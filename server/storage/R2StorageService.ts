import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import {
  StorageService,
  PresignedUploadOptions,
  PresignedUploadResult,
  PresignedDownloadResult,
} from './StorageService';

// Allowed MIME types
const ALLOWED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25 MB
const DEFAULT_EXPIRY_SECONDS = 300; // 5 minutes

export class R2StorageService implements StorageService {
  private s3Client: S3Client | null = null;
  private bucket: string;
  public isConfigured: boolean = false;
  private endpoint: string;
  private corsConfigured: boolean | null = null;
  private lastCorsCheck: number = 0;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY;
    const secretAccessKey = process.env.R2_SECRET_KEY;
    const bucket = process.env.R2_BUCKET || 'school-documents';
    const region = process.env.R2_REGION || 'auto';

    this.bucket = bucket;
    this.endpoint = endpoint || '';

    if (endpoint && accessKeyId && secretAccessKey && !endpoint.includes('<account-id>')) {
      try {
        this.s3Client = new S3Client({
          region,
          endpoint,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        this.isConfigured = true;
        console.log('[R2StorageService] Initialized with Cloudflare R2 bucket:', bucket);
      } catch (err) {
        console.warn('[R2StorageService] Failed to initialize live R2 client, using fallback:', err);
        this.isConfigured = false;
      }
    } else {
      console.log(
        '[R2StorageService] Live R2 credentials not detected in .env. Initializing local R2 Direct-Upload simulation mode.'
      );
      this.isConfigured = false;
    }
  }

  /**
   * Checks if CORS is configured in the Cloudflare R2 bucket for direct browser PUTs
   */
  public async isCorsConfigured(): Promise<boolean> {
    const now = Date.now();
    if (this.corsConfigured !== null && now - this.lastCorsCheck < 60000) {
      return this.corsConfigured;
    }
    if (!this.isConfigured || !this.endpoint) {
      this.corsConfigured = false;
      this.lastCorsCheck = now;
      return false;
    }
    try {
      const res = await fetch(`${this.endpoint}/${this.bucket}/cors-preflight-check`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://school-erp.internal',
          'Access-Control-Request-Method': 'PUT',
          'Access-Control-Request-Headers': 'content-type',
        },
      });
      this.corsConfigured = res.status === 200 || res.status === 204;
      this.lastCorsCheck = now;
      return this.corsConfigured;
    } catch {
      this.corsConfigured = false;
      this.lastCorsCheck = now;
      return false;
    }
  }

  public getConfigurationStatus() {
    return {
      isConfigured: this.isConfigured,
      bucket: this.bucket,
      endpointConfigured: Boolean(this.endpoint && !this.endpoint.includes('<account-id>')),
      provider: 'CLOUDFLARE_R2',
      corsConfigured: this.corsConfigured ?? false,
    };
  }

  /**
   * Validate and sanitize requested folder and file parameters.
   */
  private validateUploadParams(options: PresignedUploadOptions): {
    sanitizedFolder: string;
    extension: string;
  } {
    const { fileName, contentType, fileSize, folder } = options;

    if (!fileName || typeof fileName !== 'string') {
      throw new Error('Invalid or missing fileName');
    }
    if (!contentType || typeof contentType !== 'string') {
      throw new Error('Invalid or missing contentType');
    }
    if (!fileSize || typeof fileSize !== 'number' || fileSize <= 0) {
      throw new Error('Invalid or missing fileSize');
    }

    // Security against path manipulation
    if (folder.includes('..') || folder.includes('//') || folder.startsWith('/') || folder.startsWith('\\')) {
      throw new Error('Path manipulation detected in folder parameter');
    }

    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_\-\/]/g, '').toLowerCase();

    // Check if photo or document
    const isPhotoFolder =
      sanitizedFolder.includes('photo') || sanitizedFolder.includes('logo');

    if (isPhotoFolder) {
      if (!ALLOWED_PHOTO_MIME_TYPES.has(contentType.toLowerCase())) {
        throw new Error(
          `Invalid MIME type '${contentType}' for profile/logo upload. Allowed: JPEG, PNG, WEBP.`
        );
      }
      if (fileSize > MAX_PHOTO_SIZE) {
        throw new Error(`File exceeds maximum allowed photo size of 5 MB.`);
      }
    } else {
      if (!ALLOWED_DOCUMENT_MIME_TYPES.has(contentType.toLowerCase())) {
        throw new Error(
          `Invalid MIME type '${contentType}'. Allowed: PDF, JPG, PNG, WEBP, DOCX, XLSX.`
        );
      }
      if (fileSize > MAX_DOCUMENT_SIZE) {
        throw new Error(`File exceeds maximum allowed document size of 25 MB.`);
      }
    }

    // Extract file extension safely
    const extParts = fileName.split('.');
    let extension = extParts.length > 1 ? extParts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    if (!extension) {
      if (contentType === 'image/jpeg') extension = 'jpg';
      else if (contentType === 'image/png') extension = 'png';
      else if (contentType === 'image/webp') extension = 'webp';
      else if (contentType === 'application/pdf') extension = 'pdf';
      else extension = 'bin';
    }

    return { sanitizedFolder, extension };
  }

  /**
   * Generates hierarchical, collision-free object key.
   * e.g., school/students/photos/2026/09/{uuid}.jpg
   */
  private generateObjectKey(folder: string, extension: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const uuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    if (folder === 'school-logo') {
      return `school/school-logo/${uuid}.${extension}`;
    }

    if (folder.includes('photos')) {
      return `school/${folder}/${year}/${month}/${uuid}.${extension}`;
    }

    return `school/${folder}/${year}/${uuid}.${extension}`;
  }

  public async generatePresignedUploadUrl(
    options: PresignedUploadOptions
  ): Promise<PresignedUploadResult> {
    const { sanitizedFolder, extension } = this.validateUploadParams(options);
    const fileKey = this.generateObjectKey(sanitizedFolder, extension);
    const expiresIn = DEFAULT_EXPIRY_SECONDS;

    // If live R2 client is configured, generate AWS S3 presigned URL
    if (this.isConfigured && this.s3Client) {
      const corsOk = await this.isCorsConfigured();

      // If CORS is not configured on Cloudflare R2, route through the high-speed server stream gateway
      // which uploads directly to Cloudflare R2 using the backend S3 credentials (no CORS blockage)
      if (!corsOk) {
        const uploadUrl = `/api/files/stream-upload/${encodeURIComponent(fileKey)}?expiresIn=${expiresIn}&contentType=${encodeURIComponent(options.contentType)}`;
        return {
          uploadUrl,
          fileKey,
          expiresIn,
          contentType: options.contentType,
          uploadMode: 'SERVER_GATEWAY',
          isCorsConfigured: false,
        };
      }

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        ContentType: options.contentType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      return {
        uploadUrl,
        fileKey,
        expiresIn,
        contentType: options.contentType,
        uploadMode: 'DIRECT_R2',
        isCorsConfigured: true,
      };
    }

    // Dev/Preview Simulation: Return direct-upload endpoint to mock R2 bucket
    // This allows the browser to perform real direct HTTP PUT with progress tracking
    const uploadUrl = `/api/mock-r2-storage/upload/${encodeURIComponent(fileKey)}?expiresIn=${expiresIn}&contentType=${encodeURIComponent(options.contentType)}`;

    return {
      uploadUrl,
      fileKey,
      expiresIn,
      contentType: options.contentType,
      uploadMode: 'SERVER_GATEWAY',
      isCorsConfigured: false,
    };
  }

  /**
   * Sanitizes and validates a storage object key, preventing directory traversal
   */
  private sanitizeKey(fileKey: string): string {
    if (!fileKey || typeof fileKey !== 'string') {
      throw new Error('Invalid fileKey provided');
    }
    const clean = fileKey.replace(/^\/+/, '');
    if (clean.includes('..') || clean.includes('\\')) {
      throw new Error('Access denied: Unauthorized file key structure');
    }
    return clean;
  }

  public async generatePresignedDownloadUrl(
    fileKey: string,
    expiresInSeconds: number = DEFAULT_EXPIRY_SECONDS
  ): Promise<PresignedDownloadResult> {
    const cleanKey = this.sanitizeKey(fileKey);

    // Direct permanent gateway URL that streams from R2 with caching and inline disposition
    const permanentContentUrl = `/api/files/content?key=${encodeURIComponent(cleanKey)}`;

    if (this.isConfigured && this.s3Client) {
      try {
        const isPdf = cleanKey.toLowerCase().endsWith('.pdf');
        const filename = cleanKey.split('/').pop() || (isPdf ? 'document.pdf' : 'document');
        const safeFilename = filename.replace(/["\r\n\\]/g, '_');

        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
          ResponseContentType: isPdf ? 'application/pdf' : undefined,
          ResponseContentDisposition: `inline; filename="${safeFilename}"`,
        });

        const downloadUrl = await getSignedUrl(this.s3Client, command, {
          expiresIn: expiresInSeconds,
        });

        return {
          downloadUrl,
          expiresIn: expiresInSeconds,
          fileKey: cleanKey,
        };
      } catch (err) {
        console.warn(`[R2StorageService] Could not generate presigned download URL for ${cleanKey}, using gateway:`, err);
        return {
          downloadUrl: permanentContentUrl,
          expiresIn: expiresInSeconds,
          fileKey: cleanKey,
        };
      }
    }

    // Dev/Preview simulation download URL
    return {
      downloadUrl: permanentContentUrl,
      expiresIn: expiresInSeconds,
      fileKey: cleanKey,
    };
  }

  public async uploadObjectBuffer(
    fileKey: string,
    buffer: Buffer,
    contentType: string
  ): Promise<{ success: boolean; fileKey: string; etag?: string }> {
    const cleanKey = this.sanitizeKey(fileKey);

    if (this.isConfigured && this.s3Client) {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
        Body: buffer,
        ContentType: contentType,
      });

      const res = await this.s3Client.send(command);
      return {
        success: true,
        fileKey: cleanKey,
        etag: res.ETag,
      };
    }

    return {
      success: true,
      fileKey: cleanKey,
    };
  }

  public async getObjectBuffer(
    fileKey: string
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!fileKey || typeof fileKey !== 'string') return null;
    let cleanKey = '';
    try {
      cleanKey = this.sanitizeKey(fileKey);
    } catch {
      return null;
    }

    if (this.isConfigured && this.s3Client) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
        });
        const res = await this.s3Client.send(command);
        const contentType = res.ContentType || 'application/octet-stream';
        const chunks: Buffer[] = [];
        if (res.Body && (res.Body as any)[Symbol.asyncIterator]) {
          for await (const chunk of res.Body as any) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
        }
        return {
          buffer: Buffer.concat(chunks),
          contentType,
        };
      } catch (err: any) {
        const isNotFound =
          err?.name === 'NoSuchKey' ||
          err?.name === 'NotFound' ||
          err?.Code === 'NoSuchKey' ||
          err?.code === 'NoSuchKey' ||
          err?.$metadata?.httpStatusCode === 404 ||
          (typeof err?.message === 'string' &&
            (err.message.includes('NoSuchKey') || err.message.includes('does not exist')));

        if (!isNotFound) {
          console.warn(`[R2StorageService] Notice reading ${cleanKey}:`, err?.message || err);
        }
        return null;
      }
    }

    return null;
  }

  public async deleteObject(fileKey: string): Promise<boolean> {
    const cleanKey = this.sanitizeKey(fileKey);

    if (this.isConfigured && this.s3Client) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
        });
        await this.s3Client.send(command);
        return true;
      } catch (err: any) {
        const isNotFound =
          err?.name === 'NoSuchKey' ||
          err?.name === 'NotFound' ||
          err?.$metadata?.httpStatusCode === 404;
        if (!isNotFound) {
          console.warn(`[R2StorageService] Notice deleting object ${cleanKey} from R2:`, err?.message || err);
        }
        return false;
      }
    }

    return true;
  }

  public async objectExists(fileKey: string): Promise<boolean> {
    if (!fileKey || typeof fileKey !== 'string') return false;
    let cleanKey = '';
    try {
      cleanKey = this.sanitizeKey(fileKey);
    } catch {
      return false;
    }

    if (this.isConfigured && this.s3Client) {
      try {
        const command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
        });
        await this.s3Client.send(command);
        return true;
      } catch (err) {
        return false;
      }
    }

    return true;
  }
}

export const r2StorageService = new R2StorageService();
