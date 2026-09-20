import { createClient } from "@/lib/supabase/client";

// === TYPES ===

export interface DicteeResult {
  id: string;
  class_id: string;
  student_id: string;
  student_name: string;
  dictee_id: string;
  activity_mode: string;
  score: number;
  total: number;
  percentage: number;
  time_spent: number | null;
  created_at: string;
}

export type DicteeLevel = "6e" | "5e";

export interface Dictee {
  id: string;
  title: string;
  position: number;
  share_code: string;
  fill_blanks_text: string;
  level: DicteeLevel;
  // Métadonnées 5e (NULL sur le corpus 6e)
  ortho_point?: string | null;
  lexical_theme?: string | null;
  star_word?: string | null;
}

export interface DicteeWord {
  dictee_id: string;
  word: string;
  definition: string;
  spelling_errors: string[];
  position: number;
  // Lexique (famille + synonymes) — contenu IA à valider par l'enseignant.
  word_family: string[];
  synonyms: string[];
  intrus: string[];          // intrus précalculés (autres dictées), modifiables
  lexicon_validated: boolean;
}

export interface WordLexiconPatch {
  word_family?: string[];
  synonyms?: string[];
  intrus?: string[];
  lexicon_validated?: boolean;
}

import type { VariantType } from "./variant-types";

export type { VariantType };

export interface FillBlanksVariant {
  id: string;
  label: string; // "Variante pluriel", "Variante imparfait", "Variante passé composé"…
  variant_type: VariantType;
  fill_blanks_text: string; // texte avec ___ pour les blancs
  full_text: string;        // texte complet sans blancs (pour la lecture audio)
  audio_url?: string;       // URL du MP3 généré (optionnel)
  status: "draft" | "validated" | "rejected";
  created_at: string;
}

// === DICTÉES ===

// Chemin du MP3 de la dictée complète, dérivé de l'ID (et non de la position,
// qui n'est plus unique entre niveaux) : dictee-3 → dictee_3.mp3,
// dictee-5e-3 → dictee_5e_3.mp3. Fallback Web Speech si le fichier n'existe pas.
export const dicteeMp3Path = (dicteeId: string) =>
  `/audio/dictees/${dicteeId.replace(/-/g, "_")}.mp3`;

// Sans argument : tout le corpus (vues admin). Avec un niveau : uniquement
// les dictées de ce niveau — à utiliser partout où une classe est en jeu
// (grilles, notes /20, exports), sinon les dénominateurs sont faux.
export async function loadAllDictees(level?: DicteeLevel): Promise<Dictee[]> {
  const sb = createClient();
  let query = sb
    .from("dictees")
    .select("id, title, position, share_code, fill_blanks_text, level, ortho_point, lexical_theme, star_word")
    .order("position");
  if (level) query = query.eq("level", level);
  const { data } = await query;
  return data || [];
}

export async function loadDicteeWords(dicteeId: string): Promise<DicteeWord[]> {
  const sb = createClient();
  const { data } = await sb
    .from("dictee_words")
    .select("dictee_id, word, definition, spelling_errors, position, word_family, synonyms, intrus, lexicon_validated")
    .eq("dictee_id", dicteeId)
    .order("position");
  return (data || []).map((w) => ({
    ...w,
    spelling_errors: Array.isArray(w.spelling_errors) ? w.spelling_errors : [],
    word_family: Array.isArray(w.word_family) ? w.word_family : [],
    synonyms: Array.isArray(w.synonyms) ? w.synonyms : [],
    intrus: Array.isArray(w.intrus) ? w.intrus : [],
    lexicon_validated: !!w.lexicon_validated,
  }));
}

// Met à jour le lexique d'un mot (famille, synonymes, validation).
// Édition globale partagée entre tous les profs, comme les pièges.
export async function updateWordLexicon(
  dicteeId: string,
  position: number,
  patch: WordLexiconPatch,
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("dictee_words")
    .update(patch)
    .eq("dictee_id", dicteeId)
    .eq("position", position);
  if (error) throw new Error(error.message);
}

// Marque validés (ou non) tous les mots d'une dictée d'un coup.
export async function setDicteeLexiconValidated(
  dicteeId: string,
  validated: boolean,
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("dictee_words")
    .update({ lexicon_validated: validated })
    .eq("dictee_id", dicteeId);
  if (error) throw new Error(error.message);
}

