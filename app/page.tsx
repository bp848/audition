'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Activity, AlertTriangle, CheckCircle, BarChart2, Zap, Radio, Waves, Settings2, Play, Pause, FileAudio, Terminal, Loader2 } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface AnalysisResult {
  track_identity: {
    file_name: string;
    duration_sec: number;
    sample_rate: number;
    bpm: number;
    key: string;
    bit_depth: number;
  };
  whole_track_metrics: {
    integrated_lufs: number;
    true_peak_dbtp: number;
    lra_lu: number;
    psr_db: number;
    crest_db: number;
    stereo_width: number;
    stereo_correlation: number;
    low_mono_correlation_below_120hz: number;
    harshness_risk: number;
    mud_risk: number;
    sub_ratio: number;
    bass_ratio: number;
    low_mid_ratio: number;
    mid_ratio: number;
    high_ratio: number;
    air_ratio: number;
  };
  time_series_circuit_envelopes: {
    resolution_sec: number;
    lufs: number[];
    crest_db: number[];
    width: number[];
    sub_ratio: number[];
    bass_ratio: number[];
    vocal_presence: number[];
    spectral_brightness: number[];
    low_mono_correlation: number[];
    transient_sharpness: number[];
  };
  physical_sections: {
    start_sec: number;
    end_sec: number;
    avg_lufs: number;
    avg_width: number;
    name: string;
  }[];
  detected_problems: {
    issue: string;
    severity: string;
    value: number;
  }[];
  gemini_analysis: {
    genre: string;
    features: string;
    comments: string;
    lyrics_and_structure: {
      section: string;
      time: string;
      lyrics: string;
      changes: string;
    }[];
  };
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString().split('T')[1].slice(0, 12)}] ${msg}`]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      startBackendAnalysis(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      startBackendAnalysis(e.dataTransfer.files[0]);
    }
  };

  const [apiUrl, setApiUrl] = useState(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000');

  const startBackendAnalysis = async (selectedFile: File) => {
    const MAX_FILE_SIZE_MB = 25;
    const fileSizeMB = selectedFile.size / 1024 / 1024;

    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      alert(`File is too large (${fileSizeMB.toFixed(1)} MB).\n\nThe server accepts a maximum of ${MAX_FILE_SIZE_MB} MB due to cloud infrastructure limits. Please compress your audio (e.g., convert WAV to high-quality MP3/FLAC) or upload a shorter track.`);
      return;
    }

    setFile(selectedFile);
    setIsAnalyzing(true);
    setResult(null);
    setLogs([]);
    setAnalysisProgress(0);

    addLog(`Received file: ${selectedFile.name} (${fileSizeMB.toFixed(2)} MB)`);

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      setAnalysisProgress(10);
      setStatusText('Uploading to Concertmaster...');
      addLog('Preparing multipart/form-data payload...');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('route', 'analyze_only');

      const targetUrl = `${apiUrl.replace(/\/$/, '')}/api/v1/jobs/master`;

      addLog(`POST ${targetUrl}`);
      addLog('Delegating to Audition service for 9-dimensional physical analysis...');
      addLog('Awaiting Deliberation service for Gemini integration...');
      
      progressInterval = setInterval(() => {
        setAnalysisProgress(p => Math.min(p + 2, 95));
      }, 1000);

      const response = await fetch(targetUrl, {
        method: 'POST',
        body: formData,
      });

      if (progressInterval) clearInterval(progressInterval);

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 413 || errText.includes('413 Request Entity Too Large')) {
          throw new Error(`File too large (413). The cloud infrastructure limits uploads to ~32MB. Your file is ${fileSizeMB.toFixed(1)}MB. Please convert it to a high-quality MP3 or FLAC.`);
        }
        if (response.status === 404) {
          throw new Error(`Endpoint not found (404). Please check if the Concertmaster backend is running at ${targetUrl} and the route exists.`);
        }
        throw new Error(`Backend Error (${response.status}): ${errText}`);
      }

      setAnalysisProgress(98);
      addLog('Received 200 OK from Concertmaster.');
      addLog('Parsing 9-dimensional analysis_json...');

      const data: AnalysisResult = await response.json();

      setAnalysisProgress(100);
      addLog('Analysis complete. Rendering 9D dashboard...');
      setStatusText('Analysis Complete');

      setTimeout(() => {
        setResult(data);
        setIsAnalyzing(false);
      }, 800);

    } catch (error: any) {
      if (progressInterval) clearInterval(progressInterval);
      console.error("Analysis failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`🔴 ERROR: ${errorMessage}`);
      setStatusText('Analysis Failed');

      alert(`Failed to communicate with backend architecture.\n\nError: ${errorMessage}\n\nPlease ensure the Concertmaster backend is running at ${apiUrl} and CORS is configured to allow requests from this origin.`);
      setIsAnalyzing(false);
    }
  };

  if (result) {
    return <Dashboard result={result} onReset={() => setResult(null)} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl widget-container p-8 relative overflow-hidden">
        {/* Atmospheric background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_0%,_rgba(0,255,157,0.1)_0%,_transparent_50%)] pointer-events-none" />
        
        <div className="mb-8 text-center relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#151619] border border-[#232529] shadow-[0_0_30px_rgba(0,255,157,0.2)] mb-4">
            <Activity className="w-8 h-8 text-[#00FF9D]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">AudioAnalyzer (Circuit)</h1>
          <p className="text-[#8E9299] text-sm">Concertmaster / Audition / Deliberation Architecture</p>
        </div>

        {!isAnalyzing && (
          <div className="mb-6 relative z-10">
            <label className="block text-xs font-medium text-[#8E9299] mb-2 uppercase tracking-wider">
              Backend API URL
            </label>
            <div className="flex items-center bg-[#0d0e12] border border-[#232529] rounded-lg overflow-hidden focus-within:border-[#00FF9D]/50 transition-colors">
              <div className="px-3 text-[#8E9299]">
                <Settings2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full bg-transparent text-sm text-white py-2.5 px-2 focus:outline-none font-mono"
                placeholder="http://localhost:8000"
              />
            </div>
            <p className="text-[10px] text-[#8E9299] mt-2">
              Point this to your Concertmaster backend (e.g., ngrok URL or localhost if running locally).
            </p>
          </div>
        )}

        {!isAnalyzing ? (
          <div
            className="relative z-10 border-2 border-dashed border-[#232529] bg-[#0d0e12]/50 rounded-2xl p-12 text-center cursor-pointer hover:border-[#00FF9D]/50 hover:bg-[#00FF9D]/5 transition-all duration-300 group"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="audio/*"
              onChange={handleFileChange}
            />
            <div className="w-16 h-16 mx-auto bg-[#151619] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border border-[#232529]">
              <Upload className="w-8 h-8 text-[#00FF9D]" />
            </div>
            <p className="text-lg font-medium mb-2 text-white">Drop your audio file here</p>
            <p className="text-sm text-[#8E9299]">Supports MP3, WAV, FLAC, M4A</p>
            <p className="text-xs text-[#8E9299] mt-4 opacity-70">The file will be sent to the backend for 9-dimensional physical analysis and AI deliberation.</p>
          </div>
        ) : (
          <div className="space-y-6 relative z-10 py-4">
            <div>
              <div className="flex justify-between text-sm mb-2 mono-text">
                <span className="text-[#00FF9D] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> {statusText.toUpperCase()}
                </span>
                <span>{Math.round(analysisProgress)}%</span>
              </div>
              <div className="h-1 bg-[#232529] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#00FF9D]"
                  initial={{ width: 0 }}
                  animate={{ width: `${analysisProgress}%` }}
                />
              </div>
            </div>

            <div className="bg-[#0d0e12] border border-[#232529] rounded-lg p-4 h-48 overflow-y-auto font-mono text-xs text-[#8E9299] space-y-1 text-left flex flex-col shadow-inner">
              {logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
              <div className="animate-pulse text-[#00FF9D]">_</div>
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const chartData = result.time_series_circuit_envelopes.lufs.map((lufs, i) => ({
    time: i * result.time_series_circuit_envelopes.resolution_sec,
    lufs,
    crest: result.time_series_circuit_envelopes.crest_db[i],
    width: result.time_series_circuit_envelopes.width[i],
    vocal: result.time_series_circuit_envelopes.vocal_presence[i],
    brightness: result.time_series_circuit_envelopes.spectral_brightness[i],
    transient: result.time_series_circuit_envelopes.transient_sharpness[i],
  }));

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between widget-container px-6 py-5 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#00FF9D]/10 flex items-center justify-center border border-[#00FF9D]/20">
            <FileAudio className="w-6 h-6 text-[#00FF9D]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{result.track_identity.file_name}</h1>
            <div className="flex flex-wrap gap-3 text-xs mono-text text-[#8E9299] mt-2">
              <span className="bg-[#0d0e12] px-2 py-1 rounded border border-[#232529]">{formatDuration(result.track_identity.duration_sec)}</span>
              <span className="bg-[#0d0e12] px-2 py-1 rounded border border-[#232529]">{result.track_identity.sample_rate} Hz</span>
              <span className="bg-[#0d0e12] px-2 py-1 rounded border border-[#232529]">{result.track_identity.bit_depth} bit</span>
              <span className="bg-[#0d0e12] px-2 py-1 rounded border border-[#232529]">{result.track_identity.bpm} BPM</span>
              <span className="bg-[#0d0e12] px-2 py-1 rounded border border-[#232529]">{result.track_identity.key}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onReset}
          className="px-5 py-2.5 text-sm font-medium bg-[#232529] text-white hover:bg-[#00FF9D] hover:text-[#0d0e12] transition-colors rounded-lg border border-[#333539] hover:border-[#00FF9D]"
        >
          Analyze Another Track
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metrics Column */}
        <div className="space-y-6 lg:col-span-1">
          <div className="widget-container p-6">
            <h2 className="text-xs status-label mb-4">Global Metrics (BS.1770-4)</h2>
            <div className="space-y-4">
              <MetricRow label="Integrated LUFS" value={result.whole_track_metrics.integrated_lufs.toFixed(1)} unit="LUFS" />
              <MetricRow label="True Peak" value={result.whole_track_metrics.true_peak_dbtp.toFixed(2)} unit="dBTP" alert={result.whole_track_metrics.true_peak_dbtp > -0.3} />
              <MetricRow label="LRA" value={result.whole_track_metrics.lra_lu.toFixed(1)} unit="LU" />
              <MetricRow label="PSR" value={result.whole_track_metrics.psr_db.toFixed(1)} unit="dB" />
              <MetricRow label="Crest Factor" value={result.whole_track_metrics.crest_db.toFixed(1)} unit="dB" alert={result.whole_track_metrics.crest_db < 6} />
            </div>
          </div>

          <div className="widget-container p-6">
            <h2 className="text-xs status-label mb-4">Spatial & Risks</h2>
            <div className="space-y-4">
              <MetricRow label="Stereo Width" value={result.whole_track_metrics.stereo_width.toFixed(2)} />
              <MetricRow label="Low Mono Corr" value={result.whole_track_metrics.low_mono_correlation_below_120hz.toFixed(2)} alert={result.whole_track_metrics.low_mono_correlation_below_120hz < 0.7} />
              <MetricRow label="Harshness Risk" value={result.whole_track_metrics.harshness_risk.toFixed(2)} alert={result.whole_track_metrics.harshness_risk > 0.5} />
              <MetricRow label="Mud Risk" value={result.whole_track_metrics.mud_risk.toFixed(2)} alert={result.whole_track_metrics.mud_risk > 0.4} />
            </div>
          </div>
          
          {result.detected_problems && result.detected_problems.length > 0 && (
            <div className="widget-container p-6 border-[#FF4444]/30">
              <h2 className="text-xs status-label mb-4 text-[#FF4444] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Detected Problems
              </h2>
              <div className="space-y-3">
                {result.detected_problems.map((prob, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[#FF4444] capitalize truncate">{prob.issue.replace(/_/g, ' ')}</span>
                      <span className="mono-text shrink-0">{prob.value.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Charts Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="widget-container p-6">
            <h2 className="text-xs status-label mb-4">Time-Series Circuit Envelope: LUFS & Crest</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLufs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00FF9D" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00FF9D" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232529" vertical={false} />
                  <XAxis dataKey="time" stroke="#8E9299" fontSize={10} tickFormatter={(val) => `${val}s`} />
                  <YAxis stroke="#8E9299" fontSize={10} domain={[-24, 0]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#151619', borderColor: '#232529', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                    itemStyle={{ color: '#00FF9D' }}
                  />
                  <Area type="monotone" dataKey="lufs" stroke="#00FF9D" fillOpacity={1} fill="url(#colorLufs)" />
                  <Line type="monotone" dataKey="crest" stroke="#8E9299" strokeWidth={1} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="widget-container p-6">
              <h2 className="text-xs status-label mb-4">Spatial Width & Vocal Presence</h2>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#232529" vertical={false} />
                    <XAxis dataKey="time" stroke="#8E9299" fontSize={10} />
                    <YAxis stroke="#8E9299" fontSize={10} domain={[0, 1]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#151619', borderColor: '#232529', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                    />
                    <Line type="monotone" dataKey="width" stroke="#3B82F6" strokeWidth={2} dot={false} name="Stereo Width" />
                    <Line type="monotone" dataKey="vocal" stroke="#F59E0B" strokeWidth={2} dot={false} name="Vocal Presence" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="widget-container p-6">
              <h2 className="text-xs status-label mb-4">Spectral Brightness & Transient Sharpness (9D)</h2>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#232529" vertical={false} />
                    <XAxis dataKey="time" stroke="#8E9299" fontSize={10} />
                    <YAxis yAxisId="left" stroke="#8E9299" fontSize={10} />
                    <YAxis yAxisId="right" orientation="right" stroke="#8E9299" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#151619', borderColor: '#232529', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="brightness" stroke="#A855F7" strokeWidth={2} dot={false} name="Spectral Brightness (Hz)" />
                    <Line yAxisId="right" type="monotone" dataKey="transient" stroke="#EF4444" strokeWidth={2} dot={false} name="Transient Sharpness" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="widget-container p-6">
            <h2 className="text-xs status-label mb-4">Physical Sections</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {result.physical_sections && result.physical_sections.map((section, i) => (
                <div key={i} className="bg-[#0d0e12] p-4 rounded-lg border border-[#232529]">
                  <div className="text-xs text-[#8E9299] mb-1">{section.start_sec}s - {section.end_sec}s</div>
                  <div className="font-medium mb-2">{section.name}</div>
                  <div className="text-xs mono-text text-[#00FF9D]">{section.avg_lufs.toFixed(1)} LUFS</div>
                </div>
              ))}
            </div>
          </div>

          {/* Gemini Full Scan Analysis Section */}
          {result.gemini_analysis && (
            <div className="widget-container p-6 border-[#818cf8]/30 mt-8">
              <h2 className="text-lg font-bold mb-2 text-[#818cf8] flex items-center gap-2">
                <Activity className="w-5 h-5" /> Gemini Full Scan Analysis
              </h2>
              <p className="text-sm text-[#8E9299] mb-6">
                物理的な解析データと、歌詞・楽曲構造を統合したディープスキャンレポート
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-[#0d0e12] p-5 rounded-xl border border-[#232529]">
                  <h3 className="text-sm font-medium text-[#8E9299] mb-2 uppercase tracking-wider">ジャンル & 特徴</h3>
                  <div className="mb-4">
                    <span className="text-white font-medium">{result.gemini_analysis.genre}</span>
                  </div>
                  <p className="text-sm text-[#8E9299] leading-relaxed">
                    {result.gemini_analysis.features}
                  </p>
                </div>

                <div className="bg-[#0d0e12] p-5 rounded-xl border border-[#232529]">
                  <h3 className="text-sm font-medium text-[#8E9299] mb-2 uppercase tracking-wider">エンジニアリング・コメント</h3>
                  <p className="text-sm text-[#8E9299] leading-relaxed">
                    {result.gemini_analysis.comments}
                  </p>
                </div>
              </div>

              <h3 className="text-sm font-medium text-[#8E9299] mb-4 uppercase tracking-wider">楽曲構造・歌詞と音響のリンク (具体的な変化)</h3>
              <div className="space-y-4">
                {result.gemini_analysis.lyrics_and_structure && result.gemini_analysis.lyrics_and_structure.map((item, i) => (
                  <div key={i} className="bg-[#0d0e12] p-5 rounded-xl border border-[#232529] flex flex-col md:flex-row gap-6">
                    <div className="md:w-1/3 shrink-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-[#00FF9D]">{item.section}</span>
                        <span className="text-xs mono-text text-[#8E9299] bg-[#151619] px-2 py-1 rounded">{item.time}</span>
                      </div>
                      <div className="p-3 bg-[#151619] rounded-lg border border-[#232529]">
                        <p className="text-sm text-[#8E9299] whitespace-pre-line italic font-serif">
                          "{item.lyrics}"
                        </p>
                      </div>
                    </div>
                    <div className="md:w-2/3">
                      <span className="text-xs text-[#818cf8] uppercase tracking-wider mb-2 block font-semibold">音響的な変化</span>
                      <p className="text-sm text-[#8E9299] leading-relaxed">
                        {item.changes}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, unit = '', alert = false }: { label: string; value: string | number; unit?: string; alert?: boolean }) {
  return (
    <div className="flex justify-between items-end border-b border-[#232529] pb-2">
      <span className="text-sm text-[#8E9299]">{label}</span>
      <div className={cn("mono-text", alert ? "text-[#FF4444]" : "text-white")}>
        <span className="text-lg">{value}</span>
        {unit && <span className="text-xs ml-1 opacity-50">{unit}</span>}
      </div>
    </div>
  );
}
