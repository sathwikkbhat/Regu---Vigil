from fastapi import APIRouter, Depends, Request, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi.responses import StreamingResponse, Response
import csv
import io
import os
import sendgrid
from sendgrid.helpers.mail import Mail, Email, To, Content
from core.auth import get_current_user
from db.database import get_db
from db.models import Patient, TrialSite

router = APIRouter(prefix="/patients", tags=["patients"])

@router.get("/stats")
async def get_patient_stats(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Fetch all patients to calculate stats
    query = select(Patient).options(selectinload(Patient.evaluations))
    result = await db.execute(query)
    patients = result.scalars().unique().all()
    
    total = len(patients)
    flagged = 0
    safe = 0
    
    # Calculate by site
    by_site = {}
    
    for p in patients:
        evals = sorted(p.evaluations, key=lambda e: e.evaluated_at) if p.evaluations else []
        latest_eval = evals[-1] if evals else None
        is_flagged = latest_eval.flagged if latest_eval else False
        
        if is_flagged:
            flagged += 1
        else:
            safe += 1
            
        site_id = p.site_id
        if site_id not in by_site:
            by_site[site_id] = {"site_id": site_id, "total": 0, "flagged": 0}
            
        by_site[site_id]["total"] += 1
        if is_flagged:
            by_site[site_id]["flagged"] += 1
            
    return {
        "total_patients": total,
        "total_flagged": flagged,
        "total_safe": safe,
        "by_site": list(by_site.values())
    }

@router.get("/")
async def get_patients(
    request: Request,
    site_id: str = Query(None),
    export: str = Query(None),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Patient).options(selectinload(Patient.evaluations), selectinload(Patient.readings))
    if site_id:
        query = query.where(Patient.site_id == site_id)
        
    result = await db.execute(query)
    patients = result.scalars().unique().all()
    
    formatted_patients = []
    for p in patients:
        # Get latest HRV
        hrv_readings = [r for r in p.readings if r.biomarker == "HRV_SDNN"]
        latest_hrv = hrv_readings[-1].value if hrv_readings else None
        
        # Get latest Heart Rate
        hr_readings = [r for r in p.readings if r.biomarker == "Heart_Rate"]
        latest_hr = hr_readings[-1].value if hr_readings else None
        
        # Get evaluation status
        evals = sorted(p.evaluations, key=lambda e: e.evaluated_at) if p.evaluations else []
        latest_eval = evals[-1] if evals else None
        is_flagged = latest_eval.flagged if latest_eval else False
        
        formatted_patients.append({
            "id": p.id,
            "external_id": p.external_id,
            "site_id": p.site_id,
            "status": p.status,
            "latest_hrv": latest_hrv,
            "latest_hr": latest_hr,
            "is_flagged": is_flagged,
            "old_status": latest_eval.old_status if latest_eval else "SAFE",
            "new_status": latest_eval.new_status if latest_eval else "SAFE",
            "enrolled_at": p.enrolled_at
        })

    if export == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Patient ID", "Site ID", "Status", "Latest HRV", "Flagged", "Enrolled At"])
        for p in formatted_patients:
            writer.writerow([p["external_id"] or p["id"], p["site_id"], p["status"], p["latest_hrv"], p["is_flagged"], p["enrolled_at"]])
        output.seek(0)
        return Response(
            content=output.getvalue(), 
            media_type="text/csv", 
            headers={"Content-Disposition": f"attachment; filename=patients_{site_id or 'all'}.csv"}
        )
        
    return {"data": formatted_patients, "site_scope": site_id}

@router.get("/{id}")
async def get_patient(
    id: str, 
    request: Request, 
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    site_id = getattr(request.state, "site_id", None)
    
    query = select(Patient).options(selectinload(Patient.evaluations), selectinload(Patient.readings)).where(Patient.id == id)
    if site_id:
        query = query.where(Patient.site_id == site_id)
        
    result = await db.execute(query)
    patient = result.scalars().unique().first()
    
    if not patient:
        return {"error": "Patient not found or unauthorized"}
        
    return {"data": patient, "site_scope": site_id}

@router.get("/{id}/readings")
async def get_patient_readings(
    id: str, 
    request: Request, 
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from db.models import BiomarkerReading
    
    query = select(BiomarkerReading).where(BiomarkerReading.patient_id == id).order_by(BiomarkerReading.recorded_at.asc())
    result = await db.execute(query)
    readings = result.scalars().all()
    
    readings_list = []
    for r in readings:
        readings_list.append({
            "biomarker": r.biomarker,
            "value": r.value,
            "unit": r.unit,
            "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None
        })
    
    return {"id": id, "readings": readings_list}

@router.get("/{id}/pdf")
async def get_patient_pdf(
    id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from fastapi import Response
    from sqlalchemy.orm import selectinload
    from db.models import Patient
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.enums import TA_LEFT, TA_CENTER

    # Normalize patient ID
    patient_id = id if id.startswith("PT-") else f"PT-{id}"

    query = select(Patient).options(selectinload(Patient.readings), selectinload(Patient.evaluations)).where(Patient.id == patient_id)
    result = await db.execute(query)
    patient = result.scalars().first()

    if not patient:
        return Response(status_code=404, content="Patient not found")

    # Derive status
    status_str = (patient.status or 'SAFE').upper()
    is_flagged = status_str == 'AT_RISK'
    status_label = 'AT RISK' if is_flagged else 'SAFE'

    # Latest biomarkers
    sorted_readings = sorted(patient.readings, key=lambda x: x.recorded_at, reverse=True) if patient.readings else []
    latest_hrv = next((r.value for r in sorted_readings if r.biomarker == 'HRV_SDNN'), None)
    latest_hr  = next((r.value for r in sorted_readings if r.biomarker == 'Heart_Rate'), None)

    hrv_assessment = 'FLAGGED' if latest_hrv is not None and latest_hrv < 28 else 'NORMAL'
    hr_assessment  = 'FLAGGED' if latest_hr is not None and latest_hr > 95 else 'NORMAL'
    hrv_value_str  = f'{latest_hrv:.1f} ms' if latest_hrv is not None else 'N/A'
    hr_value_str   = f'{latest_hr:.1f} bpm' if latest_hr is not None else 'N/A'

    # Build PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=2*cm, leftMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('title', fontSize=20, fontName='Helvetica-Bold',
                                  textColor=colors.HexColor('#0f172a'), spaceAfter=4)
    subtitle_style = ParagraphStyle('subtitle', fontSize=11, fontName='Helvetica',
                                     textColor=colors.HexColor('#64748b'), spaceAfter=12)
    section_style = ParagraphStyle('section', fontSize=10, fontName='Helvetica-Bold',
                                    textColor=colors.HexColor('#334155'), spaceBefore=16, spaceAfter=6)
    body_style = ParagraphStyle('body', fontSize=10, fontName='Helvetica',
                                  textColor=colors.HexColor('#1e293b'), spaceAfter=4)
    risk_style = ParagraphStyle('risk', fontSize=10, fontName='Helvetica-Bold',
                                  textColor=colors.HexColor('#b91c1c'), spaceAfter=4)
    safe_style = ParagraphStyle('safe', fontSize=10, fontName='Helvetica-Bold',
                                  textColor=colors.HexColor('#166534'), spaceAfter=4)

    story = []

    # Header
    story.append(Paragraph("Patient Safety Report — ICSR", title_style))
    story.append(Paragraph("Individual Case Safety Report · ReguVigil Multi-Agent Pipeline", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=12))

    # Patient info table
    info_data = [
        ['Patient ID', patient_id, 'Trial', 'GlucoZen Phase III'],
        ['Site', patient.site_id or 'Unknown', 'Status', status_label],
    ]
    info_table = Table(info_data, colWidths=[3*cm, 6*cm, 3*cm, 6*cm])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f1f5f9')),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor('#f1f5f9')),
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0,0), (-1,-1), 6),
        ('TEXTCOLOR', (3,1), (3,1), colors.HexColor('#b91c1c') if is_flagged else colors.HexColor('#166534')),
        ('FONTNAME', (3,1), (3,1), 'Helvetica-Bold'),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.4*cm))

    # Executive Summary
    story.append(Paragraph("Executive Summary", section_style))
    summary = f"This report details the clinical status of patient <b>{patient_id}</b> enrolled at <b>{patient.site_id}</b> in the GlucoZen Phase III trial."
    story.append(Paragraph(summary, body_style))
    if is_flagged:
        story.append(Paragraph("⚠ This patient has been classified AT RISK. Immediate clinical review is recommended.", risk_style))

    # Biomarker summary
    story.append(Paragraph("Latest Biomarker Summary", section_style))
    bio_data = [
        ['Metric', 'Value', 'Threshold', 'Assessment'],
        ['HRV SDNN', hrv_value_str, '< 28 ms → FLAG', hrv_assessment],
        ['Heart Rate', hr_value_str, '> 95 bpm → FLAG', hr_assessment],
    ]
    bio_table = Table(bio_data, colWidths=[4.5*cm, 3.5*cm, 5*cm, 4*cm])
    bio_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0,0), (-1,-1), 6),
        ('TEXTCOLOR', (3,1), (3,1), colors.HexColor('#b91c1c') if hrv_assessment=='FLAGGED' else colors.HexColor('#166534')),
        ('TEXTCOLOR', (3,2), (3,2), colors.HexColor('#b91c1c') if hr_assessment=='FLAGGED' else colors.HexColor('#166534')),
        ('FONTNAME', (3,1), (3,2), 'Helvetica-Bold'),
    ]))
    story.append(bio_table)
    story.append(Spacer(1, 0.4*cm))

    # Recent readings
    story.append(Paragraph("Recent Biomarker Data (Last 30 readings)", section_style))
    reading_data = [['Date', 'Biomarker', 'Value']]
    for r in sorted_readings[:30]:
        reading_data.append([
            r.recorded_at.strftime('%Y-%m-%d'),
            r.biomarker,
            f'{r.value:.2f} {r.unit}'
        ])
    reading_table = Table(reading_data, colWidths=[4*cm, 6*cm, 7*cm])
    reading_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
    ]))
    story.append(reading_table)

    # Recommended actions for AT RISK
    if is_flagged:
        story.append(Spacer(1, 0.4*cm))
        story.append(Paragraph("Recommended Actions", ParagraphStyle('rsection', fontSize=10, fontName='Helvetica-Bold',
                                                                      textColor=colors.HexColor('#b91c1c'), spaceBefore=16, spaceAfter=6)))
        for action in [
            f"Conduct immediate cardiac review of patient {patient_id}.",
            "Temporarily suspend dosing pending secondary diagnostics.",
            "Submit expedited protocol deviation notice if condition worsens."
        ]:
            story.append(Paragraph(f"• {action}", body_style))

    # Footer
    story.append(Spacer(1, 0.6*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0')))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph("Generated by ReguVigil Multi-Agent Pipeline · Gemini 2.5 Flash · ICH E6 (R2) Aligned",
                            ParagraphStyle('footer', fontSize=8, fontName='Helvetica',
                                           textColor=colors.HexColor('#94a3b8'), alignment=TA_CENTER)))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Patient_Report_{patient_id}.pdf"}
    )


