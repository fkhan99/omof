import { doc, updateDoc } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system/legacy';
import { Post } from '@/types';
import { getFirebaseDb, getFirebaseStorage } from './config';
import { uploadLocalFile } from './upload';
import {
  getVideoExtension,
  getVideoContentType,
  getVideoThumbnailOrPlaceholder,
  optimizeImageForUpload,
} from '@/utils/media';
import { needsVideoThumbnailRegen } from '@/utils/posts';
import { VIDEO_THUMBNAIL_MAX_DIMENSION } from '@/constants/theme';

const queue: Post[] = [];
const queuedIds = new Set<string>();
let processing = false;

type BackfillListener = (postId: string, imageURL: string | null) => void;
const listeners = new Map<string, Set<BackfillListener>>();

function notifyListeners(postId: string, imageURL: string | null) {
  const postListeners = listeners.get(postId);
  if (!postListeners) return;
  postListeners.forEach((listener) => listener(postId, imageURL));
}

function subscribeToBackfill(postId: string, listener: BackfillListener): () => void {
  const existing = listeners.get(postId) ?? new Set<BackfillListener>();
  existing.add(listener);
  listeners.set(postId, existing);

  return () => {
    const current = listeners.get(postId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(postId);
    }
  };
}

async function backfillVideoPostThumbnail(post: Post): Promise<string | null> {
  if (!post.videoURL) return null;

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return null;

  const contentType = getVideoContentType(post.videoURL);
  const extension = getVideoExtension(contentType);
  const localVideo = `${cacheDir}omof-backfill-${post.id}.${extension}`;

  try {
    const download = await FileSystem.downloadAsync(post.videoURL, localVideo);
    if (download.status !== 200) {
      throw new Error(`Video download failed with status ${download.status}`);
    }

    const thumbnailUri = await getVideoThumbnailOrPlaceholder(download.uri);
    if (!thumbnailUri) return null;

    const optimizedThumb = await optimizeImageForUpload(
      thumbnailUri,
      VIDEO_THUMBNAIL_MAX_DIMENSION,
    );

    const storage = getFirebaseStorage();
    const imageURL = await uploadLocalFile(
      storage,
      optimizedThumb.uri,
      `posts/backfill/${post.id}_thumb.${optimizedThumb.extension}`,
      optimizedThumb.contentType,
    );

    const db = getFirebaseDb();
    await updateDoc(doc(db, 'posts', post.id), { imageURL });

    return imageURL;
  } finally {
    await FileSystem.deleteAsync(localVideo, { idempotent: true });
  }
}

async function drainBackfillQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const post = queue.shift()!;
    queuedIds.delete(post.id);

    try {
      const imageURL = await backfillVideoPostThumbnail(post);
      notifyListeners(post.id, imageURL);
    } catch (error) {
      if (__DEV__) {
        console.warn('[videoThumbnailBackfill]', post.id, error);
      }
      notifyListeners(post.id, null);
    }
  }

  processing = false;
}

export function scheduleVideoThumbnailBackfill(post: Post): Promise<string | null> {
  return new Promise((resolve) => {
    if (!needsVideoThumbnailRegen(post)) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (imageURL: string | null) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(imageURL);
    };

    const unsubscribe = subscribeToBackfill(post.id, (_postId, imageURL) => {
      finish(imageURL);
    });

    if (!queuedIds.has(post.id)) {
      queuedIds.add(post.id);
      queue.push(post);
      void drainBackfillQueue();
    }
  });
}
