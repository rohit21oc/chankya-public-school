import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, CheckCircle2, AlertCircle, Loader2, User, RefreshCw } from 'lucide-react';
import { fileUploadService } from '../../../services/fileUploadService';
import { getFileContentUrl } from '../../../services/apiConfig';
import { PHOTO_ACCEPT, PHOTO_FORMATS_LABEL } from '../../../utils/photoNormalizer';

export interface StaffPhotoUploaderProps {
  photo?: string;
  photoFileKey?: string;
  onChange: (photoUrl: string, fileKey: string) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  label?: string;
  required?: boolean;
}

export const StaffPhotoUploader: React.FC<StaffPhotoUploaderProps> = ({
  photo = '',
  photoFileKey = '',
  onChange,
  onUploadingChange,
  label = 'Staff Photograph',
  required = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Stash failed file to enable instant one-click retry
  const [pendingRetryFile, setPendingRetryFile] = useState<File | null>(null);

  // Local immediate preview state
  const [previewSrc, setPreviewSrc] = useState<string>('');

  // Sync incoming external photo into preview
  useEffect(() => {
    if (photo || photoFileKey) {
      setImgError(false);
      // Prioritize confirmed key or full URL
      const sourceKey = photoFileKey || photo;
      if (sourceKey.startsWith('blob:') || sourceKey.startsWith('data:')) {
        setPreviewSrc(sourceKey);
      } else {
        const resolved = getFileContentUrl(sourceKey) || fileUploadService.getFileUrl(sourceKey);
        setPreviewSrc(resolved);
      }
    } else {
      setPreviewSrc('');
    }
  }, [photo, photoFileKey]);

  // Notify parent of uploading state changes
  const updateUploadingState = (uploading: boolean) => {
    setIsUploading(uploading);
    onUploadingChange?.(uploading);
  };

  const uploadFileToR2 = async (picked: File) => {
    const validation = fileUploadService.validateFile(picked, 'staff/photos');
    if (!validation.valid) {
      setErrorMessage(validation.error || `Please choose a photo (${PHOTO_FORMATS_LABEL}).`);
      return;
    }

    setErrorMessage(null);
    setImgError(false);

    // Any photo (or the first page of a PDF) becomes a resized JPEG the browser and server both accept
    let file: File;
    try {
      updateUploadingState(true);
      setUploadProgress(5);
      file = await fileUploadService.preparePhoto(picked);
    } catch (prepErr: any) {
      updateUploadingState(false);
      setErrorMessage(prepErr?.message || `Please choose a photo (${PHOTO_FORMATS_LABEL}).`);
      return;
    }
    setPendingRetryFile(file);

    // Instant local preview for immediate visual feedback
    const localBlobUrl = URL.createObjectURL(file);
    setPreviewSrc(localBlobUrl);

    updateUploadingState(true);
    setUploadProgress(15);

    try {
      // Direct R2 presigned PUT with Server-Gateway streaming fallback
      const result = await fileUploadService.uploadDirectToR2({
        file,
        folder: 'staff/photos',
        onProgress: (evt) => {
          setUploadProgress(Math.max(15, Math.min(95, evt.percentage)));
        },
      });

      setUploadProgress(100);
      updateUploadingState(false);
      setPendingRetryFile(null);

      // Construct permanent content URL that streams from R2 with caching
      const permanentUrl = getFileContentUrl(result.fileKey) || result.publicUrl || result.downloadUrl || result.fileKey;

      // Clean up previous photo from R2 if replacing an existing file
      if (photoFileKey && photoFileKey !== result.fileKey) {
        fileUploadService.deleteFile(photoFileKey).catch((e) => {
          console.warn('[StaffPhotoUploader] Could not delete replaced staff photo:', e);
        });
      }

      // CRITICAL: Only notify parent with confirmed R2 permanent URL and fileKey
      onChange(permanentUrl, result.fileKey);
    } catch (err: any) {
      console.error('[StaffPhotoUploader] Upload error:', err);
      updateUploadingState(false);
      setErrorMessage(
        err.message || 'The photo could not be uploaded. Please click Retry.'
      );
      // Notice: We do NOT call onChange here with a blob or empty key, preventing unpersisted photo saves!
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFileToR2(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRetry = () => {
    if (pendingRetryFile) {
      uploadFileToR2(pendingRetryFile);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewSrc('');
    setImgError(false);
    setErrorMessage(null);
    setPendingRetryFile(null);
    setUploadProgress(0);
    updateUploadingState(false);

    if (photoFileKey) {
      try {
        await fileUploadService.deleteFile(photoFileKey);
      } catch (e) {
        console.warn('[StaffPhotoUploader] Could not delete staff photo from R2:', e);
      }
    }

    onChange('', '');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !isUploading) {
      uploadFileToR2(file);
    }
  };

  const isPhotoConfirmed = Boolean(photoFileKey && !isUploading && !errorMessage);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-rose-600">*</span>}
        </label>
        {isPhotoConfirmed && (
          <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Photo uploaded
          </span>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="hidden"
        onChange={handleInputChange}
        disabled={isUploading}
      />

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Photo Avatar Preview Area */}
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isUploading) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          title={previewSrc ? 'Click to change photograph' : 'Click to select photograph'}
          className={`relative group w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden cursor-pointer shrink-0 transition-all shadow-2xs ${
            isDragOver
              ? 'border-2 border-blue-600 ring-4 ring-blue-100 bg-blue-50'
              : errorMessage
              ? 'border-2 border-rose-400 bg-rose-50/30'
              : previewSrc && !imgError
              ? 'border-2 border-blue-200 bg-slate-900'
              : 'border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40'
          }`}
        >
          {previewSrc && !imgError ? (
            <>
              <img
                src={previewSrc}
                alt="Staff Photograph Preview"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />

              {/* Hover overlay to change photo */}
              {!isUploading && (
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-white text-[11px] font-semibold transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                  <span>Change Photo</span>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center select-none group-hover:text-blue-600 transition-colors">
              <div className="w-10 h-10 rounded-full bg-slate-200/70 group-hover:bg-blue-100 flex items-center justify-center mb-1 text-slate-500 group-hover:text-blue-600 transition-colors">
                <User className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold block leading-tight">
                {isDragOver ? 'Drop Image Here' : 'Upload Photo'}
              </span>
              <span className="text-[9px] text-slate-400 font-medium">Click to select</span>
            </div>
          )}

          {/* Uploading Spinner Overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-slate-900/85 flex flex-col items-center justify-center p-2 text-white text-center animate-in fade-in duration-100">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400 mb-1" />
              <span className="text-[11px] font-bold">{uploadProgress}%</span>
              <span className="text-[9px] text-slate-300">Uploading…</span>
            </div>
          )}
        </div>

        {/* Action Controls & Guidance */}
        <div className="flex-1 w-full space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {previewSrc ? 'Replace Photograph' : 'Select Photograph'}
            </button>

            {previewSrc && !isUploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                title="Remove photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            )}

            {errorMessage && !isUploading && (
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors"
                title="Retry Upload"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Upload
              </button>
            )}
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1 max-w-sm">
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                  Uploading photo…
                </span>
                <span className="text-blue-700 font-bold">{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-150 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message with Retry */}
          {errorMessage && (
            <div className="flex items-start gap-2 text-xs text-rose-700 font-medium bg-rose-50 p-2.5 rounded-xl border border-rose-200 max-w-md">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p>{errorMessage}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Click to retry upload now
                </button>
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Upload recent passport-size photograph ({PHOTO_FORMATS_LABEL}). It is compressed to about 40 KB. The photo is shown on the staff ID card, Staff Directory, and attendance records.
          </p>
        </div>
      </div>
    </div>
  );
};
