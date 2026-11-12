/**
 * ImageCompressionService
 * High-performance client-side image compression and resizing using Canvas.
 * Optimizes photos before direct Cloudflare R2 upload to reduce bandwidth and speed up uploads.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeBytes?: number;
}

export class ImageCompressionService {
  private static readonly DEFAULT_OPTIONS: CompressionOptions = {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.85,
    maxSizeBytes: 1.5 * 1024 * 1024, // 1.5 MB
  };

  /**
   * Checks if a file is an image suitable for canvas compression.
   */
  public static isCompressibleImage(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    return validTypes.includes(file.type.toLowerCase());
  }

  /**
   * Compresses and resizes an image file if needed.
   * Returns original file if not compressible or already under target size.
   */
  public static async compressImage(
    file: File,
    userOptions?: CompressionOptions
  ): Promise<File> {
    if (!this.isCompressibleImage(file)) {
      return file;
    }

    const options = { ...this.DEFAULT_OPTIONS, ...userOptions };

    // If file is already smaller than 400KB, return as-is
    if (file.size < 400 * 1024) {
      return file;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          const maxWidth = options.maxWidth || 1200;
          const maxHeight = options.maxHeight || 1200;

          // Compute aspect ratio scaling
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file); // fallback
            return;
          }

          // Smooth rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob
          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const quality = options.quality ?? 0.85;

          canvas.toBlob(
            (blob) => {
              if (!blob || blob.size >= file.size) {
                // If compression resulted in larger file, keep original
                resolve(file);
                return;
              }

              const compressedFile = new File([blob], file.name, {
                type: outputType,
                lastModified: Date.now(),
              });

              console.log(
                `[ImageCompression] Reduced ${file.name} from ${(file.size / 1024).toFixed(1)} KB to ${(compressedFile.size / 1024).toFixed(1)} KB`
              );

              resolve(compressedFile);
            },
            outputType,
            quality
          );
        };

        img.onerror = () => {
          resolve(file);
        };

        img.src = event.target?.result as string;
      };

      reader.onerror = () => {
        resolve(file);
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Helper to retrieve image dimensions
   */
  public static async getImageDimensions(
    file: File
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('File is not an image'));
        return;
      }

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }
}
