import React, { useState, useEffect } from 'react';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Save,
  RotateCcw,
  X,
  Wifi,
  WifiOff,
  Database,
  Globe,
  HelpCircle
} from 'lucide-react';
import {
  getBackendBaseUrl,
  setCustomBackendUrl,
  testBackendConnection,
  BackendHealthResult,
} from '../../services/apiConfig';

interface BackendStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackendStatusModal: React.FC<BackendStatusModalProps> = ({ isOpen, onClose }) => {
  const [currentUrl, setCurrentUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<BackendHealthResult | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const active = getBackendBaseUrl();
      setCurrentUrl(active);
      setInputUrl(active);
      handleTest(active);
    }
  }, [isOpen]);

  const handleTest = async (urlToTest?: string) => {
    setIsTesting(true);
    setSaveFeedback(null);
    try {
      const result = await testBackendConnection(urlToTest !== undefined ? urlToTest : inputUrl);
      setTestResult(result);
    } catch {
      setTestResult({
        connected: false,
        url: urlToTest || inputUrl,
        error: 'Network request failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const trimmed = inputUrl.trim();
    setCustomBackendUrl(trimmed);
    const updated = getBackendBaseUrl();
    setCurrentUrl(updated);
    setSaveFeedback('Backend URL saved successfully! Re-testing...');
    handleTest(updated);
  };

  const handleReset = () => {
    setCustomBackendUrl(null);
    const updated = getBackendBaseUrl();
    setCurrentUrl(updated);
    setInputUrl(updated);
    setSaveFeedback('Reset to default auto-detected backend URL.');
    handleTest(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="backend-connection-modal"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Backend Server Connectivity</h3>
              <p className="text-xs text-slate-400">Manage API endpoints for static frontend & backend</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-slate-800 text-sm">
          {/* Live Status Card */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              isTesting
                ? 'bg-slate-50 border-slate-200'
                : testResult?.connected
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {isTesting ? (
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                ) : testResult?.connected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {isTesting
                      ? 'Checking Server Connection...'
                      : testResult?.connected
                      ? 'Backend Online & Synced'
                      : 'Offline / Standalone Mode'}
                  </h4>
                  <p className="text-xs opacity-80 mt-0.5">
                    {isTesting
                      ? 'Pinging backend health endpoint...'
                      : testResult?.connected
                      ? `Successfully connected (${testResult.latencyMs}ms response time). R2 Storage: ${testResult.r2Bucket || 'Available'}`
                      : testResult?.error || 'Unable to reach backend. Using integrated offline local storage.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleTest()}
                disabled={isTesting}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Test</span>
              </button>
            </div>
          </div>

          {/* Configuration Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Backend API Base URL
            </label>
            <div className="flex items-center gap-2">
              <input
                id="backend-api-url-input"
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://your-backend-api.example.com (or leave empty for relative)"
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
              <button
                type="button"
                onClick={handleSave}
                className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Active endpoint: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-blue-800">{currentUrl || '(Relative URL: /api)'}</code>
            </p>
          </div>

          {saveFeedback && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs">
              {saveFeedback}
            </div>
          )}

          {/* Quick Presets / Actions */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Quick Actions:</span>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Auto-detect</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setInputUrl('');
                  setCustomBackendUrl('');
                  const updated = getBackendBaseUrl();
                  setCurrentUrl(updated);
                  handleTest(updated);
                }}
                className="p-2 text-left rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="font-bold text-slate-800">Relative Path</div>
                <div className="text-[11px] text-slate-500 truncate">Default (/api) for fullstack</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  const origin = window.location.origin;
                  setInputUrl(origin);
                  setCustomBackendUrl(origin);
                  setCurrentUrl(origin);
                  handleTest(origin);
                }}
                className="p-2 text-left rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="font-bold text-slate-800">Current Origin</div>
                <div className="text-[11px] text-slate-500 truncate">{window.location.origin}</div>
              </button>
            </div>
          </div>

          {/* Static Deployment Guide */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>Static Deployment Instructions (Vercel / Netlify)</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] pl-1">
              <li>
                In your hosting environment variables, add <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-900">VITE_API_URL=https://your-backend.com</code>
              </li>
              <li>
                Ensure your backend server is running and accessible over HTTPS with CORS enabled.
              </li>
              <li>
                If the backend is not reachable, this app continues working seamlessly in local offline mode without crashing.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
