import type { ReactNode } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { readGoogleWebClientId } from '@/services/firebase/socialAuth';

export function AuthProviders({ children }: { children: ReactNode }) {
  const clientId = readGoogleWebClientId();
  if (!clientId) return children;
  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>;
}
