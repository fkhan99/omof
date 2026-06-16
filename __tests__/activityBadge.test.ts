import { computeActivityBadgeCount } from '@/utils/activityBadge';
import { Notification } from '@/types';

describe('computeActivityBadgeCount', () => {
  const base: Notification = {
    id: 'n1',
    recipientId: 'user-b',
    actorId: 'user-a',
    actorUsername: 'alice',
    actorDisplayName: 'Alice',
    actorPhotoURL: null,
    type: 'comment',
    postId: 'post-1',
    postImageURL: null,
    commentText: 'hi',
    commentId: 'c1',
    reactionType: null,
    read: false,
    createdAt: new Date(),
  };

  it('counts unread notifications plus pending follow requests', () => {
    expect(
      computeActivityBadgeCount(
        [base, { ...base, id: 'n2', read: true }],
        2,
      ),
    ).toBe(3);
  });

  it('does not double-count follow_request notifications', () => {
    expect(
      computeActivityBadgeCount(
        [{ ...base, type: 'follow_request' }],
        1,
      ),
    ).toBe(1);
  });

  it('returns zero when nothing is unread and no requests', () => {
    expect(computeActivityBadgeCount([{ ...base, read: true }], 0)).toBe(0);
  });
});
