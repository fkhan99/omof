import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import type { ReactElement } from 'react';
import { ReactionType } from '@/types';

interface ReactionIconProps {
  type: ReactionType;
  size?: number;
  color: string;
}

const STROKE = 1.75;

/** Overlapping circles — shared experience / "I relate". */
function RelateIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9.5" cy="12" r="5.25" stroke={color} strokeWidth={STROKE} />
      <Circle cx="14.5" cy="12" r="5.25" stroke={color} strokeWidth={STROKE} />
      <Circle cx="12" cy="12" r="1.25" fill={color} />
    </Svg>
  );
}

/** Footprints on a path — "I've been there". */
function BeenThereIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 18 C7 14 9 12 12 11 C15 10 17 8 19 5"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray="2.5 3"
      />
      <Ellipse
        cx="7.5"
        cy="16.5"
        rx="2.2"
        ry="3"
        transform="rotate(-20 7.5 16.5)"
        stroke={color}
        strokeWidth={STROKE}
      />
      <Ellipse
        cx="14"
        cy="12.5"
        rx="2.2"
        ry="3"
        transform="rotate(-20 14 12.5)"
        stroke={color}
        strokeWidth={STROKE}
      />
      <Circle cx="19" cy="5" r="1.5" fill={color} />
    </Svg>
  );
}

/** Cupped hands with warmth — "Sending support". */
function SendingSupportIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 16 C6.5 12.5 8.5 10 12 9 C15.5 10 17.5 12.5 17.5 16"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Path
        d="M8 16 L8 18.5 C8 19.5 9 20.5 10 20.5 L14 20.5 C15 20.5 16 19.5 16 18.5 L16 16"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 4 L12 7.5" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path
        d="M8.5 5.5 L12 7.5 L15.5 5.5"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.5 8 L8 9.5"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Path
        d="M17.5 8 L16 9.5"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const ICONS: Record<
  ReactionType,
  (props: { size: number; color: string }) => ReactElement
> = {
  relate: RelateIcon,
  been_there: BeenThereIcon,
  sending_support: SendingSupportIcon,
};

export function ReactionIcon({ type, size = 22, color }: ReactionIconProps) {
  const Icon = ICONS[type];
  return <Icon size={size} color={color} />;
}
