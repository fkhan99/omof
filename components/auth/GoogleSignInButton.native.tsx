import { Button } from '@/components/ui/Button';
import { signInWithGoogle } from '@/services/firebase/socialAuth';
import { User as FirebaseUser } from 'firebase/auth';

interface GoogleSignInButtonProps {
  disabled?: boolean;
  loading?: boolean;
  onSuccess: (user: FirebaseUser) => void;
  onError: (message: string) => void;
}

export function GoogleSignInButton({
  disabled = false,
  loading = false,
  onSuccess,
  onError,
}: GoogleSignInButtonProps) {
  const handlePress = async () => {
    try {
      const user = await signInWithGoogle();
      onSuccess(user);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Google sign-in failed.');
    }
  };

  return (
    <Button
      title="Continue with Google"
      variant="secondary"
      onPress={handlePress}
      loading={loading}
      disabled={disabled || loading}
    />
  );
}
