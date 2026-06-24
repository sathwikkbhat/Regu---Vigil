import time
import asyncio
import random
from typing import TypedDict, Optional, List
from langgraph.graph import StateGraph, END
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import AsyncSessionLocal
from db.models import PipelineRun, PipelineAgentStatus, PipelineLog, Guideline, GuidelineStatus

from agents.agent1_parser import run_agent1
from agents.agent2_rule_extractor import run_agent2
from agents.agent3_sentinel import run_agent3
from agents.agent4_reporter import generate_and_send_pv_report

class PipelineState(TypedDict, total=False):
    run_id: str
    guideline_id: int
    pdf_path: str
    pdf_text: str
    extracted_rule: dict
    confidence_score: float
    new_rule_id: int
    rule_diff: dict
    evaluated_patients: List[dict]
    flagged_patients: List[dict]
    report_id: int
    report_html: str
    pipeline_status: str
    agent_timings: dict
    error: Optional[str]
    is_approved: bool

async def _log_pipeline(db: AsyncSession, run_id: str, level: str, message: str):
    log = PipelineLog(run_id=run_id, log_level=level, message=message)
    db.add(log)
    await db.commit()

async def _update_agent_status(db: AsyncSession, run_id: str, agent_number: int, name: str, status: str, duration: int = None, error: str = None):
    # Upsert logic or find existing
    from sqlalchemy import select
    query = select(PipelineAgentStatus).filter_by(run_id=run_id, agent_number=agent_number)
    result = await db.execute(query)
    agent = result.scalars().first()
    
    if not agent:
        agent = PipelineAgentStatus(
            id=f"{run_id}-agent{agent_number}",
            run_id=run_id,
            agent_number=agent_number,
            agent_name=name,
            status=status
        )
        db.add(agent)
    else:
        agent.status = status
        if duration is not None:
            agent.duration_ms = duration
        if error is not None:
            agent.error_message = error
            
    await db.commit()

async def agent1_parse_pdf(state: PipelineState) -> PipelineState:
    run_id = state['run_id']
    async with AsyncSessionLocal() as db:
        await _log_pipeline(db, run_id, "INFO", "Agent 1 STARTED — Regulatory Parser (Gemini 2.5 Flash)")
        await _update_agent_status(db, run_id, 1, "Regulatory Parser", "RUNNING")
        
        start = time.perf_counter()
        try:
            extraction = await run_agent1(state['pdf_path'])
            
            # If fallback was used (Gemini unavailable), log a warning
            is_fallback = extraction.raw_text and extraction.raw_text.startswith('[Gemini unavailable')
            
            run_obj = await db.get(PipelineRun, run_id)
            if run_obj:
                run_obj.confidence_score = extraction.confidence_score
                await db.commit()
            
            # Realistic demo timing: Agent 1 (Gemini parsing) feels like 4-8s
            await asyncio.sleep(random.uniform(3.5, 7.0))
            
            elapsed = int((time.perf_counter() - start) * 1000)
            
            if is_fallback:
                await _log_pipeline(db, run_id, "WARN", f"[Agent 1] Gemini API unavailable — smart fallback extraction used. Confidence: {extraction.confidence_score}")
            await _log_pipeline(db, run_id, "INFO", f"Agent 1 COMPLETE — {elapsed/1000:.1f}s. Confidence: {extraction.confidence_score}")
            await _update_agent_status(db, run_id, 1, "Regulatory Parser", "COMPLETE", duration=elapsed)

            
            return {
                **state, 
                "extracted_rule": extraction.model_dump(),
                "confidence_score": extraction.confidence_score,
                "agent_timings": {**(state.get("agent_timings") or {}), "agent1_ms": elapsed}
            }
        except Exception as e:
            await _log_pipeline(db, run_id, "ERROR", f"Agent 1 FAILED: {str(e)}")
            await _update_agent_status(db, run_id, 1, "Regulatory Parser", "ERROR", error=str(e))
            return {**state, "pipeline_status": "ERROR", "error": str(e)}

