'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, BookOpen } from 'lucide-react';

export default function ElevePage() {
  const [shareCode, setShareCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAccessDictee = async () => {
    if (!shareCode.trim()) {
      toast.error('Entre le code de la dictée');
      return;
    }

    if (!studentName.trim()) {
      toast.error('Entre ton prénom');
      return;
    }

    setIsLoading(true);

    // Simulation d'accès (en production, ça irait chercher dans Supabase)
    setTimeout(() => {
      setIsLoading(false);
      // Rediriger vers la page d'exercice avec le code
      window.location.href = `/eleve/dictee?code=${shareCode.toUpperCase()}&name=${encodeURIComponent(studentName)}`;
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-blue-900">Espace Élève</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto bg-blue-100 p-4 rounded-full w-fit mb-4">
              <KeyRound className="h-10 w-10 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Accéder à une dictée</CardTitle>
            <CardDescription>
              Entre le code donné par ton enseignant pour commencer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="name">Ton prénom</Label>
              <Input
                id="name"
                placeholder="Ex: Emma"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                className="text-lg text-center"
              />
            </div>

            <div>
              <Label htmlFor="code">Code de la dictée</Label>
              <Input
                id="code"
                placeholder="Ex: ABC123"
                value={shareCode}
                onChange={e => setShareCode(e.target.value.toUpperCase())}
                className="text-center text-2xl font-mono tracking-widest uppercase"
                maxLength={6}
              />
            </div>

            <Button
              onClick={handleAccessDictee}
              disabled={isLoading}
              className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Chargement...' : "C'est parti !"}
            </Button>

            <Alert className="bg-blue-50 border-blue-200">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Ton enseignant t'a donné un code à 6 caractères pour accéder à ta dictée.
                Si tu ne l'as pas, demande-le lui !
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
