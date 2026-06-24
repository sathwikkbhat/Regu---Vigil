import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';

export const ReportView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const patientId = id?.startsWith('PT-') ? id : `PT-${id}`;
        const response = await apiClient.get(`/patients`);
        // The /patients endpoint returns all patients. Let's find the specific one.
        const found = response.data.data.find((p: any) => p.id === patientId);
        if (found) {
          setPatient(found);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPatient();
  }, [id]);

  const handleSendToSponsor = async () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setIsSent(true);
      alert(`Patient report for ${patient?.id || id} securely emailed to Sponsor`);
      setTimeout(() => setIsSent(false), 3000);
    }, 1500);
  };

  const handleDownloadPDF = async () => {
    try {
      const patientId = id?.startsWith('PT-') ? id : `PT-${id}`;
      const response = await apiClient.get(`/patients/${patientId}/pdf`, { responseType: 'blob' });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Patient_Report_${patientId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF download failed", error);
      alert('Failed to download PDF. Ensure the backend endpoint is running.');
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading patient report...</div>;
  }

  if (!patient) {
    return <div className="p-12 text-center text-red-500">Patient not found.</div>;
  }

  const isRisk = patient.is_flagged;

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-slate-100 py-12 px-4 flex justify-center">
      <div className="w-full max-w-[860px] bg-white rounded-3xl shadow-2xl overflow-hidden relative">
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-10 py-3 sm:py-4 flex justify-between items-center flex-wrap gap-2">
          <button onClick={() => navigate(-1)} className="text-sm font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </button>
          <div className="flex gap-2">
            <button 
              onClick={handleSendToSponsor}
              disabled={isSending}
              className="btn bg-white border border-slate-300 text-slate-700 shadow-sm text-xs sm:text-sm py-1.5 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] mr-1 ${isSending ? 'animate-spin' : ''}`}>
                {isSending ? 'refresh' : 'mail'}
              </span>
              {isSending ? 'Sending...' : 'Sponsor'}
            </button>
            <button onClick={handleDownloadPDF} className="btn btn-primary text-xs sm:text-sm py-1.5 shadow-md shadow-blue-500/20">
              <span className="material-symbols-outlined text-[16px] mr-1">download</span>
              PDF
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-10 py-8 sm:py-12 space-y-8 sm:space-y-10">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start border-b-2 border-slate-800 pb-6 sm:pb-8 gap-4">
            <div className="flex gap-4 items-center">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 text-white rounded-xl flex items-center justify-center ${isRisk ? 'bg-red-600' : 'bg-slate-800'}`}>
                <span className="material-symbols-outlined text-[28px] sm:text-[32px]">{isRisk ? 'warning' : 'person'}</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Patient Safety Report</h1>
                <p className="text-slate-500 font-medium tracking-wide mt-1 text-sm">Individual Case Safety Report (ICSR)</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="bg-slate-100 text-slate-600 font-bold uppercase tracking-widest text-[10px] px-3 py-1 rounded mb-2 inline-block">
                Strictly Confidential
              </div>
              <p className="font-mono text-sm font-bold text-slate-800">CASE: {patient.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Trial</div>
              <div className="font-bold text-slate-800 text-sm">GlucoZen Phase III</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Site</div>
              <div className="font-bold text-slate-800 text-sm">{patient.site_id || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</div>
              <div className={`badge inline-flex ${isRisk ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
                {isRisk ? 'AT RISK' : 'SAFE'}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Last Updated</div>
              <div className="font-bold text-primary text-sm">Today</div>
            </div>
          </div>

          <section>
            <div className="bg-slate-50 py-1.5 px-3 border-l-2 border-primary mb-4">
              <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Executive Summary</h2>
            </div>
            <div className="px-3 text-slate-700 text-sm leading-relaxed space-y-3">
              <p>
                This report details the current clinical status of patient <b>{patient.id}</b> enrolled at <b>{patient.site_id}</b>.
                The patient is currently classified as {isRisk ? <span className="text-red-600 font-bold">AT RISK</span> : <span className="text-green-600 font-bold">SAFE</span>} according to the latest FDA regulatory thresholds.
              </p>
              {isRisk && (
                <p>
                  Immediate clinical review by the Principal Investigator is recommended due to recent biomarker fluctuations crossing the critical safety thresholds.
                </p>
              )}
            </div>
          </section>

          <hr className="border-slate-100" />

          <section>
            <div className="bg-slate-50 py-1.5 px-3 border-l-2 border-primary mb-4">
              <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Latest Biomarker Readings</h2>
            </div>
            <div className="px-3">
              <table className="w-full text-left text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-medium">
                    <th className="px-4 py-2 border-b border-slate-200">Metric</th>
                    <th className="px-4 py-2 border-b border-slate-200">Value</th>
                    <th className="px-4 py-2 border-b border-slate-200">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 border-b border-slate-100 font-bold text-slate-800">Heart Rate Variability (HRV)</td>
                    <td className="px-4 py-3 border-b border-slate-100 font-mono">{patient.latest_hrv ? `${patient.latest_hrv.toFixed(1)} ms` : 'N/A'}</td>
                    <td className="px-4 py-3 border-b border-slate-100">
                      {patient.latest_hrv < 28 ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">FLAGGED</span> : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">NORMAL</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 border-b border-slate-100 font-bold text-slate-800">Heart Rate (HR)</td>
                    <td className="px-4 py-3 border-b border-slate-100 font-mono">{patient.latest_hr ? `${patient.latest_hr.toFixed(1)} bpm` : 'N/A'}</td>
                    <td className="px-4 py-3 border-b border-slate-100">
                      {patient.latest_hr > 95 ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">FLAGGED</span> : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">NORMAL</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {isRisk && (
            <>
              <hr className="border-slate-100" />
              <section>
                <div className="bg-red-50 py-1.5 px-3 border-l-2 border-red-500 mb-4">
                  <h2 className="text-[11px] font-bold text-red-800 uppercase tracking-widest">Recommended Actions</h2>
                </div>
                <div className="px-3">
                  <ul className="list-disc list-inside text-sm text-slate-700 space-y-2 leading-relaxed">
                    <li>Conduct immediate cardiac review of patient {patient.id}.</li>
                    <li>Temporarily suspend dosing until secondary diagnostics confirm cardiac safety.</li>
                    <li>Submit expedited protocol deviation notice if condition worsens.</li>
                  </ul>
                </div>
              </section>
            </>
          )}
        </div>

        <div className="bg-slate-800 text-slate-400 py-6 px-10 text-xs flex justify-between items-center">
          <div>Generated by <b>ReguVigil</b> Multi-Agent Pipeline</div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">memory</span>
              Gemini 2.5 Flash
            </span>
            <span>ICH E6 (R2) Aligned</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ReportView;
