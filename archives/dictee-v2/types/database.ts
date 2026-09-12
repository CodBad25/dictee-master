// Types pour DictéeMaster V2
// Basé sur le modèle de données de ARCHITECTURE_V2.md

export interface Dictee {
  id: string;
  title: string;
  description?: string;
  share_code: string;
  dictation_text?: string; // Texte complet pour audio
  fill_blanks_text?: string; // Texte à trous pour exercice
  created_at: string;
  updated_at: string;
}

export interface WordList {
  id: string;
  dictee_id: string;
  title: string; // ex: "Liste n°1", "Liste n°2"
  position: number; // ordre dans la dictée
}

export interface Word {
  id: string;
  list_id: string;
  word: string;
  position: number;
  definition?: string; // généré par IA, stocké
  spelling_errors: string[]; // ["erreur1", "erreur2", "erreur3"]
  example_sentence?: string;
}

export interface TrainingSession {
  id: string;
  dictee_id: string;
  list_id?: string; // nullable si dictée complète
  student_name?: string;
  mode_used: ExerciseMode;
  total_words: number;
  correct_words: number;
  percentage: number;
  time_spent_seconds: number;
  started_at: string;
  finished_at?: string;
}

export interface WordAttempt {
  id: string;
  session_id: string;
  word: string;
  user_answer: string;
  is_correct: boolean;
  phase: ExercisePhase;
}

// Types pour les modes d'exercice
export type ExerciseMode =
  | 'flashcard'
  | 'audio'
  | 'spelling_choice'
  | 'definitions'
  | 'fill_blanks'
  | 'parcours';

export type ExercisePhase =
  | 'flashcard'
  | 'audio'
  | 'spelling'
  | 'definition'
  | 'fill-blanks';

// Types pour l'import ODT
export interface ParsedDictee {
  title: string;
  lists: ParsedWordList[];
  dictationText?: string;
  fillBlanksText?: string;
}

export interface ParsedWordList {
  title: string;
  words: string[];
}

// Types pour l'interface utilisateur
export interface DicteeWithLists extends Dictee {
  word_lists: WordListWithWords[];
}

export interface WordListWithWords extends WordList {
  words: Word[];
}

// Types pour la génération IA
export interface GeneratedWordData {
  definition: string;
  spelling_errors: string[];
  example_sentence?: string;
}

// Types pour les résultats
export interface ExerciseResult {
  word: string;
  userAnswer: string;
  isCorrect: boolean;
  correctAnswer?: string;
}
