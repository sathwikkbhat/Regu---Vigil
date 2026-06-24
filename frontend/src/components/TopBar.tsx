import React, { useState } from 'react';
import { RoleSwitcher } from './RoleSwitcher';
import { apiClient } from '../api/client';

export const TopBar: React.FC = () => {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await apiClient.post('/demo/reset');
      window.history.replaceState(null, '', window.location.pathname);
      window.location.reload();
    } catch (e) {
      alert("Failed to reset demo: " + String(e));
      setIsResetting(false);
    }
  };

  return (
    <header className="topbar flex justify-between items-center">
      {/* Brand */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
        <img src="/logo.jpeg" alt="ReguVigil" className="w-8 h-8 rounded object-cover shadow-sm flex-shrink-0" />
        <span className="font-bold text-lg tracking-tight text-slate-800 hidden sm:block">ReguVigil</span>
        {/* Demo badge — only on medium screens and up */}
        <span className="ml-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-widest hidden md:inline">
          Demo
        </span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="px-2 sm:px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1"
          title="Reset Demo"
        >
          <span className="material-symbols-outlined text-[14px]">
            {isResetting ? 'hourglass_empty' : 'restart_alt'}
          </span>
          {/* Show text only on sm+ */}
          <span className="hidden sm:inline">
            {isResetting ? 'RESETTING...' : 'RESET DEMO'}
          </span>
        </button>
        <RoleSwitcher />
      </div>
    </header>
  );
};
