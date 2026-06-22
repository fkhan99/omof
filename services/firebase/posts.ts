import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  updateDoc,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseStorage, getFirebaseAuth } from './config';
import { uploadLocalFile, uploadPlaceholderThumbnail } from './upload';
import { mapPostDoc } from './mappers';
import { Post, PaginatedResult, MoodTag, PostMediaType } from '@/types';
import { POSTS_PAGE_SIZE, VIDEO_THUMBNAIL_MAX_DIMENSION } from '@/constants/theme';
import {
  getVideoContentType,
  getVideoExtension,
  getVideoThumbnailOrPlaceholder,
  optimizeImageForUpload,
  prepareVideoForUpload,
} from '@/utils/media';

function filterPostsByAuthor(posts: Post[], authorId: string): Post[] {
  return posts.filter((post) => post.authorId === authorId);
}

export interface CreatePostMediaInput {
  mediaType: PostMediaType;
  uri: string;
  thumbnailUri?: string;
  mimeType?: string | null;
}

export async function createPost(
  author: { id: string; username: string; displayName: string; photoURL: string | null },
  media: CreatePostMediaInput,
  caption: string,
  moodTag: MoodTag,
): Promise<Post> {
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();
  const timestamp = Date.now();

  if (media.mediaType === 'image') {
    const optimized = await optimizeImageForUpload(media.uri);
    const imageURL = await uploadLocalFile(
      storage,
      optimized.uri,
      `posts/${author.id}/${timestamp}.webp`,
      'image/webp',
    );

    const docRef = await addDoc(collection(db, 'posts'), {
      authorId: author.id,
      authorUsername: author.username,
      authorDisplayName: author.displayName,
      authorPhotoURL: author.photoURL,
      mediaType: 'image',
      imageURL,
      videoURL: null,
      caption,
      moodTag,
      reactionCounts: { relate: 0, been_there: 0, sending_support: 0 },
      commentCount: 0,
      createdAt: serverTimestamp(),
    });

    const snap = await getDoc(docRef);
    const post = mapPostDoc(snap.id, snap.data()!);
    return post;
  }

  const videoContentType = getVideoContentType(media.uri, media.mimeType);
  const videoExtension = getVideoExtension(videoContentType);
  const uploadUri = await prepareVideoForUpload(media.uri);
  const thumbnailUri = media.thumbnailUri ?? (await getVideoThumbnailOrPlaceholder(uploadUri));

  const videoURL = await uploadLocalFile(
    storage,
    uploadUri,
    `posts/${author.id}/${timestamp}.${videoExtension}`,
    videoContentType,
  );

  let imageURL: string;
  if (thumbnailUri) {
    const optimizedThumb = await optimizeImageForUpload(
      thumbnailUri,
      VIDEO_THUMBNAIL_MAX_DIMENSION,
    );
    imageURL = await uploadLocalFile(
      storage,
      optimizedThumb.uri,
      `posts/${author.id}/${timestamp}_thumb.webp`,
      'image/webp',
    );
  } else {
    imageURL = await uploadPlaceholderThumbnail(
      storage,
      `posts/${author.id}/${timestamp}_thumb.jpg`,
    );
  }

  const docRef = await addDoc(collection(db, 'posts'), {
    authorId: author.id,
    authorUsername: author.username,
    authorDisplayName: author.displayName,
    authorPhotoURL: author.photoURL,
    mediaType: 'video',
    imageURL,
    videoURL,
    caption,
    moodTag,
    reactionCounts: { relate: 0, been_there: 0, sending_support: 0 },
    commentCount: 0,
    createdAt: serverTimestamp(),
  });

  const snap = await getDoc(docRef);
  const post = mapPostDoc(snap.id, snap.data()!);
  return post;
}

export async function getPost(postId: string): Promise<Post | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'posts', postId));
  if (!snap.exists()) return null;
  return mapPostDoc(snap.id, snap.data());
}

export async function updatePost(
  postId: string,
  authorId: string,
  data: { caption: string; moodTag: MoodTag },
): Promise<Post> {
  const authUid = getFirebaseAuth().currentUser?.uid ?? null;
  if (!authUid || authUid !== authorId) {
    throw new Error('You can only edit your own posts.');
  }

  const db = getFirebaseDb();
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists() || postSnap.data().authorId !== authorId) {
    throw new Error('Post not found.');
  }

  await updateDoc(postRef, {
    caption: data.caption,
    moodTag: data.moodTag,
  });

  const updatedSnap = await getDoc(postRef);
  return mapPostDoc(updatedSnap.id, updatedSnap.data()!);
}

