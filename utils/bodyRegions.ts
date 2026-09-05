/**
 * Body-map regions. Existing coarse ids stay in this list so older
 * saved entries continue to render honestly after the more detailed
 * map is introduced.
 */

export interface BodyRegion {
  id: string;
  label: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

export const BODY_REGIONS: BodyRegion[] = [
  { id: 'head', label: 'Head' },
  { id: 'face', label: 'Face' },
  { id: 'neck', label: 'Neck' },

  { id: 'shoulder_left', label: 'Left shoulder' },
  { id: 'shoulder_right', label: 'Right shoulder' },
  { id: 'chest', label: 'Chest' },
  { id: 'chest_left', label: 'Left chest' },
  { id: 'chest_right', label: 'Right chest' },
  { id: 'upper_abdomen', label: 'Upper abdomen' },
  { id: 'lower_abdomen', label: 'Lower abdomen' },
  { id: 'abdomen', label: 'Abdomen' },
  { id: 'pelvis', label: 'Pelvis / hips' },
  { id: 'hip_left', label: 'Left hip' },
  { id: 'hip_right', label: 'Right hip' },

  { id: 'arm_left', label: 'Left arm' },
  { id: 'arm_right', label: 'Right arm' },
  { id: 'upper_arm_left', label: 'Left upper arm' },
  { id: 'upper_arm_right', label: 'Right upper arm' },
  { id: 'elbow_left', label: 'Left elbow' },
  { id: 'elbow_right', label: 'Right elbow' },
  { id: 'forearm_left', label: 'Left forearm' },
  { id: 'forearm_right', label: 'Right forearm' },
  { id: 'hand_left', label: 'Left hand' },
  { id: 'hand_right', label: 'Right hand' },

  { id: 'leg_left', label: 'Left leg' },
  { id: 'leg_right', label: 'Right leg' },
  { id: 'thigh_left', label: 'Left thigh' },
  { id: 'thigh_right', label: 'Right thigh' },
  { id: 'knee_left', label: 'Left knee' },
  { id: 'knee_right', label: 'Right knee' },
  { id: 'lower_leg_left', label: 'Left lower leg' },
  { id: 'lower_leg_right', label: 'Right lower leg' },
  { id: 'ankle_left', label: 'Left ankle' },
  { id: 'ankle_right', label: 'Right ankle' },
  { id: 'foot_left', label: 'Left foot' },
  { id: 'foot_right', label: 'Right foot' },

  { id: 'upper_back', label: 'Upper back' },
  { id: 'shoulder_blade_left', label: 'Left shoulder blade' },
  { id: 'shoulder_blade_right', label: 'Right shoulder blade' },
  { id: 'mid_back', label: 'Mid back' },
  { id: 'lower_back', label: 'Lower back' },
  { id: 'lower_back_left', label: 'Left lower back' },
  { id: 'lower_back_right', label: 'Right lower back' },
  { id: 'glute_left', label: 'Left glute' },
  { id: 'glute_right', label: 'Right glute' },
  { id: 'hamstring_left', label: 'Left hamstring' },
  { id: 'hamstring_right', label: 'Right hamstring' },
  { id: 'calf_left', label: 'Left calf' },
  { id: 'calf_right', label: 'Right calf' },
  { id: 'heel_left', label: 'Left heel' },
  { id: 'heel_right', label: 'Right heel' },
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
