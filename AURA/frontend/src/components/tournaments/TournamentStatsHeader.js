"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, Maximize2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function TournamentStatsHeader({ tournamentName, category }) {
  const router = useRouter();

  return (
    <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
      <div className="flex items-center justify-between px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col items-center">
          <h1 className="text-lg font-bold">{tournamentName}</h1>
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <span>{category}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <Maximize2 className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
