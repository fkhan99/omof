import { ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { getPlaceholderJpegBytes } from '@/utils/media';

async function readUploadBlob(localUri: string): Promise<Blob> {
  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error('Could not read the selected file from your device.');
  }
  return response.blob();
}

export async function uploadLocalFile(
  storage: FirebaseStorage,
  localUri: string,
  storagePath: string,
  contentType: string,
): Promise<string> {
  const storageRef = ref(storage, storagePath);
  const blob = await readUploadBlob(localUri);
  await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(storageRef);
}

export async function uploadPlaceholderThumbnail(
  storage: FirebaseStorage,
  storagePath: string,
): Promise<string> {
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, getPlaceholderJpegBytes(), { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