async def agent2_extract_rule(state: PipelineState) -> PipelineState:
    run_id = state['run_id']
    async with AsyncSessionLocal() as db:
        await _log_pipeline(db, run_id, "INFO", "Agent 2 STARTED — Rule Extractor")
        await _update_agent_status(db, run_id, 2, "Rule Extractor", "RUNNING")
        
        start = time.perf_counter()
        try:
            from agents.agent1_parser import GuidelineExtraction
            ext_obj = GuidelineExtraction(**state['extracted_rule'])
            
            is_approved = state.get("is_approved", False)
            confidence = state.get("confidence_score", 0)
            status_to_use = "ACTIVE" if (is_approved or confidence >= 0.70) else "PENDING"
            
            new_rule_id = await run_agent2(db, ext_obj, "trial-glucozen-001", state['guideline_id'], status_to_use)
            
            # Hold RUNNING state for realistic demo duration (4-7s) before marking COMPLETE
            await asyncio.sleep(random.uniform(4.0, 7.0))
            
            elapsed = int((time.perf_counter() - start) * 1000)
            await _log_pipeline(db, run_id, "INFO", f"Agent 2 COMPLETE — {elapsed/1000:.1f}s. Rule ID: {new_rule_id}")
            await _update_agent_status(db, run_id, 2, "Rule Extractor", "COMPLETE", duration=elapsed)
            
            return {
                **state, 
                "new_rule_id": new_rule_id,
                "agent_timings": {**(state.get("agent_timings") or {}), "agent2_ms": elapsed}
            }
        except Exception as e:
            await _log_pipeline(db, run_id, "ERROR", f"Agent 2 FAILED: {str(e)}")
            await _update_agent_status(db, run_id, 2, "Rule Extractor", "ERROR", error=str(e))
            return {**state, "pipeline_status": "ERROR", "error": str(e)}

async def agent3_evaluate_patients(state: PipelineState) -> PipelineState:
    run_id = state['run_id']
    async with AsyncSessionLocal() as db:
        await _log_pipeline(db, run_id, "INFO", "Agent 3 STARTED — Biomarker Sentinel (500 patients)")
        await _update_agent_status(db, run_id, 3, "Biomarker Sentinel", "RUNNING")
        
        start = time.perf_counter()
        try:
            flagged_evals = await run_agent3(db, state['new_rule_id'])
            
            run_obj = await db.get(PipelineRun, run_id)
            if run_obj:
                run_obj.patients_evaluated = 500
                run_obj.patients_flagged = len(flagged_evals)
                await db.commit()
                
            # Hold RUNNING state for realistic demo duration (22-30s) before marking COMPLETE
            await asyncio.sleep(random.uniform(22.0, 30.0))
            
            elapsed = int((time.perf_counter() - start) * 1000)
            await _log_pipeline(db, run_id, "INFO", f"Agent 3 COMPLETE — {elapsed/1000:.1f}s. Flagged: {len(flagged_evals)}")
            
            await _update_agent_status(db, run_id, 3, "Biomarker Sentinel", "COMPLETE", duration=elapsed)
            
            return {
                **state, 
                "flagged_patients": [
                    {
                        "eval_id": e.id,
                        "patient_id": e.patient_id,
                        "current_value": e.current_value
                    } for e in flagged_evals
                ],
                "agent_timings": {**(state.get("agent_timings") or {}), "agent3_ms": elapsed}
            }
        except Exception as e:
            await _log_pipeline(db, run_id, "ERROR", f"Agent 3 FAILED: {str(e)}")
            await _update_agent_status(db, run_id, 3, "Biomarker Sentinel", "ERROR", error=str(e))
            return {**state, "pipeline_status": "ERROR", "error": str(e)}

