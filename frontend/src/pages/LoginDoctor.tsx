import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

export const LoginDoctor: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setIsSlow(false);
    setError(null);
    const timer = setTimeout(() => {
      setIsSlow(true);
    }, 2500);
    try {
      const res = await apiClient.post('/auth/login', { username: 'ramesh' });
      clearTimeout(timer);
      localStorage.setItem('jwt', res.data.access_token);
      localStorage.setItem('userRole', res.data.user?.role || 'DOCTOR');
      navigate('/dashboard/doctor');
    } catch (err: any) {
      clearTimeout(timer);
      setError('Login failed. Please ensure the backend is running.');
      setLoading(false);
      setIsSlow(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 bg-surface rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        
        {/* Left: Patient Grid */}
        <div className="p-10 bg-slate-50 flex flex-col justify-center border-r border-slate-200">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-2xl">DR</div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Welcome, Dr. Ramesh!</h2>
              <p className="text-slate-500 font-medium">Principal Investigator · Workspace</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Safe Patient */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-sm font-semibold text-slate-700">PT-4412</span>
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
              </div>
              <div className="text-xs text-slate-500">HRV: 32ms</div>
            </div>

            {/* At Risk Patient */}
            <div className="bg-white p-4 rounded-xl border-2 border-red-400 shadow-md relative overflow-hidden animate-[pulse_2s_ease-in-out_infinite]">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
              <div className="flex justify-between items-start mb-2 pl-2">
                <span className="font-mono text-sm font-bold text-slate-800">PT-8091</span>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              </div>
              <div className="text-xs text-red-600 font-medium pl-2">HRV: 24ms</div>
            </div>

            {/* Safe Patient */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-sm font-semibold text-slate-700">PT-1042</span>
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
              </div>
              <div className="text-xs text-slate-500">HRV: 35ms</div>
            </div>
          </div>
        </div>

        {/* Right: Scope & CTA */}
        <div className="p-10 flex flex-col justify-center bg-white">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Site Assignment</h3>
          
          <div className="space-y-6 mb-8 text-slate-600">
            
            <div className="p-5 bg-teal-50/50 rounded-xl border border-teal-100">
              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">local_hospital</span>
                Apollo Hospitals, Chennai
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-teal-800">Assignment</span>
                  <span className="text-sm font-bold text-slate-800">Site 3 of 10</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-teal-800">Active Patients</span>
                  <span className="text-sm font-bold text-slate-800 tabular-nums">45</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-teal-800">Trial</span>
                  <span className="text-sm font-bold text-slate-800">GlucoZen Phase III</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 font-medium leading-relaxed">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Direct access to patient vitals & 3D body scans</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Download PV Safety Reports</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 mt-4 pt-4 border-t border-slate-100">
                <span className="w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center text-sm font-bold">✗</span>
                <span>Restricted to Site 3 patients only</span>
              </div>
            </div>

          </div>

          {error && (
            <p className="text-red-500 text-sm mb-2 font-medium">{error}</p>
          )}
          {loading && isSlow && (
            <p className="text-teal-600 text-xs mb-3 font-medium text-center animate-pulse">
              ⚡ Waking up hosted backend (Render cold start can take 20-30s)...
            </p>
          )}
          <div className="mt-auto pt-4 flex gap-4">
            <button className="btn btn-ghost px-6" onClick={() => navigate('/login')} disabled={loading}>Back</button>
            <button
              className="btn w-full justify-center py-3 text-base shadow-lg shadow-teal-500/30 bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? (isSlow ? 'Waking up server...' : 'Signing in...') : 'Enter PI Dashboard'}
              {!loading && <span className="material-symbols-outlined text-sm ml-1">arrow_forward</span>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
