import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ArchiveFilters } from './components/ArchiveFilters';
import { ArchiveHeader } from './components/ArchiveHeader';
import { ArchiveInputBar } from './components/ArchiveInputBar';
import { FolderStream } from './components/FolderStream';
import { SelectedFolderCard } from './components/SelectedFolderCard';
import { FolderDetailSheet } from './components/FolderDetailSheet';
import { seedArchiveFolders, INITIAL_FOLDER_INDEX } from './data/folders';
import type { ArchiveFolder } from './data/folders';
import { createArchiveItem, addItemToFolder } from './logic/archiveLogic';
import { loadArchiveFolders, saveArchiveFolders } from './data/archiveRepository';

export function ArchiveScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [folders, setFolders] = useState<ArchiveFolder[]>(seedArchiveFolders);
  const [selectedIndex, setSelectedIndex] = useState(INITIAL_FOLDER_INDEX);
  const [detailOpen, setDetailOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadArchiveFolders().then((loaded) => {
      if (mounted) {
        setFolders(loaded);
        setHydrated(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) saveArchiveFolders(folders);
  }, [folders, hydrated]);

  const scale = Math.min(width / 402, height / 874, 1.15);
  const canvasWidth = 402 * scale;
  const topShift = Math.max(0, insets.top - 61 * scale);
  const inputTop = height - Math.max(49 * scale, insets.bottom + 16 * scale) - 66 * scale;
  const infoTop = inputTop - 222 * scale;
  const streamTop = 202 * scale + topShift;
  const streamHeight = Math.max(230 * scale, infoTop - streamTop);
  const folder = folders[selectedIndex] ?? folders[0];

  const handleSaveItem = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !folder) return;
    setFolders((current) => addItemToFolder(current, folder.id, createArchiveItem(trimmed)));
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.canvas, { width: canvasWidth, height, left: (width - canvasWidth) / 2 }]}>
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={canvasWidth} height={height}>
          <Defs>
            <RadialGradient id="ambient" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#0a2519" stopOpacity={0.62} />
              <Stop offset="1" stopColor="#030705" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={35 * scale} y={255 * scale} width={340 * scale} height={420 * scale} fill="url(#ambient)" />
        </Svg>

        <View style={[styles.streamPosition, { top: streamTop, height: streamHeight }]}>
          <FolderStream
            folders={folders}
            initialIndex={INITIAL_FOLDER_INDEX}
            onSelectedIndexChange={setSelectedIndex}
            scale={scale}
            height={streamHeight}
          />
        </View>

        <ArchiveHeader scale={scale} topShift={topShift} />
        <ArchiveFilters folderCount={folders.length} scale={scale} topShift={topShift} />
        <SelectedFolderCard folder={folder} scale={scale} top={infoTop} onOpen={() => setDetailOpen(true)} />
        <ArchiveInputBar folderTitle={folder.title} scale={scale} top={inputTop} onSave={handleSaveItem} />

        {detailOpen ? (
          <FolderDetailSheet folder={folder} scale={scale} onClose={() => setDetailOpen(false)} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#030705',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  streamPosition: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
