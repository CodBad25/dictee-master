'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  BookOpen,
  Copy,
  Check,
  Search,
  Eye,
  Share2,
  List,
} from 'lucide-react';
import { ALL_DICTEES, LEVELS, type AppDictee, type DicteeLevel } from '@/lib/all-dictees';

export default function EnseignantPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedDictee, setSelectedDictee] = useState<AppDictee | null>(null);
  const [levelFilter, setLevelFilter] = useState<DicteeLevel>('6e');

  // Filtrer les dictées par niveau puis par recherche
  const filteredDictees = ALL_DICTEES.filter(d => d.level === levelFilter).filter(d =>
    d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.shareCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Copier le code de partage
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Copier le lien complet
  const copyLink = (code: string) => {
    const link = `${window.location.origin}/eleve/dictee?code=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code + '-link');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-green-900">Espace Enseignant</h1>
            <p className="text-sm text-gray-500">{ALL_DICTEES.length} dictées disponibles</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Vue détaillée d'une dictée */}
        {selectedDictee ? (
          <div className="space-y-6">
            <Button variant="ghost" onClick={() => setSelectedDictee(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à la liste
            </Button>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-2xl">{selectedDictee.title}</CardTitle>
                      <Badge variant="outline">{selectedDictee.level === '5e' ? '5ème' : '6ème'}</Badge>
                    </div>
                    <CardDescription>
                      {selectedDictee.words.length} mots
                      {selectedDictee.lexicalTheme && ` · champ lexical : ${selectedDictee.lexicalTheme}`}
                    </CardDescription>
                    {selectedDictee.orthoPoint && (
                      <p className="mt-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-block">
                        <span className="font-semibold">Point d'orthographe :</span> {selectedDictee.orthoPoint}
                        {selectedDictee.starWord && (
                          <span className="ml-2">· ⭐ {selectedDictee.starWord}</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-lg px-4 py-2">
                      {selectedDictee.shareCode}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyCode(selectedDictee.shareCode)}
                    >
                      {copiedCode === selectedDictee.shareCode ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Lien de partage */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">Lien pour les élèves :</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white px-3 py-2 rounded border text-sm overflow-x-auto">
                      {typeof window !== 'undefined'
                        ? `${window.location.origin}/eleve/dictee?code=${selectedDictee.shareCode}`
                        : `/eleve/dictee?code=${selectedDictee.shareCode}`
                      }
                    </code>
                    <Button
                      size="sm"
                      onClick={() => copyLink(selectedDictee.shareCode)}
                    >
                      {copiedCode === selectedDictee.shareCode + '-link' ? (
                        <><Check className="h-4 w-4 mr-2" /> Copié !</>
                      ) : (
                        <><Share2 className="h-4 w-4 mr-2" /> Copier</>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Liste des mots */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <List className="h-5 w-5" />
                    Liste des mots
                  </h3>
                  <div className="grid gap-2">
                    {selectedDictee.words.map((word, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <span className="font-medium">{word.word}</span>
                          {word.definition && (
                            <p className="text-sm text-gray-600 mt-1">{word.definition}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {word.spellingErrors.length} erreurs
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Liste des dictées */
          <div className="space-y-6">
            {/* Choix du niveau : boutons chips (jamais de menu déroulant) */}
            <div className="flex gap-2">
              {LEVELS.map(level => (
                <Button
                  key={level}
                  variant={levelFilter === level ? 'default' : 'outline'}
                  className={levelFilter === level ? 'bg-green-600 hover:bg-green-700' : ''}
                  onClick={() => setLevelFilter(level)}
                >
                  {level === '6e' ? '6ème' : '5ème'}
                </Button>
              ))}
            </div>

            {/* Barre de recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher une dictée par titre ou code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Grille des dictées */}
            <div className="grid gap-4 md:grid-cols-2">
              {filteredDictees.map((dictee) => (
                <Card
                  key={dictee.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedDictee(dictee)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <BookOpen className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{dictee.title}</h3>
                          <p className="text-sm text-gray-500">{dictee.words.length} mots</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className="font-mono">
                          {dictee.shareCode}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyCode(dictee.shareCode);
                            }}
                            title="Copier le code"
                          >
                            {copiedCode === dictee.shareCode ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDictee(dictee);
                            }}
                            title="Voir les détails"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredDictees.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Aucune dictée trouvée pour "{searchTerm}"
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
