'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Eye,
  Volume2,
  CheckCircle2,
  BookOpen,
  FileText,
  Play,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import FlashcardMode from '@/components/exercises/FlashcardMode';
import AudioMode from '@/components/exercises/AudioMode';
import SpellingChoiceMode from '@/components/exercises/SpellingChoiceMode';
import DefinitionMode from '@/components/exercises/DefinitionMode';
import FillBlanksMode from '@/components/exercises/FillBlanksMode';
import ResultsScreen from '@/components/exercises/ResultsScreen';
import { ALL_DICTEES, LEVELS, type AppDictee, type DicteeLevel } from '@/lib/all-dictees';
import type { Word, ExerciseMode, ExerciseResult } from '@/types/database';

type ExercisePhase = 'select-dictee' | 'select-mode' | 'exercise' | 'results';

interface DicteeContentProps {
  searchParams: URLSearchParams;
}

function DicteeContent({ searchParams }: DicteeContentProps) {
  const code = searchParams.get('code') || '';
  const studentName = searchParams.get('name') || 'Élève';

  const [phase, setPhase] = useState<ExercisePhase>('select-dictee');
  const [selectedDictee, setSelectedDictee] = useState<AppDictee | null>(null);
  const [levelFilter, setLevelFilter] = useState<DicteeLevel>('6e');
  const [selectedMode, setSelectedMode] = useState<ExerciseMode | null>(null);
  const [results, setResults] = useState<ExerciseResult[]>([]);

  // Chercher la dictée par code ou afficher toutes les dictées
  const matchedDictee = useMemo(() => {
    if (!code) return null;
    return ALL_DICTEES.find(d => d.shareCode.toUpperCase() === code.toUpperCase());
  }, [code]);

  // Si un code est fourni et trouvé, sélectionner automatiquement cette dictée
  useEffect(() => {
    if (matchedDictee) {
      setSelectedDictee(matchedDictee);
      setPhase('select-mode');
    }
  }, [matchedDictee]);

  // Convertir les mots de la dictée au format Word
  const currentWords: Word[] = useMemo(() => {
    if (!selectedDictee) return [];
    return selectedDictee.words.map((w, i) => ({
      id: `${selectedDictee.id}-${i}`,
      list_id: selectedDictee.id,
      word: w.word,
      position: w.position,
      definition: w.definition,
      spelling_errors: w.spellingErrors,
    }));
  }, [selectedDictee]);

  // Gérer la fin d'un exercice
  const handleExerciseComplete = (exerciseResults: ExerciseResult[]) => {
    setResults(exerciseResults);
    setPhase('results');
  };

  // Recommencer
  const handleRestart = () => {
    setResults([]);
    setPhase('select-mode');
  };

  // Changer de dictée
  const handleChangeDictee = () => {
    setSelectedDictee(null);
    setSelectedMode(null);
    setResults([]);
    setPhase('select-dictee');
  };

  const exerciseModes = [
    {
      id: 'flashcard' as ExerciseMode,
      title: 'Flashcard',
      description: 'Vois le mot et tape-le',
      icon: Eye,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      id: 'audio' as ExerciseMode,
      title: 'Audio',
      description: 'Écoute le mot et écris-le',
      icon: Volume2,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      id: 'spelling_choice' as ExerciseMode,
      title: 'Choix orthographique',
      description: 'Trouve la bonne orthographe',
      icon: CheckCircle2,
      color: 'bg-green-100 text-green-600',
    },
    {
      id: 'definitions' as ExerciseMode,
      title: 'Définitions',
      description: 'Associe les mots aux définitions',
      icon: BookOpen,
      color: 'bg-orange-100 text-orange-600',
      disabled: !selectedDictee?.words.some(w => w.definition),
    },
    {
      id: 'fill_blanks' as ExerciseMode,
      title: 'Texte à trous',
      description: 'Complète le texte avec les mots',
      icon: FileText,
      color: 'bg-pink-100 text-pink-600',
      disabled: !selectedDictee?.fillBlanksText,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {phase === 'exercise' ? (
              <Button variant="ghost" size="sm" onClick={() => setPhase('select-mode')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            ) : phase === 'select-mode' && !matchedDictee ? (
              <Button variant="ghost" size="sm" onClick={handleChangeDictee}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            ) : (
              <Link href="/eleve">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
              </Link>
            )}
            <div>
              <h1 className="text-lg font-bold text-blue-900">
                {selectedDictee ? selectedDictee.title : 'Choisir une dictée'}
              </h1>
              <p className="text-sm text-gray-500">Bonjour {studentName} !</p>
            </div>
          </div>
          {selectedDictee && (
            <Badge variant="outline" className="font-mono">
              {selectedDictee.shareCode}
            </Badge>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* SÉLECTION DE LA DICTÉE */}
        {phase === 'select-dictee' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800">Choisis ta dictée</h2>
              <p className="text-gray-600 mt-2">
                Sélectionne la dictée sur laquelle tu veux t'entraîner
              </p>
            </div>

            {code && !matchedDictee && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Le code "{code}" n'a pas été trouvé. Choisis une dictée dans la liste ci-dessous.
                </AlertDescription>
              </Alert>
            )}

            {/* Choix du niveau : boutons chips (jamais de menu déroulant) */}
            <div className="flex justify-center gap-2">
              {LEVELS.map(level => (
                <Button
                  key={level}
                  variant={levelFilter === level ? 'default' : 'outline'}
                  className={levelFilter === level ? 'bg-blue-600 hover:bg-blue-700' : ''}
                  onClick={() => setLevelFilter(level)}
                >
                  {level === '6e' ? '6ème' : '5ème'}
                </Button>
              ))}
            </div>

            <div className="grid gap-3">
              {ALL_DICTEES.filter(d => d.level === levelFilter).map((dictee) => (
                <Card
                  key={dictee.id}
                  className="cursor-pointer hover:shadow-md transition-all hover:border-blue-400"
                  onClick={() => {
                    setSelectedDictee(dictee);
                    setPhase('select-mode');
                  }}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <h3 className="font-bold">{dictee.title}</h3>
                      <p className="text-sm text-gray-500">
                        {dictee.lexicalTheme
                          ? `${dictee.words.length} mots · ${dictee.lexicalTheme}`
                          : `${dictee.words.length} mots`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {dictee.shareCode}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* SÉLECTION DU MODE */}
        {phase === 'select-mode' && selectedDictee && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Badge>{selectedDictee.title}</Badge>
                <Badge variant="outline">{selectedDictee.level === '5e' ? '5ème' : '6ème'}</Badge>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Choisis ton exercice</h2>
              <p className="text-gray-600 mt-2">
                {selectedDictee.words.length} mots à apprendre
                {selectedDictee.lexicalTheme && ` · thème : ${selectedDictee.lexicalTheme}`}
              </p>
              {selectedDictee.orthoPoint && (
                <div className="mt-4 inline-block bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-900">
                  <span className="font-semibold">Point d'orthographe :</span> {selectedDictee.orthoPoint}
                  {selectedDictee.starWord && (
                    <span className="ml-2">· ⭐ Mot vedette : <span className="font-semibold">{selectedDictee.starWord}</span></span>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4">
              {exerciseModes.map(mode => (
                <Card
                  key={mode.id}
                  className={`cursor-pointer transition-all ${
                    mode.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:shadow-lg hover:border-blue-400'
                  }`}
                  onClick={() => {
                    if (!mode.disabled) {
                      setSelectedMode(mode.id);
                      setPhase('exercise');
                    }
                  }}
                >
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className={`p-3 rounded-full ${mode.color}`}>
                      <mode.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{mode.title}</h3>
                      <p className="text-gray-600 text-sm">{mode.description}</p>
                      {mode.disabled && (
                        <p className="text-xs text-orange-600 mt-1">Non disponible pour cette dictée</p>
                      )}
                    </div>
                    {!mode.disabled && <Play className="h-6 w-6 text-gray-400" />}
                  </CardContent>
                </Card>
              ))}
            </div>

            {!matchedDictee && (
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={handleChangeDictee}
              >
                Changer de dictée
              </Button>
            )}
          </div>
        )}

        {/* EXERCICE EN COURS */}
        {phase === 'exercise' && selectedMode && currentWords.length > 0 && (
          <>
            {selectedMode === 'flashcard' && (
              <FlashcardMode
                words={currentWords}
                onComplete={handleExerciseComplete}
              />
            )}
            {selectedMode === 'audio' && (
              <AudioMode
                words={currentWords}
                onComplete={handleExerciseComplete}
              />
            )}
            {selectedMode === 'spelling_choice' && (
              <SpellingChoiceMode
                words={currentWords}
                onComplete={handleExerciseComplete}
              />
            )}
            {selectedMode === 'definitions' && (
              <DefinitionMode
                words={currentWords}
                onComplete={handleExerciseComplete}
              />
            )}
            {selectedMode === 'fill_blanks' && selectedDictee && (
              <FillBlanksMode
                words={currentWords}
                text={selectedDictee.fillBlanksText}
                onComplete={handleExerciseComplete}
              />
            )}
          </>
        )}

        {/* RÉSULTATS */}
        {phase === 'results' && (
          <ResultsScreen
            results={results}
            onRestart={handleRestart}
            onChangeList={handleChangeDictee}
            studentName={studentName}
          />
        )}
      </main>
    </div>
  );
}

export default function DicteePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    }>
      <DicteeContentWrapper />
    </Suspense>
  );
}

function DicteeContentWrapper() {
  const searchParams = useSearchParams();
  return <DicteeContent searchParams={searchParams} />;
}