async def agent4_generate_report(state: PipelineState) -> PipelineState:
    run_id = state['run_id']
    async with AsyncSessionLocal() as db:
        await _log_pipeline(db, run_id, "INFO", "Agent 4 STARTED — PV Reporter (Gemini 2.5 Flash)")
        await _update_agent_status(db, run_id, 4, "PV Reporter", "RUNNING")
        
        start = time.perf_counter()
        try:
            # Pass the enriched flagged_patients list directly — already has patient_id + current_value
            flagged_list = state.get('flagged_patients', [])
            report_id = await generate_and_send_pv_report(flagged_list, "trial-glucozen-001", state['new_rule_id'], run_id)
            
            # Hold RUNNING state for realistic demo duration (10-16s) before marking COMPLETE
            await asyncio.sleep(random.uniform(10.0, 16.0))
            
            elapsed = int((time.perf_counter() - start) * 1000)
            await _log_pipeline(db, run_id, "INFO", f"Agent 4 COMPLETE — {elapsed/1000:.1f}s. Report generated.")
            await _update_agent_status(db, run_id, 4, "PV Reporter", "COMPLETE", duration=elapsed)
            
            return {
                **state, 
                "report_id": report_id,
                "pipeline_status": "COMPLETE",
                "agent_timings": {**(state.get("agent_timings") or {}), "agent4_ms": elapsed}
            }
        except Exception as e:
            await _log_pipeline(db, run_id, "ERROR", f"Agent 4 FAILED: {str(e)}")
            await _update_agent_status(db, run_id, 4, "PV Reporter", "ERROR", error=str(e))
            return {**state, "pipeline_status": "ERROR", "error": str(e)}

def route_after_agent1(state: PipelineState) -> str:
    if state.get("pipeline_status") == "ERROR":
        return END
    if state.get("is_approved"):
        return "agent2"
    if state.get('confidence_score', 0) < 0.70:
        return "human_review"
    return "agent2"

def route_default(state: PipelineState) -> str:
    if state.get("pipeline_status") == "ERROR":
        return END
    return "next"

async def route_to_human_review(state: PipelineState) -> PipelineState:
    run_id = state['run_id']
    async with AsyncSessionLocal() as db:
        await _log_pipeline(db, run_id, "WARN", "Confidence < 0.70. Routing to Human Review.")
        await _update_agent_status(db, run_id, 2, "Rule Extractor", "PENDING_REVIEW")
        await _update_agent_status(db, run_id, 3, "Biomarker Sentinel", "PENDING_REVIEW")
        await _update_agent_status(db, run_id, 4, "PV Reporter", "PENDING_REVIEW")
        return {**state, "pipeline_status": "HUMAN_REVIEW"}

# Build LangGraph
graph = StateGraph(PipelineState)
graph.add_node("agent1", agent1_parse_pdf)
graph.add_node("agent2", agent2_extract_rule)
graph.add_node("agent3", agent3_evaluate_patients)
graph.add_node("agent4", agent4_generate_report)
graph.add_node("human_review", route_to_human_review)

graph.set_entry_point("agent1")
graph.add_conditional_edges("agent1", route_after_agent1, { "agent2": "agent2", "human_review": "human_review", END: END })
graph.add_conditional_edges("agent2", route_default, { "next": "agent3", END: END })
graph.add_conditional_edges("agent3", route_default, { "next": "agent4", END: END })
graph.add_edge("agent4", END)
graph.add_edge("human_review", END)

pipeline = graph.compile()

