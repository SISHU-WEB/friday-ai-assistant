import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import type { ArchiveFolder } from '../data/folders';
import { folderItemCount, folderUpdatedLabel, describeRelative } from '../logic/archiveLogic';
import ChevronLeft from '../../../assets/figma/chevron-left.svg';

type Props = { folder: ArchiveFolder; scale: number; onClose: () => void };

export function FolderDetailSheet({ folder, scale, onClose }: Props) {
  return (
    <View style={styles.overlay}>
      <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
      <View style={styles.panel}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to archive"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.close}
          >
            <ChevronLeft width={20 * scale} height={20 * scale} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>{folder.title.toUpperCase()}</Text>
            <Text style={styles.subline}>
              {folderItemCount(folder)} items · {folderUpdatedLabel(folder)}
            </Text>
          </View>
        </View>

        {folder.items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyHint}>Type below and press Done to save here.</Text>
          </View>
        ) : (
          <FlatList
            data={folder.items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.rowDate}>{describeRelative(new Date(item.createdAt))}</Text>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,4,0.72)',
    justifyContent: 'flex-end',
  },
  panel: {
    flex: 1,
    backgroundColor: 'rgba(5,18,12,0.96)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(69,189,129,0.25)',
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  close: {
    width: 41,
    height: 41,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(28,34,31,0.62)',
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: '#f7faf9',
    fontWeight: '700',
    fontSize: 20,
    letterSpacing: -0.3,
  },
  subline: {
    color: '#a6b2ac',
    fontSize: 12,
    marginTop: 2,
  },
  list: {
    paddingBottom: 40,
    gap: 12,
  },
  row: {
    backgroundColor: 'rgba(10,28,19,0.8)',
    borderWidth: 0.8,
    borderColor: 'rgba(69,189,129,0.18)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowTitle: {
    color: '#eef7f1',
    fontSize: 14,
    lineHeight: 20,
  },
  rowDate: {
    color: '#8fa89c',
    fontSize: 11,
    marginTop: 6,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: '#eef7f1',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyHint: {
    color: '#8fa89c',
    fontSize: 12,
  },
});
