'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Check, X, ArrowRight, Volume2, VolumeX } from 'lucide-react';
import type { Word, ExerciseResult } from '@/types/database';

interface AudioModeProps {
  words: Word[];
  onComplete: (results: ExerciseResult[]) => void;
}

export default function AudioMode({ words, onComplete }: AudioModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [canPlay, setCanPlay] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentWord = words[currentIndex];
  const progress = ((currentIndex) / words.length) * 100;

  // Fonction pour lire le mot avec la synthèse vocale
  const speakWord = useCallback(() => {
    if (!canPlay || isPlaying) return;

    setIsPlaying(true);
    const utterance = new SpeechSynthesisUtterance(currentWord.word);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.8; // Un peu plus lent pour les élèves

    utterance.onend = () => {
      setIsPlaying(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [currentWord.word, canPlay, isPlaying]);

  useEffect(() => {
    // Focus l'input quand on passe au mot suivant
    if (!showResult && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, showResult]);

  useEffect(() => {
    // Lire le mot automatiquement au début
    const timer = setTimeout(() => {
      speakWord();
    }, 500);
    return () => clearTimeout(timer);
  }, [currentIndex, speakWord]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedInput = userInput.trim().toLowerCase();
    const normalizedWord = currentWord.word.toLowerCase();
    const correct = normalizedInput === normalizedWord;

    setIsCorrect(correct);
    setShowResult(true);
    setCanPlay(false);

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
      onComplete([...results]);
    } else {
      setCurrentIndex(currentIndex + 1);
      setUserInput('');
      setShowResult(false);
      setCanPlay(true);
    }
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

      {/* Carte audio */}
      <Card className="overflow-hidden">
        <CardContent className="p-8">
          {/* Zone audio */}
          <div className="text-center mb-8">
            <div className="py-8 px-4 bg-blue-50 rounded-xl">
              <Button
                size="lg"
                variant="outline"
                onClick={speakWord}
                disabled={isPlaying || !canPlay}
                className={`h-24 w-24 rounded-full ${
                  isPlaying ? 'animate-pulse bg-blue-100' : ''
                }`}
              >
                {isPlaying ? (
                  <Volume2 className="h-12 w-12 text-blue-600 animate-pulse" />
                ) : canPlay ? (
                  <Volume2 className="h-12 w-12 text-blue-600" />
                ) : (
                  <VolumeX className="h-12 w-12 text-gray-400" />
                )}
              </Button>
              <p className="text-sm text-blue-600 mt-4">
                {isPlaying
                  ? 'Écoute bien...'
                  : canPlay
                  ? 'Clique pour écouter le mot'
                  : 'Tu as déjà répondu'}
              </p>
            </div>
          </div>

          {/* Zone de saisie */}
          {!showResult ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  ref={inputRef}
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  placeholder="Écris ce que tu entends..."
                  className="text-center text-xl h-14"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                disabled={!userInput.trim()}
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
                      <span className="text-xl font-bold text-green-700">Excellent !</span>
                    </>
                  ) : (
                    <>
                      <X className="h-6 w-6 text-red-600" />
                      <span className="text-xl font-bold text-red-700">Presque !</span>
                    </>
                  )}
                </div>

                {!isCorrect && (
                  <div className="mt-4">
                    <p className="text-gray-600">
                      Tu as écrit : <span className="line-through">{userInput}</span>
                    </p>
                    <p className="text-lg font-medium mt-2">
                      C'était : <span className="text-green-700">{currentWord.word}</span>
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
