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

export interface Dictee {
  id: string;
  title: string;
  position: number;
  share_code: string;
  fill_blanks_text: string;
}

export interface DicteeWord {
  dictee_id: string;
  word: string;
  definition: string;
  spelling_errors: string[];
  position: number;
}

// === DICTÉES ===

export async function loadAllDictees(): Promise<Dictee[]> {
  const sb = createClient();
  const { data } = await sb
    .from("dictees")
    .select("id, title, position, share_code, fill_blanks_text")
    .order("position");
  return data || [];
}

export async function loadDicteeWords(dicteeId: string): Promise<DicteeWord[]> {
  const sb = createClient();
  const { data } = await sb
    .from("dictee_words")
    .select("dictee_id, word, definition, spelling_errors, position")
    .eq("dictee_id", dicteeId)
    .order("position");
  return data || [];
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

export async function createClass(teacherId: string, name: string) {
  const sb = createClient();
  const { data, error } = await sb
    .from("dm_classes")
    .insert({
      teacher_id: teacherId,
      name,
      unlocked_dictees: [1],
      default_activity_order: ["flashcard", "genre", "spelling_choice", "definitions", "fill_blanks", "audio_word", "audio_dictation"],
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
  "flashcard", "genre", "spelling_choice", "definitions",
  "dictionary", "audio_word", "fill_blanks", "audio_dictation",
];

// Liste canonique de toutes les activités existantes — source de vérité.
// Ajoute ici toute nouvelle activité pour qu'elle apparaisse automatiquement
// dans les ordres déjà stockés en DB (sans avoir à les réécrire).
const ALL_ACTIVITIES_CANONICAL = [
  "flashcard", "genre", "grammar_class", "spelling_choice", "definitions",
  "dictionary", "audio_word", "fill_blanks", "audio_dictation",
];

// Activités temporairement désactivées (cachées partout côté élève + prof).
// Pour désactiver une activité : ajouter son id dans cet ensemble.
const DISABLED_ACTIVITIES = new Set<string>([]);

// Merge un ordre stocké avec la liste canonique : préserve l'ordre choisi par
// le prof, ajoute en queue toute activité nouvelle, et filtre les activités
// désactivées (DISABLED_ACTIVITIES).
function mergeWithCanonical(stored: string[] | null | undefined): string[] {
  const merged = (() => {
    if (!stored || stored.length === 0) return ALL_ACTIVITIES_CANONICAL;
    const known = new Set(stored);
    const missing = ALL_ACTIVITIES_CANONICAL.filter(a => !known.has(a));
    return [...stored, ...missing];
  })();
  return merged.filter(a => !DISABLED_ACTIVITIES.has(a));
}

export async function loadActivityConfig(
  className: string,
  dicteeId: string,
  studentId?: string | null,
): Promise<{ activityOrder: string[]; selectedWords: number[] | null }> {
  const sb = createClient();

  // Trouver la classe par nom
  const { data: cls } = await sb
    .from("dm_classes")
    .select("id, default_activity_order")
    .eq("name", className)
    .maybeSingle();

  if (!cls) {
    return { activityOrder: DEFAULT_ACTIVITY_ORDER_FALLBACK, selectedWords: null };
  }

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
    };
  }

  // Priorité 3 : défaut de la classe
  return {
    activityOrder: mergeWithCanonical(cls.default_activity_order),
    selectedWords: null,
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
