import React, { useState } from 'react';
import {
  Smartphone,
  Monitor,
  ExternalLink,
  RefreshCw,
  X,
  Eye,
  CheckCircle2,
} from 'lucide-react';

interface LivePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LivePreviewModal: React.FC<LivePreviewModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [iframeKey, setIframeKey] = useState(Date.now());

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full h-[95vh] max-w-7xl flex flex-col overflow-hidden shadow-2xl">
        {/* Top Control Bar */}
        <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between gap-4 text-xs text-slate-200">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" />
            <span className="font-black text-white">Live Public Website Preview</span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
              Chanakya Public School & Coaching Centre
            </span>
          </div>

          {/* Device Toggles */}
          <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                deviceMode === 'desktop'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                deviceMode === 'mobile'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile View</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIframeKey(Date.now())}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Refresh preview iframe"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Open in Tab</span>
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition font-bold"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Frame Container */}
        <div className="flex-1 bg-slate-950 p-4 overflow-auto flex items-center justify-center">
          <div
            className={`transition-all duration-300 h-full bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-700 relative ${
              deviceMode === 'desktop'
                ? 'w-full max-w-6xl'
                : 'w-[375px] max-w-full max-h-[720px] rounded-3xl border-4 border-slate-700'
            }`}
          >
            <iframe
              key={iframeKey}
              src="/"
              title="Website Live Preview"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
