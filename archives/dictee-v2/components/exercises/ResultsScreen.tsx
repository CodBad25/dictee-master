'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Trophy,
  Star,
  RotateCcw,
  ArrowLeft,
  Check,
  X,
  Target,
  Flame,
} from 'lucide-react';
import type { ExerciseResult } from '@/types/database';

interface ResultsScreenProps {
  results: ExerciseResult[];
  onRestart: () => void;
  onChangeList: () => void;
  studentName: string;
}

export default function ResultsScreen({
  results,
  onRestart,
  onChangeList,
  studentName,
}: ResultsScreenProps) {
  const stats = useMemo(() => {
    const correct = results.filter(r => r.isCorrect).length;
    const total = results.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Déterminer le niveau de performance
    let level: 'excellent' | 'good' | 'medium' | 'needsWork';
    let message: string;
    let emoji: string;

    if (percentage >= 90) {
      level = 'excellent';
      message = 'Champion(ne) de l\'orthographe !';
      emoji = '🏆';
    } else if (percentage >= 70) {
      level = 'good';
      message = 'Très bien joué !';
      emoji = '⭐';
    } else if (percentage >= 50) {
      level = 'medium';
      message = 'Pas mal ! Continue à t\'entraîner.';
      emoji = '💪';
    } else {
      level = 'needsWork';
      message = 'Courage ! Tu vas y arriver !';
      emoji = '📚';
    }

    return { correct, total, percentage, level, message, emoji };
  }, [results]);

  const incorrectWords = results.filter(r => !r.isCorrect);

  // Couleurs selon le niveau
  const levelColors = {
    excellent: {
      bg: 'bg-gradient-to-br from-yellow-100 to-orange-100',
      border: 'border-yellow-300',
      text: 'text-yellow-800',
      progressColor: 'bg-yellow-500',
    },
    good: {
      bg: 'bg-gradient-to-br from-green-100 to-emerald-100',
      border: 'border-green-300',
      text: 'text-green-800',
      progressColor: 'bg-green-500',
    },
    medium: {
      bg: 'bg-gradient-to-br from-blue-100 to-cyan-100',
      border: 'border-blue-300',
      text: 'text-blue-800',
      progressColor: 'bg-blue-500',
    },
    needsWork: {
      bg: 'bg-gradient-to-br from-purple-100 to-pink-100',
      border: 'border-purple-300',
      text: 'text-purple-800',
      progressColor: 'bg-purple-500',
    },
  };

  const colors = levelColors[stats.level];

  return (
    <div className="space-y-6">
      {/* Carte principale des résultats */}
      <Card className={`${colors.bg} ${colors.border} border-2`}>
        <CardContent className="p-8 text-center">
          {/* Emoji et message */}
          <div className="text-6xl mb-4">{stats.emoji}</div>
          <h2 className={`text-2xl font-bold ${colors.text} mb-2`}>
            {stats.message}
          </h2>
          <p className="text-gray-600 mb-6">
            Bravo {studentName} !
          </p>

          {/* Score circulaire */}
          <div className="relative w-40 h-40 mx-auto mb-6">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                className="text-gray-200"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${stats.percentage * 4.4} 440`}
                strokeLinecap="round"
                className={colors.text}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${colors.text}`}>
                {stats.percentage}%
              </span>
              <span className="text-sm text-gray-600">
                {stats.correct}/{stats.total}
              </span>
            </div>
          </div>

          {/* Stats rapides */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-white/50 rounded-xl">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-1">
                <Check className="h-5 w-5" />
                <span className="text-2xl font-bold">{stats.correct}</span>
              </div>
              <p className="text-sm text-gray-600">Correct{stats.correct > 1 ? 's' : ''}</p>
            </div>
            <div className="p-4 bg-white/50 rounded-xl">
              <div className="flex items-center justify-center gap-2 text-red-600 mb-1">
                <X className="h-5 w-5" />
                <span className="text-2xl font-bold">{stats.total - stats.correct}</span>
              </div>
              <p className="text-sm text-gray-600">À revoir</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mots à revoir */}
      {incorrectWords.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-500" />
              Mots à réviser
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {incorrectWords.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-800">
                        {result.correctAnswer}
                      </p>
                      <p className="text-sm text-red-600">
                        Tu as écrit : <span className="line-through">{result.userAnswer || '(vide)'}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="text-red-600 border-red-200">
                      À revoir
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Détail complet */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-5 w-5 text-blue-500" />
            Détail de tes réponses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    result.isCorrect ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {result.isCorrect ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">{result.word}</span>
                  </div>
                  <span className={`text-sm ${result.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                    {result.userAnswer || '(vide)'}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Boutons d'action */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          variant="outline"
          onClick={onChangeList}
          className="h-12"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Changer de liste
        </Button>
        <Button
          onClick={onRestart}
          className="h-12 bg-blue-600 hover:bg-blue-700"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Recommencer
        </Button>
      </div>
    </div>
  );
}
