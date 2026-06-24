import google.generativeai as genai
import os
from pydantic import BaseModel
from typing import Literal, List, Optional
import asyncio
import httpx
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

# Model configured dynamically inside run_agent1
model = None

# ── Schema passed to Gemini (must be clean — no Optional/defaults) ──────────
class _GeminiSchema(BaseModel):
    biomarker: str
    operator: Literal["LT", "GT", "LTE", "GTE"]
    old_value: float
    new_value: float
    unit: str
    duration_days: int
    trial_phases: List[str]
    effective_date: str
    confidence_score: float
    source_url: str
    page_reference: str
    is_relevant: bool

# ── Flexible model used everywhere else in the app ───────────────────────────
class GuidelineExtraction(BaseModel):
    biomarker: str
    operator: Literal["LT", "GT", "LTE", "GTE"]
    old_value: Optional[float] = 0.0
    new_value: float
    unit: Optional[str] = "ms"
    duration_days: Optional[int] = 30
    trial_phases: Optional[List[str]] = ["Phase III"]
    effective_date: Optional[str] = "N/A"
    confidence_score: float
    source_url: Optional[str] = ""
    page_reference: Optional[str] = ""
    raw_text: Optional[str] = ""

BIOMARKER_MAP = {
    "heart rate variability": "HRV_SDNN",
    "hrv": "HRV_SDNN",
    "hrv sdnn": "HRV_SDNN",
    "hrv_sdnn": "HRV_SDNN",
    "heart rate variability (hrv sdnn)": "HRV_SDNN",
    "spo2": "SpO2",
    "oxygen saturation": "SpO2",
    "blood oxygen": "SpO2",
    "heart rate": "Heart_Rate",
    "heart_rate": "Heart_Rate",
    "pulse rate": "Heart_Rate",
    "pulse": "Heart_Rate",
    "resting heart rate": "Heart_Rate",
}

# Pre-baked results and fallbacks removed for genuine Gemini analysis.

def extract_text_from_pdf(filepath_or_url: str) -> str:
    if not fitz:
        raise ImportError("PyMuPDF (fitz) is not installed. PDF extraction failed.")
    text = ""
    try:
        doc = fitz.open(filepath_or_url)
        for page in doc:
            text += page.get_text()
    except Exception as e:
        print(f"Failed to read PDF: {e}")
        raise e
    return text

async def run_agent1(pdf_source: str) -> GuidelineExtraction:
    from core.env import load_robust_env
    load_robust_env()
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key or api_key.strip() == "" or "dummy" in api_key.lower():
        raise ValueError("GEMINI_API_KEY is not configured in the environment. Please add a valid Gemini API key to your .env file.")
        
    raw_text = extract_text_from_pdf(pdf_source)
    if not raw_text.strip():
        raise ValueError("Could not extract any text from the document. Please ensure you upload a valid, readable .pdf file.")

    prompt = f"""
    You are an expert regulatory parser for pharmacovigilance systems. Extract the biomarker safety rule
    from the following regulatory document text.

    TEXT:
    {raw_text}

    Extract the primary monitoring rule change. For the 'biomarker' field, use EXACTLY one of these codes:
    - "HRV_SDNN"  (for Heart Rate Variability / HRV / SDNN)
    - "SpO2"      (for Oxygen Saturation / SpO2)
    - "Heart_Rate" (for Heart Rate / Pulse / Beats per minute)

    For the 'operator' field use exactly: "LT" (less than), "GT" (greater than), "LTE", or "GTE".

    For 'confidence_score': a float 0.0-1.0 representing how clearly and unambiguously the rule is stated.
    High confidence (0.85+) = explicit threshold with exact numbers stated.
    Low confidence (below 0.65) = ambiguous, draft, contradictory, or missing specific numbers.

    If a field value cannot be determined, use sensible defaults (0.0 for floats, empty string for str, 30 for duration_days).
    
    CRITICAL INSTRUCTION: Analyze the text to see if it is a genuine regulatory document or pharmacovigilance guideline. If the text is completely unrelated (e.g. a resume, random article, blank document), set `is_relevant` to false. Otherwise, set it to true.
    """

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=_GeminiSchema
            )
        )

        raw = _GeminiSchema.model_validate_json(response.text)
        
        if not raw.is_relevant:
            raise ValueError("IRRELEVANT_DOCUMENT: This document does not appear to be a valid regulatory guideline or pharmacovigilance safety update.")
            
        extraction = GuidelineExtraction(
            biomarker=raw.biomarker,
            operator=raw.operator,
            old_value=raw.old_value,
            new_value=raw.new_value,
            unit=raw.unit or "ms",
            duration_days=raw.duration_days or 30,
            trial_phases=raw.trial_phases or ["Phase III"],
            effective_date=raw.effective_date or "N/A",
            confidence_score=raw.confidence_score,
            source_url=raw.source_url or "",
            page_reference=raw.page_reference or "",
        )

        normalized = BIOMARKER_MAP.get(extraction.biomarker.lower().strip())
        if normalized:
            extraction = extraction.model_copy(update={"biomarker": normalized})
        return extraction

    except Exception as e:
        print(f"Gemini Agent 1 error: {e}")
        raise e


