import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { usePatients, usePatientStats, usePipelineStatus } from '../api/queries';
import GlobeVisualization, { SITES } from '../components/GlobeVisualization';
import { motion, AnimatePresence } from 'framer-motion';


type FilterMode = 'all' | 'flagged' | 'by_site' | 'by_biomarker';

export const SITE_NAMES: Record<string, string> = {
  'site-1':  'AIIMS Delhi',
  'site-2':  'Fortis Mumbai',
  'site-3':  'Apollo Chennai',
  'site-4':  'Manipal Bangalore',
  'site-5':  'PGIMER Chandigarh',
  'site-6':  'KGMU Lucknow',
  'site-7':  'NIMHANS Bangalore',
  'site-8':  'AIIMS Bhubaneswar',
  'site-9':  'Tata Medical Kolkata',
  'site-10': 'Amrita Kochi',
};

export const DataManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const patientsPerPage = 10;

  const { data: pipelineData } = usePipelineStatus();
  const { data: statsData } = usePatientStats();
  const { data: patientsData, isLoading } = usePatients(activeSiteId || undefined);

  // Derived patient list
  const ALL_PATIENTS = useMemo(() => {
    const arr = patientsData?.data || [];
    return arr.map((p: any) => ({
      id: p.id || p.patient_id,
      siteId: p.site_id,
      hospital: SITE_NAMES[p.site_id] || p.site_id,
      hrv: p.latest_hrv != null ? Math.round(p.latest_hrv) : null,
      hr: p.latest_hr != null ? Math.round(p.latest_hr) : null,
      status: p.is_flagged ? 'AT_RISK' : 'SAFE',
    }));
  }, [patientsData]);

  const visiblePatients = useMemo(() => {
    let list = ALL_PATIENTS;
    if (filterMode === 'flagged') list = list.filter((p: any) => p.status === 'AT_RISK');
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter((p: any) => 
        p.id.toLowerCase().includes(q) || 
        p.hospital.toLowerCase().includes(q) ||
        p.siteId.toLowerCase().includes(q)
      );
    }
    
    return list.sort((a: any, b: any) => {
      if (a.status === 'AT_RISK' && b.status !== 'AT_RISK') return -1;
      if (b.status === 'AT_RISK' && a.status !== 'AT_RISK') return 1;
      if (filterMode === 'by_biomarker' && a.hrv != null && b.hrv != null) return a.hrv - b.hrv;
      return 0;
    });
  }, [ALL_PATIENTS, filterMode, searchQuery]);

  const totalPages = Math.ceil(visiblePatients.length / patientsPerPage);
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * patientsPerPage;
    return visiblePatients.slice(start, start + patientsPerPage);
  }, [visiblePatients, currentPage]);

  // Per-site counts for globe markers
  const siteFlags = useMemo(() => {
    const flags: Record<string, number> = {};
    ALL_PATIENTS.forEach((p: any) => {
      if (p.status === 'AT_RISK') flags[p.siteId] = (flags[p.siteId] || 0) + 1;
    });
    return flags;
  }, [ALL_PATIENTS]);

  const siteTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    ALL_PATIENTS.forEach((p: any) => {
      totals[p.siteId] = (totals[p.siteId] || 0) + 1;
    });
    return totals;
  }, [ALL_PATIENTS]);

  // Stats from /patients/stats API
  const totalPatients = statsData?.total_patients || ALL_PATIENTS.length;
  const totalFlagged = statsData?.total_flagged || ALL_PATIENTS.filter((p: any) => p.status === 'AT_RISK').length;
  const totalSafe = totalPatients - totalFlagged;
  const pipelineEvaluated = pipelineData?.patients_evaluated;

  const handleExportCSV = () => {
    try {
      const headers = ['Patient ID', 'Site ID', 'Hospital', 'Status', 'Latest HRV (ms)'];
      const csvContent = [
        headers.join(','),
        ...visiblePatients.map((p: any) => 
          [p.id, p.siteId, p.hospital, p.status, p.hrv || 'N/A'].join(',')
        )
      ].join('\\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `patients_export_${activeSiteId || 'global'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('CSV Export failed', error);
    }
  };

  const handleGlobeClick = (siteId: string) => {
    if (activeSiteId === siteId) {
      setActiveSiteId(null);
      setFilterMode('all');
    } else {
      setActiveSiteId(siteId);
      setFilterMode('by_site');
    }
  };

  const handleSiteChipClick = (siteId: string) => {
    handleGlobeClick(siteId);
  };

  const handleFilterMode = (mode: FilterMode) => {
    setFilterMode(mode);
    setCurrentPage(1);
    if (mode !== 'by_site') setActiveSiteId(null);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="p-4 md:p-8 max-w-[1920px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Global Patient Cohort</h1>
          <p className="text-slate-500 text-sm">Monitor re-evaluations across all 10 trial sites in India.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {activeSiteId && (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5 text-sm font-semibold text-indigo-700">
              <span className="material-symbols-outlined text-sm">location_on</span>
              {SITE_NAMES[activeSiteId]}
              <button onClick={() => { setActiveSiteId(null); setFilterMode('all'); }} className="ml-1 hover:text-indigo-900">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}
          <button
            onClick={handleExportCSV}
            className="btn bg-white border border-slate-200 text-slate-700 shadow-sm flex items-center gap-2 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span className="hidden sm:inline">Export</span> CSV
          </button>
        </div>
      </div>



      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-surface p-5">
          <p className="text-slate-500 text-sm font-semibold mb-2">Total Enrolled</p>
          <p className="text-3xl font-bold text-slate-800 tabular-nums">{totalPatients.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">across 10 sites</p>
        </div>
        <div className="card bg-surface p-5">
          <p className="text-slate-500 text-sm font-semibold mb-2">Pipeline Re-evaluated</p>
          <p className="text-3xl font-bold text-slate-800 tabular-nums">
            {pipelineEvaluated ? pipelineEvaluated.toLocaleString() : totalPatients.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">latest run</p>
        </div>
        <div className="card bg-surface p-5 border-l-4 border-red-400">
          <p className="text-red-700 text-sm font-semibold mb-2">AT RISK</p>
          <p className="text-3xl font-bold text-red-600 tabular-nums">{totalFlagged}</p>
          <p className="text-xs text-slate-400 mt-1">{totalPatients > 0 ? ((totalFlagged / totalPatients) * 100).toFixed(1) : 0}% of cohort</p>
        </div>
        <div className="card bg-surface p-5 border-l-4 border-green-400">
          <p className="text-green-700 text-sm font-semibold mb-2">Safe</p>
          <p className="text-3xl font-bold text-green-600 tabular-nums">{totalSafe.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">{totalPatients > 0 ? ((totalSafe / totalPatients) * 100).toFixed(1) : 0}% of cohort</p>
        </div>
      </div>

      {/* Globe + Site list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Site List Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ height: 480 }}>
          <div className="p-5 border-b border-slate-100 flex-shrink-0">
            <h3 className="font-bold text-slate-800">Trial Sites</h3>
            <p className="text-xs text-slate-400 mt-1">Click a site to filter patients</p>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {SITES.map((site) => {
              const flagCount = siteFlags[site.id] || 0;
              const total = siteTotals[site.id] || 0;
              const isActive = activeSiteId === site.id;
              return (
                <button
                  key={site.id}
                  onClick={() => handleSiteChipClick(site.id)}
                  className={`w-full flex items-center justify-between px-5 py-3 text-left transition-colors hover:bg-slate-50 ${
                    isActive ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      isActive ? 'bg-indigo-500' : flagCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                    }`} />
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{site.name}</div>
                      <div className="text-xs text-slate-400">{site.city} · {total} patients</div>
                    </div>
                  </div>
                  {flagCount > 0 ? (
                    <span className="flex-shrink-0 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {flagCount} ⚠
                    </span>
                  ) : (
                    <span className="flex-shrink-0 text-green-500 text-xs font-semibold">✓ Safe</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Globe — hidden on mobile since it requires WebGL + large viewport */}
        <div className="hidden lg:block lg:col-span-2 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative" style={{ height: 480 }}>
          <GlobeVisualization
            siteFlags={siteFlags}
            siteTotals={siteTotals}
            activeSiteId={activeSiteId}
            onSiteClick={handleGlobeClick}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'flagged', 'by_site', 'by_biomarker'] as FilterMode[]).map((mode) => {
            const labels: Record<FilterMode, string> = {
              all: 'All',
              flagged: '⚠ AT RISK',
              by_site: 'By Site',
              by_biomarker: 'HRV ↑',
            };
            const isActive = filterMode === mode;
            return (
              <button
                key={mode}
                onClick={() => handleFilterMode(mode)}
                className={`btn px-3 py-1.5 transition-all text-xs sm:text-sm ${
                  isActive
                    ? mode === 'flagged'
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'btn-primary'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {labels[mode]}
              </button>
            );
          })}
          <span className="text-xs sm:text-sm text-slate-400 self-center">
            <strong className="text-slate-700">{visiblePatients.length}</strong> patients
          </span>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
          <input 
            type="text" 
            placeholder="Search by ID or Hospital..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
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
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center gap-3 text-slate-400">
                    <span className="w-5 h-5 border-2 border-slate-300 border-t-blue-400 rounded-full animate-spin" />
                    Loading patients...
                  </div>
                </td>
              </tr>
            ) : visiblePatients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                  No patients match the current filter.
                </td>
              </tr>
            ) : (
              <AnimatePresence mode="popLayout">
              {paginatedPatients.map((p: any, idx: number) => {
                const isRisk = p.status === 'AT_RISK';
                return (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    key={p.id} 
                    className={`relative hover:bg-slate-50/60 transition-colors ${isRisk ? 'bg-red-50/30' : ''}`}
                  >
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-800">
                      {isRisk && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500 rounded-r" />}
                      {p.id}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 text-xs font-mono">{p.siteId}</td>
                    <td className="px-6 py-3.5 text-slate-600">{p.hospital}</td>
                    <td className={`px-6 py-3.5 font-mono font-bold ${
                      p.hrv == null ? 'text-slate-400' :
                      isRisk && (!p.hr || p.hr <= 95) ? 'text-red-600' : 'text-slate-700'
                    }`}>
                      {p.hrv != null ? `${p.hrv}ms` : '—'}
                    </td>
                    <td className={`px-6 py-3.5 font-mono font-bold ${
                      p.hr == null ? 'text-slate-400' :
                      isRisk && p.hr > 95 ? 'text-red-600' : 'text-slate-700'
                    }`}>
                      {p.hr != null ? `${p.hr} bpm` : '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isRisk ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isRisk ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                        {isRisk ? 'AT RISK' : 'SAFE'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <button
                        onClick={() => navigate(`/dashboard/doctor?site=${p.siteId}&patient=${p.id}`)}
                        className={`text-sm font-semibold hover:underline transition-colors ${
                          isRisk ? 'text-primary' : 'text-slate-400 hover:text-primary'
                        }`}
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
        </div>{/* end overflow-x-auto */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Showing <strong className="text-slate-800">{(currentPage - 1) * patientsPerPage + 1}</strong> to <strong className="text-slate-800">{Math.min(currentPage * patientsPerPage, visiblePatients.length)}</strong> of <strong className="text-slate-800">{visiblePatients.length}</strong>
            </span>
            <div className="flex gap-1.5 items-center">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              
              {/* Pagination Tabs */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Logic to show a sliding window of 5 pages
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-all ${
                      currentPage === pageNum 
                        ? 'bg-primary text-white shadow-md shadow-primary/30' 
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <span className="text-slate-400 mx-1">...</span>
              )}
              
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
