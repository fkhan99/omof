import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  limit,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './config';
import { mapCommentDoc } from './mappers';
import { Comment, PaginatedResult } from '@/types';
import { COMMENTS_PAGE_SIZE } from '@/constants/theme';
import { filterProfanity } from '@/utils';
import { getPost } from './posts';
import { createNotification } from './notifications';

export async function addComment(
  postId: string,
  author: { id: string; username: string; displayName: string; photoURL: string | null },
  text: string,
): Promise<Comment> {
  const db = getFirebaseDb();
  const filteredText = filterProfanity(text);

  const docRef = await addDoc(collection(db, 'comments'), {
    postId,
    authorId: author.id,
    authorUsername: author.username,
    authorDisplayName: author.displayName,
    authorPhotoURL: author.photoURL,
    text: filteredText,
    createdAt: serverTimestamp(),
  });

  const snap = await getDoc(docRef);
  const comment = mapCommentDoc(docRef.id, snap.data()!);

  const post = await getPost(postId);
  if (post && post.authorId !== author.id) {
    await createNotification({
      recipientId: post.authorId,
      actorId: author.id,
      actorUsername: author.username,
      actorDisplayName: author.displayName,
      actorPhotoURL: author.photoURL,
      type: 'comment',
      postId,
      postImageURL: post.imageURL,
      commentText: filteredText,
      commentId: docRef.id,
    });
  }

  return comment;
}

export async function getComments(
  postId: string,
  pageSize: number = COMMENTS_PAGE_SIZE,
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<PaginatedResult<Comment>> {
  const db = getFirebaseDb();

  // Single-field query — sort client-side to avoid requiring a composite index.
  const snap = await getDocs(
    query(collection(db, 'comments'), where('postId', '==', postId), limit(200)),
  );

  const items = snap.docs
    .map((docSnap) => mapCommentDoc(docSnap.id, docSnap.data()))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, pageSize);

  return {
    items,
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length > pageSize,
  };
}

export async function deleteComment(commentId: string, postId: string): Promise<void> {
  const db = getFirebaseDb();
  const authUid = getFirebaseAuth().currentUser?.uid;

  if (!authUid) {
    throw new Error('You must be signed in to delete a comment.');
  }

  const commentRef = doc(db, 'comments', commentId);
  const commentSnap = await getDoc(commentRef);

  if (!commentSnap.exists()) {
    console.log('comment delete skipped — already removed', { commentId });
    return;
  }

  const commentData = commentSnap.data();

  if (commentData.authorId !== authUid) {
    throw new Error('You can only delete your own comments.');
  }

  const resolvedPostId = (commentData.postId as string) || postId;

  try {
    await deleteDoc(commentRef);
    console.log('comment deleted', {
      commentId,
      postId: resolvedPostId,
      authUid,
      commentAuthorId: commentData.authorId,
    });
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    console.error('comment deletion failed', {
      commentId,
      postId: resolvedPostId,
      authUid,
      commentAuthorId: commentData.authorId,
      code: firebaseError.code,
      message: firebaseError.message ?? String(error),
    });
    throw new Error(
      firebaseError.code === 'permission-denied'
        ? 'You do not have permission to delete this comment.'
        : 'Failed to delete comment. Please try again.',
    );
  }

  // commentCount is decremented server-side when the comment doc is deleted.
}
