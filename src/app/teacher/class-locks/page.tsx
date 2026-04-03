"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClassLocksManager from "@/components/class-locks-manager";

export default function ClassLocksPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-4 border-b bg-white flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="hover:bg-gray-100"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="font-semibold">Gestion des dictées</span>
      </div>
      <ClassLocksManager />
    </main>
  );
}
