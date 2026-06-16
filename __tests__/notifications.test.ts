import { getActivityMessage } from '@/utils/notifications';
import { Notification } from '@/types';

describe('getActivityMessage', () => {
  const base: Notification = {
    id: 'n1',
    recipientId: 'user-b',
    actorId: 'user-a',
    actorUsername: 'alice',
    actorDisplayName: 'Alice',
    actorPhotoURL: null,
    type: 'follow',
    postId: null,
    postImageURL: null,
    commentText: null,
    commentId: null,
    reactionType: null,
    read: false,
    createdAt: new Date(),
  };

  it('formats follow notifications', () => {
    expect(getActivityMessage(base)).toBe('alice started following you');
  });

  it('formats comment notifications', () => {
    expect(
      getActivityMessage({
        ...base,
        type: 'comment',
        commentText: 'Sending support!',
      }),
    ).toBe('alice commented: Sending support!');
  });

  it('formats reaction notifications', () => {
    expect(getActivityMessage({ ...base, type: 'reaction' })).toBe(
      'alice reacted to your post',
    );
    expect(
      getActivityMessage({
        ...base,
        type: 'reaction',
        reactionType: 'been_there',
      }),
    ).toBe('alice reacted with "I\'ve been there" to your post');
  });

  it('formats like notifications', () => {
    expect(getActivityMessage({ ...base, type: 'like' })).toBe('alice liked your post');
  });

  it('formats follow request notifications', () => {
    expect(getActivityMessage({ ...base, type: 'follow_request' })).toBe(
      'alice requested to follow you',
    );
  });

  it('formats follow accepted notifications', () => {
    expect(getActivityMessage({ ...base, type: 'follow_accepted' })).toBe(
      'alice accepted your follow request',
    );
  });
});
