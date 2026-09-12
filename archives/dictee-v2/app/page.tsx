'use client';

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-blue-50 to-white">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-blue-900 mb-4">
          DictéeMaster
        </h1>
        <p className="text-xl text-gray-600 max-w-md mx-auto">
          Entraîne-toi à l'orthographe et deviens un champion de la dictée !
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-3xl">
        {/* Card Élève */}
        <Link href="/eleve" className="block">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-400">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto bg-blue-100 p-4 rounded-full w-fit mb-4">
                <GraduationCap className="h-12 w-12 text-blue-600" />
              </div>
              <CardTitle className="text-2xl text-blue-900">Je suis élève</CardTitle>
              <CardDescription className="text-base">
                Accède à tes dictées et entraîne-toi
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700">
                Commencer
              </Button>
            </CardContent>
          </Card>
        </Link>

        {/* Card Enseignant */}
        <Link href="/enseignant" className="block">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-400">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto bg-green-100 p-4 rounded-full w-fit mb-4">
                <BookOpen className="h-12 w-12 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-900">Je suis enseignant</CardTitle>
              <CardDescription className="text-base">
                Crée et gère tes dictées
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button size="lg" variant="outline" className="w-full border-green-600 text-green-600 hover:bg-green-50">
                Espace enseignant
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>

      <footer className="mt-16 text-center text-gray-500 text-sm">
        <p>Conçu pour les élèves de 6ème</p>
      </footer>
    </div>
  );
}
