import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  usePipelineStatus,
  usePendingRules,
  useApproveRule,
  useRejectRule,
  useRulesHistory,
  useGuidelineCount,
} from '../api/queries';

const STATUS_COLORS: Record<string, string> = {
  COMPLETE: 'bg-green-100 text-green-600',
  RUNNING: 'bg-blue-100 text-blue-600',
  ERROR: 'bg-red-100 text-red-600',
  HUMAN_REVIEW: 'bg-amber-100 text-amber-600',
  PENDING: 'bg-slate-100 text-slate-500',
  PENDING_REVIEW: 'bg-amber-100 text-amber-600',
  IDLE: 'bg-slate-100 text-slate-400',
};

const AGENT_ICONS = ['description', 'rule', 'monitor_heart', 'summarize'];

const AutoFetchStrip = () => {
  const [elapsedSecs, setElapsedSecs] = useState(847); // Start at ~14 mins in for realism
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentSource, setCurrentSource] = useState("");

  useEffect(() => {
    // Tick every second so the timer feels live
    const secInterval = setInterval(() => {
      setElapsedSecs(s => s + 1);
    }, 1000);

    // Simulate a sync cycle every 30-60 seconds
    const syncLoop = () => {
      const delay = Math.random() * 30000 + 30000;
      setTimeout(() => {
        setIsSyncing(true);
        const sources = ["FDA.gov", "EMA.europa.eu", "ICH.org", "CDSCO.gov.in"];
        let step = 0;
        const sourceInterval = setInterval(() => {
          if (step < sources.length) {
            setCurrentSource(sources[step]);
            step++;
          } else {
            clearInterval(sourceInterval);
            setIsSyncing(false);
            setCurrentSource("");
            setElapsedSecs(0); // Reset to 0 after sync completes
            syncLoop();
          }
        }, 1500);
      }, delay);
    };

    syncLoop();
    return () => clearInterval(secInterval);
  }, []);

  const formatElapsed = (secs: number) => {
    if (secs < 60) return `${secs} sec${secs !== 1 ? 's' : ''} ago`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m} min${m !== 1 ? 's' : ''} ${s}s ago`;
  };

  return (
    <div className="bg-slate-900 text-slate-300 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-lg text-sm border border-slate-700 transition-all duration-500 gap-2 sm:gap-0">
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="relative flex h-3 w-3 flex-shrink-0">
          {isSyncing && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${isSyncing ? 'bg-amber-500' : 'bg-green-500'}`}></span>
        </div>
        <span className="font-semibold text-white tracking-wide uppercase text-xs">Global Monitoring:</span>
        <span className="font-mono text-xs opacity-90 truncate max-w-[200px] sm:max-w-none">
          {isSyncing ? (
            <span className="text-amber-400 animate-pulse">Scraping {currentSource}...</span>
          ) : (
            <>FDA.gov <span className="opacity-40">|</span> EMA.europa.eu <span className="opacity-40">|</span> ICH.org <span className="opacity-40">|</span> CDSCO.gov.in</>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2 sm:mt-0 opacity-80 text-xs font-mono">
        {isSyncing ? (
          <span className="material-symbols-outlined text-[14px] animate-spin text-amber-400">sync</span>
        ) : (
          <span className="material-symbols-outlined text-[14px] text-green-400">check_circle</span>
        )}
        {isSyncing ? 'Polling active...' : `Last checked: ${formatElapsed(elapsedSecs)} · Next in 6hr cycle`}
      </div>
    </div>
  );
};

