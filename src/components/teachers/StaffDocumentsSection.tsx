import React, { useState, useRef } from 'react';
import {
  Plus,
  FileText,
  Eye,
  Trash2,
  RotateCw,
  Upload,
  AlertCircle,
  Loader2,
  CheckCircle2,
  FileCheck,
  X,
} from 'lucide-react';
import { AttachedDocument } from '../../types';
import { STAFF_DOCUMENT_TYPES } from '../../constants/staffFormOptions';
import { fileUploadService, UploadResult } from '../../services/fileUploadService';
import { DocumentViewerModal } from '../common/DocumentViewerModal';

interface StaffDocumentsSectionProps {
  documents: AttachedDocument[];
  onChange: (docs: AttachedDocument[]) => void;
  readOnly?: boolean;
}

export const StaffDocumentsSection: React.FC<StaffDocumentsSectionProps> = ({
  documents,
  onChange,
  readOnly = false,
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>('AADHAAR');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Replace state
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  // Delete confirm state
  const [docToDelete, setDocToDelete] = useState<AttachedDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Viewer modal state
  const [viewingDoc, setViewingDoc] = useState<AttachedDocument | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Handle new document file selected
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file could be selected again if needed
    e.target.value = '';

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const typeMeta = STAFF_DOCUMENT_TYPES.find((t) => t.id === selectedDocType);
      const docLabel = selectedDocType === 'OTHER'
        ? (customTitle.trim() || 'Custom Document')
        : (typeMeta?.label || 'Staff Document');

      // Direct R2 upload via fileUploadService
      const uploadRes: UploadResult = await fileUploadService.uploadDirectToR2({
        file,
        folder: 'staff/documents',
        onProgress: (p: any) => {
          const pct = typeof p === 'number' ? p : p?.percentage || 0;
          setUploadProgress(pct);
        },
      });

      const newDoc: AttachedDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        title: docLabel,
        documentType: selectedDocType,
        customDocumentTitle: selectedDocType === 'OTHER' ? customTitle.trim() : undefined,
        fileKey: uploadRes.fileKey,
        originalFileName: uploadRes.originalFileName,
        contentType: uploadRes.contentType || file.type || 'application/pdf',
        fileSize: uploadRes.fileSize || file.size,
        uploadedAt: new Date().toISOString(),
        verificationStatus: 'PENDING',
        previewUrl: uploadRes.previewUrl,
        downloadUrl: uploadRes.downloadUrl,
      };

      onChange([...documents, newDoc]);
      setIsAddingNew(false);
      setCustomTitle('');
      setSelectedDocType('AADHAAR');
    } catch (err: any) {
      console.error('[StaffDocumentsSection] Upload error:', err);
      setUploadError(err.message || 'Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger file dialog for Replace
  const handleStartReplace = (doc: AttachedDocument) => {
    setReplacingDocId(doc.id);
    setReplaceError(null);
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
      replaceInputRef.current.click();
    }
  };

  // Handle replace file selection
  const handleReplaceFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingDocId) return;

    e.target.value = '';
    const currentDoc = documents.find((d) => d.id === replacingDocId);
    if (!currentDoc) return;

    setIsReplacing(true);
    setReplaceError(null);

    try {
      const oldFileKey = currentDoc.fileKey;

      // Upload new file to R2
      const uploadRes: UploadResult = await fileUploadService.uploadDirectToR2({
        file,
        folder: 'staff/documents',
      });

      // Update document list with new file metadata
      const updatedDocs = documents.map((doc) => {
        if (doc.id === replacingDocId) {
          return {
            ...doc,
            fileKey: uploadRes.fileKey,
            originalFileName: uploadRes.originalFileName,
            contentType: uploadRes.contentType || file.type || 'application/pdf',
            fileSize: uploadRes.fileSize || file.size,
            uploadedAt: new Date().toISOString(),
            previewUrl: uploadRes.previewUrl,
            downloadUrl: uploadRes.downloadUrl,
          };
        }
        return doc;
      });

      onChange(updatedDocs);

      // Best effort cleanup of old file from R2
      if (oldFileKey && oldFileKey !== uploadRes.fileKey) {
        fileUploadService.deleteFile(oldFileKey).catch((delErr) => {
          console.warn('[StaffDocumentsSection] Cleanup of replaced file ignored:', delErr);
        });
      }

      setReplacingDocId(null);
    } catch (err: any) {
      console.error('[StaffDocumentsSection] Replace error:', err);
      setReplaceError(err.message || 'Failed to replace document.');
    } finally {
      setIsReplacing(false);
    }
  };

  // Execute deletion after confirmation
  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);

    try {
      const targetKey = docToDelete.fileKey;
      const filtered = documents.filter((d) => d.id !== docToDelete.id);
      onChange(filtered);

      if (targetKey) {
        await fileUploadService.deleteFile(targetKey);
      }
      setDocToDelete(null);
    } catch (err: any) {
      console.warn('[StaffDocumentsSection] Deletion note:', err);
      setDocToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input for Replace */}
      <input
        ref={replaceInputRef}
        type="file"
        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,application/pdf,image/*"
        onChange={handleReplaceFileSelected}
        className="hidden"
      />

      {/* Header bar with Add Document button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <span className="text-xs font-bold text-slate-800 block">
            Uploaded Documents & Certificates ({documents.length})
          </span>
          <p className="text-[11px] text-slate-500">
            Official employee documents on file.
          </p>
        </div>

        {!readOnly && !isAddingNew && (
          <button
            type="button"
            onClick={() => {
              setIsAddingNew(true);
              setUploadError(null);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Document</span>
          </button>
        )}
      </div>

      {/* Replace Error Alert if any */}
      {replaceError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{replaceError}</span>
          </div>
          <button
            type="button"
            onClick={() => setReplaceError(null)}
            className="text-rose-500 hover:text-rose-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* New Document Addition Card */}
      {isAddingNew && (
        <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-700" />
              <span className="text-xs font-bold text-blue-950">Attach New Document</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(false);
                setUploadError(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Document Type <span className="text-rose-600">*</span>
              </label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                {STAFF_DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.id} value={dt.id}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedDocType === 'OTHER' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Custom Document Title <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sports Coaching Diploma / NCC C-Certificate"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Document Description
                </label>
                <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 font-medium truncate">
                  {STAFF_DOCUMENT_TYPES.find((t) => t.id === selectedDocType)?.label}
                </div>
              </div>
            )}
          </div>

          {/* File Picker trigger */}
          <div className="pt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,application/pdf,image/*"
              onChange={handleFileSelected}
              className="hidden"
            />

            <button
              type="button"
              disabled={isUploading || (selectedDocType === 'OTHER' && !customTitle.trim())}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl bg-white text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="text-xs font-bold text-blue-900">
                    Uploading document… ({uploadProgress}%)
                  </span>
                  <span className="text-[10px] text-slate-500">Please do not refresh</span>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    Click to Select & Upload File <span className="text-rose-600">*</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Accepted formats: PDF, DOCX, XLSX, JPG, PNG (Max 25 MB)
                  </span>
                </>
              )}
            </button>

            {uploadError && (
              <div className="mt-2 text-xs text-rose-600 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-700">No documents attached yet</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Click "+ Add Document" above to attach verified identity proofs, degree certificates, and letters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {documents.map((doc, idx) => {
            const isReplacingThis = isReplacing && replacingDocId === doc.id;
            const fileSizeKb = doc.fileSize ? Math.round(doc.fileSize / 1024) : 0;
            const typeLabel =
              STAFF_DOCUMENT_TYPES.find((t) => t.id === doc.documentType)?.label ||
              doc.documentType ||
              'Document';

            return (
              <div
                key={doc.id || idx}
                className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {doc.title || typeLabel}
                      </h4>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        {typeLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {doc.originalFileName || 'Attached File'}
                      {fileSizeKb > 0 ? ` • ${fileSizeKb} KB` : ''}
                      {doc.uploadedAt
                        ? ` • ${new Date(doc.uploadedAt).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                </div>

                {/* Actions: View (Eye), Replace, Delete */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                  {/* View / Eye Button */}
                  <button
                    type="button"
                    onClick={() => setViewingDoc(doc)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    title="View / Preview Document"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>

                  {!readOnly && (
                    <>
                      {/* Replace Button */}
                      <button
                        type="button"
                        disabled={isReplacingThis}
                        onClick={() => handleStartReplace(doc)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                        title="Upload new file to replace this document"
                      >
                        {isReplacingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        ) : (
                          <RotateCw className="w-3.5 h-3.5 text-slate-600" />
                        )}
                        <span>Replace</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setDocToDelete(doc)}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Delete Attached Document?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong className="text-slate-800">{docToDelete.title}</strong>? The file will be permanently removed.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDocToDelete(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={Boolean(viewingDoc)}
        onClose={() => setViewingDoc(null)}
        document={viewingDoc}
      />
    </div>
  );
};