// Met à jour la liste des distracteurs (spelling_errors) pour un mot donné.
// Édition globale partagée entre tous les profs (pour aujourd'hui).
export async function updateWordSpellingErrors(
  dicteeId: string,
  position: number,
  errors: string[],
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("dictee_words")
    .update({ spelling_errors: errors })
    .eq("dictee_id", dicteeId)
    .eq("position", position);
  if (error) throw new Error(error.message);
}

// Met à jour la classe grammaticale d'un mot donné. null = retour à l'auto-détection.
export async function updateWordGrammaticalClass(
  dicteeId: string,
  position: number,
  grammaticalClass: string | null,
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("dictee_words")
    .update({ grammatical_class: grammaticalClass })
    .eq("dictee_id", dicteeId)
    .eq("position", position);
  if (error) throw new Error(error.message);
}

// Met à jour l'URL de l'audio personnalisé pour un mot. null = retour à la synthèse vocale.
export async function updateWordAudioUrl(
  dicteeId: string,
  position: number,
  audioUrl: string | null,
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("dictee_words")
    .update({ audio_url: audioUrl })
    .eq("dictee_id", dicteeId)
    .eq("position", position);
  if (error) throw new Error(error.message);
}

// Met à jour la définition d'un mot (pour le mode Définitions).
export async function updateWordDefinition(
  dicteeId: string,
  position: number,
  definition: string,
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("dictee_words")
    .update({ definition })
    .eq("dictee_id", dicteeId)
    .eq("position", position);
  if (error) throw new Error(error.message);
}

// === RÉSULTATS ===

// Résout l'UUID interne dm_classes.id à partir du classeId Hub.
// Renvoie null si la classe n'existe pas encore côté Supabase.
export async function getDmClassIdByHub(hubClassId: string): Promise<string | null> {
  const sb = createClient();
  const { data } = await sb
    .from("dm_classes")
    .select("id")
    .eq("hub_class_id", hubClassId)
    .maybeSingle();
  return data?.id ?? null;
}

// Variante qui remonte aussi le niveau de la classe (source de vérité du
// filtrage des dictées côté élève — ne jamais déduire le niveau du localStorage).
export async function getDmClassByHub(
  hubClassId: string
): Promise<{ id: string; level: DicteeLevel } | null> {
  const sb = createClient();
  const { data } = await sb
    .from("dm_classes")
    .select("id, level")
    .eq("hub_class_id", hubClassId)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, level: (data.level as DicteeLevel) || "6e" };
}

