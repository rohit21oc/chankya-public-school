import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  FileCode,
  Loader2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { fileUploadService } from '../../services/fileUploadService';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    title: string;
    fileKey?: string;
    url?: string;
    contentType?: string;
    originalFileName?: string;
    fileSize?: number;
  } | null;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  document,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !document) {
      setResolvedUrl('');
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setLoadError(null);

    const resolve = async () => {
      try {
        if (document.fileKey) {
          // Attempt direct content URL first or presigned URL
          const contentUrl = fileUploadService.getFileUrl(document.fileKey);
          if (!isCancelled) {
            setResolvedUrl(contentUrl);
            setIsLoading(false);
          }
        } else if (document.url) {
          if (!isCancelled) {
            setResolvedUrl(document.url);
            setIsLoading(false);
          }
        } else {
          throw new Error('No file reference available');
        }
      } catch (err: any) {
        if (!isCancelled) {
          setLoadError(err.message || 'Unable to load document viewer.');
          setIsLoading(false);
        }
      }
    };

    resolve();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, document]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !document) return null;

  const fileName = document.originalFileName || document.title || 'document';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const contentType = document.contentType || '';

  const isImage =
    contentType.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext);

  const isPdf =
    contentType === 'application/pdf' || ext === 'pdf';

  const isDoc =
    ['doc', 'docx'].includes(ext) ||
    contentType.includes('wordprocessingml') ||
    contentType.includes('msword');

  const isSheet =
    ['xls', 'xlsx', 'csv'].includes(ext) ||
    contentType.includes('spreadsheetml') ||
    contentType.includes('excel');

  const handleDownload = () => {
    if (!resolvedUrl) return;
    const a = window.document.createElement('a');
    a.href = resolvedUrl;
    a.download = document.originalFileName || document.title || 'document';
    a.target = '_blank';
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    if (resolvedUrl) {
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {document.title}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {document.originalFileName || document.title}
                {document.fileSize ? ` • ${Math.round(document.fileSize / 1024)} KB` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {resolvedUrl && (
              <>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200/70 transition-colors"
                  title="Open in new window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                  title="Download document"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[360px] bg-slate-100/50">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 text-slate-500 py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-xs font-semibold">Loading document preview...</span>
            </div>
          ) : loadError ? (
            <div className="p-6 max-w-md text-center space-y-3 bg-white rounded-xl border border-rose-200">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900">Preview Unavailable</h4>
              <p className="text-xs text-slate-500">{loadError}</p>
              {resolvedUrl && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
                >
                  Download File Directly
                </button>
              )}
            </div>
          ) : isImage ? (
            <div className="max-w-full max-h-[75vh] flex items-center justify-center p-2">
              <img
                src={resolvedUrl}
                alt={document.title}
                className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-xs"
              />
            </div>
          ) : isPdf ? (
            <div className="w-full h-[72vh] bg-white rounded-xl border border-slate-200 overflow-hidden">
              <iframe
                src={`${resolvedUrl}#toolbar=1&navpanes=0`}
                title={document.title}
                className="w-full h-full border-none"
              />
            </div>
          ) : (
            <div className="p-8 max-w-md text-center space-y-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
                {isDoc ? (
                  <FileText className="w-8 h-8" />
                ) : isSheet ? (
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                ) : (
                  <FileCode className="w-8 h-8 text-amber-600" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{fileName}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Preview is not supported inside the browser for this file type ({ext.toUpperCase() || 'document'}). You can securely download and open it in your local desktop application.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download {ext.toUpperCase()} File</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
