export interface PresignedUploadOptions {
  fileName: string;
  contentType: string;
  fileSize: number;
  folder: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
  contentType: string;
  uploadMode?: 'DIRECT_R2' | 'SERVER_GATEWAY';
  isCorsConfigured?: boolean;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
  expiresIn: number;
  fileKey: string;
}

export interface StorageService {
  generatePresignedUploadUrl(options: PresignedUploadOptions): Promise<PresignedUploadResult>;
  generatePresignedDownloadUrl(fileKey: string, expiresInSeconds?: number): Promise<PresignedDownloadResult>;
  deleteObject(fileKey: string): Promise<boolean>;
  objectExists(fileKey: string): Promise<boolean>;
  uploadObjectBuffer?(fileKey: string, buffer: Buffer, contentType: string): Promise<{ success: boolean; fileKey: string; etag?: string }>;
  getObjectBuffer?(fileKey: string): Promise<{ buffer: Buffer; contentType: string } | null>;
}
