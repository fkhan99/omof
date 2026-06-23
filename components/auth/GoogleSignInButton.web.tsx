import { View, StyleSheet } from 'react-native';
import { GoogleLogin } from '@react-oauth/google';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface GoogleSignInButtonProps {
  disabled?: boolean;
  onSuccess: (idToken: string) => void;
  onError: (message: string) => void;
}

export function GoogleSignInButton({ disabled = false, onSuccess, onError }: GoogleSignInButtonProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.wrapper, disabled && styles.disabled]} pointerEvents={disabled ? 'none' : 'auto'}>
      <GoogleLogin
        theme="outline"
        size="large"
        shape="rectangular"
        text="continue_with"
        width="100%"
        onSuccess={(response) => {
          if (response.credential) {
            onSuccess(response.credential);
            return;
          }
          onError('Google sign-in did not return a credential.');
        }}
        onError={() => {
          onError('Google sign-in failed. If this keeps happening, allow popups and try again.');
        }}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      width: '100%',
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: SPACING.xs,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
