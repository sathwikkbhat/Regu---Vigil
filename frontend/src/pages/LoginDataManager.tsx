import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

export const LoginDataManager: React.FC = () => {
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
      const res = await apiClient.post('/auth/login', { username: 'arjun' });
      clearTimeout(timer);
      localStorage.setItem('jwt', res.data.access_token);
      localStorage.setItem('userRole', res.data.user?.role || 'DATA_MANAGER');
      navigate('/dashboard/datamanager');
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
        
        {/* Left: Table Preview */}
        <div className="p-10 bg-slate-50 flex flex-col justify-center border-r border-slate-200">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-2xl">AM</div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Welcome, Arjun!</h2>
              <p className="text-slate-500 font-medium">Data Manager · Workspace</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h4 className="text-sm font-semibold text-slate-700">Live Patient Status Preview</h4>
            </div>
            <div className="p-0">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/50">
                    <th className="px-4 py-2 font-medium">Patient ID</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 font-mono text-slate-600">PT-8091</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                        AT RISK
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-slate-600">PT-1042</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                        SAFE
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-slate-600">PT-3329</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                        SAFE
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Scope & CTA */}
        <div className="p-10 flex flex-col justify-center bg-white">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Scope Confirmation</h3>
          
          <div className="space-y-6 mb-8 text-slate-600">
            
            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-amber-800">Trial Name</span>
                <span className="text-sm font-bold text-slate-800">GlucoZen Phase III</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-amber-800">Total Sites</span>
                <span className="text-sm font-bold text-slate-800 tabular-nums">10</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-amber-800">Total Patients</span>
                <span className="text-sm font-bold text-slate-800 tabular-nums">500</span>
              </div>
            </div>

            <div className="space-y-4 font-medium leading-relaxed">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Global view across all 10 sites</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Batch CSV reporting and re-evaluations</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 mt-4 pt-4 border-t border-slate-100">
                <span className="w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center text-sm font-bold">✗</span>
                <span>Cannot view Doctor or PI profiles</span>
              </div>
            </div>

          </div>

          {error && (
            <p className="text-red-500 text-sm mb-2 font-medium">{error}</p>
          )}
          {loading && isSlow && (
            <p className="text-amber-600 text-xs mb-3 font-medium text-center animate-pulse">
              ⚡ Waking up hosted backend (Render cold start can take 20-30s)...
            </p>
          )}
          <div className="mt-auto pt-4 flex gap-4">
            <button className="btn btn-ghost px-6" onClick={() => navigate('/login')} disabled={loading}>Back</button>
            <button
              className="btn w-full justify-center py-3 text-base shadow-lg shadow-amber-500/30 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? (isSlow ? 'Waking up server...' : 'Signing in...') : 'Enter Data Manager Dashboard'}
              {!loading && <span className="material-symbols-outlined text-sm ml-1">arrow_forward</span>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
