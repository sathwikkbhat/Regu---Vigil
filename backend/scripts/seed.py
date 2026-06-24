import asyncio
import sys
import os
import random
import datetime
import math
from passlib.context import CryptContext

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from db.models import (
    Base, User, Trial, TrialSite, Patient, BiomarkerReading, 
    Rule, Guideline, PVReport, RuleStatus, GuidelineStatus
)

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL or "postgresql" not in DATABASE_URL:
    _db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reguvigil_local.db")
    DATABASE_URL = f"sqlite+aiosqlite:///{_db_path}"
    print(f"[Seed] Using SQLite: {_db_path}")
else:
    print(f"[Seed] Using PostgreSQL")

_engine_kwargs = {"echo": False}
if DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
engine = create_async_engine(DATABASE_URL, **_engine_kwargs)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_db():
    print("Seeding database...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text
        # Use DELETE instead of TRUNCATE for SQLite compatibility
        for table in ["pipeline_logs", "pipeline_agent_status", "pipeline_runs", "audit_logs",
                      "patient_evaluations", "biomarker_readings", "patients", "pv_reports",
                      "monitoring_rules", "guidelines", "trial_sites", "trials", "users"]:
            try:
                await conn.execute(text(f"DELETE FROM {table}"))
            except Exception:
                pass  # table may not exist yet


    async with AsyncSessionLocal() as db:
        
        # 1. Users
        print("Seeding Users...")
        users = [
            User(id="usr-1", email="priya@reguvigil.com", name="Priya S.", role="REGULATORY_AFFAIRS", hashed_password="dummy_hash"),
            User(id="usr-2", email="arjun@reguvigil.com", name="Arjun M.", role="DATA_MANAGER", hashed_password="dummy_hash"),
            User(id="usr-3", email="ramesh@apollochennai.com", name="Dr. Ramesh K.", role="DOCTOR", site_id="site-3", hashed_password="dummy_hash")
        ]
        db.add_all(users)
        
        # 2. Trial
        print("Seeding Trial...")
        trial = Trial(
            id="trial-glucozen-001", 
            name="GlucoZen Phase III", 
            sponsor_org_id="org-iqvia", 
            phase="III",
            status="ACTIVE"
        )
        db.add(trial)
        await db.flush()
        
        # 3. Sites
        print("Seeding Sites...")
        sites_data = [
            { "id": "site-1", "name": "MGH Boston", "city": "Boston", "country": "USA", "pi": "Dr. Sarah Chen" },
            { "id": "site-2", "name": "AIIMS New Delhi", "city": "New Delhi", "country": "India", "pi": "Dr. Vikram Nair" },
            { "id": "site-3", "name": "Apollo Hospitals", "city": "Chennai", "country": "India", "pi": "Dr. Ramesh K." },
            { "id": "site-4", "name": "Fortis Mumbai", "city": "Mumbai", "country": "India", "pi": "Dr. Priya Iyer" },
            { "id": "site-5", "name": "Cleveland Clinic", "city": "Cleveland", "country": "USA", "pi": "Dr. James Okafor" },
            { "id": "site-6", "name": "NIMHANS Bangalore", "city": "Bangalore", "country": "India", "pi": "Dr. Anjali Rao" },
            { "id": "site-7", "name": "KEM Hospital", "city": "Pune", "country": "India", "pi": "Dr. Suresh Patil" },
            { "id": "site-8", "name": "Mayo Clinic", "city": "Rochester", "country": "USA", "pi": "Dr. Laura Kim" },
            { "id": "site-9", "name": "CMC Vellore", "city": "Vellore", "country": "India", "pi": "Dr. Thomas George" },
            { "id": "site-10", "name": "Johns Hopkins", "city": "Baltimore", "country": "USA", "pi": "Dr. Michael Torres" }
        ]
        sites = []
        for s in sites_data:
            site = TrialSite(
                id=s["id"], trial_id="trial-glucozen-001", hospital_name=s["name"], 
                city=s["city"], country=s["country"], pi_user_id=s["pi"],
                patient_count=50, status="ACTIVE"
            )
            sites.append(site)
        db.add_all(sites)
        await db.flush()
        
        # 4. Patients
        print("Seeding Patients...")
        patients = []
        patient_idx = 1
        
        # Add special patients
        special_patients = [
            {"id": "PT-8091", "site": "site-3", "target_hrv": 24, "age": 62, "gender": "Female"},
            {"id": "PT-8102", "site": "site-3", "target_hrv": 26, "age": 58, "gender": "Male"},
            {"id": "PT-8399", "site": "site-8", "target_hrv": 27.5, "age": 67, "gender": "Male"},
        ]
        
        for sp in special_patients:
            p = Patient(id=sp["id"], trial_id="trial-glucozen-001", site_id=sp["site"], status="ACTIVE")
            patients.append(p)
            
        # Add normal patients to reach 500
        for i in range(497):
            site_id = f"site-{random.randint(1, 10)}"
            p_id = f"PT-{1000 + patient_idx}"
            if p_id not in ["PT-8091", "PT-8102", "PT-8399"]:
                p = Patient(id=p_id, trial_id="trial-glucozen-001", site_id=site_id, status="ACTIVE")
                patients.append(p)
            patient_idx += 1
            
        db.add_all(patients)
        await db.flush()
        
        # 5. Biomarker Readings
        print("Seeding 30 days of HRV readings for 500 patients...")
        readings = []
        today = datetime.datetime.now()
        
        for p in patients:
            is_special = next((sp for sp in special_patients if sp["id"] == p.id), None)
            base_hrv = random.uniform(32, 40)
            
            for day in range(30, -1, -1):
                reading_date = today - datetime.timedelta(days=day)
                
                if is_special:
                    # AT RISK patients: trend downward over last 7 days
                    if day <= 7:
                        drop = (7 - day) * ((base_hrv - is_special["target_hrv"]) / 7.0)
                        val = base_hrv - drop + random.gauss(0, 0.5)
                    else:
                        val = base_hrv + math.sin(day/7.0)*2 + random.gauss(0, 1.0)
                else:
                    # Normal patients - randomize some to be very close to the threshold (29-33) to allow dynamic flagging
                    is_borderline = random.random() < 0.15 # 15% of patients are borderline
                    if is_borderline and day <= 7:
                        val = random.uniform(28.5, 33.5) + random.gauss(0, 0.5)
                    else:
                        val = base_hrv + math.sin(day/7.0)*2 + random.gauss(0, 1.5)
                
                # Also generate random Heart_Rate readings for the new Tachycardia PDF
                hr_val = random.uniform(60, 90) + random.gauss(0, 2)
                if random.random() < 0.08: # 8% are tachycardic
                    hr_val = random.uniform(92, 102)
                    
                readings.append(BiomarkerReading(
                    patient_id=p.id,
                    biomarker="HRV_SDNN",
                    value=round(val, 2),
                    unit="ms",
                    recorded_at=reading_date
                ))
                readings.append(BiomarkerReading(
                    patient_id=p.id,
                    biomarker="Heart_Rate",
                    value=round(hr_val, 2),
                    unit="bpm",
                    recorded_at=reading_date
                ))
                
        # Batch insert readings
        for i in range(0, len(readings), 1000):
            db.add_all(readings[i:i+1000])
            await db.flush()
            
        # 6. Guidelines
        print("Seeding Guidelines...")
        guidelines = [
            Guideline(id=1, source="FDA", pdf_url="https://fda.gov/guidance/cardiac-safety-2026", status=GuidelineStatus.PROCESSED),
            Guideline(id=2, source="EMA", pdf_url="https://ema.europa.eu/spO2-2026", status=GuidelineStatus.HUMAN_REVIEW)
        ]
        db.add_all(guidelines)
        await db.flush()
        
        # 7. Rules
        print("Seeding Rules...")
        rules = [
            Rule(id=1, version="v1.1", biomarker="HRV_SDNN", operator="LT", threshold=22, status=RuleStatus.SUPERSEDED, source_guideline_id=1, trial_id="trial-glucozen-001"),
            Rule(id=2, version="v1.2", biomarker="HRV_SDNN", operator="LT", threshold=25, status=RuleStatus.SUPERSEDED, source_guideline_id=1, trial_id="trial-glucozen-001"),
            Rule(id=3, version="v1.3", biomarker="HRV_SDNN", operator="LT", threshold=28, status=RuleStatus.ACTIVE, source_guideline_id=1, trial_id="trial-glucozen-001")
        ]
        db.add_all(rules)
        await db.flush()
        
        # 8. PV Report
        print("Seeding PV Report...")
        report = PVReport(
            id=1092,
            trial_id="trial-glucozen-001",
            triggered_by_guideline_id=1,
            rule_id=3,
            status="PENDING_SPONSOR_REVIEW"
        )
        db.add(report)
        
        await db.commit()
        
        # Reset sequences (PostgreSQL only — silently skipped on SQLite)
        from sqlalchemy import text
        try:
            await db.execute(text("SELECT setval('guidelines_id_seq', (SELECT MAX(id) FROM guidelines));"))
            await db.execute(text("SELECT setval('monitoring_rules_id_seq', (SELECT MAX(id) FROM monitoring_rules));"))
            await db.execute(text("SELECT setval('pv_reports_id_seq', (SELECT MAX(id) FROM pv_reports));"))
            await db.commit()
        except Exception:
            pass  # SQLite doesn't use sequences
        
        print("Database seeded and sequences reset successfully!")

if __name__ == "__main__":
    asyncio.run(seed_db())