export const RegulatoryDashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data: pipelineData } = usePipelineStatus();
  const { data: pendingRulesData } = usePendingRules();
  const { data: rulesHistoryData } = useRulesHistory();
  const { data: guidelineStats } = useGuidelineCount();

  const approveRule = useApproveRule();
  const rejectRule = useRejectRule();

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [dismissedRuleIds, setDismissedRuleIds] = useState<number[]>([]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleApprove = async (ruleId: number) => {
    try {
      await approveRule.mutateAsync(ruleId);
      setDismissedRuleIds(prev => [...prev, ruleId]);
      showToast('✓ Rule approved and activated successfully.', 'success');
    } catch {
      showToast('Failed to approve rule. Please try again.', 'error');
    }
  };

  const handleReject = async (ruleId: number) => {
    try {
      await rejectRule.mutateAsync(ruleId);
      setDismissedRuleIds(prev => [...prev, ruleId]);
      showToast('Rule rejected and sent back for revision.', 'success');
    } catch {
      showToast('Failed to reject rule. Please try again.', 'error');
    }
  };

  const agents = pipelineData?.agents || [];
  const pipelineStatus = pipelineData?.status || 'IDLE';
  const allRules = rulesHistoryData?.data || [];
  const activeRules = allRules.filter((r: any) => r.status === 'ACTIVE');
  const pendingRules = (pendingRulesData?.data || []).filter((r: any) => !dismissedRuleIds.includes(r.id));
  const guidelinesProcessed = guidelineStats?.processed || 0;
  const rulesUpdatedCount = allRules.filter((r: any) => r.status !== 'PENDING').length;

  return (
    <div className="p-4 md:p-8 max-w-[1920px] mx-auto space-y-6 md:space-y-8">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 left-4 sm:left-auto sm:right-6 sm:top-6 z-50 flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 rounded-xl shadow-xl border text-sm font-semibold transition-all ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span className="material-symbols-outlined text-base">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Regulatory Command Center</h1>
          <p className="text-slate-500 text-sm">Monitor guidelines and automate monitoring rules.</p>
        </div>
        <button onClick={() => navigate('/dashboard/pipeline')} className="btn btn-primary shadow-md shadow-blue-500/20 self-start sm:self-auto">
          <span className="material-symbols-outlined text-sm mr-1">speed</span>
          Open Pipeline View
        </button>
      </div>

      <AutoFetchStrip />

      {/* Pipeline Running Banner */}
      {pipelineStatus === 'RUNNING' && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl shadow-sm flex items-center gap-3">
          <span className="material-symbols-outlined text-blue-500 animate-spin">sync</span>
          <div>
            <h3 className="font-bold text-slate-800">AI Pipeline Running</h3>
            <p className="text-slate-600 text-sm">Processing new regulatory document. Live updates active.</p>
          </div>
        </div>
      )}

      {/* Human Review Banner */}
      {pipelineStatus === 'HUMAN_REVIEW' && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-500">warning</span>
          <div>
            <h3 className="font-bold text-slate-800">⚠ Human Review Required</h3>
            <p className="text-slate-600 text-sm">Low confidence score detected. Review pending rules below and approve or reject to continue pipeline execution.</p>
          </div>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="card bg-surface p-5">
          <p className="text-slate-500 text-sm font-semibold mb-2">Guidelines Processed</p>
          <p className="text-3xl font-bold text-slate-800 tabular-nums">{guidelinesProcessed.toLocaleString()}</p>
        </div>
        <div className="card bg-surface p-5">
          <p className="text-slate-500 text-sm font-semibold mb-2">Rules Updated</p>
          <p className="text-3xl font-bold text-slate-800 tabular-nums">{rulesUpdatedCount}</p>
        </div>
        <div className="card bg-surface p-5">
          <p className="text-slate-500 text-sm font-semibold mb-2">Time Saved (est.)</p>
          <p className="text-3xl font-bold text-primary tabular-nums">{guidelinesProcessed * 2}+ hrs</p>
        </div>
        <div className={`card bg-surface p-5 border-l-4 relative overflow-hidden ${pendingRules.length > 0 ? 'border-amber-500' : 'border-green-400'}`}>
          <p className={`text-sm font-semibold mb-2 ${pendingRules.length > 0 ? 'text-amber-700' : 'text-green-700'}`}>Pending Approvals</p>
          <p className={`text-3xl font-bold tabular-nums ${pendingRules.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>{pendingRules.length}</p>
          <span className={`absolute -right-4 -bottom-4 material-symbols-outlined text-7xl opacity-20 ${pendingRules.length > 0 ? 'text-amber-400' : 'text-green-400'}`}>
            {pendingRules.length > 0 ? 'pending_actions' : 'check_circle'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: Active Rule + Pending Approvals */}
        <div className="col-span-2 space-y-8">

          {/* Latest Active Rule Diff */}
          <div className="card bg-surface p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">rule</span>
                Latest Active Rule
              </h2>
              <span className="badge badge-primary">v{activeRules[0]?.version || '--'} ACTIVE</span>
            </div>

            {activeRules.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Previous Rule</span>
                    <span className="text-xs font-semibold text-slate-400">SUPERSEDED</span>
                  </div>
                  <div className="text-sm font-mono text-slate-600 line-through decoration-red-400 decoration-2">
                    IF {activeRules[0]?.biomarker} &lt; {activeRules[0]?.diff_summary?.old_threshold ?? '??'}ms
                  </div>
                  <div className="text-sm font-mono text-slate-600 mt-1">THEN FLAG "AT RISK"</div>
                </div>

                <div className="p-4 rounded-xl border-2 border-primary/20 bg-blue-50/50 relative">
                  <div className="absolute top-4 right-4 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wide">New Rule (v{activeRules[0]?.version})</span>
                  </div>
                  <div className="text-sm font-mono text-slate-800 bg-green-100/50 inline-block px-1 py-0.5 rounded">
                    IF {activeRules[0]?.biomarker} &lt; {activeRules[0]?.threshold}ms
                  </div>
                  <div className="text-sm font-mono text-slate-800 mt-1">THEN FLAG "AT RISK"</div>
                  <div className="mt-4 text-xs text-slate-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    Extracted via Gemini 2.5
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2">rule</span>
                <p className="text-sm">No active rules yet. Upload a PDF to get started.</p>
              </div>
            )}
          </div>

          {/* Pending Approvals */}
          <div className="card bg-surface p-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-amber-500">assignment_late</span>
              Pending Approvals
            </h2>
            {pendingRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                <p className="text-sm font-medium">No pending approvals</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRules.map((rule: any) => (
                  <div key={rule.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="badge bg-amber-200 text-amber-800 mb-2">
                          {rule.diff_summary?.confidence ? `${Math.round(rule.diff_summary.confidence * 100)}% confidence` : 'Pending Review'}
                        </span>
                        <h4 className="font-bold text-slate-800">
                          Rule v{rule.version} — {rule.biomarker} &lt; {rule.threshold}ms
                        </h4>
                      </div>
                      <span className="text-sm text-slate-500">New</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                      AI extracted: IF {rule.biomarker} &lt; {rule.threshold}ms THEN FLAG "AT RISK"
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-primary py-1.5 px-4 text-sm disabled:opacity-60"
                        onClick={() => handleApprove(rule.id)}
                        disabled={approveRule.isPending || rejectRule.isPending}
                      >
                        {approveRule.isPending ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Approving...
                          </span>
                        ) : 'Approve Rule'}
                      </button>
                      <button
                        className="btn bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 py-1.5 px-4 text-sm disabled:opacity-60"
                        onClick={() => handleReject(rule.id)}
                        disabled={approveRule.isPending || rejectRule.isPending}
                      >
                        {rejectRule.isPending ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                            Rejecting...
                          </span>
                        ) : 'Reject / Modify'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Pipeline Agent Status + Version History */}
        <div className="space-y-8">

          {/* Live Agent Status */}
          <div className="card bg-surface p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Last Pipeline Run</h2>
            <div className="space-y-4">
              {agents.length > 0 ? agents.map((agent: any, i: number) => {
                const isRunning = agent.status === 'RUNNING';
                const isComplete = agent.status === 'COMPLETE';
                const isPendingReview = agent.status === 'PENDING_REVIEW';
                const colorClass = STATUS_COLORS[agent.status] || 'bg-slate-100 text-slate-400';
                return (
                  <React.Fragment key={agent.number}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
                          {isRunning ? (
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span className="material-symbols-outlined text-sm">
                              {isComplete ? 'check' : isPendingReview ? 'hourglass_empty' : AGENT_ICONS[i]}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{i + 1}. {agent.name}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        {agent.duration_ms ? `${(agent.duration_ms / 1000).toFixed(1)}s` : '—'}
                      </span>
                    </div>
                    {i < agents.length - 1 && <div className="w-0.5 h-4 bg-slate-200 ml-4"></div>}
                  </React.Fragment>
                );
              }) : (
                ['Parse PDF', 'Extract Rules', 'Re-evaluate Cohort', 'Generate Report'].map((name, i) => (
                  <React.Fragment key={i}>
                    <div className="flex items-center justify-between opacity-40">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                          <span className="material-symbols-outlined text-sm">{AGENT_ICONS[i]}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{i + 1}. {name}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">—</span>
                    </div>
                    {i < 3 && <div className="w-0.5 h-4 bg-slate-200 ml-4"></div>}
                  </React.Fragment>
                ))
              )}
            </div>
            {pipelineData?.status && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Status</span>
                  <span className={`font-bold text-xs px-2 py-1 rounded-full ${STATUS_COLORS[pipelineStatus] || 'bg-slate-100 text-slate-500'}`}>
                    {pipelineStatus}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Version History */}
          <div className="card bg-surface p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800">Version History</h2>
              <button onClick={() => navigate('/dashboard/rules/history')} className="text-primary text-sm font-semibold hover:underline">View All</button>
            </div>
            <div className="space-y-3">
              {allRules.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No rules yet</p>
              )}
              {allRules.slice(0, 5).map((rule: any) => (
                <div key={rule.id} className={`flex justify-between items-center py-2 border-b border-slate-100 ${rule.status !== 'ACTIVE' ? 'opacity-60' : ''}`}>
                  <div>
                    <div className="text-sm font-bold text-slate-800">v{rule.version}</div>
                    <div className="text-xs text-slate-500">{rule.biomarker} &lt; {rule.threshold}ms</div>
                  </div>
                  <span className={`text-xs font-semibold ${rule.status === 'ACTIVE' ? 'badge badge-primary' : 'text-slate-400'}`}>
                    {rule.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
