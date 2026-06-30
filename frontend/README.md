# ReguVigil Frontend
### *Interactive Clinical Safety & Regulatory Compliance Dashboard*

This directory houses the React & TypeScript single-page application (SPA) built with Vite for the **ReguVigil** platform. The dashboard provides three distinct role-scoped views, interactive data visualization, real-time status updates, and a clinical AI copilot.

---

## 🎨 Design & Key Features

* **Glassmorphic Aesthetic:** Implements a state-of-the-art dark/light hybrid mode featuring translucent cards, smooth gradients, subtle backdrops, and modern typography (Google Fonts Outfit & Inter).
* **Framer Motion Micro-animations:** Premium spring physics transitions on layout changes, card hovers, and button clicks to elevate the tactile feel of the application.
* **Persona Switcher:** A globally persistent switcher in the top navigation bar allowing judges and developers to seamlessly toggle between the three roles for sandbox exploration.
* **3D Trial Globe:** Interactive WebGL 3D globe showing active global site distributions, colored alerts for sites with patients at risk, and flight paths representing real-time communication.
* **3D Human Anatomy Visualizer:** Visual representation of target organ systems (e.g. cardiac) with color-coded safety indicators reflecting biomarker margins.
* **Vitals & Trends Charts:** Clean, interactive clinical timeline charts using Recharts.

---

## 👥 Role-Based Workspaces

The dashboard splits into three independent portals:
1. **Regulatory Affairs (Priya S.):** Document uploads, pipeline log monitoring, human-in-the-loop rule approval/rejection.
2. **Clinical Data Manager (Arjun M.):** Multi-site clinical database overview, patient cohort filters, CSV exporting, and interactive globe.
3. **Principal Investigator (Dr. Ramesh K.):** Site-scoped patient grid, cardiac vitals trend tracking, 3D anatomical model visualizer, and patient clinical AI copilot.

---

## 📂 Codebase Structure

```
frontend/
├── public/                 # Static assets, logo, fonts, body meshes
├── src/
│   ├── api/
│   │   ├── client.ts       # Axios instance config with global interceptors
│   │   └── queries.ts      # React Query definitions for caching and polling
│   ├── components/
│   │   ├── TopBar.tsx      # Main portal navbar containing role switches & reset actions
│   │   └── RoleSwitcher.tsx# Role-selector floating widget for simple sandbox demoing
│   ├── pages/
│   │   ├── Login.tsx       # Landing/Entrance portal screen
│   │   ├── LoginRegulatory.tsx
│   │   ├── LoginDataManager.tsx
│   │   ├── LoginDoctor.tsx
│   │   ├── RegulatoryDashboard.tsx
│   │   ├── DataManagerDashboard.tsx
│   │   ├── DoctorDashboard.tsx
│   │   ├── BodyViz.tsx     # 3D clinical organ visualizer & AI copilot sidebar
│   │   ├── ReportView.tsx  # PV safety PDF report generator
│   │   ├── RuleHistory.tsx # Audit log history of approved regulatory rules
│   │   └── index.ts        # Unified page exports
│   ├── App.tsx             # Route paths, PrivateRoute wrapper, and health ping trigger
│   ├── index.css           # Global custom stylesheet & typography variables
│   └── main.tsx            # Main application mounting point
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.js      # Styling design system tokens (colors, animations, fonts)
└── vite.config.ts          # Vite compiler config
```

---

## ⚡ Direct Local Setup

### Prerequisites
* **NodeJS** v18 or later
* **NPM** v9 or later

### Steps
1. Install project dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your web browser.

---

## 🚀 Build and Deployment

### Production Compilation
To compile optimized static assets ready for deployment:
```bash
npm run build
```
This generates build output in the `/dist` directory.

### Deploying to Vercel
This frontend is configured for deployment on **Vercel**:
* **Framework Preset:** `Vite`
* **Root Directory:** `frontend`
* **Build Command:** `npm run build`
* **Output Directory:** `dist`
* **Required Env Variable:** `VITE_API_BASE_URL` pointing to your deployed backend (e.g. `https://regu-vigil.onrender.com`).
* **SPA Routing:** The configuration in `vercel.json` ensures that direct routing or browser page refreshes inside sub-paths (like `/dashboard/doctor`) are correctly rewrite-mapped to Vite's `index.html` to prevent `404` errors.
