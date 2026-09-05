/**
 * Body map regions (Tier 1). Mirror-view convention: the figure's left
 * side is the user's left side, as if looking in a mirror.
 */

export interface BodyRegion {
  id: string;
  label: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

export const BODY_REGIONS: BodyRegion[] = [
  { id: 'head', label: 'Head' },
  { id: 'neck', label: 'Neck' },
  { id: 'shoulder_left', label: 'Left shoulder' },
  { id: 'shoulder_right', label: 'Right shoulder' },
  { id: 'chest', label: 'Chest' },
  { id: 'upper_back', label: 'Upper back' },
  { id: 'arm_left', label: 'Left arm' },
  { id: 'arm_right', label: 'Right arm' },
  { id: 'abdomen', label: 'Abdomen' },
  { id: 'lower_back', label: 'Lower back' },
  { id: 'pelvis', label: 'Pelvis / hips' },
  { id: 'leg_left', label: 'Left leg' },
  { id: 'leg_right', label: 'Right leg' },
  { id: 'foot_left', label: 'Left foot' },
  { id: 'foot_right', label: 'Right foot' },
];

export function getRegionLabel(id: string): string {
  const region = BODY_REGIONS.find((item) => item.id === id);
  return region ? region.label : id;
}

export function getRegionBounds(
  id: string,
): { x: number; y: number; width: number; height: number } | undefined {
  return BODY_REGIONS.find((item) => item.id === id)?.bounds;
}
