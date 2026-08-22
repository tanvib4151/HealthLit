/**
 * Body map regions (Tier 1). Mirror-view convention: the figure's left
 * side is the user's left side, as if looking in a mirror.
 *
 * Bounds are for SVG hit detection (viewBox 100x200).
 */

export interface BodyRegion {
  id: string;
  label: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

export const BODY_REGIONS: BodyRegion[] = [
  { id: 'head', label: 'Head', bounds: { x: 35, y: 8, width: 30, height: 22 } },
  { id: 'neck', label: 'Neck', bounds: { x: 40, y: 28, width: 20, height: 10 } },
  { id: 'shoulder_left', label: 'Left shoulder', bounds: { x: 18, y: 36, width: 18, height: 15 } },
  { id: 'shoulder_right', label: 'Right shoulder', bounds: { x: 64, y: 36, width: 18, height: 15 } },
  { id: 'chest', label: 'Chest', bounds: { x: 36, y: 40, width: 28, height: 20 } },
  { id: 'arm_left', label: 'Left arm', bounds: { x: 8, y: 40, width: 12, height: 40 } },
  { id: 'arm_right', label: 'Right arm', bounds: { x: 80, y: 40, width: 12, height: 40 } },
  { id: 'abdomen', label: 'Abdomen', bounds: { x: 36, y: 62, width: 28, height: 22 } },
  { id: 'pelvis', label: 'Pelvis / hips', bounds: { x: 28, y: 82, width: 44, height: 16 } },
  { id: 'leg_left', label: 'Left leg', bounds: { x: 28, y: 96, width: 14, height: 60 } },
  { id: 'leg_right', label: 'Right leg', bounds: { x: 58, y: 96, width: 14, height: 60 } },
  { id: 'foot_left', label: 'Left foot', bounds: { x: 28, y: 154, width: 14, height: 16 } },
  { id: 'foot_right', label: 'Right foot', bounds: { x: 58, y: 154, width: 14, height: 16 } },
];

export function getRegionLabel(id: string): string {
  const region = BODY_REGIONS.find((item) => item.id === id);
  return region ? region.label : id;
}

export function getRegionBounds(id: string): { x: number; y: number; width: number; height: number } | undefined {
  return BODY_REGIONS.find((item) => item.id === id)?.bounds;
}
