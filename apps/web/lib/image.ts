"use client";

/**
 * Client-side photo preparation for profile uploads.
 *
 * There is no object store in this stack yet, so a photo is downscaled to a
 * square JPEG and stored inline as a data URL on the User row. That keeps the
 * feature self-contained — no bucket, no signed URLs, no new service — and the
 * `imageUrl` column takes a real URL unchanged the day one is added.
 *
 * Downscaling is what makes that viable: a phone photo is several megabytes,
 * which has no business in a database row, while a 256px avatar is ~15-30KB.
 */

/** Rendered size of the stored square, in pixels. */
const TARGET_PX = 256;

/** JPEG quality. 0.82 is the usual knee — visually clean, well off the cliff. */
const QUALITY = 0.82;

/** Reject anything that would still be oversized after encoding. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Roughly the encoded size of the data URL we are willing to store. */
export const MAX_STORED_BYTES = 300 * 1024;

export class ImageError extends Error {}

/**
 * Read an image file, center-crop it to a square, downscale, and return a
 * JPEG data URL.
 *
 * Center-crop rather than letterbox because every surface renders this in a
 * square or circle: fitting the whole frame in would just add bars that the
 * rounded corners then clip unpredictably.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new ImageError("That file is not an image.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageError("That image is larger than 8MB.");
  }

  const bitmap = await loadBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = TARGET_PX;
    canvas.height = TARGET_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("Could not process that image.");

    // JPEG has no alpha, so a transparent PNG would encode its holes as black
    // without this. White matches the light end of the avatar palette.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, TARGET_PX, TARGET_PX);
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET_PX, TARGET_PX);

    const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
    if (dataUrl.length > MAX_STORED_BYTES) {
      throw new ImageError("That image is too detailed to store. Try another.");
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

/**
 * Decode a file to an ImageBitmap.
 *
 * Falls back to an <img> element because Safari did not support createImageBitmap
 * on a Blob until relatively recently, and a failed decode here would otherwise
 * take out the whole upload path on those versions.
 */
async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to the <img> path
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new ImageError("Could not read that image."));
      img.src = url;
    });
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}
