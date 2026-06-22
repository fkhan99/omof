import { Platform } from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  IMAGE_COMPRESS_QUALITY,
  IMAGE_MAX_DIMENSION,
  VIDEO_THUMBNAIL_TIMEOUT_MS,
  VIDEO_THUMBNAIL_UPLOAD_TIMEOUT_MS,
} from '@/constants/theme';

const PLACEHOLDER_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCfAAH/2Q==';

const NATIVE_THUMBNAIL_TIMES_MS = [0, 500, 1000, 2000];

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

function getImageExtensionFromUri(uri: string): string {
  const lower = uri.toLowerCase().split('?')[0].split('#')[0];
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'heic';
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.webp')) return 'webp';
  if (lower.endsWith('.gif')) return 'gif';
  return 'jpg';
}

/**
 * Image pickers on iOS may return gallery or iCloud URIs that must be copied
 * into cache before manipulation or upload.
 */
export async function resolveLocalImageUri(imageUri: string): Promise<string> {
  if (Platform.OS === 'web') return imageUri;

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return imageUri;

  if (imageUri.startsWith('file://')) {
    try {
      const info = await FileSystem.getInfoAsync(imageUri);
      if (info.exists) return imageUri;
    } catch {
      // Fall through and copy from the original URI.
    }
  }

  const destination = `${cacheDir}omof-image-${Date.now()}.${getImageExtensionFromUri(imageUri)}`;
  await FileSystem.copyAsync({ from: imageUri, to: destination });
  return destination;
}

function getExtensionFromUri(uri: string): string {
  const lower = uri.toLowerCase().split('?')[0].split('#')[0];
  if (lower.endsWith('.mov')) return 'mov';
  if (lower.endsWith('.webm')) return 'webm';
  if (lower.endsWith('.m4v')) return 'm4v';
  return 'mp4';
}

export function getPlaceholderJpegBytes(): Uint8Array {
  const binary = atob(PLACEHOLDER_JPEG_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * VideoThumbnails only works reliably on a local file path. Gallery pickers often
 * return content:// or ph:// URIs that must be copied into cache first.
 */
export async function resolveLocalVideoUri(videoUri: string): Promise<string> {
  if (Platform.OS === 'web') return videoUri;

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return videoUri;

  if (videoUri.startsWith('file://')) {
    try {
      const info = await FileSystem.getInfoAsync(videoUri);
      if (info.exists) return videoUri;
    } catch {
      // Fall through and copy from the original URI.
    }
  }

  const destination = `${cacheDir}omof-video-${Date.now()}.${getExtensionFromUri(videoUri)}`;
  await FileSystem.copyAsync({ from: videoUri, to: destination });
  return destination;
}

async function extractNativeThumbnail(
  videoUri: string,
  timeoutMs: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let pending = NATIVE_THUMBNAIL_TIMES_MS.length;

    const finish = (uri: string | null) => {
      if (settled) return;
      settled = true;
      resolve(uri);
    };

    const timeoutId = setTimeout(() => finish(null), timeoutMs);

    NATIVE_THUMBNAIL_TIMES_MS.forEach((time) => {
      VideoThumbnails.getThumbnailAsync(videoUri, { time, quality: 0.75 })
        .then(({ uri }) => {
          if (!settled && uri) {
            clearTimeout(timeoutId);
            finish(uri);
          }
        })
        .catch((error) => {
          if (__DEV__) {
            console.warn(`[extractNativeThumbnail] time=${time}`, error);
          }
        })
        .finally(() => {
          pending -= 1;
          if (!settled && pending === 0) {
            clearTimeout(timeoutId);
            finish(null);
          }
        });
    });
  });
}

async function generateWebVideoThumbnail(videoUri: string): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoUri;

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(null);
    }, VIDEO_THUMBNAIL_UPLOAD_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    const captureFrame = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 720;
        const context = canvas.getContext('2d');
        if (!context) {
          cleanup();
          resolve(null);
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        cleanup();
        resolve(dataUrl);
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onloadedmetadata = () => {
      const seekTime = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(1, video.duration / 3)
        : 0;
      video.currentTime = seekTime;
    };

    video.onseeked = captureFrame;

    video.onerror = () => {
      cleanup();
      resolve(null);
    };
  });
}

/**
 * Best-effort preview frame. Image picker does not expose the gallery thumbnail URI.
 */
export async function generateVideoThumbnail(
  videoUri: string,
  timeoutMs: number = VIDEO_THUMBNAIL_TIMEOUT_MS,
): Promise<string | null> {
  const localUri = await resolveLocalVideoUri(videoUri);

  if (Platform.OS === 'web') {
    return withTimeout(generateWebVideoThumbnail(localUri), timeoutMs);
  }

  return extractNativeThumbnail(localUri, timeoutMs);
}

