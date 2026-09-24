import { Pressable, StyleSheet, Text, View } from 'react-native';
import ChevronLeft from '../../../assets/figma/chevron-left.svg';
import More from '../../../assets/figma/more.svg';

type Props = { scale: number; topShift: number };

export function ArchiveHeader({ scale, topShift }: Props) {
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        style={[styles.roundButton, {
          left: 29 * scale,
          top: 61 * scale + topShift,
          width: 41 * scale,
          height: 41 * scale,
          borderRadius: 21 * scale,
        }]}
      >
        <ChevronLeft width={23 * scale} height={23 * scale} />
      </Pressable>
      <Text style={[styles.title, {
        left: 82 * scale,
        top: 66 * scale + topShift,
        fontSize: 28 * scale,
        lineHeight: 34 * scale,
      }]}>Archive</Text>
      <View style={[styles.signal, {
        left: 280 * scale,
        top: 62 * scale + topShift,
        width: 68 * scale,
        height: 38 * scale,
        borderRadius: 19 * scale,
      }]}>
        <View style={[styles.signalDim, { width: 4 * scale, height: 4 * scale, borderRadius: 2 * scale }]} />
        <View style={[styles.signalActive, { width: 13 * scale, height: 13 * scale, borderRadius: 7 * scale }]} />
        <View style={[styles.signalDim, { width: 4 * scale, height: 4 * scale, borderRadius: 2 * scale }]} />
      </View>
      <Pressable
        accessibilityLabel="More options"
        accessibilityRole="button"
        style={[styles.more, { left: 354 * scale, top: 68 * scale + topShift, width: 24 * scale, height: 24 * scale }]}
      >
        <More width={24 * scale} height={24 * scale} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  roundButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(255,255,255,0.11)',
    borderWidth: 1,
    backgroundColor: 'rgba(28,34,31,0.62)',
  },
  title: {
    position: 'absolute',
    color: '#f7faf9',
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  signal: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    backgroundColor: 'rgba(0,54,31,0.52)',
    borderColor: 'rgba(26,186,105,0.51)',
    borderWidth: 1,
    shadowColor: '#00dc83',
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  signalDim: {
    backgroundColor: '#1b6f4c',
    opacity: 0.6,
  },
  signalActive: {
    backgroundColor: '#12e5a0',
    shadowColor: '#12e5a0',
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  more: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
