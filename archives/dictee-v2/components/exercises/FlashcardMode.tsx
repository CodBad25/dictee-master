'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Check, X, ArrowRight, Eye } from 'lucide-react';
import type { Word, ExerciseResult } from '@/types/database';

interface FlashcardModeProps {
  words: Word[];
  onComplete: (results: ExerciseResult[]) => void;
}

export default function FlashcardMode({ words, onComplete }: FlashcardModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [showWord, setShowWord] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentWord = words[currentIndex];
  const progress = ((currentIndex) / words.length) * 100;

  useEffect(() => {
    // Focus l'input quand on passe au mot suivant
    if (!showResult && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, showResult]);

  useEffect(() => {
    // Cacher le mot après 3 secondes
    if (showWord) {
      const timer = setTimeout(() => {
        setShowWord(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showWord, currentIndex]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedInput = userInput.trim().toLowerCase();
    const normalizedWord = currentWord.word.toLowerCase();
    const correct = normalizedInput === normalizedWord;

    setIsCorrect(correct);
    setShowResult(true);

    const newResult: ExerciseResult = {
      word: currentWord.word,
      userAnswer: userInput.trim(),
      isCorrect: correct,
      correctAnswer: correct ? undefined : currentWord.word,
    };
    setResults([...results, newResult]);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= words.length) {
      // Fin de l'exercice
      onComplete([...results]);
    } else {
      setCurrentIndex(currentIndex + 1);
      setUserInput('');
      setShowResult(false);
      setShowWord(true);
    }
  };

  const handleShowWord = () => {
    setShowWord(true);
    // Recacher après 2 secondes
    setTimeout(() => setShowWord(false), 2000);
  };

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

      {/* Carte du mot */}
      <Card className="overflow-hidden">
        <CardContent className="p-8">
          {/* Zone d'affichage du mot */}
          <div className="text-center mb-8">
            {showWord ? (
              <div className="py-8 px-4 bg-purple-50 rounded-xl">
                <p className="text-4xl font-bold text-purple-900 tracking-wide">
                  {currentWord.word}
                </p>
                <p className="text-sm text-purple-600 mt-2">
                  Mémorise ce mot !
                </p>
              </div>
            ) : (
              <div className="py-8 px-4 bg-gray-100 rounded-xl">
                <p className="text-2xl text-gray-400">
                  Le mot est caché
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShowWord}
                  className="mt-2"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Revoir le mot
                </Button>
              </div>
            )}
          </div>

          {/* Zone de saisie */}
          {!showResult ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  ref={inputRef}
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  placeholder="Écris le mot ici..."
                  className="text-center text-xl h-14"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={showWord}
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12"
                disabled={!userInput.trim() || showWord}
              >
                Valider
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Résultat */}
              <div
                className={`p-6 rounded-xl text-center ${
                  isCorrect
                    ? 'bg-green-50 border-2 border-green-200'
                    : 'bg-red-50 border-2 border-red-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  {isCorrect ? (
                    <>
                      <Check className="h-6 w-6 text-green-600" />
                      <span className="text-xl font-bold text-green-700">Bravo !</span>
                    </>
                  ) : (
                    <>
                      <X className="h-6 w-6 text-red-600" />
                      <span className="text-xl font-bold text-red-700">Pas tout à fait...</span>
                    </>
                  )}
                </div>

                {!isCorrect && (
                  <div className="mt-4">
                    <p className="text-gray-600">Ta réponse : <span className="line-through">{userInput}</span></p>
                    <p className="text-lg font-medium mt-2">
                      La bonne réponse : <span className="text-green-700">{currentWord.word}</span>
                    </p>
                  </div>
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
                ? 'bg-blue-500 w-4'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