export async function writePlaceholderThumbnailFile(): Promise<string | null> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return null;

  const destination = `${cacheDir}omof-video-thumb-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(destination, PLACEHOLDER_JPEG_BASE64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return destination;
}

export async function getVideoThumbnailOrPlaceholder(videoUri: string): Promise<string | null> {
  const localUri = await resolveLocalVideoUri(videoUri);
  const thumbnail = await generateVideoThumbnail(
    localUri,
    VIDEO_THUMBNAIL_UPLOAD_TIMEOUT_MS,
  );
  if (thumbnail) return thumbnail;

  if (Platform.OS === 'web') {
    return `data:image/jpeg;base64,${PLACEHOLDER_JPEG_BASE64}`;
  }

  try {
    return await writePlaceholderThumbnailFile();
  } catch (error) {
    if (__DEV__) {
      console.warn('[getVideoThumbnailOrPlaceholder] placeholder file failed', error);
    }
    return null;
  }
}

export function getVideoContentType(uri: string, mimeType?: string | null): string {
  if (mimeType?.startsWith('video/')) return mimeType;

  const lower = uri.toLowerCase();
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}

export function getVideoExtension(contentType: string): string {
  if (contentType.includes('quicktime')) return 'mov';
  if (contentType.includes('webm')) return 'webm';
  return 'mp4';
}

export async function prepareVideoForUpload(videoUri: string): Promise<string> {
  return resolveLocalVideoUri(videoUri);
}

export interface OptimizedImage {
  uri: string;
  width: number;
  height: number;
  contentType: 'image/webp' | 'image/jpeg';
  extension: 'webp' | 'jpg';
}

function getUploadImageEncoding(): Pick<OptimizedImage, 'contentType' | 'extension'> & {
  format: SaveFormat;
} {
  if (Platform.OS === 'web') {
    return { format: SaveFormat.JPEG, contentType: 'image/jpeg', extension: 'jpg' };
  }
  return { format: SaveFormat.WEBP, contentType: 'image/webp', extension: 'webp' };
}

async function saveOptimizedImage(
  image: Awaited<ReturnType<Awaited<ReturnType<typeof ImageManipulator.manipulate>>['renderAsync']>>,
  compress: number,
): Promise<OptimizedImage> {
  const encoding = getUploadImageEncoding();
  const result = await image.saveAsync({
    format: encoding.format,
    compress,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    contentType: encoding.contentType,
    extension: encoding.extension,
  };
}

/**
 * Downscales an image so its longest edge does not exceed `maxDimension`, then
 * re-encodes it as WebP. Returns the original (re-encoded) image when it's
 * already within bounds. Accepts local file URIs and base64 data URIs.
 */
export async function optimizeImageForUpload(
  uri: string,
  maxDimension: number = IMAGE_MAX_DIMENSION,
  compress: number = IMAGE_COMPRESS_QUALITY,
): Promise<OptimizedImage> {
  const localUri = await resolveLocalImageUri(uri);
  const context = ImageManipulator.manipulate(localUri);
  let image = await context.renderAsync();

  const longestEdge = Math.max(image.width, image.height);
  if (longestEdge > maxDimension) {
    const scale = maxDimension / longestEdge;
    context.resize({
      width: Math.round(image.width * scale),
      height: Math.round(image.height * scale),
    });
    image = await context.renderAsync();
  }

  const result = await image.saveAsync({
    format: SaveFormat.WEBP,
    compress,
  });

  return { uri: result.uri, width: result.width, height: result.height };
}

/**
 * Square-crops and downscales profile photos. Used when iOS picks the original
 * library asset without the native crop UI.
 */
export async function optimizeAvatarForUpload(
  uri: string,
  maxDimension: number = IMAGE_MAX_DIMENSION,
  compress: number = IMAGE_COMPRESS_QUALITY,
): Promise<OptimizedImage> {
  const localUri = await resolveLocalImageUri(uri);
  const context = ImageManipulator.manipulate(localUri);
  let image = await context.renderAsync();

  const cropSize = Math.min(image.width, image.height);
  if (cropSize < image.width || cropSize < image.height) {
    context.crop({
      originX: Math.round((image.width - cropSize) / 2),
      originY: Math.round((image.height - cropSize) / 2),
      width: cropSize,
      height: cropSize,
    });
    image = await context.renderAsync();
  }

  if (image.width > maxDimension) {
    context.resize({ width: maxDimension, height: maxDimension });
    image = await context.renderAsync();
  }

  const result = await image.saveAsync({
    format: SaveFormat.WEBP,
    compress,
  });

  return { uri: result.uri, width: result.width, height: result.height };
}

export async function persistDataUrlThumbnail(dataUrl: string): Promise<string | null> {
  if (!dataUrl.startsWith('data:image')) return dataUrl;

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return dataUrl;

  const base64 = dataUrl.split(',')[1];
  if (!base64) return null;

  const destination = `${cacheDir}omof-video-thumb-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(destination, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return destination;
}
