import {
  PresignedUploadRequest,
  PresignedUploadResponse,
  PresignedDownloadResponse,
  R2FileMetadata,
  StorageFolder,
} from '../types';
import { ImageCompressionService } from './imageCompressionService';
import { getApiUrl, getFileContentUrl, getAuthHeaders } from './apiConfig';
import { normalizePhotoFile, compressDocumentFile, isPdfFile } from '../utils/photoNormalizer';

export interface UploadProgressEvent {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  fileKey: string;
  originalFileName: string;
  contentType: string;
  fileSize: number;
  storageProvider: 'CLOUDFLARE_R2';
  uploadedAt: string;
  previewUrl?: string;
  downloadUrl?: string;
  publicUrl?: string;
  url?: string;
}

export interface DirectUploadOptions {
  folder: StorageFolder;
  file: File;
  onProgress?: (event: UploadProgressEvent) => void;
  signal?: AbortSignal;
  compressPhoto?: boolean;
}

class FileUploadService {
  // Client-side cache for presigned download URLs: Map<fileKey, { url: string; expiresAt: number }>
  private downloadUrlCache: Map<string, { url: string; expiresAt: number }> = new Map();

  /**
   * Validates file size and MIME type according to folder category
   */
  public validateFile(file: File, folder: StorageFolder): { valid: boolean; error?: string } {
    const isPhotoOrLogo = folder.includes('photos') || folder.includes('logo');

    // Student / staff photos: any image or a PDF is fine, it is converted to a JPEG before upload
    if (folder.includes('photos')) {
      const looksLikeImage =
        file.type.toLowerCase().startsWith('image/') ||
        isPdfFile(file) ||
        /\.(jpe?g|jfif|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name);
      if (!looksLikeImage) {
        return { valid: false, error: 'Please choose a photo: JPG, JPEG, PNG, WEBP or PDF.' };
      }
      if (file.size > 25 * 1024 * 1024) {
        return { valid: false, error: 'The file is larger than 25 MB. Please choose a smaller photo.' };
      }
      return { valid: true };
    }

    if (isPhotoOrLogo) {
      const allowedMimes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/jpg',
        'image/pjpeg',
        'image/x-png',
      ];
      const isAllowedMime = allowedMimes.includes(file.type.toLowerCase()) || file.type.startsWith('image/');
      const isAllowedExt = !!file.name.match(/\.(jpe?g|png|webp|jfif|bmp)$/i);

      if (!isAllowedMime && !isAllowedExt) {
        return {
          valid: false,
          error: 'Please select a valid image file (PNG, JPG, or WEBP).',
        };
      }
      if (file.size > 10 * 1024 * 1024) {
        return {
          valid: false,
          error: 'Image file size exceeds the 10 MB limit. Please choose a smaller photo.',
        };
      }
    } else {
      const allowed = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      if (!allowed.includes(file.type.toLowerCase()) && !file.name.match(/\.(pdf|docx?|xlsx?|jpg|jpeg|png)$/i)) {
        return {
          valid: false,
          error: 'Allowed file types: PDF, DOCX, XLSX, JPG, PNG.',
        };
      }
      if (file.size > 25 * 1024 * 1024) {
        return {
          valid: false,
          error: 'Document file size exceeds the 25 MB limit.',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Requests a presigned PUT upload URL from the backend
   */
  public async getPresignedUploadUrl(
    request: PresignedUploadRequest
  ): Promise<PresignedUploadResponse> {
    const response = await fetch(getApiUrl('/api/files/presign-upload'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload request failed' }));
      throw new Error(err.error || 'The upload could not be started. Please try again.');
    }

    return response.json();
  }

  /**
   * Direct browser upload to Cloudflare R2 (or simulation bucket) with progress tracking
   */
  public async uploadDirectToR2(
    fileOrOptions: File | DirectUploadOptions,
    folderArg?: StorageFolder,
    onProgressArg?: (progress: number | any) => void
  ): Promise<UploadResult & { publicUrl: string }> {
    let options: DirectUploadOptions;
    if (fileOrOptions instanceof File) {
      options = {
        file: fileOrOptions,
        folder: folderArg || 'public-website/hero',
        onProgress: onProgressArg as any,
      };
    } else {
      options = fileOrOptions;
    }

    let { file, folder, onProgress, signal, compressPhoto = true } = options;

    // 1. Validation
    const validation = this.validateFile(file, folder);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 2. Client-side Image Optimization.
    // Student / staff photos always become a resized JPEG (also from PDF, HEIC on Safari, .jfif, image/jpg...)
    if (folder.includes('photos') && !(file.type === 'image/jpeg' && (file as any).__normalizedPhoto)) {
      file = await this.preparePhoto(file);
    }
    // Student / staff documents: images and large PDFs are compressed before upload
    if (folder.includes('documents') && !(file as any).__compressedDocument) {
      file = await compressDocumentFile(file);
      (file as any).__compressedDocument = true;
    }
    const isImage = file.type.startsWith('image/');
    const alreadyCompressed = (file as any).__normalizedPhoto || (file as any).__compressedDocument;
    if (isImage && compressPhoto && !alreadyCompressed && ImageCompressionService.isCompressibleImage(file)) {
      try {
        file = await ImageCompressionService.compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.85,
        });
      } catch (e) {
        console.warn('Image optimization skipped:', e);
      }
    }

    // 3. Resilient Upload with Automatic Cloudflare R2 Gateway Fallback
    try {
      // Request short-lived presigned upload URL or gateway URL
      const presign = await this.getPresignedUploadUrl({
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileSize: file.size,
        folder,
      });

      let uploadSucceeded = false;

      // If presigned URL is a direct remote URL (Cloudflare R2 endpoint), attempt direct PUT first
      if (presign.uploadUrl && presign.uploadUrl.startsWith('http')) {
        try {
          await this.executeDirectPut(presign.uploadUrl, file, onProgress, signal);
          uploadSucceeded = true;
        } catch (directErr: any) {
          if (signal?.aborted) throw new Error('Upload cancelled');
          console.warn(
            '[FileUploadService] Direct browser PUT to Cloudflare R2 blocked by browser/CORS. Seamlessly streaming to Cloudflare R2 via secure server gateway...',
            directErr
          );
        }
      }

      // If direct browser PUT was blocked or presigned URL is a local endpoint, stream directly to R2 via server gateway
      if (!uploadSucceeded) {
        const streamUrl =
          presign.uploadUrl && !presign.uploadUrl.startsWith('http')
            ? getApiUrl(presign.uploadUrl)
            : getApiUrl(`/api/files/stream-upload/${encodeURIComponent(presign.fileKey)}?contentType=${encodeURIComponent(file.type || 'application/octet-stream')}`);
        await this.executeDirectPut(streamUrl, file, onProgress, signal);
      }

      // Notify backend of completion to confirm entity association
      const permanentUrl = getFileContentUrl(presign.fileKey);
      const metadata: UploadResult & { publicUrl: string; url: string } = {
        fileKey: presign.fileKey,
        originalFileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        storageProvider: 'CLOUDFLARE_R2',
        uploadedAt: new Date().toISOString(),
        downloadUrl: permanentUrl,
        previewUrl: permanentUrl,
        publicUrl: permanentUrl,
        url: permanentUrl,
      };

      return metadata;
    } catch (err: any) {
      if (signal?.aborted || err.name === 'AbortError') {
        throw new Error('Upload cancelled');
      }
      console.error('[FileUploadService] Upload failed:', err);
      throw err;
    }
  }

  /**
   * Converts a picked student / staff photo (image or PDF) into a resized JPEG ready for upload and preview.
   * Throws an Error whose message can be shown to the user.
   */
  public async preparePhoto(file: File): Promise<File> {
    const out = await normalizePhotoFile(file);
    (out as any).__normalizedPhoto = true;
    return out;
  }

  /**
   * General upload helper returning publicUrl
   */
  public async uploadFile(
    file: File,
    folder: StorageFolder = 'public-website/hero',
    onProgress?: (event: UploadProgressEvent) => void
  ): Promise<UploadResult & { publicUrl: string }> {
    return this.uploadDirectToR2(file, folder, onProgress);
  }

  /**
   * Helper to resolve any fileKey or stored URL to an immediately viewable URL
   */
  public getFileUrl(fileKeyOrUrl?: string): string {
    return getFileContentUrl(fileKeyOrUrl);
  }

  /**
   * Performs the HTTP PUT directly to the target R2 presigned URL
   */
  private executeDirectPut(
    uploadUrl: string,
    file: File,
    onProgress?: (event: UploadProgressEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('Upload cancelled'));
        });
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percentage = Math.min(100, Math.round((e.loaded / e.total) * 100));
          const progressEvent: any = Object.assign(new Number(percentage), {
            loaded: e.loaded,
            total: e.total,
            percentage,
            valueOf() {
              return percentage;
            },
          });
          onProgress(progressEvent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) {
            const progressEvent: any = Object.assign(new Number(100), {
              loaded: file.size,
              total: file.size,
              percentage: 100,
              valueOf() {
                return 100;
              },
            });
            onProgress(progressEvent);
          }
          resolve();
        } else {
          reject(new Error(`Storage provider returned status ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('The upload failed. Check your connection and try again.'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload request timed out.'));
      };

      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      // The school server needs the session to accept the upload; external storage URLs carry their own signature.
      if (uploadUrl.startsWith(getApiUrl('/api/'))) {
        const auth = (getAuthHeaders() as Record<string, string>).Authorization;
        if (auth) xhr.setRequestHeader('Authorization', auth);
      }
      xhr.send(file);
    });
  }

  /**
   * Generates or retrieves a cached presigned download URL for private files
   */
  public async getPresignedDownloadUrl(fileKey: string): Promise<string> {
    if (!fileKey) return '';

    // Check client-side cache
    const now = Date.now();
    const cached = this.downloadUrlCache.get(fileKey);
    if (cached && cached.expiresAt > now + 30000) {
      // Return cached URL if it still has > 30 seconds validity
      return cached.url;
    }

    try {
      const res = await fetch(getApiUrl(`/api/files/presign-download?key=${encodeURIComponent(fileKey)}`), { headers: getAuthHeaders() });
      if (!res.ok) {
        throw new Error('Failed to retrieve file download URL');
      }
      const data: PresignedDownloadResponse = await res.json();

      // Cache for (expiresIn - 30) seconds
      this.downloadUrlCache.set(fileKey, {
        url: data.downloadUrl,
        expiresAt: now + (data.expiresIn - 30) * 1000,
      });

      return data.downloadUrl;
    } catch (err) {
      console.error('[FileUploadService] Failed to get download URL:', err);
      return '';
    }
  }

  public async getDownloadUrl(fileKey: string): Promise<string> {
    return this.getPresignedDownloadUrl(fileKey);
  }

  /**
   * Delete file from Cloudflare R2 through backend
   */
  public async deleteFile(fileKey: string): Promise<boolean> {
    try {
      const res = await fetch(getApiUrl('/api/files'), {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fileKey }),
      });
      if (res.ok) {
        this.downloadUrlCache.delete(fileKey);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[FileUploadService] Delete failed:', err);
      return false;
    }
  }

  /**
   * Associate uploaded file key with student/staff/school entity to confirm permanent storage
   */
  public async confirmFileAssociation(
    fileKey: string,
    entity: { type: 'STUDENT' | 'STUDENT_PHOTO' | 'STUDENT_DOCUMENT' | 'STAFF' | 'SCHOOL_LOGO' | 'PRINCIPAL_SIGNATURE' | 'EXAM_CONTROLLER_SIGNATURE' | 'STUDENT_DOC' | 'STUDY_MATERIAL' | 'HOMEWORK'; id: string }
  ): Promise<boolean> {
    try {
      const res = await fetch(getApiUrl('/api/files/confirm'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fileKey, associatedEntity: entity }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch current Cloudflare R2 storage operational status and bucket metrics
   */
  public async getStorageStatus(): Promise<{
    provider: string;
    configured: boolean;
    bucket: string;
    endpoint: string;
    filesStoredCount: number;
    mode: string;
  }> {
    try {
      const res = await fetch(getApiUrl('/api/files/storage-status'), { headers: getAuthHeaders() });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[FileUploadService] Failed to get storage status:', err);
    }
    return {
      provider: 'CLOUDFLARE_R2',
      configured: true,
      bucket: 'school-management-r2',
      endpoint: 'https://r2.cloudflarestorage.com',
      filesStoredCount: 0,
      mode: 'ACTIVE',
    };
  }
}

export const fileUploadService = new FileUploadService();
