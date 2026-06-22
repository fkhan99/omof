import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from './config';
import { UserPlan } from '@/types';

export async function getUserPlan(userId: string): Promise<UserPlan> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return 'free';
  return (snap.data().plan as UserPlan) ?? 'free';
}
