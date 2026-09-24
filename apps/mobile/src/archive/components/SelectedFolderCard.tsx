import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ArchiveFolder } from '../data/folders';
import { folderItemCount, folderUpdatedLabel } from '../logic/archiveLogic';
import EmeraldFolder from '../../../assets/figma/folder-emerald.svg';
import ChevronRight from '../../../assets/figma/chevron-right.svg';
import MetadataFolder from '../../../assets/figma/metadata-folder.svg';
import Clock from '../../../assets/figma/clock.svg';

type Props = { folder: ArchiveFolder; scale: number; top: number; onOpen: () => void };

export function SelectedFolderCard({ folder, scale, top, onOpen }: Props) {
  const reveal = useSharedValue(1);

  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 240 });
  }, [folder.id, reveal]);

  const contentMotion = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 5 * scale }],
  }));

  return (
    <View style={[styles.card, {
      left: 26 * scale,
      top,
      width: 350 * scale,
      height: 164 * scale,
      borderRadius: 26 * scale,
    }]}>
      <BlurView intensity={29} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, contentMotion]}>
        <View style={[styles.iconTile, {
          left: 18 * scale,
          top: 18 * scale,
          width: 68 * scale,
          height: 68 * scale,
          borderRadius: 18 * scale,
        }]}>
          <EmeraldFolder width={40 * scale} height={32 * scale} />
        </View>
        <Text style={[styles.eyebrow, { left: 104 * scale, top: 24 * scale, fontSize: 10 * scale }]}>FOLDER</Text>
        <Text numberOfLines={1} style={[styles.title, {
          left: 104 * scale,
          top: 43 * scale,
          width: 190 * scale,
          fontSize: 18.5 * scale,
        }]}>{folder.title}</Text>
        <Text numberOfLines={3} style={[styles.description, {
          left: 104 * scale,
          top: 78 * scale,
          width: 235 * scale,
          fontSize: 11 * scale,
          lineHeight: 17 * scale,
        }]}>{folder.description}</Text>
        <Pressable
          accessibilityLabel={`Open ${folder.title}`}
          accessibilityRole="button"
          onPress={onOpen}
          style={({ pressed }) => [styles.openButton, {
            left: 300 * scale,
            top: 28 * scale,
            width: 34 * scale,
            height: 34 * scale,
            borderRadius: 17 * scale,
            opacity: pressed ? 0.7 : 1,
          }]}
        >
          <ChevronRight width={9 * scale} height={14 * scale} />
        </Pressable>
        <View style={[styles.meta, { left: 21 * scale, top: 132 * scale, height: 18 * scale }]}>
          <MetadataFolder width={16 * scale} height={15 * scale} />
          <Text style={[styles.metaText, { fontSize: 11 * scale, marginLeft: 8 * scale }]}>{folderItemCount(folder)} items</Text>
          <View style={[styles.divider, { marginLeft: 26 * scale, marginRight: 24 * scale, height: 18 * scale }]} />
          <Clock width={17 * scale} height={17 * scale} />
          <Text style={[styles.metaText, { fontSize: 11 * scale, marginLeft: 9 * scale }]}>{folderUpdatedLabel(folder)}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: 'rgba(5,29,19,0.85)',
    borderWidth: 0.8,
    borderColor: 'rgba(69,189,129,0.28)',
    shadowColor: '#00351e',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  iconTile: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,79,53,0.55)',
    borderWidth: 0.7,
    borderColor: 'rgba(69,207,138,0.2)',
  },
  eyebrow: {
    position: 'absolute',
    color: '#abb8b0',
    fontWeight: '600',
  },
  title: {
    position: 'absolute',
    color: '#f7fbf9',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  description: {
    position: 'absolute',
    color: '#b0bdb5',
  },
  openButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.6,
  },
  meta: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    color: '#a6b2ac',
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(166,184,173,0.35)',
  },
});
