import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';

export const RoleSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    if (newRole === 'login') {
      localStorage.removeItem('jwt');
      localStorage.removeItem('userRole');
      navigate('/login');
      return;
    }
    
    let username = '';
    if (newRole === 'REGULATORY_AFFAIRS') username = 'priya';
    else if (newRole === 'DATA_MANAGER') username = 'arjun';
    else if (newRole === 'DOCTOR') username = 'ramesh';

    if (username) {
      try {
        const res = await apiClient.post('/auth/login', { username });
        localStorage.setItem('jwt', res.data.access_token);
        localStorage.setItem('userRole', res.data.user?.role || newRole);
        
        if (newRole === 'REGULATORY_AFFAIRS') window.location.href = '/dashboard/regulatory';
        else if (newRole === 'DATA_MANAGER') window.location.href = '/dashboard/datamanager';
        else if (newRole === 'DOCTOR') window.location.href = '/dashboard/doctor';
      } catch (err) {
        console.error('Failed to switch role:', err);
      }
    }
  };

  if (location.pathname === '/login' || location.pathname === '/') return null;

  const currentRole = localStorage.getItem('userRole') || '';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 font-medium">DEMO ROLE:</span>
      <select 
        value={currentRole} 
        onChange={handleRoleChange}
        className="text-sm border border-slate-200 rounded px-2 py-1 bg-slate-50 outline-none hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <option value="REGULATORY_AFFAIRS">Priya (Regulatory)</option>
        <option value="DATA_MANAGER">Arjun (Data Mgr)</option>
        <option value="DOCTOR">Dr. Ramesh (PI)</option>
        <option value="login">Logout</option>
      </select>
    </div>
  );
};
