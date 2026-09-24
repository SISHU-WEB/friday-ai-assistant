import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createArchiveItem,
  addItemToFolder,
  folderItemCount,
  folderUpdatedLabel,
  describeRelative,
} from '../src/archive/logic/archiveLogic.ts';
import { seedArchiveFolders } from '../src/archive/data/folders.ts';

test('new item is trimmed and gets an id and timestamp', () => {
  const item = createArchiveItem('  Read two chapters  ');
  assert.equal(item.title, 'Read two chapters');
  assert.ok(item.id.startsWith('item-'));
  assert.ok(Number.isFinite(new Date(item.createdAt).getTime()));
});

test('addItemToFolder prepends to the target folder only', () => {
  const item = createArchiveItem('Saved note');
  const next = addItemToFolder(seedArchiveFolders, 'projects', item);

  const projects = next.find((f) => f.id === 'projects');
  const travel = next.find((f) => f.id === 'travel');
  assert.equal(projects?.items.length, 1);
  assert.equal(projects?.items[0].id, item.id);
  assert.equal(travel?.items.length, 0);
});

test('item count adds saved items on top of the Figma baseline', () => {
  const compliance = seedArchiveFolders.find((f) => f.id === 'compliance');
  assert.equal(compliance && folderItemCount(compliance), 24);

  const withNote = addItemToFolder(seedArchiveFolders, 'compliance', createArchiveItem('Audit report'));
  const updated = withNote.find((f) => f.id === 'compliance');
  assert.equal(updated && folderItemCount(updated), 25);
});

test('updated label falls back to seed until a real item exists', () => {
  const travel = seedArchiveFolders.find((f) => f.id === 'travel');
  assert.equal(travel && folderUpdatedLabel(travel), 'Updated 5 days ago');

  const saved = addItemToFolder(seedArchiveFolders, 'travel', createArchiveItem('Kyoto photos'));
  const updated = saved.find((f) => f.id === 'travel');
  assert.equal(updated && folderUpdatedLabel(updated), 'Updated just now');
});

test('describeRelative buckets recent times', () => {
  assert.equal(describeRelative(new Date(Date.now() - 10_000)), 'Updated just now');
  assert.match(describeRelative(new Date(Date.now() - 3 * 60_000)), /^Updated \d+ minutes ago$/);
  assert.match(describeRelative(new Date(Date.now() - 3 * 3_600_000)), /^Updated \d+ hours? ago$/);
});
