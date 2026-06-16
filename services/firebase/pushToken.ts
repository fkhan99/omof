import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from './config';

export async function updateFcmToken(userId: string, token: string | null): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const db = getFirebaseDb();
  await setDoc(
    doc(db, 'users', userId),
    { fcmToken: token, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
