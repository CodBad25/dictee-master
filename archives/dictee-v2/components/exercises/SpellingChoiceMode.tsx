'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, X, ArrowRight } from 'lucide-react';
import { shuffleArray } from '@/lib/spelling-errors';
import type { Word, ExerciseResult } from '@/types/database';

interface SpellingChoiceModeProps {
  words: Word[];
  onComplete: (results: ExerciseResult[]) => void;
}

export default function SpellingChoiceMode({ words, onComplete }: SpellingChoiceModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState<ExerciseResult[]>([]);

  const currentWord = words[currentIndex];
  const progress = ((currentIndex) / words.length) * 100;

  // Générer les options (mot correct + 1 erreur)
  const options = useMemo(() => {
    const errors = currentWord.spelling_errors || [];
    const wrongOption = errors[Math.floor(Math.random() * errors.length)] || currentWord.word + 'x';
    return shuffleArray([currentWord.word, wrongOption]);
  }, [currentWord]);

  const handleSelect = (answer: string) => {
    if (showResult) return;

    setSelectedAnswer(answer);
    setShowResult(true);

    const isCorrect = answer === currentWord.word;
    const newResult: ExerciseResult = {
      word: currentWord.word,
      userAnswer: answer,
      isCorrect,
      correctAnswer: isCorrect ? undefined : currentWord.word,
    };
    setResults([...results, newResult]);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= words.length) {
      onComplete([...results]);
    } else {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  const isCorrect = selectedAnswer === currentWord.word;

  return (
    <div className="space-y-6">
      {/* Progression */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Mot {currentIndex + 1} sur {words.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Carte de choix */}
      <Card className="overflow-hidden">
        <CardContent className="p-8">
          {/* Question */}
          <div className="text-center mb-8">
            <p className="text-lg text-gray-600 mb-2">Quelle est la bonne orthographe ?</p>
            {currentWord.definition && (
              <p className="text-sm text-gray-500 italic">
                Indice : {currentWord.definition}
              </p>
            )}
          </div>

          {/* Options */}
          <div className="grid gap-4">
            {options.map((option, index) => {
              let buttonStyle = 'border-2 border-gray-200 hover:border-green-400 hover:bg-green-50';

              if (showResult) {
                if (option === currentWord.word) {
                  buttonStyle = 'border-2 border-green-500 bg-green-100';
                } else if (option === selectedAnswer) {
                  buttonStyle = 'border-2 border-red-500 bg-red-100';
                } else {
                  buttonStyle = 'border-2 border-gray-200 opacity-50';
                }
              } else if (selectedAnswer === option) {
                buttonStyle = 'border-2 border-blue-500 bg-blue-50';
              }

              return (
                <Button
                  key={index}
                  variant="outline"
                  className={`h-16 text-xl font-medium transition-all ${buttonStyle}`}
                  onClick={() => handleSelect(option)}
                  disabled={showResult}
                >
                  <span className="flex items-center gap-2">
                    {showResult && option === currentWord.word && (
                      <Check className="h-5 w-5 text-green-600" />
                    )}
                    {showResult && option === selectedAnswer && option !== currentWord.word && (
                      <X className="h-5 w-5 text-red-600" />
                    )}
                    {option}
                  </span>
                </Button>
              );
            })}
          </div>

          {/* Résultat */}
          {showResult && (
            <div className="mt-6 space-y-4">
              <div
                className={`p-4 rounded-xl text-center ${
                  isCorrect
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {isCorrect ? (
                  <p className="text-green-700 font-bold">Bonne réponse !</p>
                ) : (
                  <p className="text-red-700 font-bold">
                    La bonne réponse était : <span className="text-green-700">{currentWord.word}</span>
                  </p>
                )}
              </div>

              <Button onClick={handleNext} className="w-full h-12">
                {currentIndex + 1 >= words.length ? (
                  'Voir mes résultats'
                ) : (
                  <>
                    Mot suivant
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Indicateurs */}
      <div className="flex justify-center gap-1">
        {words.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all ${
              index < currentIndex
                ? results[index]?.isCorrect
                  ? 'bg-green-500'
                  : 'bg-red-500'
                : index === currentIndex
                ? 'bg-green-500 w-4'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
