/**
 * HTML escaping for generated documents.
 *
 * Shared by the report exporter and the chart renderer so there is
 * exactly one implementation. Two copies of an escaping function is
 * how one of them ends up missing a character.
 *
 * Everything user-entered that reaches printed HTML goes through
 * this: symptom labels, notes, medication names, profile fields, and
 * edited report sections. On web the report opens in a real browser,
 * so an unescaped angle bracket is script execution, not a typo.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
