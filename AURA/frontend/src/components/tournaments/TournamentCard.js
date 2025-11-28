"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { formatTime, formatDate } from "@/lib/utils";

export function TournamentCard({ tournament, index }) {
  const {
    id,
    name,
    start_date,
    end_date,
    registration_fee,
    venue,
    capacity,
    registered,
    match_format,
  } = tournament;

  // Helper function to check if tournament is live
  const isTournamentLive = () => {
    if (!start_date || !end_date) return false;
    const now = new Date();
    const startTime = new Date(start_date);
    const endTime = new Date(end_date);
    return now >= startTime && now <= endTime;
  };

  // Determine registration status
  const getStatusBadge = () => {
    if (isTournamentLive()) {
      return <Badge className="bg-red-100 text-red-700 animate-pulse">LIVE</Badge>;
    }
    if (registered) {
      return <Badge className="bg-green-100 text-green-700">REGISTERED</Badge>;
    }
    // You might want to add logic for CLOSED/OPEN based on capacity
    return <Badge className="bg-blue-100 text-blue-700">OPEN</Badge>;
  };

  const categoryLabel =
    match_format?.eligible_gender === "M"
      ? "Men's Doubles"
      : match_format?.eligible_gender === "W"
      ? "Women's Doubles"
      : "Mixed Doubles";

  // Calculate registered count (from backend or default to 0)
  const registeredCount = tournament.registered_count || 0;
  const progress = capacity > 0 ? (registeredCount / capacity) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: index * 0.1 }}
    >
      <Link href={`/tournaments/${id}`}>
        <Card className="overflow-hidden mb-4 py-0 gap-0">
          <div className="flex flex-row gap-0">
            {/* Image placeholder */}
            <div className="size-32 bg-gray-200 relative shrink-0">
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                {categoryLabel}
              </div>
              {getStatusBadge() && (
                <div className="absolute top-1 right-1">{getStatusBadge()}</div>
              )}
            </div>
            {/* Content */}
            <CardContent className="flex-1 p-3 space-y-1">
              <CardHeader className="p-0 gap-1">
                <CardTitle className="text-sm font-semibold">{name}</CardTitle>

                <div className="flex items-center text-xs text-gray-600 gap-2">
                  <span>Pickleball</span>
                </div>
              </CardHeader>

              <div className="flex items-center text-xs text-gray-600 gap-2">
                <Calendar className="size-3" />
                <span>{formatDate(start_date)}</span>
              </div>

              <div className="flex items-center text-xs text-gray-600 gap-2">
                <Clock className="size-3" />
                <span>
                  {formatTime(start_date)} - {formatTime(end_date)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-purple-600 font-semibold text-sm">
                  {registration_fee > 0 ? `${registration_fee} Rs` : "Free"}
                </div>

                <div className="flex items-center text-xs text-gray-600 gap-1">
                  <MapPin className="size-3" />
                  <span>{venue?.name || venue?.address || "Location TBD"}</span>
                </div>
              </div>
            </CardContent>
          </div>

          <CardFooter className="flex items-center gap-2 p-3">
            <Users className="size-6" />
            {/* Progress bar */}
            <Progress
              value={Math.min(progress, 100)}
              className="flex-1 h-2 bg-gray-200 [&>div]:bg-purple-600"
            />
            <span className="text-xs text-gray-600">
              {registeredCount}/{capacity}
            </span>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
}
