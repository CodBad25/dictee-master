// Types pour la base de données Supabase

export type UserRole = 'teacher' | 'student';

export type TrainingMode = 'flashcard' | 'audio' | 'progression';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
}

export interface WordList {
  id: string;
  teacher_id: string;
  title: string;
  description?: string;
  mode: TrainingMode;
  share_code: string;
  created_at: string;
  updated_at: string;
}

export interface Word {
  id: string;
  list_id: string;
  word: string;
  hint?: string;
  order: number;
}

export interface ClassGroup {
  id: string;
  teacher_id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface ClassMember {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
}

export interface Assignment {
  id: string;
  list_id: string;
  class_id: string;
  due_date?: string;
  created_at: string;
}

export interface TrainingSession {
  id: string;
  student_id: string;
  list_id: string;
  mode_used: 'flashcard' | 'audio';
  started_at: string;
  finished_at?: string;
  total_words: number;
  correct_words: number;
  time_spent_seconds: number;
}

export interface WordAttempt {
  id: string;
  session_id: string;
  word_id: string;
  student_answer: string;
  is_correct: boolean;
  attempt_number: number;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition_type: 'perfect_score' | 'streak' | 'total_words' | 'first_list';
  condition_value: number;
}

export interface StudentBadge {
  id: string;
  student_id: string;
  badge_id: string;
  earned_at: string;
}

export interface Streak {
  id: string;
  student_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
}

// Types pour les vues agrégées
export interface StudentProgress {
  student_id: string;
  student_name: string;
  list_id: string;
  total_attempts: number;
  best_score: number;
  last_attempt_date: string;
  total_time_spent: number;
}

export interface ListWithWords extends WordList {
  words: Word[];
}

export interface SessionWithDetails extends TrainingSession {
  list: WordList;
  attempts: WordAttempt[];
}
