/**
 * Client-side Image Compression & Validation Utility (Phase 7)
 * Ensures product/variant images are validated for MIME type and file size,
 * resized to lightweight thumbnails/WebP data URLs (< 60 KB), and never stored
 * as raw multi-megabyte Base64 blobs in Firestore documents.
 */

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export const MAX_RAW_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB max input file
export const MAX_COMPRESSED_DATA_URL_LENGTH = 85_000; // ~60 KB max compressed data URL

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export function validateProductImageFile(file: {
  type?: string;
  size?: number;
  name?: string;
}): ImageValidationResult {
  if (!file) {
    return { valid: false, error: 'কোনো ছবি নির্বাচন করা হয়নি।' };
  }
  const mime = String(file.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime)) {
    return {
      valid: false,
      error: 'শুধুমাত্র JPG, PNG অথবা WebP ফরম্যাটের ছবি আপলোড করা যাবে।',
    };
  }
  const size = Number(file.size) || 0;
  if (size <= 0) {
    return { valid: false, error: 'ছবির ফাইলটি খালি বা ত্রুটিপূর্ণ।' };
  }
  if (size > MAX_RAW_UPLOAD_BYTES) {
    return {
      valid: false,
      error: 'ছবির সাইজ ৫ মেগাবাইটের (5MB) বেশি হতে পারবে না।',
    };
  }
  return { valid: true };
}

/**
 * Compresses and resizes an image file in the browser using HTMLCanvasElement
 * into a compact WebP (or JPEG fallback) thumbnail suitable for fast loading.
 */
export async function compressProductImageFile(
  file: File,
  maxDimension = 360,
  quality = 0.76
): Promise<string> {
  const check = validateProductImageFile(file);
  if (!check.valid) {
    throw new Error(check.error);
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ছবিটি রিড করা যায়নি।'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ছবিটি লোড করা যায়নি।'));
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('ব্রাউজারে ইমেজ কম্প্রেশন সাপোর্ট করছে না।'));
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          // If still larger than budget, step down quality
          if (dataUrl.length > MAX_COMPRESSED_DATA_URL_LENGTH) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.55);
          }
          resolve(dataUrl);
        } catch (err: any) {
          reject(new Error(err?.message || 'ইমেজ কম্প্রেস করতে সমস্যা হয়েছে।'));
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
