import { createClient } from './client';

// ============================================
// TYPES
// ============================================

export interface DbWordList {
  id: string;
  teacher_id: string | null;
  title: string;
  description: string | null;
  mode: 'flashcard' | 'audio' | 'progression';
  share_code: string;
  created_at: string;
  updated_at: string;
}

export interface DbWord {
  id: string;
  list_id: string;
  word: string;
  hint: string | null;
  position: number;
  created_at: string;
}

export interface DbStudent {
  id: string;
  teacher_id: string | null;
  name: string;
  student_code: string;
  created_at: string;
}

export interface DbTrainingSession {
  id: string;
  student_id: string | null;
  list_id: string;
  student_name: string | null;
  mode_used: 'flashcard' | 'audio';
  total_words: number;
  correct_words: number;
  percentage: number;
  time_spent_seconds: number;
  chrono_time_seconds: number | null;
  started_at: string;
  finished_at: string | null;
}

export interface DbWordAttempt {
  id: string;
  session_id: string;
  word: string;
  user_answer: string;
  is_correct: boolean;
  created_at: string;
}

export interface DbClass {
  id: string;
  teacher_id: string | null;
  name: string;
  class_code: string;
  created_at: string;
}

// ============================================
// WORD LISTS
// ============================================

export async function getWordListByShareCode(shareCode: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('word_lists')
    .select('*')
    .eq('share_code', shareCode.toUpperCase())
    .single();

  if (error) {
    console.error('Error fetching word list:', error);
    return null;
  }
  return data as DbWordList;
}

export async function getWordListsByTeacher(teacherId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('word_lists')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching word lists:', error);
    return [];
  }
  return data as DbWordList[];
}

export async function createWordList(
  teacherId: string | null,
  title: string,
  mode: 'flashcard' | 'audio' | 'progression',
  description?: string
) {
  const supabase = createClient();
  
  // Générer un code de partage unique
  const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const { data, error } = await supabase
    .from('word_lists')
    .insert({
      teacher_id: teacherId,
      title,
      mode,
      description: description || null,
      share_code: shareCode,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating word list:', error);
    return null;
  }
  return data as DbWordList;
}

export async function deleteWordList(listId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('word_lists')
    .delete()
    .eq('id', listId);

  if (error) {
    console.error('Error deleting word list:', error);
    return false;
  }
  return true;
}

// ============================================
// WORDS
// ============================================

export async function getWordsByListId(listId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('list_id', listId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching words:', error);
    return [];
  }
  return data as DbWord[];
}

export async function createWords(listId: string, words: string[]) {
  const supabase = createClient();
  
  const wordsToInsert = words.map((word, index) => ({
    list_id: listId,
    word,
    position: index,
  }));

  const { data, error } = await supabase
    .from('words')
    .insert(wordsToInsert)
    .select();

  if (error) {
    console.error('Error creating words:', error);
    return [];
  }
  return data as DbWord[];
}

export async function updateWords(listId: string, words: { id?: string; word: string; position: number }[]) {
  const supabase = createClient();
  
  // Supprimer les anciens mots
  await supabase.from('words').delete().eq('list_id', listId);
  
  // Insérer les nouveaux
  const wordsToInsert = words.map((w, index) => ({
    list_id: listId,
    word: w.word,
    position: index,
  }));

  const { data, error } = await supabase
    .from('words')
    .insert(wordsToInsert)
    .select();

  if (error) {
    console.error('Error updating words:', error);
    return [];
  }
  return data as DbWord[];
}

// ============================================
// STUDENTS
// ============================================

export async function getStudentByCode(studentCode: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('student_code', studentCode.toUpperCase())
    .single();

  if (error) {
    console.error('Error fetching student:', error);
    return null;
  }
  return data as DbStudent;
}

export async function getStudentsByTeacher(teacherId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }
  return data as DbStudent[];
}

export async function createStudent(teacherId: string | null, name: string) {
  const supabase = createClient();
  
  // Générer un code élève unique (PRENOM-XXXX)
  const baseName = name.substring(0, 5).toUpperCase().replace(/[^A-Z]/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const studentCode = `${baseName}-${randomSuffix}`;
  
  const { data, error } = await supabase
    .from('students')
    .insert({
      teacher_id: teacherId,
      name,
      student_code: studentCode,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating student:', error);
    return null;
  }
  return data as DbStudent;
}

// ============================================
// TRAINING SESSIONS
// ============================================

export async function createTrainingSession(session: {
  studentId?: string | null;
  listId: string;
  studentName?: string | null;
  modeUsed: 'flashcard' | 'audio';
  totalWords: number;
  correctWords: number;
  percentage: number;
  timeSpentSeconds: number;
  chronoTimeSeconds?: number | null;
}) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('training_sessions')
    .insert({
      student_id: session.studentId || null,
      list_id: session.listId,
      student_name: session.studentName || null,
      mode_used: session.modeUsed,
      total_words: session.totalWords,
      correct_words: session.correctWords,
      percentage: session.percentage,
      time_spent_seconds: session.timeSpentSeconds,
      chrono_time_seconds: session.chronoTimeSeconds || null,
      finished_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating training session:', error);
    return null;
  }
  return data as DbTrainingSession;
}

export async function getSessionsByListId(listId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('list_id', listId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
  return data as DbTrainingSession[];
}

export async function getSessionsByStudentId(studentId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('student_id', studentId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
  return data as DbTrainingSession[];
}

export async function getAllSessions() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('training_sessions')
    .select(`
      *,
      word_lists (title, share_code)
    `)
    .order('started_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching all sessions:', error);
    return [];
  }
  return data;
}

export async function getSessionsByStudentName(studentName: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('training_sessions')
    .select(`
      *,
      word_lists (title, share_code)
    `)
    .ilike('student_name', studentName)
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching sessions by student name:', error);
    return [];
  }
  return data;
}

// ============================================
// WORD ATTEMPTS
// ============================================

export async function createWordAttempts(
  sessionId: string,
  attempts: { word: string; userAnswer: string; isCorrect: boolean }[]
) {
  const supabase = createClient();
  
  const attemptsToInsert = attempts.map((a) => ({
    session_id: sessionId,
    word: a.word,
    user_answer: a.userAnswer,
    is_correct: a.isCorrect,
  }));

  const { data, error } = await supabase
    .from('word_attempts')
    .insert(attemptsToInsert)
    .select();

  if (error) {
    console.error('Error creating word attempts:', error);
    return [];
  }
  return data as DbWordAttempt[];
}

export async function getAttemptsBySessionId(sessionId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('word_attempts')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching attempts:', error);
    return [];
  }
  return data as DbWordAttempt[];
}

// ============================================
// CLASSES
// ============================================

export async function getClassesByTeacher(teacherId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching classes:', error);
    return [];
  }
  return data as DbClass[];
}

export async function createClass(teacherId: string, name: string) {
  const supabase = createClient();
  
  const classCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const { data, error } = await supabase
    .from('classes')
    .insert({
      teacher_id: teacherId,
      name,
      class_code: classCode,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating class:', error);
    return null;
  }
  return data as DbClass;
}
