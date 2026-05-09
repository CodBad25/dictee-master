// Génère toutes les formes acceptées pour un mot stocké avec une variante
// entre parenthèses (ex: "flou (e)", "coucher (se)").
//
// Pour "flou (e)" → ["flou", "floue", "flou e", "flou(e)", "flou (e)"]
// Pour "coucher (se)" → ["coucher", "coucherse", "coucher se", "se coucher", "coucher(se)", "coucher (se)"]
// Si pas de parenthèses → [word] inchangé.
export function expandParentheticalVariants(word: string): string[] {
  const match = word.match(/^(.*?)\s*\(([^)]+)\)\s*(.*)$/);
  if (!match) return [word];

  const before = match[1].trim();
  const paren = match[2].trim();
  const after = match[3].trim();

  const tail = after ? ` ${after}` : "";

  const variants = [
    `${before}${tail}`,
    `${before}${paren}${tail}`,
    `${before} ${paren}${tail}`,
    `${paren} ${before}${tail}`,
    `${before}(${paren})${tail}`,
    `${before} (${paren})${tail}`,
  ];

  return Array.from(new Set(variants.map(v => v.trim()).filter(Boolean)));
}
