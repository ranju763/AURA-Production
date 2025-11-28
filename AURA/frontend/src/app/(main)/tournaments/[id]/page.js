"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTournament } from "@/hooks/useTournament";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tournamentsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  ArrowLeft,
  MoreVertical,
  Phone,
  MapPin,
  Clock,
  Calendar,
  Users,
  Star,
} from "lucide-react";
import { formatTime, formatDateWithDay } from "@/lib/utils";
import {
  ScrollablePage,
  ScrollablePageHeader,
  ScrollablePageContent,
} from "@/components/layout/ScrollablePage";
import { toast } from "sonner";

export default function TournamentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: tournament, isLoading } = useTournament(params.id);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const registrationMutation = useMutation({
    mutationFn: () => tournamentsApi.register(params.id),
    onSuccess: () => {
      toast.success("Successfully registered for tournament!");
      setIsDrawerOpen(false);
      // Invalidate and refetch tournament data to update registration status
      queryClient.invalidateQueries({ queryKey: ["tournament", params.id] });
    },
    onError: (error) => {
      const errorMessage =
        error?.response?.data?.message || "Failed to register for tournament";
      toast.error(errorMessage);
    },
  });

  if (isLoading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (!tournament) {
    return <div className="p-4 text-center">Tournament not found</div>;
  }

  const {
    name,
    start_date,
    end_date,
    venue,
    description,
    hosted_by,
    referee,
    capacity,
    match_format,
    registration_fee,
    registered_count,
    registered_players,
    image_url,
  } = tournament;

  const category =
    match_format?.eligible_gender === "M"
      ? "Men's Doubles"
      : match_format?.eligible_gender === "W"
      ? "Women's Doubles"
      : "Mixed Doubles";

  const registeredCount = registered_count || 0;
  const progress = capacity > 0 ? (registeredCount / capacity) * 100 : 0;

  return (
    <ScrollablePage>
      <ScrollablePageHeader>
        <header className="sticky top-0 bg-white border-b z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-lg font-bold">Tournaments</h1>
            <Button variant="ghost" size="icon">
              <MoreVertical className="size-5" />
            </Button>
          </div>
        </header>
      </ScrollablePageHeader>

      <ScrollablePageContent className="space-y-4">
        {/* Tournament Image */}
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-[412px] object-cover rounded-b-3xl"
          />
        ) : (
          <div className="w-full h-[412px] bg-gray-200 rounded-b-3xl" />
        )}

        {/* Tournament Overview Card */}
        <Card className="mx-4 p-4 gap-4 -mt-12">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-1">{name}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Pickleball</span>
              <span>·</span>
              <span>{category}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="size-4" />
              <span>Durations</span>
              <span className="ml-auto">
                {formatTime(start_date)} - {formatTime(end_date)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="size-4" />
              <span>Date</span>
              <span className="ml-auto">{formatDateWithDay(start_date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="size-4" />
              <span>Players</span>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <span className="text-xs">
                  {registeredCount}/{capacity}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Venue Section */}
        <div className="mx-4">
          <h3 className="font-bold text-lg mb-2">Venue</h3>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <p className="font-medium">{venue?.name || "Venue TBD"}</p>
                <p className="text-sm text-gray-600">
                  {venue?.address || "Address TBD"}
                </p>
              </div>
              <Button variant="ghost" size="icon">
                <MapPin className="size-5" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Description Section */}
        <div className="mx-4">
          <h3 className="font-bold text-lg mb-2">Description</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {description ||
              "Proin lobortis porttitor leo sed mattis. Aliq vul convallis mauris, at dictum elit feugiat. Praesent in nulla porttitor, lobortis."}
          </p>
        </div>

        {/* Hosted By Section */}
        {hosted_by && (
          <div className="mx-4">
            <h3 className="font-bold text-lg mb-2">Hosted By</h3>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                {hosted_by.photo_url ? (
                  <img
                    src={hosted_by.photo_url}
                    alt={hosted_by.name || "Host"}
                    className="size-12 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="size-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-600">
                      {(hosted_by.name || "H")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium">{hosted_by.name}</p>
                  <p className="text-sm text-gray-600">Host</p>
                </div>
                {/* <Button variant="ghost" size="icon">
                  <Phone className="size-5" />
                </Button> */}
              </div>
            </Card>
          </div>
        )}

        {/* Referees Section */}
        {referee && referee.length > 0 && (
          <div className="mx-4">
            <h3 className="font-bold text-lg mb-2">Referee&apos;s</h3>
            <div className="space-y-2">
              {referee.map((ref, index) => (
                <Card key={ref.id || index} className="p-4">
                  <div className="flex items-center gap-3">
                    {ref.photo_url ? (
                      <img
                        src={ref.photo_url}
                        alt={ref.name || "Referee"}
                        className="size-12 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="size-12 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-600">
                          {(ref.name || "R")[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{ref.name}</p>
                      <p className="text-sm text-gray-600">
                        {ref.role || "Referee"}
                      </p>
                    </div>
                    {/* <Button variant="ghost" size="icon">
                      <Phone className="size-5" />
                    </Button> */}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Players Section */}
        <div className="mx-4">
          <h3 className="font-bold text-lg mb-2">Players</h3>
          <div className="space-y-2">
            {registered_players && registered_players.length > 0 ? (
              registered_players.map((player) => (
                <Card key={player.id} className="p-4">
                  <div className="flex items-center gap-3">
                    {player.photo_url ? (
                      <img
                        src={player.photo_url}
                        alt={player.name || player.username || "Player"}
                        className="size-12 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="size-12 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-600">
                          {(player.name || player.username || "P")[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">
                        {player.name || player.username}
                      </p>
                      <p className="text-sm text-gray-600">
                        {player.aura
                          ? `${player.aura.toFixed(1)} AURA`
                          : "No rating"}
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-4">
                <div className="text-center text-gray-500 text-sm">
                  No players registered yet
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Book Now / Show Stats Button */}
        <div className="sticky bottom-0 border-t bg-white p-4">
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              const startTime = new Date(start_date);
              const now = new Date();
              const isRegistered = tournament?.registered;

              if (isRegistered || startTime <= now) {
                router.push(`/tournaments/${params.id}/stats`);
              } else {
                setIsDrawerOpen(true);
              }
            }}
            disabled={registrationMutation.isPending}
          >
            {tournament?.registered
              ? "SHOW STATS"
              : new Date(start_date) <= new Date()
              ? "SHOW STATS"
              : "BOOK NOW"}
          </Button>
        </div>
      </ScrollablePageContent>

      {/* Registration Confirmation Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Confirm Registration</DrawerTitle>
            <DrawerDescription>
              Are you sure you want to register for {name}?
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 py-2 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Tournament:</span>
              <span className="font-medium">{name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Date:</span>
              <span className="font-medium">
                {formatDateWithDay(start_date)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Time:</span>
              <span className="font-medium">
                {formatTime(start_date)} - {formatTime(end_date)}
              </span>
            </div>
            {registration_fee > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Registration Fee:</span>
                <span className="font-medium">
                  ${registration_fee.toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <DrawerFooter>
            <Button
              onClick={() => registrationMutation.mutate()}
              disabled={registrationMutation.isPending}
              className="w-full"
              size="lg"
            >
              {registrationMutation.isPending
                ? "Registering..."
                : "Confirm Registration"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsDrawerOpen(false)}
              disabled={registrationMutation.isPending}
              className="w-full"
            >
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </ScrollablePage>
  );
}
