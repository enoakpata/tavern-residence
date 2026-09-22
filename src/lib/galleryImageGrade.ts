// A single, subtle warm color grade applied to every photo in the
// "Around the Residence" gallery (both the mosaic tiles and the
// lightbox) — a touch of sepia and lifted contrast/saturation, just
// enough that photos from different shoots read as one consistent,
// editorial set rather than an unedited dump. Shared as one constant so
// the tile grid and the lightbox can never drift out of sync with each
// other.
export const GALLERY_IMAGE_GRADE = '[filter:sepia(0.08)_saturate(1.08)_contrast(1.03)]'
