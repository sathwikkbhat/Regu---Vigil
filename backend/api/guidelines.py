from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.auth import get_current_user
from db.database import get_db
from db.models import Guideline, GuidelineStatus

router = APIRouter(prefix="/guidelines", tags=["guidelines"])

@router.get("/")
async def get_guidelines(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Guideline).order_by(Guideline.created_at.desc())
    result = await db.execute(query)
    guidelines = result.scalars().all()
    
    return {"data": guidelines}

from fastapi import BackgroundTasks
from agents.pipeline import run_pipeline_async
import uuid
import os
from datetime import datetime, timezone
from db.models import PipelineRun

@router.get("/stats/count")
async def get_guideline_stats(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func
    # Example stats: total guidelines processed
    query = select(func.count(Guideline.id)).where(Guideline.status == GuidelineStatus.PROCESSED)
    result = await db.execute(query)
    count = result.scalar()
    return {"processed": count, "pending": 0}

@router.post("/upload")
async def upload_guideline(
    file: UploadFile = File(None),
    pdf_url: str = Form(None),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    import hashlib
    import uuid
    import os
    import fitz
    import asyncio
    import tempfile
    
    # Platform-agnostic temp directory (works on Windows + Linux/Docker)
    UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "rv_uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    user_id = user.get("sub") if user else None
    
    if file:
        content = await file.read()
        if not content:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        pdf_hash = hashlib.sha256(content).hexdigest()
        
        # Save file to UPLOAD_DIR with UUID filename
        filename = f"{uuid.uuid4()}.pdf"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as f:
            f.write(content)
            
        # Extract text using PyMuPDF: fitz.open(filepath)
        text = ""
        try:
            doc = fitz.open(file_path)
            for page in doc:
                text += page.get_text()
        except Exception as e:
            print(f"[Upload] PyMuPDF extraction failed: {e}")
            
        # Save extracted text to a raw text file
        txt_filename = f"{uuid.uuid4()}.txt"
        txt_file_path = os.path.join(UPLOAD_DIR, txt_filename)
        with open(txt_file_path, "w", encoding="utf-8") as f:
            f.write(text)
            
        source_name = "MANUAL_UPLOAD"
    else:
        # Fallback/default behavior if no file is provided
        filename = "sample_fda_guideline.pdf"
        file_path = filename # root directory
        if not os.path.exists(file_path):
            # Create a simple PDF if none exists
            from reportlab.pdfgen import canvas
            c = canvas.Canvas(file_path)
            c.drawString(100, 750, "FDA GUIDANCE DOCUMENT")
            c.save()
            
        with open(file_path, "rb") as f:
            content = f.read()
        pdf_hash = hashlib.sha256(content).hexdigest()
        txt_file_path = "sample_fda_guideline.txt"
        source_name = "URL_IMPORT"

    # Query if already exists
    query = select(Guideline).where(Guideline.pdf_hash == pdf_hash)
    result = await db.execute(query)
    existing_guideline = result.scalars().first()
    
    if existing_guideline:
        guideline_id = existing_guideline.id
        existing_guideline.pdf_url = file_path  # store full path
        existing_guideline.raw_text_path = txt_file_path
        existing_guideline.uploaded_by = user_id
        await db.commit()
    else:
        new_guideline = Guideline(
            source=source_name,
            pdf_url=file_path,  # store full path so pipeline can find it
            pdf_hash=pdf_hash,
            status=GuidelineStatus.PENDING,
            raw_text_path=txt_file_path,
            uploaded_by=user_id
        )
        db.add(new_guideline)
        await db.commit()
        await db.refresh(new_guideline)
        guideline_id = new_guideline.id
    
    # Always create a new run record
    run_id = f"run_{uuid.uuid4().hex[:8]}"
    new_run = PipelineRun(
        id=run_id,
        guideline_id=guideline_id,
        overall_status="PENDING",
        started_at=datetime.now(timezone.utc)
    )
    db.add(new_run)
    await db.commit()
    
    # Trigger the 4-agent pipeline asynchronously using asyncio.create_task
    # Do NOT wait for pipeline to complete
    asyncio.create_task(run_pipeline_async(run_id, guideline_id, file_path))
    
    return {
        "guideline_id": guideline_id,
        "status": "PIPELINE_STARTED",
        "run_id": run_id
    }

@router.get("/{id}")
async def get_guideline(
    id: int, 
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Guideline).where(Guideline.id == id)
    result = await db.execute(query)
    guideline = result.scalars().first()
    
    if not guideline:
        return {"error": "Guideline not found"}
        
    return {"data": guideline}
