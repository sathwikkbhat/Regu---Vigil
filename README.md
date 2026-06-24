# 🚨 ReguVigil — Real-Time Pharmacovigilance & AI Regulatory Guardrails

> **From Regulatory PDF Publication to Patient Safety Compliance in <90 Seconds.**
> ReguVigil is a multi-agent AI system built for clinical trial sponsors to monitor, parse, extract, evaluate, and alert safety officers and investigators of critical safety guideline revisions.

---

## 🎬 Platform Overview

When regulatory bodies (like the FDA or EMA) publish a new safety guideline, sponsors have to manually review complex documents, identify revised biomarker margins (e.g., HRV SDNN safety thresholds), query their patient database, and email principal investigators at various hospital sites. This manual process takes days and introduces significant human error.

**ReguVigil automates this entire lifecycle dynamically, with zero hard-coded mocks:**
1. **Poll & Ingest**: Continuous automated scraping of RSS/Atom feeds across CDSCO, FDA, EMA, and ICH.
2. **Dynamic Agent Parsing**: Agent 1 extracts safety rule structures (biomarkers, operator, revised margin, confidence) using a real, live `gemini-2.5-flash` model.
3. **Database Audit & Diffing**: Agent 2 performs SQL diffing against current active trial rules and records revisions.
4. **Clinical Sentinel**: Agent 3 executes asynchronous batch queries (via `asyncio.gather`) to evaluate 500 patient vitals against the new margins.
5. **Autonomic Alerting**: Agent 4 groups flagged at-risk patients by hospital site and triggers Twilio SendGrid to dispatch site-scoped HTML alert summaries to respective Principal Investigators.

---

## 🛠️ Monorepo Tech Stack

### Frontend (React Dashboard)
- **Vite & React 18**: Ultra-fast hot-reloading compilation.
- **Tailwind CSS & Framer Motion**: Glassmorphism aesthetic, interactive animations, and responsive components.
- **React Query (TanStack)**: Declarative data fetching and state caching with 1.5s live polling.
- **Recharts & React Globe**: Interactive 3D site tracking globe and clinical biomarker trend charts.

### Backend (FastAPI Services)
- **FastAPI (ASGI)**: High-performance async Python backend.
- **SQLAlchemy (Asyncpg)**: Non-blocking ORM integration for PostgreSQL/SQLite.
- **LangGraph**: Directed-acyclic graph (DAG) state coordinator for the 4-Agent pipeline.
- **Google GenAI Client**: Direct connection to `gemini-2.5-flash` with structured Pydantic schema validation.
- **PyMuPDF**: Fast text parsing from raw PDF uploads.

---

## 📂 Project Structure

```
regu-vigil/
├── backend/
│   ├── main.py                  # API router bindings, CORS headers, & scheduler hook
│   ├── core/
│   │   ├── auth.py              # JWT encoding/decoding configuration
│   │   ├── env.py               # Robust .env search utility (overrides system environment)
│   │   └── middleware.py        # Token auth, audit logger, and hospital site scoping
│   ├── db/
│   │   ├── database.py          # Session factory and dynamic engine selector (SQLite/Postgres)
│   │   └── models.py            # SQLite/Postgre database tables
│   ├── api/
│   │   ├── auth.py              # User authentication routes
│   │   ├── guidelines.py        # Upload endpoints & asynchronous pipeline trigger
│   │   ├── patients.py          # Patient vitals lookup, 3D body viz dataset, and copilot agent
│   │   ├── pipeline.py          # Log retrieval, runs list, and manual human override routes
│   │   └── rules.py             # Active rules history, approval, and rejection
│   └── agents/
│       ├── pipeline.py          # LangGraph Graph compile & node routing definitions
│       ├── agent1_parser.py     # Pure Gemini-powered PDF parsing with relevance validation
│       ├── agent2_rule_extractor.py # SQL rule versioning and delta builder
│       ├── agent3_sentinel.py   # Async-batch patient vitals evaluation
│       └── agent4_reporter.py   # Twilio SendGrid HTML email alert template and dispatch
└── frontend/
    ├── src/
    │   ├── api/
    │   │   ├── client.ts        # Axios client with auto 401 JWT logout interceptor
    │   │   └── queries.ts       # React Query endpoints and polling rules
    │   ├── components/
    │   │   ├── TopBar.tsx       # Brand header and database reset handler
    │   │   └── RoleSwitcher.tsx # Instant demo persona switches via browser redirects
    │   └── pages/
    │       ├── Login.tsx        # Persona selection screen
    │       ├── RegulatoryDashboard.tsx # Document uploads, pipeline logs, and approval queue
    │       ├── DataManagerDashboard.tsx # Global patient records and interactive 3D Globe
    │       ├── DoctorDashboard.tsx # Site-scoped vital graphs, notifications, and 3D body viz
    │       └── BodyViz.tsx      # Patient-specific clinical copilot and interactive organ visualizer
    └── vercel.json              # Rewrites routing rule to support Single-Page App (SPA) on Vercel
```

---

## ⚡ Direct Local Setup

### 1. Setup Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure your `.env` file inside the `backend/` directory:
   ```env
   GEMINI_API_KEY=your-gemini-api-key
   # If you want to use email alerts:
   SENDGRID_API_KEY=SG.xxx
   SENDGRID_FROM_EMAIL=your-verified-sender@domain.com
   ```
4. Seed the database with 500 patients and 15,000 biomarker readings:
   ```bash
   python -m scripts.seed
   ```
5. Run the FastAPI development server:
   ```bash
   python -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```

### 2. Setup Frontend
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
4. Access the web app at `http://localhost:5173`.

---

## 🚀 Deploying to Vercel (Frontend)

Vercel is the premier platform for deploying React single-page applications.

### Build and Deployment Steps
1. Push your changes to your new GitHub repository:
   ```bash
   git add .
   git commit -m "Configure project for Vercel deployment"
   git push origin main
   ```
2. Log into your [Vercel Dashboard](https://vercel.com) and click **Add New Project**.
3. Select your repository `sathwikkbhat/Regu---Vigil` from the list.
4. **Configuration Settings**:
   - **Framework Preset**: `Vite` (auto-detected)
   - **Root Directory**: `frontend` (Ensure you set this to the `frontend` folder, since it is a monorepo)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Environment Variables**:
   - Add `VITE_API_BASE_URL` pointing to your deployed FastAPI backend (e.g. `https://your-backend-server.com`).
6. Click **Deploy**.

> [!NOTE]
> The included `frontend/vercel.json` ensures that deep-links (like `/dashboard/doctor`) are correctly routed to Vite's `index.html` on Vercel without throwing a `404 Not Found` page error on refreshes.

---

## 🧠 Dynamic Document Parsing Rules
Unlike previous static versions that relied on filename checks and hard-coded fallbacks:
- **Genuine AI Opinion**: Agent 1 uses a real Gemini API call to check whether the uploaded PDF matches clinical trials.
- **Relevance Rejection**: If you upload an irrelevant file (like a resume, marketing guide, or assignment), Gemini sets `is_relevant: false`, throwing a clear `ValueError` explaining that the document is not an active pharmacovigilance safety update.
- **Self-Correcting Env Loader**: The backend searches directories upwards to locate the workspace `.env` file, overriding any pre-defined OS environment keys to guarantee the Gemini calls proceed without authentication faults.

