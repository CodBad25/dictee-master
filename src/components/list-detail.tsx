"use client";

import { useState } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  Save,
  BarChart3,
  Clock,
  Users,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAppStore, SessionHistoryEntry } from "@/lib/store";
import type { WordList, Word } from "@/types/database";

interface ListDetailProps {
  list: WordList;
  onClose: () => void;
}

export default function ListDetail({ list, onClose }: ListDetailProps) {
  const { demoWords, addDemoList, sessionHistory } = useAppStore();
  const words = demoWords[list.id] || [];

  const [editedWords, setEditedWords] = useState<Word[]>(words);
  const [newWord, setNewWord] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Calculate stats for this list
  const listSessions = sessionHistory.filter(s => s.listId === list.id);
  const avgScore = listSessions.length > 0
    ? Math.round(listSessions.reduce((sum, s) => sum + s.percentage, 0) / listSessions.length)
    : 0;
  const avgTime = listSessions.length > 0
    ? Math.round(listSessions.reduce((sum, s) => sum + s.timeSpent, 0) / listSessions.length)
    : 0;
  const uniqueStudents = new Set(listSessions.map(s => s.studentName).filter(Boolean)).size;

  // Find most missed words
  const wordErrors: Record<string, number> = {};
  listSessions.forEach(session => {
    session.answers.forEach(answer => {
      if (!answer.isCorrect) {
        wordErrors[answer.word] = (wordErrors[answer.word] || 0) + 1;
      }
    });
  });
  const mostMissedWords = Object.entries(wordErrors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const handleAddWord = () => {
    if (!newWord.trim()) {
      toast.error("Entrez un mot");
      return;
    }

    if (editedWords.some(w => w.word.toLowerCase() === newWord.toLowerCase())) {
      toast.error("Ce mot existe déjà");
      return;
    }

    const word: Word = {
      id: `word-${Date.now()}`,
      list_id: list.id,
      word: newWord.trim(),
      order: editedWords.length,
    };

    setEditedWords([...editedWords, word]);
    setNewWord("");
    setHasChanges(true);
  };

  const handleRemoveWord = (wordId: string) => {
    setEditedWords(editedWords.filter(w => w.id !== wordId));
    setHasChanges(true);
  };

  const handleReorder = (newOrder: Word[]) => {
    setEditedWords(newOrder.map((w, i) => ({ ...w, order: i })));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (editedWords.length === 0) {
      toast.error("La liste doit contenir au moins un mot");
      return;
    }

    addDemoList(list, editedWords);
    setHasChanges(false);
    toast.success("Liste sauvegardée");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">{list.title}</h2>
              <p className="text-white/80 text-sm">
                Code : <span className="font-mono font-bold">{list.share_code}</span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Stats row */}
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2">
              <Target className="w-4 h-4" />
              <span className="text-sm font-medium">{avgScore}% moy.</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">{formatTime(avgTime)}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">{uniqueStudents} élèves</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2">
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm font-medium">{listSessions.length} sessions</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Most missed words */}
          {mostMissedWords.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 rounded-2xl border border-red-100">
              <h3 className="font-semibold text-red-700 mb-2 text-sm">Mots les plus ratés</h3>
              <div className="flex flex-wrap gap-2">
                {mostMissedWords.map(([word, count]) => (
                  <span
                    key={word}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                  >
                    {word} <span className="text-red-400">({count}x)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add word */}
          <div className="flex gap-2 mb-4">
            <Input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="Ajouter un mot..."
              className="h-12 text-lg rounded-xl border-2"
              onKeyDown={(e) => e.key === "Enter" && handleAddWord()}
            />
            <Button
              onClick={handleAddWord}
              className="h-12 px-5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-xl"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>

          {/* Word list */}
          <div className="space-y-2">
            <Reorder.Group
              axis="y"
              values={editedWords}
              onReorder={handleReorder}
              className="space-y-2"
            >
              {editedWords.map((word, index) => (
                <Reorder.Item
                  key={word.id}
                  value={word}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-100 hover:border-purple-200 transition-colors cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="w-5 h-5 text-gray-400" />
                  <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-bold text-sm">
                    {index + 1}
                  </span>
                  <span className="flex-1 font-medium text-gray-800">{word.word}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveWord(word.id)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </Reorder.Item>
              ))}
            </Reorder.Group>

            {editedWords.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p>Aucun mot dans cette liste</p>
                <p className="text-sm">Ajoutez des mots ci-dessus</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl"
            >
              Fermer
            </Button>
            {hasChanges && (
              <Button
                onClick={handleSave}
                className="flex-1 h-12 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-xl gap-2"
              >
                <Save className="w-5 h-5" />
                Sauvegarder
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
