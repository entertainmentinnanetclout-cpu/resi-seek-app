/** Matches the Supabase Storage allowlist in SEC-07 bucket configuration.
 * Client validation improves UX; security enforcement is server-side in Storage.
 */
export const PUBLIC_IMAGE_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
] as const;
export const PUBLIC_IMAGE_ACCEPT = PUBLIC_IMAGE_MIME_TYPES.join(",");

export const SELLER_VERIFICATION_MIME_TYPES = [
  "application/pdf", "image/jpeg", "image/png", "image/webp",
  "image/heic", "image/heif", "image/avif",
] as const;
export const SELLER_VERIFICATION_ACCEPT = SELLER_VERIFICATION_MIME_TYPES.join(",");

export function publicImageUploadError(file: Pick<File,"type"|"size">, maxMiB=5): string | null {
  if (!(PUBLIC_IMAGE_MIME_TYPES as readonly string[]).includes(file.type.toLowerCase())) {
    return "Choose a JPG, PNG, WebP, GIF or AVIF image. SVG and unknown file types are not supported.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > maxMiB * 1024 * 1024) {
    return `Image must be at least 1 byte and no larger than ${maxMiB} MB`;
  }
  return null;
}

export function sellerVerificationUploadError(file: Pick<File,"type"|"size">): string | null {
  if (!(SELLER_VERIFICATION_MIME_TYPES as readonly string[]).includes(file.type.toLowerCase())) {
    return "Verification document must be PDF, JPG, PNG, WebP, HEIC, HEIF or AVIF.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 15 * 1024 * 1024) {
    return "Verification document must be no larger than 15 MB";
  }
  return null;
}
