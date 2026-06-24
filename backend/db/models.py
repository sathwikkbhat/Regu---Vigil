from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, JSON, Boolean, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base

class GuidelineStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"
    HUMAN_REVIEW = "HUMAN_REVIEW"

class RuleStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUPERSEDED = "SUPERSEDED"
    PENDING = "PENDING"

class EvaluationStatus(str, enum.Enum):
    SAFE = "SAFE"
    AT_RISK = "AT_RISK"
    CRITICAL = "CRITICAL"
    BORDERLINE = "BORDERLINE"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"

class Guideline(Base):
    __tablename__ = "guidelines"
    
    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, index=True)
    pdf_url = Column(String)
    pdf_hash = Column(String, unique=True, index=True)
    status = Column(Enum(GuidelineStatus), default=GuidelineStatus.PENDING)
    raw_text_path = Column(String)
    uploaded_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Rule(Base):
    __tablename__ = "monitoring_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String)
    trial_id = Column(String, index=True)
    biomarker = Column(String, index=True)
    operator = Column(String)
    threshold = Column(Float)
    status = Column(Enum(RuleStatus), default=RuleStatus.PENDING)
    diff_summary = Column(JSON)
    source_guideline_id = Column(Integer, ForeignKey("guidelines.id"))
    manually_approved = Column(Boolean, default=False)
    confidence_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Trial(Base):
    __tablename__ = "trials"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    sponsor_org_id = Column(String)
    phase = Column(String)
    indication = Column(String)
    status = Column(String)
    enrolled_count = Column(Integer, default=0)
    sites_count = Column(Integer, default=0)

class TrialSite(Base):
    __tablename__ = "trial_sites"
    
    id = Column(String, primary_key=True, index=True)
    trial_id = Column(String, ForeignKey("trials.id"))
    hospital_name = Column(String)
    city = Column(String)
    country = Column(String)
    pi_user_id = Column(String)
    patient_count = Column(Integer, default=0)
    status = Column(String)

class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(String, primary_key=True, index=True)
    trial_id = Column(String, ForeignKey("trials.id"))
    site_id = Column(String, ForeignKey("trial_sites.id"))
    external_id = Column(String, unique=True, index=True)
    enrolled_at = Column(DateTime(timezone=True))
    status = Column(String)
    device_id = Column(String)
    
    readings = relationship("BiomarkerReading", backref="patient")
    evaluations = relationship("PatientEvaluation", backref="patient")

class BiomarkerReading(Base):
    __tablename__ = "biomarker_readings"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.id"))
    biomarker = Column(String, index=True)
    value = Column(Float)
    unit = Column(String)
    recorded_at = Column(DateTime(timezone=True), index=True)
    device_id = Column(String)
    source = Column(String)
    quality_flag = Column(String)

class PatientEvaluation(Base):
    __tablename__ = "patient_evaluations"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.id"))
    rule_id = Column(Integer, ForeignKey("monitoring_rules.id"))
    old_rule_id = Column(Integer)
    old_status = Column(Enum(EvaluationStatus))
    new_status = Column(Enum(EvaluationStatus))
    current_value = Column(Float)
    flagged = Column(Boolean, default=False)
    evaluation_triggered_by = Column(String)
    evaluated_at = Column(DateTime(timezone=True), server_default=func.now())

class PVReport(Base):
    __tablename__ = "pv_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    trial_id = Column(String, ForeignKey("trials.id"))
    triggered_by_guideline_id = Column(Integer, ForeignKey("guidelines.id"))
    rule_id = Column(Integer, ForeignKey("monitoring_rules.id"))
    run_id = Column(String, ForeignKey("pipeline_runs.id"))
    severity_breakdown = Column(JSON)
    status = Column(String)
    pdf_path = Column(String)
    report_html = Column(String)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    role = Column(String)
    org_id = Column(String)
    site_id = Column(String, nullable=True)
    trial_ids = Column(JSON)  # stored as JSON array for SQLite compatibility
    last_login_at = Column(DateTime(timezone=True))
    hashed_password = Column(String)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String, index=True)
    record_id = Column(String)
    action = Column(String)
    old_value = Column(JSON)
    new_value = Column(JSON)
    performed_by = Column(String)
    performed_at = Column(DateTime(timezone=True), server_default=func.now())

class PipelineRun(Base):
    __tablename__ = "pipeline_runs"
    
    id = Column(String, primary_key=True, index=True)
    guideline_id = Column(Integer, ForeignKey("guidelines.id"))
    overall_status = Column(String, default='IDLE')
    confidence_score = Column(Float, nullable=True)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    patients_evaluated = Column(Integer, default=0)
    patients_flagged = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PipelineAgentStatus(Base):
    __tablename__ = "pipeline_agent_status"
    
    id = Column(String, primary_key=True, index=True)
    run_id = Column(String, ForeignKey("pipeline_runs.id"))
    agent_number = Column(Integer)
    agent_name = Column(String)
    status = Column(String, default='IDLE')
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    duration_ms = Column(Integer)
    error_message = Column(String)

class PipelineLog(Base):
    __tablename__ = "pipeline_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String, ForeignKey("pipeline_runs.id"))
    logged_at = Column(DateTime(timezone=True), server_default=func.now())
    log_level = Column(String, default='INFO')
    message = Column(String)
