import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ArchiveFolder } from './ArchiveFolder';
import type { ArchiveFolder as ArchiveFolderData } from '../data/folders';
import {
  FOLDER_SPACING,
  clamp,
  projectedSnapIndex,
  resistBeyondBounds,
} from '../logic/snap';

type Props = {
  folders: ArchiveFolderData[];
  initialIndex: number;
  onSelectedIndexChange: (index: number) => void;
  scale: number;
  height: number;
};

export function FolderStream({ folders, initialIndex, onSelectedIndexChange, scale, height }: Props) {
  const position = useSharedValue(initialIndex);
  const dragStart = useSharedValue(initialIndex);
  const lastIndex = folders.length - 1;

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .onBegin(() => {
      cancelAnimation(position);
      dragStart.value = position.value;
    })
    .onUpdate((event) => {
      const rawPosition = dragStart.value - event.translationX / (FOLDER_SPACING * scale);
      position.value = resistBeyondBounds(rawPosition, lastIndex);
    })
    .onEnd((event) => {
      const target = projectedSnapIndex(
        clamp(position.value, 0, lastIndex),
        event.velocityX / scale,
        folders.length,
      );
      position.value = withSpring(
        target,
        { damping: 25, stiffness: 185, mass: 0.82, overshootClamping: true },
        (finished) => {
          if (finished) runOnJS(onSelectedIndexChange)(target);
        },
      );
    });

  const dragHintStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (initialIndex - position.value) * 1.5 * scale }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.stream, { height }]} testID="folder-stream">
        <Svg
          pointerEvents="none"
          width={442 * scale}
          height={78 * scale}
          viewBox="0 0 442 78"
          style={{ position: 'absolute', left: -19 * scale, top: 0 }}
        >
          <Path
            d="M-6 77 C114 10 265 -10 448 77"
            stroke="#16875b"
            strokeOpacity={0.42}
            strokeWidth={0.75}
            fill="none"
          />
        </Svg>

        <Animated.View style={[styles.dragHint, {
          width: 30 * scale,
          height: 30 * scale,
          borderRadius: 15 * scale,
          left: 235 * scale,
          top: 13 * scale,
        }, dragHintStyle]} pointerEvents="none">
          <Text style={[styles.dragHintText, { fontSize: 18 * scale }]}>↔</Text>
        </Animated.View>

        {folders.map((folder, index) => (
          <ArchiveFolder
            key={folder.id}
            folder={folder}
            index={index}
            folderCount={folders.length}
            initialIndex={initialIndex}
            position={position}
            scale={scale}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  stream: {
    overflow: 'hidden',
    width: '100%',
  },
  dragHint: {
    position: 'absolute',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.7,
    borderColor: 'rgba(45,203,133,0.45)',
    backgroundColor: 'rgba(8,31,22,0.78)',
    shadowColor: '#0ce68a',
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  dragHintText: {
    color: '#5ff3bf',
    fontWeight: '300',
    textAlign: 'center',
    marginTop: -2,
  },
});
