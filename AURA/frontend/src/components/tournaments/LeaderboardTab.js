"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

// Skeleton loader for leaderboard
function LeaderboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top 3 Skeleton */}
      <div className="flex items-end justify-center gap-3 mb-6">
        {[2, 1, 3].map((position) => (
          <div key={position} className="flex flex-col items-center">
            <div className="relative mb-2">
              <Skeleton
                className={`rounded-full ${
                  position === 1 ? "size-24" : "size-20"
                }`}
              />
              <Skeleton className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 size-7 rounded-full" />
            </div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
        ))}
      </div>
      {/* Remaining players skeleton */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((index) => (
          <Card key={index} className="p-3">
            <div className="flex items-center gap-3">
              {/* Rank badge skeleton */}
              <Skeleton className="size-8 rounded-full" />
              {/* Avatar skeleton */}
              <Skeleton className="size-10 rounded-full" />
              {/* Name skeleton */}
              <Skeleton className="h-4 flex-1" />
              {/* Points badge skeleton */}
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function LeaderboardTab({ topThree, remaining, isLoading }) {
  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  if (topThree.length === 0 && remaining.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center text-gray-500 py-8"
      >
        No leaderboard data available for this round
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Top 3 Display */}
      {topThree.length > 0 && (
        <div className="flex items-end justify-center gap-3 mb-6">
          {/* 2nd Place - Left */}
          {topThree[1] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="flex flex-col items-center"
            >
              <div className="relative mb-2">
                <Badge className="absolute -top-1 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white px-2 py-0.5 rounded-full text-xs font-medium z-10">
                  AURA: {topThree[1].aura ? topThree[1].aura.toFixed(1) : topThree[1].aura_mu ? topThree[1].aura_mu.toFixed(1) : "N/A"}
                </Badge>
                <div className="w-20 h-20 bg-linear-to-b from-white to-gray-300 rounded-full" />
                <Badge className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white w-7 h-7 flex items-center justify-center p-0 rounded-full text-xs font-bold">
                  2
                </Badge>
              </div>
              <p className="text-sm font-medium text-center mb-1 max-w-[80px]">
                {topThree[1].name || topThree[1].username}
              </p>
              <Badge className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs">
                {topThree[1].wins || 0}pts
              </Badge>
            </motion.div>
          )}

          {/* 1st Place - Center (tallest) */}
          {topThree[0] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="flex flex-col items-center"
            >
              <div className="relative mb-2">
                <Badge className="absolute -top-1 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white px-2 py-0.5 rounded-full text-xs font-medium z-10">
                  AURA: {topThree[0].aura ? topThree[0].aura.toFixed(1) : topThree[0].aura_mu ? topThree[0].aura_mu.toFixed(1) : "N/A"}
                </Badge>
                <div className="w-24 h-24 bg-linear-to-b from-white to-gray-300 rounded-full" />
                <Badge className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white w-7 h-7 flex items-center justify-center p-0 rounded-full text-xs font-bold">
                  1
                </Badge>
              </div>
              <p className="text-sm font-medium text-center mb-1 max-w-[90px]">
                {topThree[0].name || topThree[0].username}
              </p>
              <Badge className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs">
                {topThree[0].wins || 0}pts
              </Badge>
            </motion.div>
          )}

          {/* 3rd Place - Right */}
          {topThree[2] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="flex flex-col items-center"
            >
              <div className="relative mb-2">
                <Badge className="absolute -top-1 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white px-2 py-0.5 rounded-full text-xs font-medium z-10">
                  AURA: {topThree[2].aura ? topThree[2].aura.toFixed(1) : topThree[2].aura_mu ? topThree[2].aura_mu.toFixed(1) : "N/A"}
                </Badge>
                <div className="w-20 h-20 bg-linear-to-b from-white to-gray-300 rounded-full" />
                <Badge className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white w-7 h-7 flex items-center justify-center p-0 rounded-full text-xs font-bold">
                  3
                </Badge>
              </div>
              <p className="text-sm font-medium text-center mb-1 max-w-[80px]">
                {topThree[2].name || topThree[2].username}
              </p>
              <Badge className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs">
                {topThree[2].wins || 0}pts
              </Badge>
            </motion.div>
          )}
        </div>
      )}

      {/* Remaining Players */}
      <div className="space-y-2">
        {remaining.map((player, index) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + index * 0.05, duration: 0.2 }}
          >
            <Card className="p-3">
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 border-gray-300"
                >
                  {index + 4}
                </Badge>
                <div className="w-10 h-10 bg-linear-to-b from-white to-gray-300 rounded-full" />
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {player.name || player.username}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-gray-600 bg-gray-50 border-gray-300"
                >
                  {player.wins || 0}pts
                </Badge>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