@router.post("/{id}/copilot")
async def patient_copilot(
    id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Gemini-powered AI clinical assistant for a specific patient."""
    import google.generativeai as genai
    from core.env import load_robust_env
    
    load_robust_env()
    question = body.get("question", "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    # Fetch patient data
    query = select(Patient).options(selectinload(Patient.readings), selectinload(Patient.evaluations)).where(Patient.id == id)
    result = await db.execute(query)
    patient = result.scalars().unique().first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Build patient context for Gemini
    hrv_readings = sorted([r for r in patient.readings if r.biomarker == "HRV_SDNN"], key=lambda r: r.recorded_at, reverse=True)
    hr_readings = sorted([r for r in patient.readings if r.biomarker == "Heart_Rate"], key=lambda r: r.recorded_at, reverse=True)
    
    latest_hrv = hrv_readings[0].value if hrv_readings else None
    latest_hr = hr_readings[0].value if hr_readings else None
    
    # Last 7 days trend
    hrv_trend = [round(r.value, 1) for r in hrv_readings[:7]]
    hr_trend = [round(r.value, 1) for r in hr_readings[:7]]
    
    evals = sorted(patient.evaluations, key=lambda e: e.evaluated_at) if patient.evaluations else []
    latest_eval = evals[-1] if evals else None
    status = "AT RISK" if (latest_eval and latest_eval.flagged) else "SAFE"

    patient_context = f"""
Patient ID: {id}
Site: {patient.site_id or 'Unknown'}
Current Status: {status}
Latest HRV (SDNN): {f'{latest_hrv:.1f} ms' if latest_hrv else 'N/A'} (Threshold: < 28ms = AT RISK)
Latest Heart Rate: {f'{latest_hr:.1f} bpm' if latest_hr else 'N/A'} (Threshold: > 95bpm = AT RISK)
HRV trend (last 7 days, newest first): {hrv_trend}
Heart Rate trend (last 7 days, newest first): {hr_trend}
Total readings available: {len(patient.readings)}
Active regulatory rule: HRV_SDNN LT 28ms (Rule v1.3, GlucoZen Phase III trial)
"""

    system_prompt = f"""You are ReguVigil AI Copilot, an expert clinical pharmacovigilance assistant embedded in a multi-agent regulatory safety monitoring system for clinical trials.

You have access to the following real-time patient data:
{patient_context}

Answer the clinician's question concisely and clinically. Focus on:
- Interpreting the biomarker data (HRV trends, heart rate patterns)
- Regulatory implications based on the active monitoring rules
- Actionable clinical recommendations
- Risk assessment based on current values vs thresholds

Keep responses under 120 words. Be direct, specific, and medically precise. Do NOT make things up — only reference data provided above."""

    # Try Gemini AI, fall back to deterministic response
    api_key = os.getenv("GEMINI_API_KEY")
    
    if api_key and "dummy" not in api_key.lower():
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.5-flash")
            response = model.generate_content(f"{system_prompt}\n\nClinician asks: {question}")
            ai_answer = response.text.strip()
        except Exception as e:
            err = str(e).lower()
            # Fallback to deterministic response if API fails
            if latest_hrv and latest_hrv < 28:
                ai_answer = f"Patient {id} is AT RISK with HRV SDNN of {latest_hrv:.1f}ms, below the 28ms threshold. 7-day trend shows {'declining' if len(hrv_trend) > 1 and hrv_trend[0] < hrv_trend[-1] else 'stable'} values. Recommend immediate cardiology review and consideration of study drug suspension per Protocol Section 5.2."
            else:
                ai_answer = f"Patient {id} currently shows HRV SDNN of {latest_hrv:.1f if latest_hrv else 'N/A'}ms, within safe range. Continue standard monitoring. No immediate intervention required based on current biomarker readings."
    else:
        # Deterministic fallback when no API key
        if latest_hrv and latest_hrv < 28:
            ai_answer = f"⚠ ALERT: Patient {id} shows HRV SDNN of {latest_hrv:.1f}ms — below the regulatory threshold of 28ms. Trend over last 7 days: {hrv_trend}. This patient is flagged under Rule v1.3. Recommend: (1) Withhold study drug, (2) Expedited cardiology consultation, (3) Submit IND Safety Report within 15 days if cardiac event confirmed."
        elif latest_hr and latest_hr > 95:
            ai_answer = f"Patient {id} shows elevated Heart Rate of {latest_hr:.1f}bpm (>95bpm threshold). This may indicate drug-induced sympathomimetic activity. Recommend ECG confirmation and consider dose adjustment per Protocol Amendment 3."
        else:
            ai_answer = f"Patient {id} biomarkers are within acceptable ranges (HRV: {latest_hrv:.1f if latest_hrv else 'N/A'}ms, HR: {latest_hr:.1f if latest_hr else 'N/A'}bpm). Standard monitoring schedule should continue. No protocol deviations required at this time."

    return {
        "patient_id": id,
        "question": question,
        "answer": ai_answer,
        "patient_status": status,
        "latest_hrv": latest_hrv,
        "latest_hr": latest_hr
    }


@router.post("/{id}/notify")
async def notify_doctor(
    id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Find the patient's site so we can alert on ALL flagged patients at that site
    query = select(Patient).options(selectinload(Patient.evaluations), selectinload(Patient.readings)).where(Patient.id == id)
    result = await db.execute(query)
    target_patient = result.scalars().unique().first()
    if not target_patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    site_id = target_patient.site_id

    # 2. Fetch ALL patients at this site and find the flagged ones
    site_query = select(Patient).options(selectinload(Patient.evaluations), selectinload(Patient.readings)).where(Patient.site_id == site_id)
    site_result = await db.execute(site_query)
    site_patients = site_result.scalars().unique().all()

    flagged_patients = []
    for p in site_patients:
        evals = sorted(p.evaluations, key=lambda e: e.evaluated_at) if p.evaluations else []
        latest_eval = evals[-1] if evals else None
        if latest_eval and latest_eval.flagged:
            hrv_readings = [r for r in p.readings if r.biomarker == "HRV_SDNN"]
            latest_hrv = round(hrv_readings[-1].value, 1) if hrv_readings else "N/A"
            flagged_patients.append({"id": p.id, "hrv": latest_hrv})

    total_flagged = len(flagged_patients)

    # 3. Build patient rows for the email table
    patient_rows = "".join(
        f"""<tr style='border-bottom:1px solid #fee2e2'>
               <td style='padding:8px 12px;font-weight:600;color:#1e293b'>{fp['id']}</td>
               <td style='padding:8px 12px;color:#dc2626;font-weight:700'>{fp['hrv']} ms</td>
               <td style='padding:8px 12px;color:#b91c1c'>⚠ AT RISK — Below Threshold</td>
           </tr>"""
        for fp in flagged_patients
    ) or "<tr><td colspan='3' style='padding:8px 12px;color:#64748b'>No flagged patients found.</td></tr>"

    # 4. Build HTML email body
    html_body = f"""
    <html>
    <body style='font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:32px'>
      <div style='max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)'>
        <div style='background:linear-gradient(135deg,#dc2626,#b91c1c);padding:28px 32px'>
          <h1 style='color:#fff;margin:0;font-size:22px;font-weight:700'>🚨 ReguVigil Pharmacovigilance Alert</h1>
          <p style='color:#fecaca;margin:8px 0 0;font-size:14px'>Trial: GlucoZen Phase III · Site: {site_id.upper()}</p>
        </div>
        <div style='padding:28px 32px'>
          <p style='font-size:15px;color:#1e293b;margin:0 0 16px'>
            Dear Dr. Ramesh K.,<br><br>
            The ReguVigil AI pipeline has identified <strong style='color:#dc2626'>{total_flagged} patient(s)</strong> under your care at <strong>{site_id.upper()}</strong> who are currently <strong>AT RISK</strong> based on their latest HRV biomarker readings.
          </p>
          <table style='width:100%;border-collapse:collapse;margin:16px 0;border-radius:8px;overflow:hidden;border:1px solid #fee2e2'>
            <thead>
              <tr style='background:#fef2f2'>
                <th style='padding:10px 12px;text-align:left;color:#7f1d1d;font-size:13px'>Patient ID</th>
                <th style='padding:10px 12px;text-align:left;color:#7f1d1d;font-size:13px'>Latest HRV (SDNN)</th>
                <th style='padding:10px 12px;text-align:left;color:#7f1d1d;font-size:13px'>Status</th>
              </tr>
            </thead>
            <tbody>{patient_rows}</tbody>
          </table>
          <p style='font-size:14px;color:#475569;margin:16px 0'>Please log into your dashboard immediately to review these patients and take necessary clinical action.</p>
          <a href='http://localhost:3000/dashboard/doctor' style='display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:8px'>View Doctor Dashboard →</a>
        </div>
        <div style='background:#f1f5f9;padding:16px 32px;font-size:12px;color:#94a3b8'>
          This is an automated alert from the ReguVigil Pharmacovigilance AI System. Do not reply to this email.
        </div>
      </div>
    </body>
    </html>
    """

    # 5. Send email via SendGrid
    sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
    from_email_address = os.environ.get('SENDGRID_FROM_EMAIL', 'suzxxpro@gmail.com')
    doctor_email = os.environ.get('SENDGRID_TO_DOCTOR', 'sathwikbhat2@gmail.com')
    datamanager_email = os.environ.get('SENDGRID_TO_DATAMANAGER', 'drarjunbhat@gmail.com')

    if not sendgrid_api_key or sendgrid_api_key == "SG.your_sendgrid_api_key_here":
        return {"status": "success", "message": f"Simulated alert: {total_flagged} flagged patients (SendGrid key missing)", "flagged_count": total_flagged}

    recipients = [doctor_email, datamanager_email]
    try:
        sg = sendgrid.SendGridAPIClient(api_key=sendgrid_api_key)
        for recipient in recipients:
            mail = Mail(
                from_email=Email(from_email_address),
                to_emails=To(recipient),
                subject=f"🚨 URGENT: {total_flagged} Patient(s) AT RISK — Dr. Ramesh K. Site ({site_id.upper()})",
                html_content=html_body
            )
            sg.client.mail.send.post(request_body=mail.get())
        return {"status": "success", "message": f"Alert sent to {len(recipients)} recipients. {total_flagged} flagged patients reported.", "flagged_count": total_flagged}
    except Exception as e:
        print(f"SendGrid error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send notification: {str(e)}")

