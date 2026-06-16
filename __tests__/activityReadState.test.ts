import { applyPersistedReadState, getActivityReadKey } from '@/utils/activityRead';
import { Notification } from '@/types';

describe('activity read state', () => {
  const base: Notification = {
    id: 'derived_comment_abc',
    recipientId: 'user-b',
    actorId: 'user-a',
    actorUsername: 'alice',
    actorDisplayName: 'Alice',
    actorPhotoURL: null,
    type: 'comment',
    postId: 'post-1',
    postImageURL: null,
    commentText: 'Hi',
    commentId: 'comment-1',
    reactionType: null,
    read: false,
    createdAt: new Date(),
  };

  it('marks items read when their key is persisted', () => {
    const readKeys = new Set([getActivityReadKey(base)]);
    const [result] = applyPersistedReadState([base], readKeys);
    expect(result.read).toBe(true);
  });

  it('keeps unread items when their key is not persisted', () => {
    const [result] = applyPersistedReadState([base], new Set());
    expect(result.read).toBe(false);
  });

  it('preserves Firestore read state without a persisted key', () => {
    const [result] = applyPersistedReadState([{ ...base, read: true }], new Set());
    expect(result.read).toBe(true);
  });
});
