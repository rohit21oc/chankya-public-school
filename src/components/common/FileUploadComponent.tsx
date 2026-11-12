import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  FileText,
  Image as ImageIcon,
  Loader2,
  Trash2,
} from 'lucide-react';
import { StorageFolder } from '../../types';
import { PHOTO_ACCEPT, PHOTO_FORMATS_LABEL } from '../../utils/photoNormalizer';
import { fileUploadService, UploadResult, UploadProgressEvent } from '../../services/fileUploadService';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';

export type UploadVariant =
  | 'student-photo'
  | 'staff-photo'
  | 'teacher-photo'
  | 'school-logo'
  | 'principal-signature'
  | 'exam-controller-signature'
  | 'upi-qr-code'
  | 'student-document'
  | 'staff-document'
  | 'study-material'
  | 'homework';

interface FileUploadComponentProps {
  uploadType?: UploadVariant;
  category?: string;
  accept?: string;
  acceptedFileTypes?: string;
  maxSizeMB?: number;
  currentValue?: string; // existing photo URL or fileKey
  currentFileKey?: string;
  label?: string;
  hint?: string;
  onUploadComplete: (result: UploadResult) => void;
  onRemove?: () => void;
  className?: string;
  entityId?: string;
}

export const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  uploadType: rawUploadType,
  category,
  accept,
  acceptedFileTypes,
  maxSizeMB,
  currentValue,
  currentFileKey,
  label,
  hint,
  onUploadComplete,
  onRemove,
  className = '',
}) => {
  const uploadType: UploadVariant =
    rawUploadType ||
    (category === 'STAFF_PHOTO'
      ? 'staff-photo'
      : category === 'STAFF_DOCUMENT'
      ? 'staff-document'
      : category === 'STUDENT_PHOTO'
      ? 'student-photo'
      : category === 'STUDENT_DOCUMENT'
      ? 'student-document'
      : category === 'SCHOOL_LOGO'
      ? 'school-logo'
      : 'study-material');

  const isPhotoOrLogo =
    uploadType === 'student-photo' ||
    uploadType === 'staff-photo' ||
    uploadType === 'teacher-photo' ||
    uploadType === 'school-logo' ||
    uploadType === 'principal-signature' ||
    uploadType === 'exam-controller-signature' ||
    uploadType === 'upi-qr-code';

  // Student / staff / teacher photos also take PDF and other image types (converted to JPEG before upload)
  const isPersonPhoto = uploadType === 'student-photo' || uploadType === 'staff-photo' || uploadType === 'teacher-photo';
  const defaultAccept = isPersonPhoto
    ? PHOTO_ACCEPT
    : isPhotoOrLogo
    ? 'image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp,image/*'
    : '.pdf,.docx,.xlsx,.jpg,.png,application/pdf';
  const acceptedTypes = accept || acceptedFileTypes || defaultAccept;
  const limitMB = maxSizeMB || (isPersonPhoto ? 25 : isPhotoOrLogo ? 10 : 25);

  const mapFolder = (): StorageFolder => {
    switch (uploadType) {
      case 'student-photo':
        return 'students/photos';
      case 'staff-photo':
        return 'staff/photos';
      case 'teacher-photo':
        return 'teachers/photos';
      case 'school-logo':
        return 'school-logo';
      case 'principal-signature':
      case 'exam-controller-signature':
        return 'school-logo';
      case 'upi-qr-code':
        return 'school-logo';
      case 'student-document':
        return 'students/documents';
      case 'staff-document':
        return 'staff/documents';
      case 'homework':
        return 'homework';
      case 'study-material':
      default:
        return 'study-materials';
    }
  };

  const [preview, setPreview] = useState<string | null>(currentValue || null);
  const [activeFileKey, setActiveFileKey] = useState<string | null>(currentFileKey || null);
  const [uploadState, setUploadState] = useState<'idle' | 'compressing' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Synchronize when external currentValue updates
  useEffect(() => {
    setPreview(currentValue || null);
    setActiveFileKey(currentFileKey || null);
  }, [currentValue, currentFileKey]);

  const handleFileSelection = async (picked: File) => {
    // Reset state
    setErrorMessage(null);
    setFileName(picked.name);

    let file = picked;
    if (isPersonPhoto) {
      const check = fileUploadService.validateFile(picked, mapFolder());
      if (!check.valid) {
        setErrorMessage(check.error || `Please choose a photo (${PHOTO_FORMATS_LABEL}).`);
        setUploadState('error');
        return;
      }
      // Convert to a resized JPEG first so the preview works for PDF / HEIC / .jfif too
      setUploadState('compressing');
      try {
        file = await fileUploadService.preparePhoto(picked);
      } catch (prepErr: any) {
        setErrorMessage(prepErr?.message || `Please choose a photo (${PHOTO_FORMATS_LABEL}).`);
        setUploadState('error');
        return;
      }
    }

    // Immediate preview for images
    if (file.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
    }

    // Validation
    const validation = fileUploadService.validateFile(file, mapFolder());
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid file format');
      setUploadState('error');
      return;
    }

    // Prepare abort controller for cancellation
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setUploadState(file.type.startsWith('image/') ? 'compressing' : 'uploading');
    setProgress(5);

    try {
      // Simulate compression indicator briefly for large photos
      if (file.type.startsWith('image/') && file.size > 800 * 1024) {
        setTimeout(() => setUploadState('uploading'), 300);
      } else {
        setUploadState('uploading');
      }

      const result = await fileUploadService.uploadDirectToR2({
        file,
        folder: mapFolder(),
        signal: controller.signal,
        onProgress: (evt: UploadProgressEvent) => {
          setProgress(evt.percentage);
        },
      });

      setActiveFileKey(result.fileKey);
      setUploadState('success');
      setProgress(100);

      onUploadComplete(result);
    } catch (err: any) {
      if (err.message === 'Upload cancelled') {
        setUploadState('idle');
        setProgress(0);
        setPreview(currentValue || null);
        return;
      }
      setErrorMessage(err.message || 'File upload failed.');
      setUploadState('error');
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploadState('idle');
    setProgress(0);
  };

  const handleRetry = () => {
    if (fileInputRef.current?.files?.[0]) {
      handleFileSelection(fileInputRef.current.files[0]);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeFileKey) {
      fileUploadService.deleteFile(activeFileKey).catch(console.warn);
    }
    setPreview(null);
    setActiveFileKey(null);
    setUploadState('idle');
    setProgress(0);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onRemove) {
      onRemove();
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-700">{label}</label>
        </div>
      )}

      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
          }
        }}
      />

      {isPhotoOrLogo ? (
        /* Photo / Logo Layout */
        <div className="flex items-start gap-4">
          <div
            onClick={() => uploadState !== 'uploading' && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            className={`relative group flex flex-col items-center justify-center cursor-pointer transition-all border-2 border-dashed rounded-xl overflow-hidden ${
              uploadType === 'school-logo'
                ? 'w-28 h-28'
                : uploadType === 'principal-signature' || uploadType === 'exam-controller-signature'
                ? 'w-36 h-20'
                : 'w-24 h-28'
            } ${
              isDragOver
                ? 'border-blue-600 bg-blue-50/60'
                : 'border-slate-300 hover:border-blue-500 bg-slate-50'
            }`}
          >
            {(() => {
              const previewSrc = preview
                ? uploadType === 'school-logo'
                  ? getSchoolLogoSrc(preview)
                  : fileUploadService.getFileUrl(preview)
                : '';
              return previewSrc ? (
                <img
                  src={previewSrc}
                  alt="Upload Preview"
                  className={`w-full h-full ${
                    uploadType === 'school-logo' || uploadType === 'principal-signature' || uploadType === 'exam-controller-signature'
                      ? 'object-contain p-1 bg-white'
                      : 'object-cover'
                  }`}
                  referrerPolicy="no-referrer"
                  onError={uploadType === 'school-logo' ? handleLogoError : undefined}
                />
              ) : (
                <div className="p-2 text-center text-slate-400 group-hover:text-blue-600">
                  <ImageIcon className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                  <span className="text-[10px] block font-medium">
                    {uploadType === 'principal-signature' || uploadType === 'exam-controller-signature' ? 'Upload Signature' : 'Choose Photo'}
                  </span>
                </div>
              );
            })()}

            {/* Hover overlay for changing */}
            {preview && uploadState !== 'uploading' && (
              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-white text-[10px] transition-opacity">
                <span>Change</span>
                <RotateCw className="w-3.5 h-3.5" />
              </div>
            )}

            {/* Uploading Spinner / Progress Overlay */}
            {uploadState === 'uploading' && (
              <div className="absolute inset-0 bg-slate-900/75 flex flex-col items-center justify-center p-2 text-white">
                <Loader2 className="w-5 h-5 animate-spin mb-1 text-blue-400" />
                <span className="text-[11px] font-bold">{progress}%</span>
              </div>
            )}
          </div>

          {/* Action details beside photo */}
          <div className="flex-1 min-w-0 py-0.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={uploadState === 'uploading'}
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50"
              >
                {preview ? 'Replace Photo' : 'Select Photo'}
              </button>
              {preview && uploadState !== 'uploading' && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Remove Photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Upload Progress Bar */}
            {uploadState === 'uploading' && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                  <span>Uploading...</span>
                  <span className="font-bold text-blue-700">{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-150 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-[10px] text-red-600 hover:underline font-medium"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Success indicator */}
            {uploadState === 'success' && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">✓ Upload complete</span>
              </div>
            )}

            {/* Error indicator & retry */}
            {uploadState === 'error' && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-red-700 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{errorMessage || 'Upload failed'}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 hover:underline"
                >
                  <RotateCw className="w-3 h-3" /> Retry Upload
                </button>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              {hint || (isPersonPhoto ? `${PHOTO_FORMATS_LABEL} • saved at about 40 KB` : `Max ${limitMB}MB (PNG, JPG, WEBP)`)}
            </p>
          </div>
        </div>
      ) : (
        /* Document Layout (Drag & Drop Zone) */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
            isDragOver
              ? 'border-blue-600 bg-blue-50/60'
              : 'border-slate-300 hover:border-blue-500 bg-slate-50'
          }`}
          onClick={() => uploadState !== 'uploading' && fileInputRef.current?.click()}
        >
          {uploadState === 'uploading' ? (
            <div className="space-y-2 max-w-xs mx-auto py-2">
              <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
                <span className="truncate">Uploading: {fileName}</span>
                <span className="font-bold text-blue-700">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-150 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                className="text-xs text-red-600 hover:underline font-medium"
              >
                Cancel Upload
              </button>
            </div>
          ) : uploadState === 'success' ? (
            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
              <div className="flex items-center gap-2 text-left min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <span className="text-xs font-bold text-slate-900 block truncate">
                    {fileName || 'Uploaded Document'}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium block">
                    ✓ Upload complete and saved
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 rounded"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-1 text-slate-400 hover:text-red-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-2">
              <Upload className="w-7 h-7 mx-auto mb-1.5 text-slate-400" />
              <div className="text-xs font-semibold text-slate-700">
                <span>Click to browse</span> or drag and drop document
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {hint || `PDF, DOCX, XLSX up to ${limitMB}MB supported.`}
              </p>
              {errorMessage && (
                <div className="mt-2 text-xs text-red-600 font-medium flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