export async function saveResult(params: {
  hubClassId: string;
  studentId: string;
  studentName: string;
  dicteeId: string;
  activityMode: string;
  score: number;
  total: number;
  percentage: number;
  timeSpent?: number;
  answers?: { word: string; userAnswer: string; isCorrect: boolean }[];
}): Promise<void> {
  const sb = createClient();

  const classId = await getDmClassIdByHub(params.hubClassId);
  if (!classId) {
    console.error("saveResult: dm_classes introuvable pour hub_class_id", params.hubClassId);
    return;
  }

  // Sauvegarder le résultat
  const { data: result, error } = await sb
    .from("dm_results")
    .insert({
      class_id: classId,
      student_id: params.studentId,
      student_name: params.studentName,
      dictee_id: params.dicteeId,
      activity_mode: params.activityMode,
      score: params.score,
      total: params.total,
      percentage: params.percentage,
      time_spent: params.timeSpent || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erreur sauvegarde résultat:", error.message);
    return;
  }

  // Sauvegarder les tentatives mot par mot
  if (result && params.answers && params.answers.length > 0) {
    const attempts = params.answers.map((a) => ({
      result_id: result.id,
      word: a.word,
      user_answer: a.userAnswer || "(vide)",
      is_correct: a.isCorrect,
    }));

    const { error: attErr } = await sb.from("dm_word_attempts").insert(attempts);
    if (attErr) {
      console.error("Erreur sauvegarde tentatives:", attErr.message);
    }
  }
}

// Charger les résultats d'un élève
export async function loadStudentResults(studentId: string): Promise<DicteeResult[]> {
  const sb = createClient();
  const { data } = await sb
    .from("dm_results")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return data || [];
}

// Charger les résultats d'un élève pour une dictée spécifique
export async function loadStudentDicteeResults(
  studentId: string,
  dicteeId: string
): Promise<DicteeResult[]> {
  const sb = createClient();
  const { data } = await sb
    .from("dm_results")
    .select("*")
    .eq("student_id", studentId)
    .eq("dictee_id", dicteeId)
    .order("created_at", { ascending: false });
  return data || [];
}

// Charger le détail des tentatives d'un résultat
export async function loadWordAttempts(
  resultId: string
): Promise<{ word: string; user_answer: string; is_correct: boolean }[]> {
  const sb = createClient();
  const { data } = await sb
    .from("dm_word_attempts")
    .select("word, user_answer, is_correct")
    .eq("result_id", resultId);
  return data || [];
}

// Stats résumées par dictée pour un élève (pour affichage sur les cartes)
export async function loadStudentDicteeStats(studentId: string): Promise<
  Record<string, { bestScore: number; attempts: number; lastMode: string }>
> {
  const results = await loadStudentResults(studentId);
  const stats: Record<string, { bestScore: number; attempts: number; lastMode: string }> = {};

  for (const r of results) {
    if (!stats[r.dictee_id]) {
      stats[r.dictee_id] = { bestScore: 0, attempts: 0, lastMode: "" };
    }
    stats[r.dictee_id].attempts++;
    if (r.percentage > stats[r.dictee_id].bestScore) {
      stats[r.dictee_id].bestScore = r.percentage;
    }
    if (!stats[r.dictee_id].lastMode) {
      stats[r.dictee_id].lastMode = r.activity_mode;
    }
  }

  return stats;
}

// === CLASSES (enseignant) ===

export async function loadTeacherClasses(teacherId: string) {
  const sb = createClient();
  const { data } = await sb
    .from("dm_classes")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at");
  return data || [];
}

export async function createClass(teacherId: string, name: string, level: DicteeLevel = "6e") {
  const sb = createClient();
  const { data, error } = await sb
    .from("dm_classes")
    .insert({
      teacher_id: teacherId,
      name,
      level,
      unlocked_dictees: [1],
      // "genre" et "dictionary" sont volontairement absents : désactivés par défaut
      // (demande de la collègue du 06/09/2026, elle ne les utilise pas). Le code des
      // deux modes est conservé et ils restent réactivables dans 🎯 Parcours.
      default_activity_order: ["flashcard", "grammar_class", "spelling_choice", "definitions", "lexique", "fill_blanks", "audio_word", "audio_dictation"],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateUnlockedDictees(classId: string, positions: number[]) {
  const sb = createClient();
  const { error } = await sb
    .from("dm_classes")
    .update({ unlocked_dictees: positions })
    .eq("id", classId);
  if (error) throw new Error(error.message);
}

export async function updateActivityOrder(classId: string, order: string[]) {
  const sb = createClient();
  const { error } = await sb
    .from("dm_classes")
    .update({ default_activity_order: order })
    .eq("id", classId);
  if (error) throw new Error(error.message);
}

// Met à jour la liste des activités FACULTATIVES de la classe (niveau classe =
// s'applique à toutes les dictées). Une activité facultative reste visible côté
// élève mais ne bloque pas la progression vers l'exercice suivant.
export async function updateClassOptionalActivities(classId: string, optional: string[]) {
  const sb = createClient();
  const { error } = await sb
    .from("dm_classes")
    .update({ optional_activities: optional })
    .eq("id", classId);
  if (error) throw new Error(error.message);
}

// Charge les activités facultatives de la classe (niveau classe).
export async function loadClassOptionalActivities(classId: string): Promise<string[]> {
  const sb = createClient();
  const { data } = await sb
    .from("dm_classes")
    .select("optional_activities")
    .eq("id", classId)
    .single();
  const opt = data?.optional_activities;
  const stored = Array.isArray(opt) ? opt.filter((a: string) => ALL_ACTIVITIES_CANONICAL.includes(a)) : [];
  // Aucun réglage enregistré → « Famille & synonymes » est facultatif par défaut
  // (décision du 19/09/2026) : il ne bloque jamais la progression.
  return stored.length > 0 ? stored : [...DEFAULT_OPTIONAL_ACTIVITIES];
}

// === COMMENTAIRES D'ERREURS (mnémoniques) ===
// Réglage de classe : affiche ou masque, CÔTÉ ÉLÈVE uniquement, les commentaires
// explicatifs d'erreurs sur l'écran de résultats. Demande de la collègue du
// 06/09/2026 : les explications sont parfois fausses, on garde la fonction mais
// elle est désactivable. Côté prof les mnémoniques restent toujours affichées.
// Défaut false (masqué) tant que la qualité des explications n'est pas validée.
export async function loadClassMnemonicsEnabled(classId: string): Promise<boolean> {
  const sb = createClient();
  const { data, error } = await sb
    .from("dm_classes")
    .select("mnemonics_enabled")
    .eq("id", classId)
    .single();
  // Colonne absente (migration-mnemonics-toggle.sql pas encore appliquée) :
  // on retombe sur le comportement demandé, c'est-à-dire masqué.
  if (error || !data) return false;
  return data.mnemonics_enabled === true;
}

export async function updateClassMnemonicsEnabled(classId: string, enabled: boolean) {
  const sb = createClient();
  const { error } = await sb
    .from("dm_classes")
    .update({ mnemonics_enabled: enabled })
    .eq("id", classId);
  if (error) throw new Error(error.message);
}

// === PARCOURS CONFIG ===

export async function loadClassDefaultOrder(classId: string): Promise<string[] | null> {
  const sb = createClient();
  const { data } = await sb
    .from("dm_classes")
    .select("default_activity_order")
    .eq("id", classId)
    .single();
  return mergeWithCanonical(data?.default_activity_order);
}

export async function loadAllDicteeOverrides(classId: string, studentId?: string | null): Promise<
  Record<string, { activityOrder: string[]; selectedWords: number[] | null }>
> {
  const sb = createClient();
  let query = sb
    .from("dictee_activity_overrides")
    .select("dictee_id, activity_order, selected_words")
    .eq("class_id", classId);
  if (studentId) {
    query = query.eq("student_id", studentId);
  } else {
    query = query.is("student_id", null);
  }
  const { data } = await query;
  const result: Record<string, { activityOrder: string[]; selectedWords: number[] | null }> = {};
  for (const row of data || []) {
    result[row.dictee_id] = {
      activityOrder: row.activity_order,
      selectedWords: row.selected_words,
    };
  }
  return result;
}

export async function saveDicteeOverride(
  classId: string,
  dicteeId: string,
  activityOrder: string[],
  selectedWords: number[] | null,
  studentId?: string | null,
): Promise<void> {
  const sb = createClient();
  // Chercher si un override existe déjà
  let query = sb
    .from("dictee_activity_overrides")
    .select("id")
    .eq("class_id", classId)
    .eq("dictee_id", dicteeId);
  if (studentId) {
    query = query.eq("student_id", studentId);
  } else {
    query = query.is("student_id", null);
  }
  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { error } = await sb
      .from("dictee_activity_overrides")
      .update({ activity_order: activityOrder, selected_words: selectedWords })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb
      .from("dictee_activity_overrides")
      .insert({ class_id: classId, dictee_id: dicteeId, activity_order: activityOrder, selected_words: selectedWords, student_id: studentId || null });
    if (error) throw new Error(error.message);
  }
}

export async function deleteDicteeOverride(classId: string, dicteeId: string, studentId?: string | null): Promise<void> {
  const sb = createClient();
  let query = sb
    .from("dictee_activity_overrides")
    .delete()
    .eq("class_id", classId)
    .eq("dictee_id", dicteeId);
  if (studentId) {
    query = query.eq("student_id", studentId);
  } else {
    query = query.is("student_id", null);
  }
  const { error } = await query;
  if (error) throw new Error(error.message);
}

// Charger les élèves qui ont des overrides dans une classe
export async function loadStudentsWithOverrides(classId: string): Promise<Set<string>> {
  const sb = createClient();
  const { data } = await sb
    .from("dictee_activity_overrides")
    .select("student_id")
    .eq("class_id", classId)
    .not("student_id", "is", null);
  return new Set((data || []).map(r => r.student_id).filter(Boolean));
}

const DEFAULT_ACTIVITY_ORDER_FALLBACK = [
  "flashcard", "genre", "grammar_class", "spelling_choice", "definitions", "lexique",
  "dictionary", "audio_word", "fill_blanks", "audio_dictation",
];

// Activités facultatives quand la classe n'a aucun réglage enregistré.
const DEFAULT_OPTIONAL_ACTIVITIES = ["lexique"];

// Liste canonique de toutes les activités existantes — source de vérité pour
// valider les ids stockés et pour le cas « aucune config » (on renvoie tout).
const ALL_ACTIVITIES_CANONICAL = [
  "flashcard", "genre", "grammar_class", "spelling_choice", "definitions", "lexique",
  "dictionary", "audio_word", "fill_blanks", "audio_dictation",
];

// Activités temporairement désactivées (cachées partout côté élève + prof).
// Pour désactiver une activité : ajouter son id dans cet ensemble.
const DISABLED_ACTIVITIES = new Set<string>([]);

// Réconcilie un ordre stocké avec la liste canonique.
//
// IMPORTANT : un ordre sauvegardé ne contient QUE les activités actives ;
// l'absence d'une activité = retrait volontaire par le prof. On ne réinjecte
// donc JAMAIS les activités manquantes (sinon les exercices retirés par le prof
// — ex. genre/dictionnaire/dictée — réapparaissent en fin de parcours).
// On garde les activités connues, dans l'ordre choisi par le prof, en filtrant
// celles désactivées au niveau de l'app (DISABLED_ACTIVITIES).
//
// Conséquence : si une NOUVELLE activité est ajoutée à l'app, elle n'apparaîtra
// pas automatiquement dans les parcours déjà personnalisés — le prof devra la
// réactiver. C'est le comportement sûr (ne pas injecter d'exercice surprise).
function mergeWithCanonical(stored: string[] | null | undefined): string[] {
  // Aucune config → toutes les activités (ordre canonique).
  if (!stored || stored.length === 0) {
    return ALL_ACTIVITIES_CANONICAL.filter(a => !DISABLED_ACTIVITIES.has(a));
  }
  return stored.filter(
    a => ALL_ACTIVITIES_CANONICAL.includes(a) && !DISABLED_ACTIVITIES.has(a),
  );
}

export async function loadActivityConfig(
  hubClassId: string,
  dicteeId: string,
  studentId?: string | null,
): Promise<{ activityOrder: string[]; selectedWords: number[] | null; optionalActivities: string[] }> {
  const sb = createClient();

  // Trouver la classe par hub_class_id (clé universelle — jamais par name)
  const { data: cls } = await sb
    .from("dm_classes")
    .select("id, default_activity_order, optional_activities")
    .eq("hub_class_id", hubClassId)
    .maybeSingle();

  if (!cls) {
    console.warn(
      `[loadActivityConfig] Classe introuvable pour hub_class_id="${hubClassId}". Fallback activé.`
    );
    return { activityOrder: DEFAULT_ACTIVITY_ORDER_FALLBACK, selectedWords: null, optionalActivities: [] };
  }

  // Activités facultatives — réglage au niveau classe (s'applique à toutes les
  // dictées, quel que soit l'override de parcours).
  const optionalActivities: string[] = Array.isArray(cls.optional_activities)
    ? cls.optional_activities.filter((a: string) => ALL_ACTIVITIES_CANONICAL.includes(a))
    : [];

  // Priorité 1 : override spécifique à l'élève
  if (studentId) {
    const { data: studentOverride } = await sb
      .from("dictee_activity_overrides")
      .select("activity_order, selected_words")
      .eq("class_id", cls.id)
      .eq("dictee_id", dicteeId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (studentOverride) {
      return {
        activityOrder: mergeWithCanonical(studentOverride.activity_order),
        selectedWords: studentOverride.selected_words,
        optionalActivities,
      };
    }
  }

  // Priorité 2 : override de la dictée (classe entière)
  const { data: override } = await sb
    .from("dictee_activity_overrides")
    .select("activity_order, selected_words")
    .eq("class_id", cls.id)
    .eq("dictee_id", dicteeId)
    .is("student_id", null)
    .maybeSingle();

  if (override) {
    return {
      activityOrder: mergeWithCanonical(override.activity_order),
      selectedWords: override.selected_words,
      optionalActivities,
    };
  }

  // Priorité 3 : défaut de la classe
  return {
    activityOrder: mergeWithCanonical(cls.default_activity_order),
    selectedWords: null,
    optionalActivities,
  };
}

// Charger tous les résultats d'une classe
export async function loadClassResults(classId: string): Promise<DicteeResult[]> {
  const sb = createClient();
  const { data } = await sb
    .from("dm_results")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  return data || [];
}

// === UNLOCK REQUESTS ===

export interface UnlockRequest {
  id: string;
  class_id: string;
  dictee_position: number;
  student_name: string;
  student_id: string;
  status: "pending" | "approved" | "denied";
  created_at: string;
  updated_at: string;
}

export async function createUnlockRequest(
  classId: string,
  dicteePosition: number,
  studentId: string,
  studentName: string
): Promise<UnlockRequest | null> {
  const sb = createClient();
  const { data, error } = await sb
    .from("dm_unlock_requests")
    .insert({
      class_id: classId,
      dictee_position: dicteePosition,
      student_id: studentId,
      student_name: studentName,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Erreur création demande de déverrouillage:", error.message);
    return null;
  }
  return data;
}

// Toutes les demandes d'un élève dans une classe (toutes statuts confondus, récentes d'abord).
// Sert au polling côté élève pour détecter les transitions pending -> approved/denied.
export async function loadStudentUnlockRequests(
  classId: string,
  studentId: string,
): Promise<UnlockRequest[]> {
  const sb = createClient();
  const { data } = await sb
    .from("dm_unlock_requests")
    .select("*")
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function loadPendingUnlockRequests(classId: string): Promise<UnlockRequest[]> {
  const sb = createClient();
  const { data } = await sb
    .from("dm_unlock_requests")
    .select("*")
    .eq("class_id", classId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return data || [];
}

export async function approveUnlockRequest(
  requestId: string,
  classId: string,
  dicteePosition: number
): Promise<boolean> {
  const sb = createClient();

  // Mettre à jour le statut de la demande
  const { error: updateError } = await sb
    .from("dm_unlock_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  if (updateError) {
    console.error("Erreur mise à jour demande:", updateError.message);
    return false;
  }

  // Ajouter la dictée aux positions déverrouillées si elle n'y est pas
  const { data: dmClass, error: readError } = await sb
    .from("dm_classes")
    .select("unlocked_dictees")
    .eq("id", classId)
    .maybeSingle();

  if (readError || !dmClass) {
    console.error("approveUnlockRequest: dm_classes introuvable", classId, readError?.message);
    return false;
  }

  try {
    const newPositions = [
      ...new Set([...(dmClass.unlocked_dictees || []), dicteePosition]),
    ].sort((a, b) => a - b);
    await updateUnlockedDictees(classId, newPositions);
    return true;
  } catch (e) {
    console.error("approveUnlockRequest: échec updateUnlockedDictees", e);
    return false;
  }
}

export async function rejectUnlockRequest(requestId: string): Promise<boolean> {
  const sb = createClient();
  const { error } = await sb
    .from("dm_unlock_requests")
    .update({ status: "denied" })
    .eq("id", requestId);

  if (error) {
    console.error("Erreur rejet demande:", error.message);
    return false;
  }
  return true;
}

// === VARIANTES ADAPTATIVES (texte à trous) ===

// Charger les variantes stockées en JSONB pour une dictée.
export async function loadFillBlanksVariants(dicteeId: string): Promise<FillBlanksVariant[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from("dictees")
    .select("fill_blanks_variants")
    .eq("id", dicteeId)
    .maybeSingle();
  if (error) {
    console.error("loadFillBlanksVariants:", error.message);
    return [];
  }
  return (data?.fill_blanks_variants as FillBlanksVariant[]) || [];
}

// Sauvegarder (écraser) toutes les variantes d'une dictée.
export async function saveFillBlanksVariants(
  dicteeId: string,
  variants: FillBlanksVariant[],
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("dictees")
    .update({ fill_blanks_variants: variants })
    .eq("id", dicteeId);
  if (error) throw new Error(error.message);
}

// === TEXTE D'ENTRAÎNEMENT (retour de Nadia, 20/09/2026) ===
//
// Les modes « dictée audio » et « texte à trous » servaient le texte du jour J,
// que l'élève finissait par connaître par cœur. Chaque dictée a donc un texte
// d'entraînement distinct, court (≤ 25 mots, ≤ 3 phrases courtes).
//
// Les trous ne sont plus déduits de la liste de vocabulaire mais écrits à la
// main dans le texte, entre guillemets français : «curieuses». Ils portent sur
// un ACCORD (pluriel du nom ou de l'adjectif, féminin de l'adjectif, verbe,
// participe passé) et jamais sur l'orthographe du mot seul — c'est le rôle du
// mode « audio mot ». Le contexte qui donne l'indice (déterminant, sujet) reste
// visible, sinon l'accord est indevinable.

export interface TrainingText {
  marked: string;                    // texte avec les trous entre «…»
  rules?: Record<string, string>;    // réponse → règle d'accord testée (feedback élève)
  validated: boolean;                // visible des élèves ; dévalidable par l'enseignant
  audio_url?: string | null;         // MP3 du texte complet (première écoute)
  audio_phrases?: string[];          // un MP3 par phrase : la dictée phrase par
                                     // phrase les joue entiers, au lieu de
                                     // découper le fichier complet en estimant
                                     // les instants — ce qui rognait le premier
                                     // mot (signalé par Nadia le 20/09/2026)
  updated_at?: string;
}

export interface TrainingBlank {
  answer: string;   // la forme attendue, accordée
  rule?: string;    // ce que le trou teste, affiché dans la correction
  position: number; // position dans le texte affiché
}

export interface ParsedTrainingText {
  fullText: string;      // texte complet, sans marqueurs (lecture audio)
  displayText: string;   // texte avec ______ à la place des trous
  blanks: TrainingBlank[];
}

const BLANK_RE = /«([^»]+)»/g;

// Découpe le texte marqué en texte complet + texte à trous + réponses.
export function parseTrainingText(t: TrainingText): ParsedTrainingText {
  const fullText = t.marked.replace(/[«»]/g, "");
  const blanks: TrainingBlank[] = [];
  let displayText = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  BLANK_RE.lastIndex = 0;
  while ((match = BLANK_RE.exec(t.marked)) !== null) {
    const answer = match[1];
    displayText += t.marked.slice(cursor, match.index);
    blanks.push({
      answer,
      rule: t.rules?.[answer],
      position: displayText.length,
    });
    displayText += "_".repeat(Math.max(5, answer.length));
    cursor = match.index + match[0].length;
  }
  displayText += t.marked.slice(cursor);

  return { fullText, displayText, blanks };
}

// Contrôles mécaniques des consignes de Nadia : ≤ 25 mots, ≤ 3 phrases, au
// moins un trou. Utilisé par l'éditeur enseignant pour signaler un dépassement.
export function checkTrainingText(t: TrainingText): string[] {
  const { fullText, blanks } = parseTrainingText(t);
  const problems: string[] = [];
  const wordCount = fullText.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
  const sentenceCount = fullText.split(/(?<=[.!?])\s+/).filter((p) => p.trim().length > 0).length;

  if (wordCount > 25) problems.push(`${wordCount} mots (Nadia demande 25 au maximum)`);
  if (sentenceCount > 3) problems.push(`${sentenceCount} phrases (3 au maximum)`);
  if (blanks.length === 0) problems.push("aucun trou : entoure les mots à trouer avec « et »");
  return problems;
}

export async function loadTrainingText(dicteeId: string): Promise<TrainingText | null> {
  const sb = createClient();
  const { data, error } = await sb
    .from("dictees")
    .select("training_text")
    .eq("id", dicteeId)
    .maybeSingle();
  if (error) {
    console.error("loadTrainingText:", error.message);
    return null;
  }
  return (data?.training_text as TrainingText) || null;
}

export async function saveTrainingText(dicteeId: string, text: TrainingText): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("dictees")
    .update({ training_text: { ...text, updated_at: new Date().toISOString() } })
    .eq("id", dicteeId);
  if (error) throw new Error(error.message);
}
