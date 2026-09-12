'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Check, X, ArrowRight, BookOpen } from 'lucide-react';
import { shuffleArray } from '@/lib/spelling-errors';
import type { Word, ExerciseResult } from '@/types/database';

interface DefinitionModeProps {
  words: Word[];
  onComplete: (results: ExerciseResult[]) => void;
}

export default function DefinitionMode({ words, onComplete }: DefinitionModeProps) {
  // Filtrer les mots qui ont une définition
  const wordsWithDefs = useMemo(
    () => words.filter(w => w.definition && w.definition.trim().length > 0),
    [words]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState<ExerciseResult[]>([]);

  const currentWord = wordsWithDefs[currentIndex];
  const progress = ((currentIndex) / wordsWithDefs.length) * 100;

  // Générer les options de mots (mot correct + autres mots)
  const wordOptions = useMemo(() => {
    const otherWords = wordsWithDefs
      .filter((_, i) => i !== currentIndex)
      .map(w => w.word)
      .slice(0, 3);

    return shuffleArray([currentWord.word, ...otherWords]);
  }, [currentIndex, currentWord, wordsWithDefs]);

  const handleSelectWord = (word: string) => {
    if (showResult) return;

    setSelectedWord(word);
    setShowResult(true);

    const isCorrect = word === currentWord.word;
    const newResult: ExerciseResult = {
      word: currentWord.word,
      userAnswer: word,
      isCorrect,
      correctAnswer: isCorrect ? undefined : currentWord.word,
    };
    setResults([...results, newResult]);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= wordsWithDefs.length) {
      onComplete([...results]);
    } else {
      setCurrentIndex(currentIndex + 1);
      setSelectedWord(null);
      setShowResult(false);
    }
  };

  if (wordsWithDefs.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">
            Aucune définition disponible pour cette liste de mots.
          </p>
          <Button onClick={() => onComplete([])} className="mt-4">
            Retour
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isCorrect = selectedWord === currentWord.word;

  return (
    <div className="space-y-6">
      {/* Progression */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Définition {currentIndex + 1} sur {wordsWithDefs.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Carte définition */}
      <Card className="overflow-hidden">
        <CardContent className="p-8">
          {/* Définition */}
          <div className="text-center mb-8">
            <Badge className="mb-4" variant="outline">
              Définition
            </Badge>
            <div className="p-6 bg-orange-50 rounded-xl">
              <p className="text-xl text-gray-800 italic">
                "{currentWord.definition}"
              </p>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Quel mot correspond à cette définition ?
            </p>
          </div>

          {/* Options de mots */}
          <div className="grid grid-cols-2 gap-3">
            {wordOptions.map((word, index) => {
              let buttonStyle = 'border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50';

              if (showResult) {
                if (word === currentWord.word) {
                  buttonStyle = 'border-2 border-green-500 bg-green-100';
                } else if (word === selectedWord) {
                  buttonStyle = 'border-2 border-red-500 bg-red-100';
                } else {
                  buttonStyle = 'border-2 border-gray-200 opacity-50';
                }
              }

              return (
                <Button
                  key={index}
                  variant="outline"
                  className={`h-14 text-lg font-medium transition-all ${buttonStyle}`}
                  onClick={() => handleSelectWord(word)}
                  disabled={showResult}
                >
                  <span className="flex items-center gap-2">
                    {showResult && word === currentWord.word && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                    {showResult && word === selectedWord && word !== currentWord.word && (
                      <X className="h-4 w-4 text-red-600" />
                    )}
                    {word}
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
                  <p className="text-green-700 font-bold">Bien joué !</p>
                ) : (
                  <p className="text-red-700">
                    C'était : <span className="font-bold text-green-700">{currentWord.word}</span>
                  </p>
                )}
              </div>

              <Button onClick={handleNext} className="w-full h-12">
                {currentIndex + 1 >= wordsWithDefs.length ? (
                  'Voir mes résultats'
                ) : (
                  <>
                    Définition suivante
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
        {wordsWithDefs.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all ${
              index < currentIndex
                ? results[index]?.isCorrect
                  ? 'bg-green-500'
                  : 'bg-red-500'
                : index === currentIndex
                ? 'bg-orange-500 w-4'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
