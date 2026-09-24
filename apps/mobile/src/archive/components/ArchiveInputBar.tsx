import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Paperclip from '../../../assets/figma/paperclip.svg';
import Microphone from '../../../assets/figma/microphone.svg';

type Props = {
  folderTitle: string;
  scale: number;
  top: number;
  onSave: (text: string) => void;
};

export function ArchiveInputBar({ folderTitle, scale, top, onSave }: Props) {
  const [draft, setDraft] = useState('');

  useEffect(() => setDraft(''), [folderTitle]);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setDraft('');
  };

  return (
    <View style={[styles.bar, {
      left: 22 * scale,
      top,
      width: 358 * scale,
      height: 66 * scale,
      borderRadius: 33 * scale,
    }]}>
      <BlurView tint="dark" intensity={30} style={StyleSheet.absoluteFill} />
      <Pressable
        accessibilityLabel="Attach item"
        accessibilityRole="button"
        style={({ pressed }) => [styles.attachment, {
          left: 7 * scale,
          top: 7 * scale,
          width: 50 * scale,
          height: 50 * scale,
          borderRadius: 25 * scale,
          opacity: pressed ? 0.7 : 1,
        }]}
      >
        <Paperclip width={20 * scale} height={24 * scale} />
      </Pressable>
      <View style={[styles.inputFrame, {
        left: 65 * scale,
        top: 9 * scale,
        width: 226 * scale,
        height: 46 * scale,
        borderRadius: 23 * scale,
      }]}>
        <TextInput
          accessibilityLabel={`Save to ${folderTitle}`}
          value={draft}
          onChangeText={setDraft}
          placeholder={`Save to ${folderTitle}...`}
          placeholderTextColor="#94a39c"
          selectionColor="#16d38c"
          returnKeyType="done"
          onSubmitEditing={submit}
          blurOnSubmit
          style={[styles.input, { fontSize: 13 * scale, paddingHorizontal: 14 * scale }]}
        />
      </View>
      <Pressable
        accessibilityLabel="Voice input preview"
        accessibilityRole="button"
        style={({ pressed }) => [styles.micButton, {
          left: 297 * scale,
          top: 6 * scale,
          width: 52 * scale,
          height: 52 * scale,
          borderRadius: 26 * scale,
          opacity: pressed ? 0.72 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        }]}
      >
        <Microphone width={20 * scale} height={27 * scale} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 0.8,
    borderColor: 'rgba(26,107,74,0.52)',
    backgroundColor: 'rgba(6,19,13,0.92)',
    shadowColor: '#00190e',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  attachment: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,39,34,0.82)',
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputFrame: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: 'rgba(13,24,19,0.9)',
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  input: {
    flex: 1,
    color: '#e6f2eb',
  },
  micButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,55,34,0.92)',
    borderWidth: 0.9,
    borderColor: 'rgba(0,201,121,0.56)',
    shadowColor: '#00de87',
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
});
