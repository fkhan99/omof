import { View, StyleSheet } from 'react-native';
import type { ReactElement } from 'react';
import { ReactionType } from '@/types';

interface ReactionIconProps {
  type: ReactionType;
  size?: number;
  color: string;
}

interface IconPartProps {
  size: number;
  color: string;
}

/** Overlapping circles — shared experience / "I relate". */
function RelateIcon({ size, color }: IconPartProps) {
  const circle = size * 0.52;
  const overlap = circle * 0.38;

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={[
          styles.ring,
          {
            width: circle,
            height: circle,
            borderColor: color,
            marginRight: -overlap,
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          {
            width: circle,
            height: circle,
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.dot,
          {
            width: size * 0.14,
            height: size * 0.14,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

/** Footprints along a path — "I've been there". */
function BeenThereIcon({ size, color }: IconPartProps) {
  const footW = size * 0.22;
  const footH = size * 0.32;

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={[styles.pathDot, { top: size * 0.1, left: size * 0.74, backgroundColor: color }]} />
      <View style={[styles.pathDot, { top: size * 0.28, left: size * 0.58, backgroundColor: color }]} />
      <View style={[styles.pathDot, { top: size * 0.46, left: size * 0.42, backgroundColor: color }]} />
      <View style={[styles.pathDot, { top: size * 0.64, left: size * 0.26, backgroundColor: color }]} />

      <View
        style={[
          styles.foot,
          {
            width: footW,
            height: footH,
            borderColor: color,
            bottom: size * 0.12,
            left: size * 0.18,
            transform: [{ rotate: '-22deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.foot,
          {
            width: footW,
            height: footH,
            borderColor: color,
            top: size * 0.34,
            left: size * 0.48,
            transform: [{ rotate: '-22deg' }],
          },
        ]}
      />
    </View>
  );
}

/** Cupped hands with warmth — "Sending support". */
function SendingSupportIcon({ size, color }: IconPartProps) {
  const bowl = size * 0.72;

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={[styles.ray, { top: size * 0.08, height: size * 0.18, backgroundColor: color }]} />
      <View
        style={[
          styles.rayDiagonal,
          { top: size * 0.16, left: size * 0.22, backgroundColor: color, transform: [{ rotate: '-35deg' }] },
        ]}
      />
      <View
        style={[
          styles.rayDiagonal,
          { top: size * 0.16, right: size * 0.22, backgroundColor: color, transform: [{ rotate: '35deg' }] },
        ]}
      />
      <View
        style={[
          styles.bowl,
          {
            width: bowl,
            height: bowl * 0.52,
            borderColor: color,
            top: size * 0.34,
          },
        ]}
      />
      <View
        style={[
          styles.bowlBase,
          {
            width: bowl * 0.78,
            height: size * 0.12,
            borderColor: color,
            bottom: size * 0.14,
          },
        ]}
      />
    </View>
  );
}

const ICONS: Record<ReactionType, (props: IconPartProps) => ReactElement> = {
  relate: RelateIcon,
  been_there: BeenThereIcon,
  sending_support: SendingSupportIcon,
};

export function ReactionIcon({ type, size = 22, color }: ReactionIconProps) {
  const Icon = ICONS[type];
  return <Icon size={size} color={color} />;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    borderWidth: 1.75,
    borderRadius: 999,
  },
  dot: {
    position: 'absolute',
    borderRadius: 999,
  },
  pathDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 999,
    opacity: 0.85,
  },
  foot: {
    position: 'absolute',
    borderWidth: 1.75,
    borderRadius: 999,
  },
  ray: {
    position: 'absolute',
    width: 1.75,
    borderRadius: 999,
  },
  rayDiagonal: {
    position: 'absolute',
    width: 1.75,
    height: 8,
    borderRadius: 999,
  },
  bowl: {
    position: 'absolute',
    borderWidth: 1.75,
    borderBottomWidth: 0,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  bowlBase: {
    position: 'absolute',
    borderWidth: 1.75,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
});
