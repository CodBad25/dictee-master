"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import UnlockRequestsManager from "@/components/unlock-requests-manager";

export default function UnlockRequestsPage() {
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
        <span className="font-semibold">Demandes de déverrouillage</span>
      </div>
      <UnlockRequestsManager />
    </main>
  );
}