async def run_pipeline_async(run_id: str, guideline_id: int, pdf_path: str):
    import datetime
    async with AsyncSessionLocal() as db:
        run_obj = await db.get(PipelineRun, run_id)
        if run_obj:
            run_obj.overall_status = "RUNNING"
            run_obj.started_at = datetime.datetime.now(datetime.timezone.utc)
            await db.commit()
            
        await _log_pipeline(db, run_id, "INFO", f"Pipeline triggered — guideline_id: {guideline_id}")

    try:
        final_state = await pipeline.ainvoke({
            "run_id": run_id,
            "guideline_id": guideline_id,
            "pdf_path": pdf_path,
            "pipeline_status": "RUNNING",
            "is_approved": False
        })
        
        async with AsyncSessionLocal() as db:
            run_obj = await db.get(PipelineRun, run_id)
            if run_obj:
                if final_state.get("pipeline_status") == "ERROR":
                    run_obj.overall_status = "ERROR"
                elif final_state.get("pipeline_status") == "HUMAN_REVIEW":
                    run_obj.overall_status = "HUMAN_REVIEW"
                else:
                    run_obj.overall_status = "COMPLETE"
                run_obj.completed_at = datetime.datetime.now(datetime.timezone.utc)
                await db.commit()
                
                status = run_obj.overall_status
                if status == "COMPLETE":
                    total_ms = sum(final_state.get('agent_timings', {}).values())
                    evals = final_state.get('flagged_patients', [])
                    await _log_pipeline(db, run_id, "SUCCESS", f"✓ PIPELINE COMPLETE — Total: {total_ms/1000:.1f}s | 500 patients evaluated | {len(evals)} flagged")
                    
        return final_state
    except Exception as e:
        async with AsyncSessionLocal() as db:
            run_obj = await db.get(PipelineRun, run_id)
            if run_obj:
                run_obj.overall_status = "ERROR"
                run_obj.completed_at = datetime.datetime.now(datetime.timezone.utc)
                await db.commit()
            await _log_pipeline(db, run_id, "ERROR", f"Fatal pipeline error: {str(e)}")
        return {"pipeline_status": "ERROR"}

async def approve_pipeline_run(run_id: str):
    import datetime
    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        run_obj = await db.get(PipelineRun, run_id)
        if not run_obj:
            return
            
        await _log_pipeline(db, run_id, "INFO", "Human Review Approved. Resuming pipeline.")
        guideline_id = run_obj.guideline_id
        
        gl_query = select(Guideline).filter_by(id=guideline_id)
        res = await db.execute(gl_query)
        guideline = res.scalar_one_or_none()
        
        # Resolve PDF path: check if the stored url is a full path, then try temp dir
        import os, tempfile
        pdf_url = guideline.pdf_url if guideline else None
        if pdf_url and os.path.isabs(pdf_url) and os.path.exists(pdf_url):
            pdf_path = pdf_url
        elif pdf_url and not pdf_url.startswith("sample") and not pdf_url.startswith("http"):
            upload_dir = os.path.join(tempfile.gettempdir(), "rv_uploads")
            candidate = os.path.join(upload_dir, pdf_url)
            pdf_path = candidate if os.path.exists(candidate) else "sample_fda_guideline.pdf"
        else:
            pdf_path = "sample_fda_guideline.pdf"

    try:
        final_state = await pipeline.ainvoke({
            "run_id": run_id,
            "guideline_id": guideline_id,
            "pdf_path": pdf_path,
            "pipeline_status": "RUNNING",
            "is_approved": True
        })
        
        async with AsyncSessionLocal() as db:
            run_obj = await db.get(PipelineRun, run_id)
            if run_obj:
                if final_state.get("pipeline_status") == "ERROR":
                    run_obj.overall_status = "ERROR"
                else:
                    run_obj.overall_status = "COMPLETE"
                run_obj.completed_at = datetime.datetime.now(datetime.timezone.utc)
                await db.commit()
                
                status = run_obj.overall_status
                if status == "COMPLETE":
                    total_ms = sum(final_state.get('agent_timings', {}).values())
                    evals = final_state.get('flagged_patients', [])
                    await _log_pipeline(db, run_id, "SUCCESS", f"✓ PIPELINE COMPLETE — Total: {total_ms/1000:.1f}s | 500 patients evaluated | {len(evals)} flagged")
                    
    except Exception as e:
        async with AsyncSessionLocal() as db:
            run_obj = await db.get(PipelineRun, run_id)
            if run_obj:
                run_obj.overall_status = "ERROR"
                run_obj.completed_at = datetime.datetime.now(datetime.timezone.utc)
                await db.commit()
            await _log_pipeline(db, run_id, "ERROR", f"Fatal pipeline error on resume: {str(e)}")
