import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { ArchiveFolder as ArchiveFolderData } from '../data/folders';
import { FOLDER_SPACING, focusedIndex } from '../logic/snap';

const TRACK_OFFSETS = [-22, -13, -1, 10, 24, 36, 48];
const TRACK_INDICES = [-3, -2, -1, 0, 1, 2, 3];

type Props = {
  folder: ArchiveFolderData;
  index: number;
  folderCount: number;
  initialIndex: number;
  position: SharedValue<number>;
  scale: number;
};

function FolderFace({ green, scale }: { green: boolean; scale: number }) {
  const gid = green ? 'folderGreen' : 'folderWhite';
  const topColor = green ? '#22f09a' : '#fbfdfc';
  const bottomColor = green ? '#09b86c' : '#e3ebe7';
  const rimColor = green ? '#8affc8' : '#ffffff';
  // Rear edge: a subtle darker sliver, only a thin right strip peeks out.
  const backColor = green ? '#068a4e' : '#b4c9bf';
  return (
    <Svg width={96 * scale} height={266 * scale} viewBox="0 0 96 266">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={topColor} />
          <Stop offset="1" stopColor={bottomColor} />
        </LinearGradient>
      </Defs>
      {/* rear face offset right, only a thin sliver peeks out */}
      <Rect x="5" y="17" width="91" height="249" rx="13" fill={backColor} />
      {/* folder tab ear + rounded front body, with a bright luminous rim */}
      <Rect x="6" y="0" width="38" height="22" rx="7" fill={`url(#${gid})`} />
      <Rect x="0" y="16" width="96" height="250" rx="14" fill={`url(#${gid})`} stroke={rimColor} strokeWidth={1.5} strokeOpacity={green ? 0.6 : 0.9} />
    </Svg>
  );
}

function FolderArtwork({ green, scale }: { green: boolean; scale: number }) {
  return (
    <View style={[styles.artwork, { top: 57 * scale }]}>
      <View style={[
        styles.glow,
        {
          width: 96 * scale,
          height: 266 * scale,
          shadowColor: green ? '#0fe28a' : '#e6f2ec',
          shadowOpacity: green ? 0.8 : 0.55,
          shadowRadius: green ? 28 : 18,
        },
      ]}>
        <FolderFace green={green} scale={scale} />
      </View>
    </View>
  );
}

function ArchiveFolderComponent({ folder, index, folderCount, initialIndex, position, scale }: Props) {
  const lift = useSharedValue(index === initialIndex ? 1 : 0);
  useAnimatedReaction(
    () => index === focusedIndex(position.value, folderCount),
    (selected, previous) => {
      if (selected === previous) return;
      lift.value = withSpring(selected ? 1 : 0, {
        damping: 25,
        stiffness: 190,
        mass: 0.75,
        overshootClamping: true,
      });
    },
  );

  const placementStyle = useAnimatedStyle(() => {
    const relative = index - position.value;
    const trackY = interpolate(relative, TRACK_INDICES, TRACK_OFFSETS, Extrapolation.EXTEND);
    const selected = index === focusedIndex(position.value, folderCount);
    // Depth via foreshortening: side cards narrow & shrink like they recede.
    const scaleX = interpolate(relative, [-3, 0, 3], [0.82, 1, 0.82], Extrapolation.CLAMP);
    const depthScale = interpolate(relative, [-3, 0, 3], [0.95, 1, 0.95], Extrapolation.CLAMP);
    return {
      // Selected folder always floats on top of the rest of the arc.
      zIndex: selected ? 40 : 20 + relative,
      transform: [
        { translateX: (155 + relative * FOLDER_SPACING) * scale - 3 * scale * lift.value },
        { translateY: trackY * scale - 7 * scale * lift.value },
        { scaleX },
        { scale: depthScale * (1 + lift.value * 0.025) },
      ],
    };
  });

  const whiteStyle = useAnimatedStyle(() => {
    const selected = index === focusedIndex(position.value, folderCount);
    if (selected) return { opacity: 0 };
    const dist = Math.abs(index - Math.round(position.value));
    return { opacity: Math.max(0.7, 1 - dist * 0.1) };
  });
  const greenStyle = useAnimatedStyle(() => ({
    opacity: index === focusedIndex(position.value, folderCount) ? 1 : 0,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.folder, { width: 96 * scale, height: 322 * scale }, placementStyle]}
      accessibilityLabel={folder.title}
    >
      <Animated.View style={[styles.surface, whiteStyle]}>
        <FolderArtwork green={false} scale={scale} />
        <View style={[styles.labelHolder, { left: 7 * scale, top: 214 * scale, width: 82 * scale, height: 20 * scale }]}>
          <Text numberOfLines={1} style={[styles.label, { fontSize: 10.5 * scale, color: '#15231d' }]}>{folder.title}</Text>
        </View>
      </Animated.View>
      <Animated.View style={[styles.surface, greenStyle]}>
        <FolderArtwork green scale={scale} />
        <View style={[styles.labelHolder, { left: 7 * scale, top: 214 * scale, width: 82 * scale, height: 20 * scale }]}>
          <Text numberOfLines={1} style={[styles.label, { fontSize: 10.5 * scale, color: '#f3fff9' }]}>{folder.title}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export const ArchiveFolder = memo(ArchiveFolderComponent);

const styles = StyleSheet.create({
  folder: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'visible',
  },
  surface: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  artwork: {
    position: 'absolute',
    left: 0,
  },
  glow: {
    shadowOffset: { width: 0, height: 0 },
  },
  labelHolder: {
    position: 'absolute',
    transform: [{ rotate: '-62deg' }],
  },
  label: {
    fontFamily: 'System',
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
