import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { apiClient } from './api/client';
import { TopBar } from './components/TopBar';
import { 
  LandingPage,
  Login, 
  LoginRegulatory, 
  LoginDataManager, 
  LoginDoctor,
  RegulatoryDashboard,
  PipelineLiveView,
  DataManagerDashboard,
  DoctorDashboard,
  BodyViz,
  ReportView,
  RuleHistory
} from './pages';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('jwt');
  if (!token) return <Navigate to="/login" />;
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

function App() {
  React.useEffect(() => {
    // Proactively wake up Render backend in the background as early as possible
    apiClient.get('/health').catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/regulatory" element={<LoginRegulatory />} />
        <Route path="/login/datamanager" element={<LoginDataManager />} />
        <Route path="/login/doctor" element={<LoginDoctor />} />

        {/* Protected Routes */}
        <Route path="/dashboard/regulatory" element={
          <PrivateRoute><RegulatoryDashboard /></PrivateRoute>
        } />
        <Route path="/dashboard/pipeline" element={
          <PrivateRoute><PipelineLiveView /></PrivateRoute>
        } />
        <Route path="/dashboard/datamanager" element={
          <PrivateRoute><DataManagerDashboard /></PrivateRoute>
        } />
        <Route path="/dashboard/doctor" element={
          <PrivateRoute><DoctorDashboard /></PrivateRoute>
        } />
        <Route path="/dashboard/doctor/patient/:id/viz" element={
          <PrivateRoute><BodyViz /></PrivateRoute>
        } />
        <Route path="/dashboard/report/:id" element={
          <PrivateRoute><ReportView /></PrivateRoute>
        } />
        <Route path="/dashboard/rules/history" element={
          <PrivateRoute><RuleHistory /></PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
