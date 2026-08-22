/**
 * Symptom quality descriptors (Tier 1).
 *
 * Descriptors help users articulate pain characteristics beyond severity.
 * Organized by symptom type for relevance.
 */

export const SYMPTOM_QUALITIES: Record<string, string[]> = {
  pain: [
    'Sharp',
    'Dull',
    'Throbbing',
    'Radiating',
    'Burning',
    'Aching',
    'Stabbing',
    'Cramping',
    'Tingling',
    'Numb',
  ],
  fatigue: [
    'Complete exhaustion',
    'Mental fog',
    'Heavy limbs',
    'Weakness',
    'Lack of motivation',
    'Sleep deprivation',
  ],
  headache: [
    'Pressure',
    'Pulsing',
    'Tension',
    'Migraine',
    'Sharp',
    'Dull',
    'One-sided',
  ],
  nerve_sensitivity: [
    'Electric',
    'Pins and needles',
    'Shooting',
    'Burning',
    'Tingling',
    'Numb',
  ],
  inflammation: [
    'Swelling',
    'Warmth',
    'Redness',
    'Stiffness',
    'Tenderness',
    'Throbbing',
  ],
};

export function getQualitiesForSymptom(symptomType: string): string[] {
  return SYMPTOM_QUALITIES[symptomType] ?? [];
}
