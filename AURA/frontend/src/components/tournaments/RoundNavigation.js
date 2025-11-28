"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function RoundNavigation({ rounds, selectedRound, onRoundChange }) {
  return (
    <div className="px-4 py-3 overflow-x-auto bg-white">
      <div className="flex gap-2">
        {rounds.map((round, index) => (
          <motion.div
            key={`round-${round}-${index}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
          >
            <Button
              variant={selectedRound === round ? "default" : "outline"}
              size="sm"
              onClick={() => onRoundChange(round)}
              className={
                selectedRound === round
                  ? "bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                  : "bg-white text-gray-700 border-gray-300 transition-colors"
              }
            >
              {round}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

