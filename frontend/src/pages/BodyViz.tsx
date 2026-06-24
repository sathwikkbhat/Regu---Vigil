import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { usePatientReadings, usePatientCopilot } from '../api/queries';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  'Should we withhold study drug?',
  'What does the HRV trend indicate?',
  'Recommended immediate actions?',
  'Is this patient at high cardiac risk?',
];

export const BodyViz: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const patientId = id || 'PT-8091';

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'ai',
      text: `Hello! I'm the ReguVigil AI Copilot. I have access to ${patientId}'s live biomarker data. Ask me anything about their clinical status, risk assessment, or recommended actions.`,
      timestamp: new Date(),
    }
  ]);
  const [heartbeatPhase, setHeartbeatPhase] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: readingsData } = usePatientReadings(patientId);
  const copilot = usePatientCopilot();

  // Derive chart data from readings
  const readings = readingsData?.readings || [];
  const hrvReadings = readings
    .filter((r: any) => r.biomarker === 'HRV_SDNN')
    .slice(-30)
    .map((r: any, i: number) => ({ day: `D${i + 1}`, hrv: Math.round(r.value) }));

  const latestHRV = readings.filter((r: any) => r.biomarker === 'HRV_SDNN').slice(-1)[0]?.value;
  const latestHR = readings.filter((r: any) => r.biomarker === 'Heart_Rate').slice(-1)[0]?.value;
  const isAtRisk = latestHRV != null && latestHRV < 28;

  // Pulsing heartbeat animation
  useEffect(() => {
    const interval = setInterval(() => setHeartbeatPhase(p => (p + 1) % 100), 30);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim()) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', text: question, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);

    // Optimistic AI typing indicator
    const thinkingMsg: ChatMessage = { role: 'ai', text: '...', timestamp: new Date() };
    setMessages(prev => [...prev, thinkingMsg]);

    try {
      const result = await copilot.mutateAsync({ patientId, question });
      setMessages(prev => [
        ...prev.slice(0, -1), // remove thinking indicator
        { role: 'ai', text: result.answer, timestamp: new Date() }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'ai', text: `Unable to reach AI Copilot. Please ensure the backend is running. Fallback: Patient ${patientId} shows ${isAtRisk ? 'CRITICAL — HRV below 28ms threshold' : 'stable biomarker readings'}.`, timestamp: new Date() }
      ]);
    }
  };

  // Build heartbeat path animation
  const getHeartbeatPath = () => {
    const progress = heartbeatPhase / 100;
    return `M0,10 L${progress * 15},10 L${progress * 15 + 5},-5 L${progress * 15 + 12},25 L${progress * 15 + 18},10 L50,10`;
  };

  const chartData = hrvReadings.length > 0 ? hrvReadings : [
    { day: 'D1', hrv: 35 }, { day: 'D10', hrv: 31 }, { day: 'D20', hrv: 29 }, { day: 'D28', hrv: 25 }, { day: 'D30', hrv: 24 }
  ];

  return (
    <div className="h-[calc(100vh-64px)] w-full bg-[#0F172A] flex overflow-hidden">
      
      {/* Left Data Panel */}
      <div className="w-[420px] bg-[#1E293B] border-r border-slate-700/50 flex flex-col h-full shadow-2xl z-10 relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-4 mb-4">
            <button 
              onClick={() => navigate('/dashboard/doctor')}
              className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-600 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <h1 className="text-xl font-bold text-white tracking-wide">Patient Scan</h1>
          </div>
          
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-mono font-bold text-white">{patientId}</h2>
              <p className="text-slate-400 text-sm mt-1">Clinical Trial Participant · Site 3</p>
            </div>
            <span className={`badge ${isAtRisk ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
              {isAtRisk ? 'AT RISK' : 'SAFE'}
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Biomarkers */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Live Vitals</h3>
            <div className="space-y-3">
              <div className={`bg-slate-800/50 rounded-lg p-3 border ${isAtRisk ? 'border-red-500/30' : 'border-slate-700/50'} flex justify-between items-center relative overflow-hidden`}>
                {isAtRisk && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />}
                <div>
                  <div className="text-sm text-slate-400">HRV (SDNN)</div>
                  <div className={`text-2xl font-bold text-white tracking-tight`}>
                    {latestHRV != null ? Math.round(latestHRV) : '—'}
                    <span className={`text-xs ml-1 ${isAtRisk ? 'text-red-400' : 'text-green-400'}`}>ms</span>
                  </div>
                  {isAtRisk && <div className="text-xs text-red-400 font-bold mt-0.5">⚠ Below 28ms threshold</div>}
                </div>
                <div className="h-10 w-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.slice(-10)}>
                      <Line type="monotone" dataKey="hrv" stroke={isAtRisk ? '#EF4444' : '#22c55e'} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 flex justify-between items-center">
                <div>
                  <div className="text-sm text-slate-400">Heart Rate</div>
                  <div className="text-xl font-bold text-slate-200 tracking-tight">
                    {latestHR != null ? Math.round(latestHR) : '—'}
                    <span className="text-xs text-slate-500 ml-1">bpm</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-green-400 text-2xl">favorite</span>
              </div>
            </div>
          </div>

          {/* HRV 30-day trend */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">30-Day HRV Trend</h3>
            <div className="h-28 bg-slate-900/60 rounded-lg p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any) => [`${v} ms`, 'HRV SDNN']}
                  />
                  <ReferenceLine y={28} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.6} />
                  <Line type="monotone" dataKey="hrv" stroke={isAtRisk ? '#ef4444' : '#22c55e'} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Regulatory Context */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Rule Violation</h3>
            <div className="bg-[#0F172A] rounded-xl p-4 border border-slate-700 shadow-inner">
              <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-700/50">
                <span className="text-sm font-bold text-primary">v1.3 Active</span>
                <span className="text-xs font-mono text-slate-400">HRV &lt; 28ms</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {isAtRisk
                  ? <>Patient HRV of <span className="text-red-400 font-bold">{latestHRV != null ? `${Math.round(latestHRV)}ms` : '—'}</span> breaches the active threshold. They would have been SAFE under the superseded v1.2 rule (25ms).</>
                  : <>Patient HRV of <span className="text-green-400 font-bold">{latestHRV != null ? `${Math.round(latestHRV)}ms` : '—'}</span> is within the safe range. Continue standard monitoring per protocol.</>
                }
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-slate-700/50">
            <button 
              onClick={() => navigate(`/dashboard/report/${patientId}`)}
              className="w-full bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/30 rounded-lg py-3 flex items-center justify-center gap-2 font-bold transition-all"
            >
              <span className="material-symbols-outlined">download</span>
              View PV Safety Report
            </button>
          </div>
        </div>
      </div>

      {/* Right Area: Body Viz + AI Chat */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        
        {/* Body Viz background */}
        <div className="flex-1 relative flex justify-center items-center overflow-hidden">
          
          {/* Background */}
          <div className="absolute inset-0 z-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/40 via-[#0F172A] to-[#0F172A]" />
            <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(#1E293B 1px, transparent 1px), linear-gradient(90deg, #1E293B 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          </div>

          {/* Body Figure */}
          <div className="relative z-10 w-full h-full flex justify-center items-center">
            <div className="relative h-[70vh] aspect-[1/2] opacity-80 mix-blend-screen flex justify-center items-center">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-400/20 via-teal-400/10 to-transparent blur-3xl rounded-full scale-50" />
              
              <svg viewBox="0 0 200 500" className="w-full h-full drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">
                <path d="M100,20 C120,20 130,35 130,55 C130,80 110,85 100,90 C90,85 70,80 70,55 C70,35 80,20 100,20 Z" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M70,95 C40,95 20,110 20,150 L30,280 C30,300 50,300 50,280 L60,180 L60,300 L40,480 C40,490 60,490 65,480 L85,320 L100,340 L115,320 L135,480 C140,490 160,490 160,480 L140,300 L140,180 L150,280 C150,300 170,300 170,280 L180,150 C180,110 160,95 130,95 L70,95 Z" fill="none" stroke="#38bdf8" strokeWidth="2" opacity="0.6"/>
                {[120, 160, 200, 240, 280].map(y => (
                  <circle key={y} cx="100" cy={y} r="3" fill="#38bdf8" opacity="0.8" />
                ))}
                <line x1="100" y1="120" x2="60" y2="180" stroke="#38bdf8" strokeWidth="1" opacity="0.3" />
                <line x1="100" y1="120" x2="140" y2="180" stroke="#38bdf8" strokeWidth="1" opacity="0.3" />
              </svg>

              {/* Animated Heart Node */}
              <div className="absolute top-[28%] left-1/2 -translate-x-[20px] -translate-y-1/2 z-20">
                <div className="relative flex justify-center items-center w-4 h-4">
                  <span className={`absolute inline-flex h-20 w-20 rounded-full ${isAtRisk ? 'bg-red-500' : 'bg-green-500'} opacity-20 animate-[ping_1.5s_ease-in-out_infinite]`} />
                  <span className={`absolute inline-flex h-10 w-10 rounded-full ${isAtRisk ? 'bg-red-500' : 'bg-green-500'} opacity-30 animate-[ping_1.5s_ease-in-out_infinite_0.3s]`} />
                  <span className={`relative inline-flex rounded-full h-4 w-4 ${isAtRisk ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,1)]' : 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,1)]'}`} />
                  
                  {/* Pointer Line */}
                  <div className={`absolute left-4 top-1/2 w-32 h-[1px] ${isAtRisk ? 'bg-red-500/50' : 'bg-green-500/50'} origin-left -rotate-12`} />
                  
                  {/* Label Overlay */}
                  <div className="absolute left-32 -top-8 bg-slate-900/90 border border-slate-600/50 backdrop-blur px-3 py-2 rounded shadow-2xl whitespace-nowrap z-30">
                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2 ${isAtRisk ? 'text-red-400' : 'text-green-400'}`}>
                      <span className="material-symbols-outlined text-[14px]">{isAtRisk ? 'warning' : 'check_circle'}</span>
                      {isAtRisk ? 'Cardiac Anomaly' : 'Cardiac Normal'}
                    </div>
                    <div className="flex items-center gap-2 text-white font-mono text-sm">
                      HRV: {latestHRV != null ? `${Math.round(latestHRV)}ms` : '—'}
                      <svg className={`w-8 h-4 ${isAtRisk ? 'text-red-500' : 'text-green-500'}`} viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d={getHeartbeatPath()} />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HUD */}
          <div className="absolute top-8 right-8 flex gap-3 z-20">
            <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700 rounded-lg p-3 text-center w-24">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Status</div>
              <div className={`text-sm font-bold ${isAtRisk ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>{isAtRisk ? 'AT RISK' : 'SAFE'}</div>
            </div>
            <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700 rounded-lg p-3 text-center w-24">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Scan Sync</div>
              <div className="text-sm font-mono text-green-400 animate-pulse">LIVE</div>
            </div>
            <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700 rounded-lg p-3 text-center w-24">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">HRV SDNN</div>
              <div className={`text-sm font-mono font-bold ${isAtRisk ? 'text-red-400' : 'text-green-400'}`}>{latestHRV != null ? `${Math.round(latestHRV)}ms` : '—'}</div>
            </div>
          </div>
        </div>

        {/* AI Copilot Chat Panel */}
        <div className="bg-slate-900/95 backdrop-blur-md border-t border-slate-700/60 flex flex-col" style={{ height: 340 }}>
          
          {/* Chat Header */}
          <div className="px-5 py-3 border-b border-slate-700/60 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[16px]">smart_toy</span>
              </div>
              <div>
                <div className="text-sm font-bold text-white">ReguVigil AI Copilot</div>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${copilot.isPending ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`} />
                  {copilot.isPending ? 'Analyzing...' : 'Powered by Gemini 2.5 Flash'}
                </div>
              </div>
            </div>
            {/* Quick question pills */}
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {QUICK_QUESTIONS.slice(0,2).map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={copilot.isPending}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-full px-3 py-1 whitespace-nowrap transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 custom-scrollbar">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                    <span className="material-symbols-outlined text-white text-[12px]">smart_toy</span>
                  </div>
                )}
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : msg.text === '...'
                    ? 'bg-slate-800 text-slate-400 rounded-tl-sm'
                    : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                }`}>
                  {msg.text === '...' ? (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input Row */}
          <div className="px-4 py-3 border-t border-slate-700/60 flex items-center gap-2 flex-shrink-0">
            <div className="flex-1 bg-slate-800 border border-slate-600/60 rounded-xl flex items-center overflow-hidden">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !copilot.isPending && sendMessage(input)}
                placeholder="Ask about this patient's condition..."
                className="flex-1 bg-transparent border-none text-white text-sm px-4 py-2.5 focus:outline-none placeholder-slate-500"
                disabled={copilot.isPending}
              />
              <div className="flex gap-1 pr-2">
                {QUICK_QUESTIONS.slice(2).map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    disabled={copilot.isPending}
                    title={q}
                    className="text-xs text-slate-400 hover:text-white p-1 transition-colors disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[14px]">bolt</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || copilot.isPending}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all"
            >
              {copilot.isPending
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-sm">send</span>
              }
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dash {
          0% { stroke-dashoffset: 60; }
          50% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -60; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
      `}</style>
    </div>
  );
};
