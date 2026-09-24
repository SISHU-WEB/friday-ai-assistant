export const FOLDER_SPACING = 56;
export const SNAP_PROJECTION_SECONDS = 0.17;

export function clamp(value: number, minimum: number, maximum: number): number {
  'worklet';
  return Math.min(maximum, Math.max(minimum, value));
}

export function focusedIndex(position: number, folderCount: number): number {
  'worklet';
  return clamp(Math.round(position), 0, folderCount - 1);
}

export function projectedSnapIndex(
  position: number,
  velocityX: number,
  folderCount: number,
  spacing = FOLDER_SPACING,
): number {
  'worklet';
  const projectedPosition = position - (velocityX * SNAP_PROJECTION_SECONDS) / spacing;
  return focusedIndex(projectedPosition, folderCount);
}

export function resistBeyondBounds(position: number, lastIndex: number): number {
  'worklet';
  if (position < 0) return position * 0.18;
  if (position > lastIndex) return lastIndex + (position - lastIndex) * 0.18;
  return position;
}
