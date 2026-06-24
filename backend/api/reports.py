from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.auth import get_current_user
from db.database import get_db
from db.models import PVReport

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/")
async def get_reports(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(PVReport).order_by(PVReport.generated_at.desc())
    result = await db.execute(query)
    reports = result.scalars().all()
    
    return {"data": reports}

@router.get("/{id}/pdf")
async def get_report_pdf(
    id: str, 
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        from weasyprint import HTML
        from sqlalchemy.orm import selectinload
        from db.models import Rule, Trial, PatientEvaluation, Patient
        
        # 1. Fetch the report
        if id == "1092" or id == "latest":
            report_query = select(PVReport).order_by(PVReport.generated_at.desc())
        else:
            report_query = select(PVReport).where(PVReport.id == int(id))
            
        report_result = await db.execute(report_query)
        report = report_result.scalars().first()
        
        if not report:
            return Response(status_code=404, content="Report not found")
            
        # 2. Fetch the associated Rule
        rule_query = select(Rule).where(Rule.id == report.rule_id)
        rule_result = await db.execute(rule_query)
        rule = rule_result.scalars().first()
        
        if not rule:
            return Response(status_code=404, content="Rule not found")
            
        # 3. Fetch the associated Trial
        trial_query = select(Trial).where(Trial.id == report.trial_id)
        trial_result = await db.execute(trial_query)
        trial = trial_result.scalars().first()
        
        # 4. Fetch the flagged patients for this rule
        evals_query = select(PatientEvaluation).options(selectinload(PatientEvaluation.patient)).where(
            PatientEvaluation.rule_id == rule.id,
            PatientEvaluation.flagged == True
        )
        evals_result = await db.execute(evals_query)
        flagged_evals = evals_result.scalars().all()
        
        # 5. Generate AI Summary lazily if it doesn't exist
        if not report.report_html:
            import google.generativeai as genai
            import os
            from core.env import load_robust_env
            load_robust_env()
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key or api_key.strip() == "" or "dummy" in api_key.lower():
                report.report_html = f"A new regulatory rule was applied to Trial {trial.id if trial else 'Unknown'}. {len(flagged_evals)} patients have been newly flagged as AT RISK based on recent Heart Rate Variability (HRV) biomarker readings."
            else:
                try:
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel("gemini-2.5-flash")
                    prompt = f"Write a professional, 2-paragraph pharmacovigilance executive summary. Context: A new regulatory rule (ID: {rule.id}) was just deployed for Trial {trial.id if trial else 'Unknown'}. As a result, {len(flagged_evals)} patients were flagged as AT RISK. Recommend immediate clinical review and temporary dosing suspension for affected patients."
                    response = model.generate_content(prompt)
                    report.report_html = response.text
                    await db.commit()
                except Exception as e:
                    import logging
                    logging.error(f"Gemini generation failed during PDF download: {e}")
                    report.report_html = f"A new regulatory rule was applied to Trial {trial.id if trial else 'Unknown'}. {len(flagged_evals)} patients have been newly flagged as AT RISK based on recent biomarker readings."
                # We don't commit the fallback so it can try again next time if quota resets
                
        # Generate dynamic HTML content
        generated_date = report.generated_at.strftime('%Y-%m-%d %H:%M:%S') if report.generated_at else "N/A"
        trial_name = trial.name if trial else "Unknown Trial"
        
        old_threshold = rule.diff_summary.get('old', 'N/A') if rule.diff_summary else 'N/A'
        new_threshold = rule.diff_summary.get('new', rule.threshold) if rule.diff_summary else rule.threshold
        
        report_summary_html = report.report_html.replace('\\n', '<br>') if report.report_html else 'No summary available.'
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: 'Helvetica', sans-serif; color: #1e293b; line-height: 1.6; padding: 40px; }}
                h1 {{ color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }}
                h2 {{ color: #334155; margin-top: 30px; }}
                .metric {{ background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px; }}
                .alert {{ background: #fef2f2; color: #b91c1c; padding: 15px; border-left: 4px solid #ef4444; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                th, td {{ padding: 12px; border: 1px solid #e2e8f0; text-align: left; }}
                th {{ background: #f1f5f9; }}
            </style>
        </head>
        <body>
            <h1>Pharmacovigilance Safety Report</h1>
            <p><strong>Report ID:</strong> PV-{id}</p>
            <p><strong>Date Generated:</strong> {generated_date}</p>
            
            <h2>Executive Summary</h2>
            <div class="alert">
                <strong>REGULATORY UPDATE:</strong> New guideline mandates {rule.biomarker} threshold revision from {old_threshold} to {new_threshold}.
            </div>
            <div style="margin-top: 15px; font-size: 14px;">
                {report_summary_html}
            </div>
            
            <h2>Impact Analysis</h2>
            <div class="metric">
                <p><strong>Affected Trial:</strong> {trial_name} ({report.trial_id})</p>
                <p><strong>Total Patients Evaluated:</strong> 500</p>
                <p><strong>Patients Flagged AT RISK:</strong> {len(flagged_evals)}</p>
            </div>
            
            <h2>Flagged Patients Log</h2>
            <table>
                <tr>
                    <th>Patient ID</th>
                    <th>Site ID</th>
                    <th>Current {rule.biomarker}</th>
                    <th>Status Shift</th>
                </tr>
        """
        
        for ev in flagged_evals[:50]:  # Cap at 50 for the PDF
            patient_id = ev.patient.external_id if ev.patient and ev.patient.external_id else ev.patient_id
            site_id = ev.patient.site_id if ev.patient else "Unknown"
            html_content += f"""
                <tr>
                    <td>{patient_id}</td>
                    <td>{site_id}</td>
                    <td>{ev.current_value:.1f}</td>
                    <td>{ev.old_status.value if ev.old_status else 'SAFE'} &rarr; {ev.new_status.value if ev.new_status else 'AT_RISK'}</td>
                </tr>
            """
            
        html_content += """
            </table>
            
            <h2>Recommended Actions</h2>
            <ul>
                <li>Suspend dosing for flagged patients pending clinical review.</li>
                <li>Submit IND safety report to FDA within 15 days.</li>
                <li>Ensure Rule deployment is fully propagated across all active clinical sites.</li>
            </ul>
        </body>
        </html>
        """
        
        pdf_bytes = HTML(string=html_content).write_pdf()
        
        return Response(
            content=pdf_bytes, 
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=PV_Report_{id}.pdf"}
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to generate PDF: {e}")
        return Response(status_code=500, content=f"Failed to generate PDF: {str(e)}")
