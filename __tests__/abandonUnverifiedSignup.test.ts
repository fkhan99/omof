import { abandonUnverifiedSignup } from '@/services/firebase/abandonUnverifiedSignup';

const mockDeleteUser = jest.fn();
const mockGetDoc = jest.fn();
const mockLogOut = jest.fn();
const mockDeleteViaFunction = jest.fn();

let mockCurrentUser: { uid: string; email?: string } | null = {
  uid: 'user-1',
  email: 'test@example.com',
};

jest.mock('firebase/auth', () => ({
  deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

jest.mock('@/services/firebase/auth', () => ({
  logOut: (...args: unknown[]) => mockLogOut(...args),
}));

jest.mock('@/services/firebase/deleteAuthUserCallable', () => ({
  deleteCurrentAuthUserViaFunction: (...args: unknown[]) => mockDeleteViaFunction(...args),
}));

jest.mock('@/services/firebase/config', () => ({
  getFirebaseAuth: () => ({
    get currentUser() {
      return mockCurrentUser;
    },
  }),
  getFirebaseDb: () => ({}),
  isFirebaseConfigured: () => true,
}));

describe('abandonUnverifiedSignup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { uid: 'user-1', email: 'test@example.com' };
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockDeleteViaFunction.mockImplementation(async () => {
      mockCurrentUser = null;
    });
    mockDeleteUser.mockImplementation(async () => {
      mockCurrentUser = null;
    });
    mockLogOut.mockResolvedValue(undefined);
  });

  it('rejects when not signed in', async () => {
    mockCurrentUser = null;
    await expect(abandonUnverifiedSignup()).rejects.toThrow('You must be signed in to switch emails');
  });

  it('rejects when profile already exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true });
    await expect(abandonUnverifiedSignup()).rejects.toThrow('already has a profile');
  });

  it('deletes via Cloud Function when available', async () => {
    await abandonUnverifiedSignup();

    expect(mockDeleteViaFunction).toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockLogOut).toHaveBeenCalled();
  });

  it('falls back to client deleteUser when Cloud Function fails', async () => {
    mockDeleteViaFunction.mockRejectedValue(new Error('functions/unavailable'));

    await abandonUnverifiedSignup();

    expect(mockDeleteUser).toHaveBeenCalled();
    expect(mockLogOut).toHaveBeenCalled();
  });
});
