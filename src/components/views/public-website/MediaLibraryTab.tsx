import React, { useState } from 'react';
import {
  HardDrive,
  UploadCloud,
  Search,
  Copy,
  Check,
  Trash2,
  FileImage,
  FileText,
  Maximize2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  ArrowUpRight,
} from 'lucide-react';
import { PublicMediaItem, StorageFolder } from '../../../types';
import { fileUploadService } from '../../../services/fileUploadService';
import { getFileContentUrl } from '../../../services/apiConfig';

interface MediaLibraryTabProps {
  mediaItems: PublicMediaItem[];
  totalStorageBytes: number;
  onRefresh: () => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export const MediaLibraryTab: React.FC<MediaLibraryTabProps> = ({
  mediaItems = [],
  totalStorageBytes = 0,
  onRefresh,
  onDeleteItem,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>('');
  const [deleteTargetItem, setDeleteTargetItem] = useState<PublicMediaItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);
  const [brokenImageIds, setBrokenImageIds] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4000);
  };

  const formatSize = (bytes: number) => {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  // Safely guard against non-array or null/undefined mediaItems
  const safeMediaItems = Array.isArray(mediaItems) ? mediaItems : [];

  // Filter items safely without crashing on missing properties
  const searchLower = (searchTerm || '').trim().toLowerCase();
  const filteredMedia = safeMediaItems.filter((m) => {
    if (!m) return false;
    const nameStr = String(m.fileName || m.name || m.fileKey || '').toLowerCase();
    const urlStr = String(m.url || '').toLowerCase();
    const folderStr = String(m.folder || '').toLowerCase();
    const categoryStr = String(m.category || '').toLowerCase();

    const matchesSearch =
      !searchLower ||
      nameStr.includes(searchLower) ||
      urlStr.includes(searchLower) ||
      folderStr.includes(searchLower) ||
      categoryStr.includes(searchLower);

    const matchesFolder =
      selectedFolder === 'ALL' ||
      folderStr.includes(selectedFolder.toLowerCase()) ||
      categoryStr === selectedFolder.toLowerCase();

    return matchesSearch && matchesFolder;
  });

  const handleCopy = async (id: string, rawUrl: string) => {
    try {
      const fullUrl = getFileContentUrl(rawUrl);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(id);
      showToast('success', 'Media URL copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      showToast('error', 'Could not copy URL to clipboard.');
    }
  };

  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset file input so re-selecting the same file triggers onChange
    e.target.value = '';
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadProgress(15);

      const targetFolder: StorageFolder =
        selectedFolder !== 'ALL' &&
        [
          'hero',
          'gallery',
          'leadership',
          'events',
          'notices',
          'facilities',
        ].includes(selectedFolder)
          ? (`public-website/${selectedFolder}` as StorageFolder)
          : 'public-website/general';

      await fileUploadService.uploadDirectToR2(file, targetFolder, (progress) => {
        setUploadProgress(Math.min(95, Math.max(15, progress)));
      });

      setUploadProgress(100);
      await onRefresh();
      showToast('success', `"${file.name}" uploaded.`);
    } catch (err: any) {
      console.error('[MediaLibrary] Upload failed:', err);
      showToast('error', `Upload failed: ${err?.message || 'Network error'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleRefreshClick = async () => {
    try {
      setIsRefreshingLocal(true);
      await onRefresh();
      showToast('success', 'Media library refreshed.');
    } catch (err: any) {
      showToast('error', 'Failed to refresh media library.');
    } finally {
      setIsRefreshingLocal(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetItem) return;
    try {
      setIsDeleting(true);
      const keyOrId = deleteTargetItem.fileKey || deleteTargetItem.id;
      await onDeleteItem(keyOrId);
      showToast('success', 'Media asset deleted successfully.');
      setDeleteTargetItem(null);
    } catch (err: any) {
      console.error('[MediaLibrary] Delete failed:', err);
      showToast('error', `Delete failed: ${err?.message || 'Server error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const folders = [
    'ALL',
    'hero',
    'gallery',
    'leadership',
    'events',
    'facilities',
    'notices',
    'photos',
    'general',
  ];

  const calculatedTotalBytes =
    totalStorageBytes ||
    safeMediaItems.reduce((acc, curr) => acc + (curr?.fileSize || curr?.sizeBytes || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs animate-in fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-cyan-600" />
            <span>Media library</span>
          </h3>
          <p className="text-xs text-slate-500">
            Banners, gallery photos and attachments used on the public website.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefreshClick}
            disabled={isRefreshingLocal || isLoading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingLocal || isLoading ? 'animate-spin text-cyan-600' : ''}`} />
          </button>

          <label
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer ${
              isUploading ? 'opacity-70 pointer-events-none' : ''
            }`}
          >
            <UploadCloud className="w-4 h-4 text-amber-400" />
            <span>{isUploading ? `Uploading (${uploadProgress || 15}%)...` : 'Upload New Media'}</span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleDirectUpload}
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
              <span>Uploading…</span>
            </span>
            <span>{uploadProgress || 15}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-amber-200 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300 rounded-full"
              style={{ width: `${uploadProgress || 15}%` }}
            />
          </div>
        </div>
      )}

      {/* Storage Summary Bar */}
      <div className="p-4 rounded-2xl bg-cyan-50/50 border border-cyan-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="font-black text-cyan-950 flex items-center gap-1.5">
            <span>Media storage</span>
          </div>
          <p className="text-cyan-800 text-[11px]">
            Files: <strong>{safeMediaItems.length} files</strong> | Space used:{' '}
            <strong>{formatSize(calculatedTotalBytes)}</strong>
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search files by name, folder..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Folders */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {folders.map((f) => {
            const isSelected = selectedFolder.toLowerCase() === f.toLowerCase();
            return (
              <button
                key={f}
                onClick={() => setSelectedFolder(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <div
              key={n}
              className="bg-white rounded-2xl border border-slate-200 p-3 space-y-3 animate-pulse"
            >
              <div className="aspect-square bg-slate-100 rounded-xl" />
              <div className="h-3 bg-slate-200 rounded-md w-3/4" />
              <div className="h-2 bg-slate-100 rounded-md w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Grid of Media Assets */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredMedia.map((item) => {
            const rawKey = item.fileKey || item.id || '';
            const displayName =
              item.fileName || item.name || rawKey.split('/').pop() || 'Media File';
            const rawUrl = item.url || `/api/files/content?key=${encodeURIComponent(rawKey)}`;
            const safeDisplayUrl = getFileContentUrl(rawUrl);

            const contentType = String(item.contentType || item.mimeType || '').toLowerCase();
            const isImage =
              contentType.startsWith('image/') ||
              /\.(jpeg|jpg|png|webp|gif|svg|avif)$/i.test(rawKey) ||
              /\.(jpeg|jpg|png|webp|gif|svg|avif)$/i.test(displayName);
            const isPdf =
              contentType.includes('pdf') ||
              rawKey.toLowerCase().endsWith('.pdf') ||
              displayName.toLowerCase().endsWith('.pdf');

            const itemSize = item.fileSize ?? item.sizeBytes ?? 0;
            const folderLabel = String(item.folder || item.category || 'General').replace(
              'public-website/',
              ''
            );
            const isBroken = Boolean(brokenImageIds[item.id]);

            return (
              <div
                key={item.id || rawKey}
                className="group bg-white rounded-2xl border border-slate-200 hover:border-cyan-400 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between"
              >
                {/* Thumbnail Container */}
                <div className="aspect-square bg-slate-100 relative overflow-hidden flex items-center justify-center">
                  {isImage && safeDisplayUrl && !isBroken ? (
                    <img
                      src={safeDisplayUrl}
                      alt={displayName}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        setBrokenImageIds((prev) => ({ ...prev, [item.id]: true }));
                      }}
                    />
                  ) : isPdf ? (
                    <div className="flex flex-col items-center justify-center p-3 text-rose-600 space-y-1">
                      <FileText className="w-10 h-10" />
                      <span className="text-[9px] font-black uppercase tracking-wider text-rose-700">
                        PDF Document
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-3 text-slate-400 space-y-1">
                      <FileImage className="w-10 h-10 text-slate-300" />
                      <span className="text-[9px] font-bold text-slate-400">File Asset</span>
                    </div>
                  )}

                  {/* Folder pill */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-900/75 text-white backdrop-blur-xs">
                    {folderLabel}
                  </span>

                  {/* Action overlays on hover */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    {isImage && safeDisplayUrl && !isBroken && (
                      <button
                        onClick={() => {
                          setPreviewUrl(safeDisplayUrl);
                          setPreviewName(displayName);
                        }}
                        className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white cursor-pointer transition shadow-xs"
                        title="View high-resolution preview"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <a
                      href={safeDisplayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white cursor-pointer transition shadow-xs"
                      title="Open in new tab"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Info & Copy */}
                <div className="p-3 space-y-2 text-xs flex-1 flex flex-col justify-between">
                  <div>
                    <h4
                      className="font-bold text-slate-900 text-xs truncate"
                      title={displayName}
                    >
                      {displayName}
                    </h4>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>{formatSize(itemSize)}</span>
                      <span>
                        {item.uploadedAt ? item.uploadedAt.substring(0, 10) : 'Recent'}
                      </span>
                    </div>

                    {/* Usage Tag */}
                    {item.usedIn && item.usedIn.length > 0 && (
                      <div className="pt-1.5 flex flex-wrap gap-1">
                        {item.usedIn.map((use, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-900 border border-amber-200 truncate max-w-full"
                            title={use}
                          >
                            {use}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleCopy(item.id, rawUrl)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-700 hover:text-cyan-800 transition cursor-pointer"
                      title="Copy full CDN image URL"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setDeleteTargetItem(item)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      title="Remove asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Safe Empty State with exact requested text: "No media available" */}
          {filteredMedia.length === 0 && (
            <div className="col-span-full p-12 text-center rounded-2xl bg-white border border-dashed border-slate-300 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-900">No media available</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchTerm || selectedFolder !== 'ALL'
                    ? 'No media assets match your active search filter.'
                    : 'No media files uploaded yet.'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                {(searchTerm || selectedFolder !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedFolder('ALL');
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
                <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition cursor-pointer">
                  <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
                  <span>Upload Media</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleDirectUpload}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* High-Resolution Lightbox Modal */}
      {previewUrl && previewUrl.trim() && (
        <div
          onClick={() => {
            setPreviewUrl(null);
            setPreviewName('');
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md cursor-pointer animate-in fade-in"
        >
          <div
            className="max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <span className="text-xs font-bold truncate max-w-md">{previewName || 'Media Preview'}</span>
              <button
                onClick={() => {
                  setPreviewUrl(null);
                  setPreviewName('');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-black/40">
              <img
                src={previewUrl}
                alt={previewName || 'Enlarged Preview'}
                className="max-w-full max-h-[78vh] object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Delete Media Object?</h4>
                <p className="text-xs text-slate-500">
                  {deleteTargetItem.fileName || deleteTargetItem.fileKey}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This permanently deletes the file. If it is referenced in a hero banner or gallery, it will no longer display.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTargetItem(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete File</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
