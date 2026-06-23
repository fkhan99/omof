import { Platform, ViewStyle } from 'react-native';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  /** Filled buttons, strong brand actions */
  primary: string;
  /** Text/icons on top of `primary` backgrounds */
  onPrimary: string;
  primaryLight: string;
  /** Inline links (Terms, Privacy, Sign in, etc.) */
  link: string;
  accent: string;
  accentSoft: string;
  /** Selected / pressed interactive states (reactions, mood chips, etc.) */
  selected: string;
  selectedBackground: string;
  selectedBorder: string;
  danger: string;
  dangerSoft: string;
  success: string;
  warning: string;
  overlay: string;
  white: string;
  black: string;
};

export const LIGHT_COLORS: ThemeColors = {
  background: '#F7F3EE',
  surface: '#FDFBF7',
  surfaceMuted: '#E8E0D4',
  text: '#1C1917',
  textSecondary: '#44403C',
  textMuted: '#78716C',
  border: '#D6CEC4',
  primary: '#C05621',
  onPrimary: '#FFFFFF',
  primaryLight: '#D97706',
  link: '#B45309',
  accent: '#D97706',
  accentSoft: '#FAF0E4',
  selected: '#7C2D12',
  selectedBackground: '#FCDDB4',
  selectedBorder: '#D97706',
  danger: '#D93040',
  dangerSoft: '#FFF0F1',
  success: '#1F7A45',
  warning: '#B45309',
  overlay: 'rgba(0, 0, 0, 0.45)',
  white: '#FFFFFF',
  black: '#000000',
};

export const DARK_COLORS: ThemeColors = {
  background: '#0C0A08',
  surface: '#1A1612',
  surfaceMuted: '#2A2420',
  text: '#F5F0EB',
  textSecondary: '#D6CEC4',
  textMuted: '#A8A29E',
  border: '#44403C',
  primary: '#F0B872',
  onPrimary: '#1A1208',
  primaryLight: '#F5C882',
  link: '#F0B872',
  accent: '#E8A84A',
  accentSoft: '#2A2218',
  selected: '#FDE8C8',
  selectedBackground: '#3D2E1F',
  selectedBorder: '#D4943A',
  danger: '#FF7B7B',
  dangerSoft: '#2D1A1A',
  success: '#5CE08F',
  warning: '#F0B872',
  overlay: 'rgba(0, 0, 0, 0.7)',
  white: '#FFFFFF',
  black: '#000000',
};

/** @deprecated Use `useTheme().colors` for theme-aware styling. */
export const COLORS = LIGHT_COLORS;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const SHADOWS = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    android: { elevation: 3 },
    default: {},
  }),
  sm: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
    default: {},
  }),
};

export const CAPTION_MAX_LENGTH = 280;
export const BIO_MAX_LENGTH = 160;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const DISPLAY_NAME_MAX_LENGTH = 50;
export const COMMENT_MAX_LENGTH = 500;
export const POSTS_PAGE_SIZE = 10;
export const COMMENTS_PAGE_SIZE = 20;
export const NOTIFICATIONS_PAGE_SIZE = 20;
export const SEARCH_RESULTS_LIMIT = 20;
export const VIDEO_MAX_DURATION_SEC = 60;
export const VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024;
export const VIDEO_THUMBNAIL_TIMEOUT_MS = 3000;
export const VIDEO_THUMBNAIL_UPLOAD_TIMEOUT_MS = 15000;

// Storage optimization: images are downscaled to a maximum edge length and
// re-encoded as WebP before upload to keep Firebase Storage usage low.
export const IMAGE_MAX_DIMENSION = 1440;
export const AVATAR_MAX_DIMENSION = 512;
export const VIDEO_THUMBNAIL_MAX_DIMENSION = 1080;
export const IMAGE_COMPRESS_QUALITY = 0.8;
