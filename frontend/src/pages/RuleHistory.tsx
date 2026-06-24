import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const RuleHistory: React.FC = () => {
  const navigate = useNavigate();
  const [selectedVersion, setSelectedVersion] = useState<string>('v1.3');

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button 
          onClick={() => navigate('/dashboard/regulatory')}
          className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rule Version History</h1>
          <p className="text-slate-500">Track and audit changes to automated monitoring parameters.</p>
        </div>
      </div>

      {/* Active Rule Banner */}
      <div className="bg-white border border-slate-200 border-l-4 border-l-primary p-4 sm:p-5 rounded-r-xl shadow-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="badge badge-primary font-bold">ACTIVE</span>
            <span className="font-mono text-sm font-bold text-slate-800">v1.3 • HRV SDNN Threshold Update</span>
          </div>
          <p className="text-sm text-slate-500">Effective: Oct 24, 2026 • Triggered by FDA Guideline Revision</p>
        </div>
        <button className="btn bg-slate-50 text-slate-600 border border-slate-200 text-sm self-start sm:self-auto">Download Audit Log</button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Left: Version Timeline */}
        <div className="md:w-[35%] bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-6">Timeline</h3>
          
          <div className="relative border-l-2 border-slate-100 ml-3 space-y-8 pb-4">
            
            {/* v1.3 */}
            <div 
              className={`relative pl-6 cursor-pointer group ${selectedVersion === 'v1.3' ? '' : 'opacity-60 hover:opacity-100'}`}
              onClick={() => setSelectedVersion('v1.3')}
            >
              <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${selectedVersion === 'v1.3' ? 'bg-primary border-white ring-4 ring-blue-100' : 'bg-white border-slate-300 group-hover:border-primary'}`}></div>
              <h4 className={`font-bold ${selectedVersion === 'v1.3' ? 'text-primary' : 'text-slate-800'}`}>Version 1.3</h4>
              <p className="text-xs text-slate-500 font-medium mb-1">Oct 24, 2026 • 10:42 AM</p>
              <p className="text-sm text-slate-600">Threshold adjusted to 28ms</p>
              <div className="text-[10px] uppercase font-bold text-slate-400 mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">person</span>
                System Auto-Generated
              </div>
            </div>

            {/* v1.2 */}
            <div 
              className={`relative pl-6 cursor-pointer group ${selectedVersion === 'v1.2' ? '' : 'opacity-60 hover:opacity-100'}`}
              onClick={() => setSelectedVersion('v1.2')}
            >
              <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${selectedVersion === 'v1.2' ? 'bg-slate-600 border-white ring-4 ring-slate-100' : 'bg-white border-slate-300 group-hover:border-slate-500'}`}></div>
              <h4 className={`font-bold ${selectedVersion === 'v1.2' ? 'text-slate-800' : 'text-slate-800'}`}>Version 1.2 <span className="font-normal text-slate-400 text-xs ml-2">(SUPERSEDED)</span></h4>
              <p className="text-xs text-slate-500 font-medium mb-1">May 12, 2026 • 09:15 AM</p>
              <p className="text-sm text-slate-600">Threshold adjusted to 25ms</p>
              <div className="text-[10px] uppercase font-bold text-slate-400 mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">person</span>
                Approved by Priya S.
              </div>
            </div>

            {/* v1.1 */}
            <div 
              className={`relative pl-6 cursor-pointer group ${selectedVersion === 'v1.1' ? '' : 'opacity-60 hover:opacity-100'}`}
              onClick={() => setSelectedVersion('v1.1')}
            >
              <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${selectedVersion === 'v1.1' ? 'bg-slate-600 border-white ring-4 ring-slate-100' : 'bg-white border-slate-300 group-hover:border-slate-500'}`}></div>
              <h4 className={`font-bold ${selectedVersion === 'v1.1' ? 'text-slate-800' : 'text-slate-800'}`}>Version 1.1 <span className="font-normal text-slate-400 text-xs ml-2">(SUPERSEDED)</span></h4>
              <p className="text-xs text-slate-500 font-medium mb-1">Jan 05, 2026 • 08:00 AM</p>
              <p className="text-sm text-slate-600">Initial Rule Creation (20ms)</p>
            </div>

          </div>
        </div>

        {/* Right: Diff Viewer */}
        <div className="md:w-[65%] space-y-6">
          
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400">difference</span>
                Semantic Diff View
              </h3>
              {selectedVersion === 'v1.3' && (
                <div className="flex gap-2">
                  <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">1 Deletion</span>
                  <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">1 Addition</span>
                </div>
              )}
            </div>

            <div className="p-0 font-mono text-sm">
              {selectedVersion === 'v1.3' ? (
                <>
                  <div className="grid grid-cols-[50px_1fr] border-b border-slate-100">
                    <div className="bg-slate-50 border-r border-slate-200 text-slate-400 text-right pr-2 py-2">1</div>
                    <div className="py-2 px-4 text-slate-700">{"{"}</div>
                  </div>
                  <div className="grid grid-cols-[50px_1fr] border-b border-slate-100">
                    <div className="bg-slate-50 border-r border-slate-200 text-slate-400 text-right pr-2 py-2">2</div>
                    <div className="py-2 px-4 text-slate-700">&nbsp;&nbsp;"biomarker": "HRV_SDNN",</div>
                  </div>
                  <div className="grid grid-cols-[50px_1fr] bg-red-50 border-b border-slate-100">
                    <div className="bg-red-100 border-r border-red-200 text-red-400 text-right pr-2 py-2">3</div>
                    <div className="py-2 px-4 text-red-800 line-through">&nbsp;&nbsp;"threshold": 25,</div>
                  </div>
                  <div className="grid grid-cols-[50px_1fr] bg-green-50 border-b border-slate-100 relative">
                    <div className="bg-green-100 border-r border-green-200 text-green-600 text-right pr-2 py-2">4</div>
                    <div className="py-2 px-4 text-green-800 font-bold">&nbsp;&nbsp;"threshold": 28,</div>
                    <div className="absolute left-[50px] top-0 bottom-0 w-[2px] bg-green-500"></div>
                  </div>
                  <div className="grid grid-cols-[50px_1fr] border-b border-slate-100">
                    <div className="bg-slate-50 border-r border-slate-200 text-slate-400 text-right pr-2 py-2">5</div>
                    <div className="py-2 px-4 text-slate-700">&nbsp;&nbsp;"operator": "LT",</div>
                  </div>
                  <div className="grid grid-cols-[50px_1fr]">
                    <div className="bg-slate-50 border-r border-slate-200 text-slate-400 text-right pr-2 py-2">6</div>
                    <div className="py-2 px-4 text-slate-700">{"}"}</div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-slate-500 font-sans flex flex-col items-center">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">history</span>
                  <p>Select a version with a diff to view changes.</p>
                </div>
              )}
            </div>
          </div>

          {selectedVersion === 'v1.3' && (
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5 border-l-4 border-l-slate-400">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">format_quote</span>
                Source PDF Excerpt (Gemini Extraction)
              </h4>
              <p className="text-[13px] text-slate-700 italic leading-relaxed pl-4 border-l border-slate-300">
                "...in light of recent post-market surveillance data across Phase III cardiac and metabolic trials, 
                the agency advises adjusting the monitoring threshold for Heart Rate Variability (SDNN). 
                The <b>critical threshold should be revised from 25ms to 28ms</b> effective immediately to reduce false-positive 
                alerts while maintaining patient safety margins."
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
