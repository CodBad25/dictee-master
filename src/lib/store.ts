import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, WordList, Word, TrainingSession, Badge, Streak } from '@/types/database';

// Demo user for development without Supabase
interface DemoUser {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  avatar_url?: string;
}

// Session history entry for tracking progress
export interface SessionHistoryEntry {
  id: string;
  date: string;
  listId: string;
  listTitle: string;
  studentName?: string; // Prénom de l'élève (optionnel pour rétrocompatibilité)
  percentage: number;
  correctCount: number;
  totalWords: number;
  timeSpent: number; // seconds
  chronoTime?: number; // chrono time if enabled
  answers: {
    word: string;
    userAnswer: string;
    isCorrect: boolean;
  }[];
}

interface AppState {
  // User
  user: DemoUser | null;
  setUser: (user: DemoUser | null) => void;

  // Student name for session tracking
  currentStudentName: string;
  setCurrentStudentName: (name: string) => void;

  // Current training session
  currentList: WordList | null;
  currentWords: Word[];
  setCurrentTraining: (list: WordList, words: Word[]) => void;
  clearCurrentTraining: () => void;

  // Session progress
  sessionProgress: {
    currentWordIndex: number;
    correctCount: number;
    attempts: { wordId: string; answer: string; isCorrect: boolean }[];
    mode: 'flashcard' | 'audio';
    startTime: number;
  } | null;
  startSession: (mode: 'flashcard' | 'audio') => void;
  submitAnswer: (wordId: string, answer: string, isCorrect: boolean) => void;
  nextWord: () => void;
  endSession: () => { correctCount: number; totalWords: number; timeSpent: number } | null;

  // Gamification
  streak: number;
  badges: string[];
  updateStreak: (newStreak: number) => void;
  addBadge: (badgeId: string) => void;

  // Demo lists (for development without Supabase)
  demoLists: WordList[];
  demoWords: Record<string, Word[]>;
  addDemoList: (list: WordList, words: Word[]) => void;
  deleteDemoList: (listId: string) => void;

  // Session history
  sessionHistory: SessionHistoryEntry[];
  addSessionToHistory: (entry: Omit<SessionHistoryEntry, 'id' | 'date'>) => void;
  clearSessionHistory: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // User
      user: null,
      setUser: (user) => set({ user }),

      // Student name
      currentStudentName: '',
      setCurrentStudentName: (name) => set({ currentStudentName: name }),

      // Current training
      currentList: null,
      currentWords: [],
      setCurrentTraining: (list, words) => set({ currentList: list, currentWords: words }),
      clearCurrentTraining: () => set({ currentList: null, currentWords: [], sessionProgress: null }),

      // Session progress
      sessionProgress: null,
      startSession: (mode) => set({
        sessionProgress: {
          currentWordIndex: 0,
          correctCount: 0,
          attempts: [],
          mode,
          startTime: Date.now(),
        }
      }),
      submitAnswer: (wordId, answer, isCorrect) => set((state) => {
        if (!state.sessionProgress) return state;
        return {
          sessionProgress: {
            ...state.sessionProgress,
            correctCount: state.sessionProgress.correctCount + (isCorrect ? 1 : 0),
            attempts: [...state.sessionProgress.attempts, { wordId, answer, isCorrect }],
          }
        };
      }),
      nextWord: () => set((state) => {
        if (!state.sessionProgress) return state;
        return {
          sessionProgress: {
            ...state.sessionProgress,
            currentWordIndex: state.sessionProgress.currentWordIndex + 1,
          }
        };
      }),
      endSession: () => {
        const state = get();
        if (!state.sessionProgress || !state.currentWords.length) return null;
        const timeSpent = Math.floor((Date.now() - state.sessionProgress.startTime) / 1000);
        const result = {
          correctCount: state.sessionProgress.correctCount,
          totalWords: state.currentWords.length,
          timeSpent,
        };
        set({ sessionProgress: null });
        return result;
      },

      // Gamification
      streak: 0,
      badges: [],
      updateStreak: (newStreak) => set({ streak: newStreak }),
      addBadge: (badgeId) => set((state) => ({
        badges: state.badges.includes(badgeId) ? state.badges : [...state.badges, badgeId]
      })),

      // Demo lists
      demoLists: [],
      demoWords: {},
      addDemoList: (list, words) => set((state) => ({
        demoLists: [...state.demoLists.filter(l => l.id !== list.id), list],
        demoWords: { ...state.demoWords, [list.id]: words }
      })),
      deleteDemoList: (listId) => set((state) => {
        const { [listId]: _, ...restWords } = state.demoWords;
        return {
          demoLists: state.demoLists.filter(l => l.id !== listId),
          demoWords: restWords
        };
      }),

      // Session history
      sessionHistory: [],
      addSessionToHistory: (entry) => set((state) => ({
        sessionHistory: [
          {
            ...entry,
            id: `session-${Date.now()}`,
            date: new Date().toISOString(),
          },
          ...state.sessionHistory,
        ].slice(0, 50) // Keep only last 50 sessions
      })),
      clearSessionHistory: () => set({ sessionHistory: [] }),
    }),
    {
      name: 'dictee-master-storage',
      partialize: (state) => ({
        user: state.user,
        currentStudentName: state.currentStudentName,
        streak: state.streak,
        badges: state.badges,
        demoLists: state.demoLists,
        demoWords: state.demoWords,
        sessionHistory: state.sessionHistory,
      }),
      skipHydration: false,
      onRehydrateStorage: () => (state) => {
        console.log('Store hydrated:', state ? 'success' : 'failed');
      },
    }
  )
);
