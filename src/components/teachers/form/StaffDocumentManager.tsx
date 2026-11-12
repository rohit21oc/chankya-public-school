import React, { useState } from 'react';
import {
  Download,
  Eye,
  FileCheck,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AttachedDocument } from '../../../types';
import { STAFF_DOCUMENT_TYPES } from '../../../constants/staffFormConstants';
import { FileUploadComponent } from '../../common/FileUploadComponent';
import { DocumentPreviewModal } from '../../common/DocumentPreviewModal';
import { fileUploadService } from '../../../services/fileUploadService';

interface StaffDocumentManagerProps {
  documents: AttachedDocument[];
  onChange: (docs: AttachedDocument[]) => void;
  disabled?: boolean;
}

export const StaffDocumentManager: React.FC<StaffDocumentManagerProps> = ({
  documents,
  onChange,
  disabled = false,
}) => {
  const [docTypeId, setDocTypeId] = useState<string>('AADHAAR');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<AttachedDocument | null>(null);
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  const getDocTypeLabel = (id: string) => {
    return STAFF_DOCUMENT_TYPES.find((d) => d.id === id)?.label || id;
  };

  const handleUploadNewComplete = (res: any) => {
    const selectedType = getDocTypeLabel(docTypeId);
    const finalTitle = customTitle.trim()
      ? `${selectedType}: ${customTitle.trim()}`
      : `${selectedType} - ${res.originalFileName.replace(/\.[^/.]+$/, '')}`;

    const newDoc: AttachedDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: finalTitle,
      type: docTypeId,
      fileKey: res.fileKey,
      fileName: res.originalFileName,
      originalFileName: res.originalFileName,
      contentType: res.contentType,
      fileSize: res.fileSize,
      url: res.url,
      uploadedAt: res.uploadedAt || new Date().toISOString(),
    };

    onChange([...documents, newDoc]);
    setCustomTitle('');
    setIsAddingNew(false);
  };

  const handleReplaceComplete = async (res: any, oldDoc: AttachedDocument) => {
    // Delete old file from R2
    if (oldDoc.fileKey) {
      fileUploadService.deleteFile(oldDoc.fileKey).catch(() => {});
    }

    const updatedDoc: AttachedDocument = {
      ...oldDoc,
      fileKey: res.fileKey,
      fileName: res.originalFileName,
      originalFileName: res.originalFileName,
      contentType: res.contentType,
      fileSize: res.fileSize,
      url: res.url,
      uploadedAt: res.uploadedAt || new Date().toISOString(),
    };

    onChange(documents.map((d) => (d.id === oldDoc.id ? updatedDoc : d)));
    setReplacingDocId(null);
  };

  const handleDelete = async (doc: AttachedDocument) => {
    if (disabled) return;
    if (window.confirm(`Are you sure you want to remove "${doc.title}"?`)) {
      if (doc.fileKey) {
        fileUploadService.deleteFile(doc.fileKey).catch(() => {});
      }
      onChange(documents.filter((d) => d.id !== doc.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-blue-700" />
            <span>Staff Records & Verification Documents</span>
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Official employee credentials and verification records stored securely in school digital vault
          </p>
        </div>

        {!disabled && (
          <button
            type="button"
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            {isAddingNew ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>Close Upload</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Add Document</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Add Document Box */}
      {isAddingNew && !disabled && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-blue-200 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">Upload New Document</span>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Document Category <span className="text-rose-600">*</span>
              </label>
              <select
                value={docTypeId}
                onChange={(e) => setDocTypeId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-medium focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                {STAFF_DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.id} value={dt.id}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Custom Title / Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Master of Science Degree - Delhi University"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white"
              />
            </div>
          </div>

          <FileUploadComponent
            category="STAFF_DOCUMENT"
            label="Upload Document (PDF, PNG, JPG - max 10MB)"
            acceptedFileTypes="application/pdf,image/jpeg,image/png,image/webp"
            maxSizeMB={10}
            onUploadComplete={handleUploadNewComplete}
          />
        </div>
      )}

      {/* Replace Document Box Modal/Area */}
      {replacingDocId && !disabled && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-300 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-amber-700" />
              <span>
                Replace File for: &quot;{documents.find((d) => d.id === replacingDocId)?.title}&quot;
              </span>
            </span>
            <button
              type="button"
              onClick={() => setReplacingDocId(null)}
              className="text-amber-800 hover:text-amber-950"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-amber-800">
            Selecting a new file will replace the existing document record while preserving the title.
          </p>
          {(() => {
            const targetDoc = documents.find((d) => d.id === replacingDocId);
            if (!targetDoc) return null;
            return (
              <FileUploadComponent
                category="STAFF_DOCUMENT"
                label="Select Replacement File (PDF, PNG, JPG)"
                acceptedFileTypes="application/pdf,image/jpeg,image/png,image/webp"
                maxSizeMB={10}
                onUploadComplete={(res) => handleReplaceComplete(res, targetDoc)}
              />
            );
          })()}
        </div>
      )}

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 space-y-1.5">
          <FileText className="w-7 h-7 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-700">No verification documents attached yet</p>
          <p className="text-[11px] text-slate-500">
            Click &quot;Add Document&quot; above to upload Aadhaar, Degree certificates, B.Ed/CTET records, or appointment orders.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h5 className="font-bold text-slate-900 text-xs truncate">{doc.title}</h5>
                  <span className="text-[11px] text-slate-500 block truncate">
                    {doc.fileName || doc.originalFileName || 'Attached File'} •{' '}
                    {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'Verified'}
                  </span>
                </div>
              </div>

              {/* Action buttons: View (Eye), Replace (Refresh), Delete (Trash) */}
              <div className="flex items-center gap-1 shrink-0">
                {/* View / Eye Icon button */}
                <button
                  type="button"
                  onClick={() => setSelectedPreviewDoc(doc)}
                  className="p-2 rounded-lg text-blue-700 hover:bg-blue-50 transition-colors"
                  title="View / Preview Document"
                >
                  <Eye className="w-4 h-4" />
                </button>

                {/* Replace File button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => setReplacingDocId(doc.id)}
                    className="p-2 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors"
                    title="Replace with new file"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}

                {/* Delete button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal for View (Eye) Icon */}
      <DocumentPreviewModal
        isOpen={Boolean(selectedPreviewDoc)}
        onClose={() => setSelectedPreviewDoc(null)}
        document={selectedPreviewDoc}
      />
    </div>
  );
};
