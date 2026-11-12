import React, { useState, useEffect } from 'react';
import { Download, ExternalLink, FileText, Loader2, X, RefreshCw } from 'lucide-react';
import { fileUploadService } from '../../services/fileUploadService';
import { getFileContentUrl } from '../../services/apiConfig';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    title: string;
    fileKey: string;
    originalFileName?: string;
    contentType?: string;
  } | null;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document,
}) => {
  const [fileUrl, setFileUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchDocumentUrl = async () => {
    if (!document?.fileKey) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      // Prioritize secure signed URL from Cloudflare R2 / backend with inline disposition
      const presignedUrl = await fileUploadService.getDownloadUrl(document.fileKey);
      if (presignedUrl) {
        setFileUrl(presignedUrl);
        setIsLoading(false);
        return;
      }

      // Fallback to backend content proxy URL with inline disposition
      const directUrl = getFileContentUrl(document.fileKey);
      if (directUrl) {
        setFileUrl(directUrl);
      } else {
        setLoadError('Unable to generate secure preview link for this document.');
      }
      setIsLoading(false);
    } catch (err: any) {
      const directUrl = getFileContentUrl(document.fileKey);
      if (directUrl) {
        setFileUrl(directUrl);
      } else {
        setLoadError(err?.message || 'Failed to load document preview.');
      }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !document?.fileKey) {
      setFileUrl('');
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    fetchDocumentUrl();
  }, [isOpen, document?.fileKey]);

  if (!isOpen || !document) return null;

  const isImage =
    document.contentType?.startsWith('image/') ||
    !!document.originalFileName?.match(/\.(jpe?g|png|webp|gif|bmp)$/i) ||
    !!document.fileKey.match(/\.(jpe?g|png|webp|gif|bmp)$/i);

  const isPdf =
    document.contentType === 'application/pdf' ||
    !!document.originalFileName?.match(/\.pdf$/i) ||
    !!document.fileKey.match(/\.pdf$/i);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm truncate">{document.title}</h3>
              <p className="text-[11px] text-slate-500 truncate">
                {document.originalFileName || document.fileKey}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={document.originalFileName || undefined}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Open in new window or Download"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open File</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 flex-1 overflow-auto bg-slate-100 flex items-center justify-center min-h-[350px]">
          {isLoading ? (
            <div className="text-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-600 font-medium">Loading secure document preview...</p>
            </div>
          ) : loadError ? (
            <div className="text-center py-12 space-y-3 max-w-sm">
              <FileText className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-xs text-rose-600 font-semibold">{loadError}</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={fetchDocumentUrl}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
                {fileUrl && (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-slate-200 text-slate-800 rounded-xl text-xs font-bold hover:bg-slate-300"
                  >
                    Open Directly
                  </a>
                )}
              </div>
            </div>
          ) : isImage && fileUrl ? (
            <div className="max-h-[72vh] flex items-center justify-center p-2">
              <img
                src={fileUrl}
                alt={document.title}
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm border border-slate-200 bg-white"
              />
            </div>
          ) : isPdf && fileUrl ? (
            <div className="w-full h-[74vh] flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-300 shadow-sm">
              <object
                data={`${fileUrl}#toolbar=1&navpanes=0`}
                type="application/pdf"
                className="w-full h-full"
              >
                <iframe
                  src={`${fileUrl}#toolbar=1&navpanes=0`}
                  title={document.title}
                  className="w-full h-full border-0 bg-white"
                >
                  <div className="p-8 text-center text-slate-700 space-y-4 bg-white h-full flex flex-col items-center justify-center">
                    <FileText className="w-12 h-12 text-blue-600 mx-auto" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{document.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Inline PDF preview is ready. Click below to view or download.
                      </p>
                    </div>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={document.originalFileName || undefined}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View / Download PDF</span>
                    </a>
                  </div>
                </iframe>
              </object>
            </div>
          ) : (
            <div className="text-center py-12 space-y-4 max-w-md bg-white p-6 rounded-2xl border border-slate-200">
              <FileText className="w-12 h-12 text-blue-600 mx-auto" />
              <div>
                <p className="font-bold text-slate-900 text-sm">{document.title}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Preview not directly renderable in-browser for this file format ({document.contentType || 'file'}).
                </p>
              </div>
              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={document.originalFileName || undefined}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open or Download Document</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
