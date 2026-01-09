"use client";

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import {
  getWordListByShareCode,
  getWordsByListId,
  createWordList,
  createWords,
  deleteWordList as deleteWordListDb,
  createTrainingSession,
  createWordAttempts,
  getAllSessions,
  getSessionsByStudentName,
  DbWordList,
  DbWord,
} from '@/lib/supabase/queries';
import type { WordList, Word } from '@/types/database';

// Convertir DbWordList vers WordList local
function toLocalWordList(db: DbWordList): WordList {
  return {
    id: db.id,
    teacher_id: db.teacher_id || '',
    title: db.title,
    description: db.description || undefined,
    mode: db.mode,
    share_code: db.share_code,
    created_at: db.created_at,
    updated_at: db.updated_at,
  };
}

// Convertir DbWord vers Word local
function toLocalWord(db: DbWord): Word {
  return {
    id: db.id,
    list_id: db.list_id,
    word: db.word,
    hint: db.hint || undefined,
    order: db.position,
  };
}

// Hook pour synchroniser avec Supabase
export function useSupabaseSync() {
  const { addDemoList } = useAppStore();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Créer une liste dans Supabase
  const createList = async (
    title: string,
    mode: 'flashcard' | 'audio' | 'progression' | 'fill-blanks',
    words: string[],
    teacherId?: string
  ) => {
    setIsSyncing(true);
    try {
      const dbList = await createWordList(teacherId || null, title, mode);
      if (dbList) {
        const dbWords = await createWords(dbList.id, words);
        const localList = toLocalWordList(dbList);
        const localWords = dbWords.map(toLocalWord);
        addDemoList(localList, localWords);
        setIsSyncing(false);
        return { list: localList, words: localWords };
      }
    } catch (error) {
      console.error('Error creating list:', error);
    }
    setIsSyncing(false);
    return null;
  };

  // Supprimer une liste
  const deleteList = async (listId: string) => {
    setIsSyncing(true);
    try {
      const success = await deleteWordListDb(listId);
      if (success) {
        useAppStore.getState().deleteDemoList(listId);
        setIsSyncing(false);
        return true;
      }
    } catch (error) {
      console.error('Error deleting list:', error);
    }
    setIsSyncing(false);
    return false;
  };

  // Chercher une liste par code
  const findListByCode = async (shareCode: string) => {
    setIsSyncing(true);
    try {
      const dbList = await getWordListByShareCode(shareCode);
      if (dbList) {
        const dbWords = await getWordsByListId(dbList.id);
        const localList = toLocalWordList(dbList);
        const localWords = dbWords.map(toLocalWord);
        addDemoList(localList, localWords);
        return { list: localList, words: localWords };
      }
    } catch (error) {
      console.error('Error finding list:', error);
    } finally {
      setIsSyncing(false);
    }
    return null;
  };

  // Sauvegarder une session
  const saveSession = async (session: {
    listId: string;
    listTitle: string;
    studentName?: string;
    modeUsed: 'flashcard' | 'audio';
    totalWords: number;
    correctWords: number;
    percentage: number;
    timeSpentSeconds: number;
    chronoTimeSeconds?: number;
    answers: { word: string; userAnswer: string; isCorrect: boolean }[];
  }) => {
    // TOUJOURS sauvegarder en local d'abord
    useAppStore.getState().addSessionToHistory({
      listId: session.listId,
      listTitle: session.listTitle,
      studentName: session.studentName,
      percentage: session.percentage,
      correctCount: session.correctWords,
      totalWords: session.totalWords,
      timeSpent: session.timeSpentSeconds,
      chronoTime: session.chronoTimeSeconds,
      answers: session.answers,
    });

    // Puis essayer de sauvegarder dans Supabase
    try {
      const dbSession = await createTrainingSession({
        listId: session.listId,
        studentName: session.studentName,
        modeUsed: session.modeUsed,
        totalWords: session.totalWords,
        correctWords: session.correctWords,
        percentage: session.percentage,
        timeSpentSeconds: session.timeSpentSeconds,
        chronoTimeSeconds: session.chronoTimeSeconds,
      });

      if (dbSession) {
        await createWordAttempts(dbSession.id, session.answers);
        return dbSession;
      }
    } catch (error) {
      console.error('Error saving session to Supabase:', error);
    }
    return null;
  };

  // Charger toutes les sessions
  const loadAllSessions = async () => {
    try {
      return await getAllSessions();
    } catch (error) {
      console.error('Error loading sessions:', error);
      return [];
    }
  };

  // Charger les sessions d'un élève par son prénom
  const loadStudentSessions = async (studentName: string) => {
    if (!studentName.trim()) return [];
    try {
      return await getSessionsByStudentName(studentName.trim());
    } catch (error) {
      console.error('Error loading student sessions:', error);
      return [];
    }
  };

  // Synchroniser les sessions locales vers Supabase
  const syncLocalSessionsToSupabase = async () => {
    const state = useAppStore.getState();
    const localSessions = state.sessionHistory;
    const localLists = state.demoLists;
    const localWords = state.demoWords;

    if (localSessions.length === 0) {
      return { synced: 0, failed: 0, listsCreated: 0 };
    }

    let synced = 0;
    let failed = 0;
    let listsCreated = 0;

    // 1. D'abord, s'assurer que toutes les listes référencées existent dans Supabase
    const listIdsNeeded = new Set(localSessions.map(s => s.listId));
    const listIdMapping: Record<string, string> = {}; // old ID -> new ID (si recréé)

    for (const listId of listIdsNeeded) {
      // Chercher la liste locale
      const localList = localLists.find(l => l.id === listId);
      if (!localList) {
        // Pas de liste locale, on ne peut pas sync ces sessions
        continue;
      }

      // Vérifier si la liste existe dans Supabase via son share_code
      const existingList = await getWordListByShareCode(localList.share_code);

      if (existingList) {
        // La liste existe, utiliser son ID
        listIdMapping[listId] = existingList.id;
      } else {
        // Créer la liste dans Supabase
        const words = localWords[listId] || [];
        const wordStrings = words.map(w => w.word);

        const newList = await createWordList(
          localList.teacher_id || null,
          localList.title,
          localList.mode as 'flashcard' | 'audio' | 'progression' | 'fill-blanks',
          localList.description
        );

        if (newList) {
          await createWords(newList.id, wordStrings);
          listIdMapping[listId] = newList.id;
          listsCreated++;
        }
      }
    }

    // 2. Synchroniser les sessions
    for (const session of localSessions) {
      const targetListId = listIdMapping[session.listId];
      if (!targetListId) {
        failed++;
        continue;
      }

      try {
        const dbSession = await createTrainingSession({
          listId: targetListId,
          studentName: session.studentName,
          modeUsed: 'flashcard',
          totalWords: session.totalWords,
          correctWords: session.correctCount,
          percentage: session.percentage,
          timeSpentSeconds: session.timeSpent,
          chronoTimeSeconds: session.chronoTime,
        });

        if (dbSession) {
          await createWordAttempts(dbSession.id, session.answers);
          synced++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error('Error syncing session:', error);
        failed++;
      }
    }

    return { synced, failed, listsCreated };
  };

  return {
    isOnline,
    isSyncing,
    createList,
    deleteList,
    findListByCode,
    saveSession,
    loadAllSessions,
    loadStudentSessions,
    syncLocalSessionsToSupabase,
  };
}