export async function deletePost(postId: string, authorId: string): Promise<void> {
  const authUid = getFirebaseAuth().currentUser?.uid ?? null;
  if (!authUid || authUid !== authorId) {
    throw new Error('You can only delete your own posts.');
  }

  const db = getFirebaseDb();
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists() || postSnap.data().authorId !== authorId) {
    throw new Error('Post not found.');
  }

  const [commentsSnap, reactionsSnap] = await Promise.all([
    getDocs(query(collection(db, 'comments'), where('postId', '==', postId))),
    getDocs(query(collection(db, 'reactions'), where('postId', '==', postId))),
  ]);

  await Promise.all([
    ...commentsSnap.docs.map((commentDoc) => deleteDoc(commentDoc.ref)),
    ...reactionsSnap.docs.map((reactionDoc) => deleteDoc(reactionDoc.ref)),
    deleteDoc(postRef),
  ]);
}

export async function getFeedPosts(
  followingIds: string[],
  pageSize: number = POSTS_PAGE_SIZE,
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<PaginatedResult<Post>> {
  const db = getFirebaseDb();
  const authorIds = [...new Set(followingIds)];

  if (authorIds.length === 0) {
    return { items: [], lastDoc: null, hasMore: false };
  }

  const chunks: string[][] = [];
  for (let i = 0; i < authorIds.length; i += 10) {
    chunks.push(authorIds.slice(i, i + 10));
  }

  const allPosts: Post[] = [];

  for (const chunk of chunks) {
    let q = query(
      collection(db, 'posts'),
      where('authorId', 'in', chunk),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snap = await getDocs(q);
    snap.docs.forEach((docSnap) => {
      allPosts.push(mapPostDoc(docSnap.id, docSnap.data()));
    });
  }

  allPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const items = allPosts.slice(0, pageSize);

  return {
    items,
    lastDoc: items.length > 0 ? null : lastDoc ?? null,
    hasMore: allPosts.length >= pageSize,
  };
}

export async function getPostsByAuthor(
  authorId: string,
  pageSize: number = POSTS_PAGE_SIZE,
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<PaginatedResult<Post>> {
  const db = getFirebaseDb();

  let q = query(
    collection(db, 'posts'),
    where('authorId', '==', authorId),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snap = await getDocs(q);
  const items = filterPostsByAuthor(
    snap.docs.map((docSnap) => mapPostDoc(docSnap.id, docSnap.data())),
    authorId,
  );

  return {
    items,
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === pageSize,
  };
}

/**
 * Posts for the signed-in user only.
 * Requires uid === auth.currentUser.uid (never profile.id unless it matches auth).
 */
export async function getMyPosts(
  uid: string,
  pageSize: number = POSTS_PAGE_SIZE,
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<PaginatedResult<Post>> {
  const authUid = getFirebaseAuth().currentUser?.uid ?? null;

  console.log('[getMyPosts] auth.currentUser.uid:', authUid);
  console.log('[getMyPosts] requested uid:', uid);

  if (!authUid) {
    console.warn('[getMyPosts] No authenticated user — returning empty');
    return { items: [], lastDoc: null, hasMore: false };
  }

  if (uid !== authUid) {
    console.warn('[getMyPosts] uid does not match auth.currentUser.uid — refusing query', {
      authUid,
      requestedUid: uid,
    });
    return { items: [], lastDoc: null, hasMore: false };
  }

  const db = getFirebaseDb();

  try {
    let q = query(
      collection(db, 'posts'),
      where('authorId', '==', authUid),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snap = await getDocs(q);

    console.log('[getMyPosts] query snapshot size:', snap.size);
    console.log('[getMyPosts] returned post IDs:', snap.docs.map((docSnap) => docSnap.id));
    console.log(
      '[getMyPosts] returned post data:',
      snap.docs.map((docSnap) => ({ id: docSnap.id, authorId: docSnap.data().authorId })),
    );

    const items = filterPostsByAuthor(
      snap.docs.map((docSnap) => mapPostDoc(docSnap.id, docSnap.data())),
      authUid,
    );

    console.log('[getMyPosts] owned posts after filter:', items.length);

    return {
      items,
      lastDoc: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: snap.docs.length === pageSize,
    };
  } catch (error) {
    console.error('[getMyPosts] Firestore error:', error);
    throw error;
  }
}
