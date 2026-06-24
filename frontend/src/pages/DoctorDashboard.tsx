import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { usePatients, usePatientReadings } from '../api/queries';
import { SITE_NAMES } from './DataManagerDashboard';

type FilterMode = 'all' | 'flagged' | 'safe';

export const DoctorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const targetId   = searchParams.get('patient');
  const urlSite    = searchParams.get('site');

  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [filterMode,  setFilterMode]  = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [toast,       setToast]       = useState<{ message: string; type: 'success'|'error'|'info' } | null>(null);
  const PATIENTS_PER_PAGE = 10;

  const { data: patientsData, isLoading } = usePatients();

  /* ── Derived patient list ── */
  const allPatients = useMemo(() => {
    const arr: any[] = patientsData?.data || [];
    return arr.map((p: any) => ({
      id:         p.external_id || p.id,
      internalId: p.id,
      siteId:     p.site_id,
      hospital:   SITE_NAMES[p.site_id] || p.site_id,
      hrv:        p.latest_hrv != null ? Math.round(p.latest_hrv) : null,
      hr:         p.latest_hr  != null ? Math.round(p.latest_hr)  : null,
      status:     p.is_flagged ? 'AT_RISK' : 'SAFE',
    }));
  }, [patientsData]);

  /* Site scoping */
  const resolvedTarget = useMemo(
    () => allPatients.find(p => p.id === targetId || p.internalId === targetId),
    [allPatients, targetId]
  );
  const SITE_ID       = urlSite || resolvedTarget?.siteId || 'site-3';
  const hospitalName  = SITE_NAMES[SITE_ID] || 'Unknown Hospital';
  const siteIndex     = SITE_ID.replace('site-', '');
  const sitePatients  = useMemo(() => allPatients.filter(p => p.siteId === SITE_ID), [allPatients, SITE_ID]);
  const flaggedCount  = sitePatients.filter(p => p.status === 'AT_RISK').length;

  /* Filter + search */
  const visiblePatients = useMemo(() => {
    let list = sitePatients;
    if (filterMode === 'flagged') list = list.filter(p => p.status === 'AT_RISK');
    if (filterMode === 'safe')    list = list.filter(p => p.status === 'SAFE');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.id.toLowerCase().includes(q) || p.hospital.toLowerCase().includes(q));
    }
    return list.sort((a, b) => (a.status === 'AT_RISK' && b.status !== 'AT_RISK' ? -1 : b.status === 'AT_RISK' ? 1 : 0));
  }, [sitePatients, filterMode, searchQuery]);

  const totalPages       = Math.ceil(visiblePatients.length / PATIENTS_PER_PAGE);
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * PATIENTS_PER_PAGE;
    return visiblePatients.slice(start, start + PATIENTS_PER_PAGE);
  }, [visiblePatients, currentPage]);

  /* Auto-select */
  const selectedPatient = useMemo(() => {
    if (selectedId) return sitePatients.find(p => p.internalId === selectedId) || null;
    if (targetId)   return sitePatients.find(p => p.id === targetId || p.internalId === targetId) || null;
    return sitePatients.find(p => p.status === 'AT_RISK') || sitePatients[0] || null;
  }, [sitePatients, selectedId, targetId]);

  /* Readings + trend */
  const { data: readingsData, isLoading: readingsLoading } = usePatientReadings(
    selectedPatient?.internalId || ''
  );

  const trendData = useMemo(() => {
    if (!readingsData?.readings?.length) return [];
    const byDay: Record<string, any> = {};
    readingsData.readings.forEach((r: any) => {
      const key = new Date(r.recorded_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      if (!byDay[key]) byDay[key] = { day: key };
      if (r.biomarker === 'HRV_SDNN')   byDay[key].hrv = parseFloat(r.value.toFixed(1));
      if (r.biomarker === 'Heart_Rate')  byDay[key].hr  = parseFloat(r.value.toFixed(1));
    });
    return Object.values(byDay);
  }, [readingsData]);

  /* Helpers */
  const showToast = (message: string, type: 'success'|'error'|'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };


  const handleFilterMode = (mode: FilterMode) => { setFilterMode(mode); setCurrentPage(1); };
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => { setSearchQuery(e.target.value); setCurrentPage(1); };
  const handleSelect = (p: any) => { setSelectedId(p.internalId); };

  const isRisk = selectedPatient?.status === 'AT_RISK';

  return (
    <div className="p-4 md:p-8 max-w-[1920px] mx-auto space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 left-4 sm:left-auto sm:right-6 sm:top-6 z-50 flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 rounded-xl shadow-xl border text-sm font-semibold ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          toast.type === 'error'   ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <span className="material-symbols-outlined text-base">
            {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
          </span>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{hospitalName}</h1>
          <p className="text-slate-500 text-sm">Site {siteIndex} · GlucoZen Phase III Trial · {sitePatients.length} active patients</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold self-start sm:self-auto ${
          flaggedCount > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <span className={`material-symbols-outlined text-sm ${flaggedCount > 0 ? 'animate-bounce' : ''}`}>
            {flaggedCount > 0 ? 'notification_important' : 'check_circle'}
          </span>
          {flaggedCount > 0 ? `${flaggedCount} at risk` : 'All clear'}
        </div>
      </div>

      {/* Main content: table left, detail panel right */}
      <div className="flex flex-col xl:flex-row gap-6">

        {/* ── LEFT: Table + Filter ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Filter Bar — identical to DataManager */}
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap">
              {(['all', 'flagged', 'safe'] as FilterMode[]).map(mode => {
                const labels: Record<FilterMode, string> = {
                  all: 'All Patients',
                  flagged: '⚠ AT RISK Only',
                  safe: '✓ Safe Only',
                };
                const isActive = filterMode === mode;
                return (
                  <button key={mode} onClick={() => handleFilterMode(mode)}
                    className={`btn px-4 py-2 transition-all text-sm ${
                      isActive
                        ? mode === 'flagged' ? 'bg-red-600 border-red-600 text-white' : 'btn-primary'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {labels[mode]}
                  </button>
                );
              })}
              <span className="text-sm text-slate-400 self-center ml-2">
                Showing <strong className="text-slate-700">{visiblePatients.length}</strong> patients
              </span>
            </div>
            {/* Search */}
            <div className="relative w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input type="text" placeholder="Search by ID or Hospital..."
                value={searchQuery} onChange={handleSearch}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Table — identical structure to DataManager */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="px-6 py-4 font-semibold">Patient ID</th>
                  <th className="px-6 py-4 font-semibold">Site</th>
                  <th className="px-6 py-4 font-semibold">Hospital</th>
                  <th className="px-6 py-4 font-semibold">HRV (latest)</th>
                  <th className="px-6 py-4 font-semibold">Heart Rate</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-3 text-slate-400">
                      <span className="w-5 h-5 border-2 border-slate-300 border-t-blue-400 rounded-full animate-spin" />
                      Loading patients...
                    </div>
                  </td></tr>
                ) : visiblePatients.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">No patients match the current filter.</td></tr>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {paginatedPatients.map((p: any, idx: number) => {
                      const pIsRisk = p.status === 'AT_RISK';
                      const isSelected = selectedPatient?.internalId === p.internalId;
                      return (
                        <motion.tr
                          layout
                          key={p.internalId}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.18, delay: idx * 0.03 }}
                          onClick={() => handleSelect(p)}
                          className={`relative cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/60 ring-1 ring-inset ring-primary/20' :
                            pIsRisk ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <td className="px-6 py-3.5 font-mono font-bold text-slate-800">
                            {pIsRisk && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500 rounded-r" />}
                            {p.id}
                          </td>
                          <td className="px-6 py-3.5 text-slate-500 text-xs font-mono">{p.siteId}</td>
                          <td className="px-6 py-3.5 text-slate-600">{p.hospital}</td>
                          <td className={`px-6 py-3.5 font-mono font-bold ${pIsRisk && (!p.hr || p.hr <= 95) ? 'text-red-600' : 'text-slate-700'}`}>
                            {p.hrv != null ? `${p.hrv}ms` : '—'}
                          </td>
                          <td className={`px-6 py-3.5 font-mono font-bold ${pIsRisk && p.hr > 95 ? 'text-red-600' : 'text-slate-700'}`}>
                            {p.hr != null ? `${p.hr} bpm` : '—'}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                              pIsRisk ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${pIsRisk ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                              {pIsRisk ? 'AT RISK' : 'SAFE'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            <button
                              onClick={e => { e.stopPropagation(); handleSelect(p); }}
                              className={`text-sm font-semibold hover:underline transition-colors ${pIsRisk ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}
                            >
                              View Details
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                )}
              </tbody>
            </table>

            {/* Pagination — identical to DataManager */}
            {totalPages > 1 && (() => {
              // Build a clean page window — never more than 7 items including ellipses
              const pages: (number | '...')[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else if (currentPage <= 4) {
                pages.push(1,2,3,4,5,'...',totalPages);
              } else if (currentPage >= totalPages - 3) {
                pages.push(1,'...',totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages);
              } else {
                pages.push(1,'...',currentPage-1,currentPage,currentPage+1,'...',totalPages);
              }
              return (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Showing <strong className="text-slate-800">{(currentPage - 1) * PATIENTS_PER_PAGE + 1}</strong> to{' '}
                    <strong className="text-slate-800">{Math.min(currentPage * PATIENTS_PER_PAGE, visiblePatients.length)}</strong> of{' '}
                    <strong className="text-slate-800">{visiblePatients.length}</strong>
                  </span>
                  <div className="flex gap-1.5 items-center">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      <span className="material-symbols-outlined text-sm">chevron_left</span>
                    </button>
                    {pages.map((pg, i) => pg === '...' ? (
                      <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-slate-400 text-sm">…</span>
                    ) : (
                      <button key={pg} onClick={() => setCurrentPage(pg as number)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-all ${
                          currentPage === pg
                            ? 'bg-primary text-white shadow-md shadow-primary/30'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>{pg}</button>
                    ))}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── RIGHT: Sticky Detail Panel ── */}
        <div className="xl:w-[380px] shrink-0">
          {selectedPatient ? (
            <div className="sticky top-20 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">

              {/* Panel Header */}
              <div className={`p-5 border-b flex justify-between items-start ${isRisk ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-mono font-bold text-slate-800">{selectedPatient.id}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isRisk ? 'bg-red-100 text-red-700 border-red-200 animate-pulse' : 'bg-green-100 text-green-700 border-green-200'
                    }`}>{isRisk ? 'AT RISK' : 'SAFE'}</span>
                  </div>
                  <p className="text-xs text-slate-500">{selectedPatient.hospital} · {selectedPatient.siteId}</p>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Biomarker Stats */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'HRV', val: selectedPatient.hrv, unit: 'ms',  flagged: isRisk && (!selectedPatient.hr || selectedPatient.hr <= 95) },
                    { label: 'SpO2', val: 98,                   unit: '%',  flagged: false },
                    { label: 'HR',   val: selectedPatient.hr,   unit: 'bpm', flagged: isRisk && selectedPatient.hr > 95 },
                  ].map(({ label, val, unit, flagged }) => (
                    <div key={label} className={`rounded-xl p-3 text-center border ${flagged ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${flagged ? 'text-red-600' : 'text-slate-500'}`}>{label}</div>
                      <div className={`text-lg font-bold tabular-nums ${flagged ? 'text-red-600' : 'text-slate-700'}`}>
                        {val != null ? val : '—'}<span className="text-[10px] ml-0.5 opacity-60">{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart — key forces full remount on patient switch */}
                <div>
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-slate-400">monitoring</span>
                    30-Day Trend · HRV &amp; Heart Rate
                  </h3>
                  <div className="border border-slate-100 rounded-xl bg-slate-50 overflow-hidden" style={{ height: 210 }}>
                    {trendData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-1">
                        <span className="material-symbols-outlined text-2xl">show_chart</span>
                        No readings yet
                      </div>
                    ) : (
                      <LineChart key={`chart-${selectedPatient.internalId}`} width={340} height={210} data={trendData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false}
                          tick={{ fontSize: 8, fill: '#94A3B8' }} interval="preserveStartEnd" />
                        <YAxis yAxisId="left"  domain={[15, 50]}  axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94A3B8' }} width={26} />
                        <YAxis yAxisId="right" orientation="right" domain={[45, 115]} axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94A3B8' }} width={26} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 10 }} />
                        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 9, paddingTop: 2 }} />
                        <ReferenceLine yAxisId="left"  y={28} stroke="#CBD5E1" strokeDasharray="4 4" />
                        <ReferenceLine yAxisId="right" y={95} stroke="#FCA5A5" strokeDasharray="4 4" />
                        <Line yAxisId="left"  name="HRV (ms)"  type="monotone" dataKey="hrv"
                          stroke="#10B981" strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} connectNulls />
                        <Line yAxisId="right" name="HR (bpm)"  type="monotone" dataKey="hr"
                          stroke="#F59E0B" strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} connectNulls />
                      </LineChart>
                    )}
                  </div>
                </div>

                {/* Risk Context */}
                {isRisk && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <span className="material-symbols-outlined text-amber-500 text-[14px]">info</span>
                      Regulatory Context
                    </div>
                    <p className="leading-relaxed mb-2">Breached new FDA HRV threshold (v1.3: &lt;28ms) in latest pipeline run.</p>
                    <div className="flex gap-2">
                      <span className="bg-white px-2 py-0.5 rounded border border-amber-100 text-slate-600">v1.2: SAFE</span>
                      <span className="bg-white px-2 py-0.5 rounded border border-amber-100 font-bold text-slate-800">v1.3: AT RISK</span>
                    </div>
                  </div>
                )}

                {/* CTAs */}
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/dashboard/report/${selectedPatient.id}`)}
                    className="btn flex-1 justify-center py-2 bg-slate-800 hover:bg-slate-900 text-white shadow text-xs transition-all hover:-translate-y-0.5">
                    <span className="material-symbols-outlined text-[15px] mr-1">description</span>
                    View Full Report
                  </button>
                </div>
                <p className="text-center text-[10px] text-slate-400 uppercase tracking-wider">Scoped to Site {siteIndex} Only</p>
              </div>
            </div>
          ) : (
            <div className="xl:w-[380px] flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-slate-200 text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-3">person_search</span>
              <p className="text-sm font-medium">Click a row to view patient details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
