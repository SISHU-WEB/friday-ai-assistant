import { Pressable, StyleSheet, Text, View } from 'react-native';
import FolderIcon from '../../../assets/figma/folder-outline.svg';
import TagIcon from '../../../assets/figma/tag.svg';
import SizeIcon from '../../../assets/figma/document-size.svg';
import ChevronDown from '../../../assets/figma/chevron-down.svg';
import SearchIcon from '../../../assets/figma/search.svg';

type Props = { scale: number; topShift: number; folderCount: number };

export function ArchiveFilters({ scale, topShift, folderCount }: Props) {
  const top = 124 * scale + topShift;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable style={[styles.filter, { left: 29 * scale, top, width: 96 * scale, height: 34 * scale, borderRadius: 19 * scale }]}>
        <FolderIcon width={18 * scale} height={18 * scale} />
        <Text style={[styles.label, { fontSize: 10 * scale }]}>Folders ({folderCount})</Text>
      </Pressable>
      <Pressable style={[styles.filter, { left: 132 * scale, top, width: 92 * scale, height: 34 * scale, borderRadius: 19 * scale }]}>
        <TagIcon width={18 * scale} height={18 * scale} />
        <Text style={[styles.label, { fontSize: 10 * scale }]}>Tags (44)</Text>
      </Pressable>
      <Pressable style={[styles.filter, { left: 231 * scale, top, width: 97 * scale, height: 34 * scale, borderRadius: 19 * scale }]}>
        <SizeIcon width={18 * scale} height={18 * scale} />
        <Text style={[styles.label, { fontSize: 10 * scale }]}>Small</Text>
        <ChevronDown width={14 * scale} height={14 * scale} />
      </Pressable>
      <Pressable
        accessibilityLabel="Search archive"
        accessibilityRole="button"
        style={[styles.search, { left: 337 * scale, top, width: 34 * scale, height: 34 * scale, borderRadius: 17 * scale }]}
      >
        <SearchIcon width={22 * scale} height={22 * scale} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  filter: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(22,27,24,0.78)',
    borderColor: 'rgba(255,255,255,0.13)',
    borderWidth: 0.8,
  },
  label: {
    color: '#e8edeb',
    fontWeight: '400',
  },
  search: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,31,28,0.9)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.8,
  },
});
