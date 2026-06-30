import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

export const LoginRegulatory: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ processed: 1204 });

  React.useEffect(() => {
    apiClient.get('/guidelines/stats/count')
      .then(res => setStats(res.data))
      .catch(err => console.error("Failed to fetch stats", err));
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setIsSlow(false);
    setError(null);
    const timer = setTimeout(() => {
      setIsSlow(true);
    }, 2500);
    try {
      const res = await apiClient.post('/auth/login', { username: 'priya' });
      clearTimeout(timer);
      localStorage.setItem('jwt', res.data.access_token);
      localStorage.setItem('userRole', res.data.user?.role || 'REGULATORY_AFFAIRS');
      navigate('/dashboard/regulatory');
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
        
        {/* Left: Stats */}
        <div className="p-10 bg-slate-50 flex flex-col justify-center border-r border-slate-200">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-primary font-bold text-2xl">PS</div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Welcome, Priya!</h2>
              <p className="text-slate-500 font-medium">Regulatory Affairs · Workspace</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="stat-card">
              <p className="text-slate-500 text-sm font-semibold mb-1">Guidelines Processed</p>
              <p className="text-3xl font-bold text-slate-800 tabular-nums">
                {stats.processed.toLocaleString()}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-slate-500 text-sm font-semibold mb-1">Regulators Monitored</p>
              <p className="text-3xl font-bold text-slate-800 tabular-nums">4</p>
            </div>
            <div className="stat-card sm:col-span-2">
              <p className="text-slate-500 text-sm font-semibold mb-1">Time Saved (YTD)</p>
              <p className="text-3xl font-bold text-primary tabular-nums">480 hrs</p>
            </div>
          </div>
        </div>

        {/* Right: Checklist & CTA */}
        <div className="p-10 flex flex-col justify-center bg-white">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Access Profile</h3>
          
          <div className="space-y-4 mb-8 text-slate-600 font-medium leading-relaxed">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">✓</span>
              <span>Manage active monitoring rules</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">✓</span>
              <span>Trigger end-to-end AI pipeline</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">✓</span>
              <span>Review full pipeline execution logs</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 mt-6 pt-4 border-t border-slate-100">
              <span className="w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center text-sm font-bold">✗</span>
              <span>Access patient PHI or direct vitals</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span className="w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center text-sm font-bold">✗</span>
              <span>Manage trial site assignments</span>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm mb-2 font-medium">{error}</p>
          )}
          {loading && isSlow && (
            <p className="text-blue-600 text-xs mb-3 font-medium text-center animate-pulse">
              ⚡ Waking up hosted backend (Render cold start can take 20-30s)...
            </p>
          )}
          <div className="mt-auto pt-4 flex gap-4">
            <button className="btn btn-ghost px-6" onClick={() => navigate('/login')} disabled={loading}>Back</button>
            <button
              className="btn btn-primary flex-1 justify-center py-3 text-base shadow-lg shadow-blue-500/30 disabled:opacity-60"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? (isSlow ? 'Waking up server...' : 'Signing in...') : 'Enter Regulatory Dashboard'}
              {!loading && <span className="material-symbols-outlined text-sm ml-1">arrow_forward</span>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
