import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { REVIEW_REPORT_THRESHOLD } from './phrases';

const FieldValue = admin.firestore.FieldValue;

type TargetType = 'post' | 'comment';

export async function escalateReportedContent(
  db: admin.firestore.Firestore,
  targetType: TargetType,
  targetId: string,
): Promise<boolean> {
  const collection = targetType === 'post' ? 'posts' : 'comments';
  const targetRef = db.collection(collection).doc(targetId);
  const targetSnap = await targetRef.get();

  if (!targetSnap.exists) {
    functions.logger.info('[moderation] report target missing', { targetType, targetId });
    return false;
  }

  const reportsSnap = await db
    .collection('reports')
    .where('targetId', '==', targetId)
    .get();

  const distinctReporters = new Set<string>();
  reportsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.targetType === targetType && data.reporterId) {
      distinctReporters.add(data.reporterId);
    }
  });

  const reportCount = distinctReporters.size;

  functions.logger.info('[moderation] report count', {
    targetType,
    targetId,
    reportCount,
    threshold: REVIEW_REPORT_THRESHOLD,
  });

  await targetRef.update({ reportCount });

  if (reportCount < REVIEW_REPORT_THRESHOLD) {
    return false;
  }

  const existing = targetSnap.data()!;
  if (existing.reviewRequired === true && existing.isHidden === true) {
    return false;
  }

  await targetRef.update({
    moderationStatus: 'REVIEW',
    moderationReason: `Escalated after ${reportCount} distinct reports.`,
    reviewRequired: true,
    isHidden: true,
    moderationUpdatedAt: FieldValue.serverTimestamp(),
  });

  functions.logger.info('[moderation] content escalated to review', {
    targetType,
    targetId,
    reportCount,
  });

  return true;
}
