import { createClient } from '@supabase/supabase-js';
import type { Dictee, WordList, Word, TrainingSession, WordAttempt } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============ DICTÉES ============

export async function getDictees() {
  const { data, error } = await supabase
    .from('dictees')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Dictee[];
}

export async function getDicteeByCode(shareCode: string) {
  const { data, error } = await supabase
    .from('dictees')
    .select(`
      *,
      word_lists (
        *,
        words (*)
      )
    `)
    .eq('share_code', shareCode)
    .single();

  if (error) throw error;
  return data;
}

export async function getDicteeById(id: string) {
  const { data, error } = await supabase
    .from('dictees')
    .select(`
      *,
      word_lists (
        *,
        words (*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createDictee(dictee: Omit<Dictee, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('dictees')
    .insert(dictee)
    .select()
    .single();

  if (error) throw error;
  return data as Dictee;
}

export async function updateDictee(id: string, updates: Partial<Dictee>) {
  const { data, error } = await supabase
    .from('dictees')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Dictee;
}

export async function deleteDictee(id: string) {
  const { error } = await supabase
    .from('dictees')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============ WORD LISTS ============

export async function createWordList(list: Omit<WordList, 'id'>) {
  const { data, error } = await supabase
    .from('word_lists')
    .insert(list)
    .select()
    .single();

  if (error) throw error;
  return data as WordList;
}

export async function getWordListsByDictee(dicteeId: string) {
  const { data, error } = await supabase
    .from('word_lists')
    .select(`
      *,
      words (*)
    `)
    .eq('dictee_id', dicteeId)
    .order('position');

  if (error) throw error;
  return data;
}

// ============ WORDS ============

export async function createWord(word: Omit<Word, 'id'>) {
  const { data, error } = await supabase
    .from('words')
    .insert(word)
    .select()
    .single();

  if (error) throw error;
  return data as Word;
}

export async function createWords(words: Omit<Word, 'id'>[]) {
  const { data, error } = await supabase
    .from('words')
    .insert(words)
    .select();

  if (error) throw error;
  return data as Word[];
}

export async function updateWord(id: string, updates: Partial<Word>) {
  const { data, error } = await supabase
    .from('words')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Word;
}

export async function getWordsByList(listId: string) {
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('list_id', listId)
    .order('position');

  if (error) throw error;
  return data as Word[];
}

// ============ TRAINING SESSIONS ============

export async function createTrainingSession(session: Omit<TrainingSession, 'id'>) {
  const { data, error } = await supabase
    .from('training_sessions')
    .insert(session)
    .select()
    .single();

  if (error) throw error;
  return data as TrainingSession;
}

export async function updateTrainingSession(id: string, updates: Partial<TrainingSession>) {
  const { data, error } = await supabase
    .from('training_sessions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as TrainingSession;
}

export async function getSessionsByDictee(dicteeId: string) {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('dictee_id', dicteeId)
    .order('started_at', { ascending: false });

  if (error) throw error;
  return data as TrainingSession[];
}

// ============ WORD ATTEMPTS ============

export async function createWordAttempt(attempt: Omit<WordAttempt, 'id'>) {
  const { data, error } = await supabase
    .from('word_attempts')
    .insert(attempt)
    .select()
    .single();

  if (error) throw error;
  return data as WordAttempt;
}

export async function getAttemptsBySession(sessionId: string) {
  const { data, error } = await supabase
    .from('word_attempts')
    .select('*')
    .eq('session_id', sessionId);

  if (error) throw error;
  return data as WordAttempt[];
}

// ============ UTILITIES ============

export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
