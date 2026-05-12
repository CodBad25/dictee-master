// Types et métadonnées centralisés pour les variantes adaptatives de dictées.
// Étendre ce fichier pour ajouter un nouveau type de transformation est trivial :
// 1. ajouter une entrée à VariantType (et à FillBlanksVariant.variant_type)
// 2. ajouter une entrée à VARIANT_META (label, icône, catégorie)
// 3. ajouter une entrée à TRANSFORMATIONS (côté API, instruction LLM)

export type VariantType =
  | "pluriel"
  | "singulier"
  | "imparfait"
  | "passe_compose"
  | "passe_simple"
  | "futur_simple"
  | "plus_que_parfait"
  | "pronom_je"
  | "pronom_tu"
  | "pronom_nous"
  | "pronom_vous"
  | "pronom_elles";

export type VariantCategory = "nombre" | "temps" | "pronom";

export interface VariantMeta {
  label: string;
  icon: string;
  category: VariantCategory;
}

export const VARIANT_META: Record<VariantType, VariantMeta> = {
  pluriel:          { label: "Pluriel",          icon: "📚", category: "nombre" },
  singulier:        { label: "Singulier",        icon: "👤", category: "nombre" },
  imparfait:        { label: "Imparfait",        icon: "⏳", category: "temps" },
  passe_compose:    { label: "Passé composé",    icon: "✓",  category: "temps" },
  passe_simple:     { label: "Passé simple",     icon: "📜", category: "temps" },
  futur_simple:     { label: "Futur simple",     icon: "🚀", category: "temps" },
  plus_que_parfait: { label: "Plus-que-parfait", icon: "⏪", category: "temps" },
  pronom_je:        { label: "Je",               icon: "👤", category: "pronom" },
  pronom_tu:        { label: "Tu",               icon: "👤", category: "pronom" },
  pronom_nous:      { label: "Nous",             icon: "👥", category: "pronom" },
  pronom_vous:      { label: "Vous",             icon: "👥", category: "pronom" },
  pronom_elles:     { label: "Elles",            icon: "👩‍👩‍👧", category: "pronom" },
};

// Ordre d'affichage stable côté UI (chips + cartes).
export const VARIANT_TYPE_ORDER: VariantType[] = [
  // nombre
  "pluriel",
  "singulier",
  // temps
  "imparfait",
  "passe_compose",
  "passe_simple",
  "futur_simple",
  "plus_que_parfait",
  // pronoms
  "pronom_je",
  "pronom_tu",
  "pronom_nous",
  "pronom_vous",
  "pronom_elles",
];

export const ALL_VARIANT_TYPES: VariantType[] = VARIANT_TYPE_ORDER;

// Pré-sélections par défaut dans l'UI (les 2 variantes historiques).
export const DEFAULT_SELECTED_VARIANTS: VariantType[] = ["pluriel", "imparfait"];

// Estimation de coût en € par variante (un appel LLM "génération" + part de la passe de relecture).
// Mis à jour à partir des mesures réelles observées (~0.003€ par variante générée).
export const COST_PER_VARIANT_EUR = 0.0035;
