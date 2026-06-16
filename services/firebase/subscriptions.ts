import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './config';
import { mapMockTransactionDoc } from './mappers';
import { UserPlan, MockTransaction } from '@/types';
import { PLUS_TRIAL_CREDITS } from '@/constants/plans';

/**
 * MOCK / TEST ONLY — no real payment processor is integrated.
 */
export async function startMockPlusTrial(userId: string): Promise<MockTransaction> {
  const authUid = getFirebaseAuth().currentUser?.uid;
  if (!authUid || authUid !== userId) {
    throw new Error('You must be signed in to upgrade.');
  }

  const db = getFirebaseDb();
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error('User not found.');
  }

  const currentPlan = (userSnap.data().plan as UserPlan) ?? 'free';
  if (currentPlan === 'plus') {
    throw new Error('You already have OMOF Plus.');
  }

  const transactionRef = await addDoc(collection(db, 'transactions_mock'), {
    userId,
    plan: 'plus',
    amount: 0,
    currency: 'USD',
    status: 'mock_completed',
    isTestPurchase: true,
    createdAt: serverTimestamp(),
  });

  await updateDoc(userRef, {
    plan: 'plus',
    promotionCredits: PLUS_TRIAL_CREDITS,
    updatedAt: serverTimestamp(),
  });

  const transactionSnap = await getDoc(transactionRef);
  const transaction = mapMockTransactionDoc(transactionRef.id, transactionSnap.data()!);

  console.log('[subscriptions] mock plus trial started', {
    userId,
    transactionId: transaction.id,
    promotionCredits: PLUS_TRIAL_CREDITS,
  });

  return transaction;
}

export async function getUserPlan(userId: string): Promise<UserPlan> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return 'free';
  return (snap.data().plan as UserPlan) ?? 'free';
}
