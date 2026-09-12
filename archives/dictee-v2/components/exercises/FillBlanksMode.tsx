'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, X, ArrowRight, FileText } from 'lucide-react';
import type { Word, ExerciseResult } from '@/types/database';

interface FillBlanksModeProps {
  words: Word[];
  text: string;
  onComplete: (results: ExerciseResult[]) => void;
}

interface BlankItem {
  index: number;
  word: string;
  answer: string;
}

export default function FillBlanksMode({ words, text, onComplete }: FillBlanksModeProps) {
  // Parser le texte et identifier les blancs
  const { textParts, blanks } = useMemo(() => {
    const parts: (string | { blankIndex: number })[] = [];
    const blanksList: BlankItem[] = [];

    // Syntaxe {{mot}} : le trou attend la forme exacte écrite dans le texte
    // (utile quand les mots de la liste sont à l'infinitif mais conjugués dans le texte)
    if (text.includes('{{')) {
      const segments = text.split(/\{\{(.*?)\}\}/g);
      segments.forEach((segment, i) => {
        if (i % 2 === 1) {
          parts.push({ blankIndex: blanksList.length });
          blanksList.push({ index: blanksList.length, word: segment, answer: '' });
        } else if (segment) {
          parts.push(segment);
        }
      });
      return { textParts: parts, blanks: blanksList };
    }

    // Syntaxe historique : les _____ correspondent aux mots de la liste, dans l'ordre
    const segments = text.split(/(_____+|\.\.\.)/g);
    let blankIndex = 0;

    segments.forEach((segment, i) => {
      if (segment.match(/^_+$/) || segment === '...') {
        // C'est un blanc
        if (blankIndex < words.length) {
          parts.push({ blankIndex });
          blanksList.push({
            index: blankIndex,
            word: words[blankIndex].word,
            answer: '',
          });
          blankIndex++;
        }
      } else if (segment.trim()) {
        parts.push(segment);
      }
    });

    return { textParts: parts, blanks: blanksList };
  }, [text, words]);

  // Mots d'aide : les réponses attendues, triées alphabétiquement pour ne pas révéler l'ordre
  const helpWords = useMemo(() => {
    if (text.includes('{{')) {
      return blanks
        .map(b => b.word.toLowerCase())
        .sort((a, b) => a.localeCompare(b, 'fr'));
    }
    return words.slice(0, blanks.length).map(w => w.word);
  }, [text, words, blanks]);

  const [answers, setAnswers] = useState<string[]>(blanks.map(() => ''));
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus sur le premier input au chargement
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      // Passer au prochain input
      if (index < blanks.length - 1 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleSubmit = () => {
    const exerciseResults: ExerciseResult[] = blanks.map((blank, i) => {
      const userAnswer = answers[i].trim().toLowerCase();
      const correctWord = blank.word.toLowerCase();
      const isCorrect = userAnswer === correctWord;

      return {
        word: blank.word,
        userAnswer: answers[i].trim(),
        isCorrect,
        correctAnswer: isCorrect ? undefined : blank.word,
      };
    });

    setResults(exerciseResults);
    setShowResult(true);
  };

  const handleFinish = () => {
    onComplete(results);
  };

  const filledBlanks = answers.filter(a => a.trim().length > 0).length;
  const progress = (filledBlanks / blanks.length) * 100;

  if (blanks.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">
            Aucun texte à trous disponible pour cette dictée.
          </p>
          <Button onClick={() => onComplete([])} className="mt-4">
            Retour
          </Button>
        </CardContent>
      </Card>
    );
  }

  const correctCount = results.filter(r => r.isCorrect).length;

  return (
    <div className="space-y-6">
      {/* Progression */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{filledBlanks} / {blanks.length} mots remplis</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Texte à trous */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <Badge variant="outline" className="mb-4">
              <FileText className="h-3 w-3 mr-1" />
              Texte à compléter
            </Badge>
          </div>

          <div className="text-lg leading-relaxed">
            {textParts.map((part, i) => {
              if (typeof part === 'string') {
                return <span key={i}>{part}</span>;
              }

              const blank = blanks[part.blankIndex];
              const answer = answers[part.blankIndex];
              const result = results[part.blankIndex];

              return (
                <span key={i} className="inline-block mx-1">
                  {showResult ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
                        result?.isCorrect
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {result?.isCorrect ? (
                        <>
                          <Check className="h-4 w-4" />
                          {blank.word}
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          <span className="line-through">{answer || '(vide)'}</span>
                          <span className="text-green-700 font-medium ml-1">
                            → {blank.word}
                          </span>
                        </>
                      )}
                    </span>
                  ) : (
                    <Input
                      ref={el => {
                        inputRefs.current[part.blankIndex] = el;
                      }}
                      value={answer}
                      onChange={e => handleAnswerChange(part.blankIndex, e.target.value)}
                      onKeyDown={e => handleKeyDown(e, part.blankIndex)}
                      className="inline-block w-32 h-8 text-center mx-1"
                      placeholder={`(${part.blankIndex + 1})`}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  )}
                </span>
              );
            })}
          </div>

          {/* Liste des mots disponibles (aide) */}
          {!showResult && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-gray-500 mb-2">Mots à placer :</p>
              <div className="flex flex-wrap gap-2">
                {helpWords.map((w, i) => (
                  <Badge key={i} variant="secondary" className="text-sm">
                    {w}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Boutons d'action */}
      {!showResult ? (
        <Button
          onClick={handleSubmit}
          className="w-full h-12"
          disabled={filledBlanks < blanks.length}
        >
          Vérifier mes réponses
        </Button>
      ) : (
        <div className="space-y-4">
          <div
            className={`p-4 rounded-xl text-center ${
              correctCount === blanks.length
                ? 'bg-green-50 border border-green-200'
                : correctCount > blanks.length / 2
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <p className="text-xl font-bold">
              {correctCount} / {blanks.length} correct{correctCount > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {correctCount === blanks.length
                ? 'Parfait !'
                : correctCount > blanks.length / 2
                ? 'Bien joué !'
                : 'Continue à t\'entraîner !'}
            </p>
          </div>

          <Button onClick={handleFinish} className="w-full h-12">
            Voir mes résultats
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
