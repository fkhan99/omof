import { deleteAccount } from '@/services/firebase/accountDeletion';

const mockDeleteUser = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockWriteBatch = jest.fn();
const mockDeleteObject = jest.fn();
const mockGetUserProfile = jest.fn();
const mockDeletePost = jest.fn();
const mockClearPushToken = jest.fn();

jest.mock('firebase/auth', () => ({
  deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
}));

jest.mock('firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => ({ path }),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

jest.mock('@/utils/pushRegistration', () => ({
  clearPushToken: (...args: unknown[]) => mockClearPushToken(...args),
}));

const mockReauthenticateWithPassword = jest.fn();

jest.mock('@/services/firebase/auth', () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
  reauthenticateWithPassword: (...args: unknown[]) => mockReauthenticateWithPassword(...args),
}));

jest.mock('@/services/firebase/posts', () => ({
  deletePost: (...args: unknown[]) => mockDeletePost(...args),
}));

jest.mock('@/services/firebase/config', () => ({
  getFirebaseAuth: () => ({
    currentUser: { uid: 'user-1' },
  }),
  getFirebaseDb: () => ({}),
  getFirebaseStorage: () => ({}),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn((_db, _collection, id) => ({ id })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  query: jest.fn(),
  where: jest.fn(),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

describe('deleteAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserProfile.mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      email: 'test@example.com',
    });
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockDeleteDoc.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue(undefined);
    mockDeletePost.mockResolvedValue(undefined);
    mockReauthenticateWithPassword.mockResolvedValue(undefined);
    mockDeleteObject.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('rejects when auth uid does not match', async () => {
    await expect(deleteAccount('other-user', 'secret123')).rejects.toThrow(
      'You must be signed in to delete your account.',
    );
  });

  it('rejects when profile is missing', async () => {
    mockGetUserProfile.mockResolvedValue(null);
    await expect(deleteAccount('user-1', 'secret123')).rejects.toThrow('Profile not found.');
  });

  it('rejects when password is missing', async () => {
    await expect(deleteAccount('user-1', '   ')).rejects.toThrow(
      'Enter your password to confirm account deletion.',
    );
  });

  it('deletes user data and auth account when signed in', async () => {
    await deleteAccount('user-1', 'secret123');

    expect(mockReauthenticateWithPassword).toHaveBeenCalledWith('test@example.com', 'secret123');
    expect(mockDeletePost).not.toHaveBeenCalled();
    expect(mockClearPushToken).toHaveBeenCalledWith('user-1');
    expect(mockDeleteDoc).toHaveBeenCalledWith({ id: 'testuser' });
    expect(mockDeleteDoc).toHaveBeenCalledWith({ id: 'user-1' });
    expect(mockDeleteUser).toHaveBeenCalled();
    expect(mockDeleteObject).toHaveBeenCalled();
  });

  it('maps auth/requires-recent-login to a friendly error', async () => {
    mockDeleteUser.mockRejectedValue({ code: 'auth/requires-recent-login' });

    await expect(deleteAccount('user-1', 'secret123')).rejects.toThrow(
      'Enter your password to confirm account deletion.',
    );
  });
});
