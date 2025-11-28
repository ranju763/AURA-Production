"use client";

import { useState } from "react";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Image from "next/image";

export default function AddTeamDialog({
  teamA,
  teamB,
  onSelectTeam,
  side,
}) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedSide, setSelectedSide] = useState(null);

  const handleTeamSelect = (team, side) => {
    if (team && team.length >= 2) {
      // Store the selection and show confirmation
      setSelectedTeam(team);
      setSelectedSide(side);
      setConfirmOpen(true);
    }
  };

  const handleConfirm = () => {
    if (selectedTeam && selectedSide) {
      onSelectTeam(selectedSide, selectedTeam);
      setOpen(false);
      setConfirmOpen(false);
      setSelectedTeam(null);
      setSelectedSide(null);
    }
  };

  const handleCancel = () => {
    setConfirmOpen(false);
    setSelectedTeam(null);
    setSelectedSide(null);
  };


  // Determine team name for confirmation
  const getTeamName = (team) => {
    if (teamA.some((p) => p.id === team[0]?.id)) return "Team A";
    if (teamB.some((p) => p.id === team[0]?.id)) return "Team B";
    return "Team";
  };

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-white bg-[#ABD1C4] rounded-full hover:bg-[#9BC4B5]"
          >
            <Plus className="size-6 text-gray-800" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            Select Team for {side === "left" ? "Left Side" : "Right Side"}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4">
        <Tabs defaultValue="teamA" className="w-full">
          <TabsList className="mb-3 w-full">
            <TabsTrigger value="teamA" className="flex-1">
              Team A
            </TabsTrigger>
            <TabsTrigger value="teamB" className="flex-1">
              Team B
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teamA" className="space-y-2 mt-0">
            {teamA && teamA.length >= 2 ? (
              <>
                <div className="text-sm font-medium">Team A Members</div>
                <div className="flex gap-2 items-center justify-between">
                  <div className="flex gap-2">
                    {teamA.map((player) => (
                      <div
                        key={player.id}
                        className="mr-4 last:mr-0 capitalize"
                      >
                        {/* <div className="size-8 bg-green-200 rounded-full" /> */}
                        <Image src={player.photo_url} alt={player.name} width={32} height={32} className="rounded-full" />
                        <span className="text-sm">
                          {player.name || player.username || "Player"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleTeamSelect(teamA, side)}
                  >
                    Select Team A
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                Team A needs at least 2 players
              </div>
            )}
          </TabsContent>

          <TabsContent value="teamB" className="space-y-2 mt-0">
          {teamB && teamB.length >= 2 ? (
              <>
                <div className="text-sm font-medium">Team B Members</div>
                <div className="flex gap-2 items-center justify-between">
                  <div className="flex gap-2">
                    {teamB.map((player) => (
                      <div
                        key={player.id}
                        className="mr-4 last:mr-0 capitalize"
                      >
                        {/* <div className="size-8 bg-green-200 rounded-full" /> */}
                        <Image src={player.photo_url} alt={player.name} width={32} height={32} className="rounded-full" />
                        <span className="text-sm">
                          {player.name || player.username || "Player"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleTeamSelect(teamB, side)}
                  >
                    Select Team B
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                Team B needs at least 2 players
              </div>
            )}
          </TabsContent>
        </Tabs>
        </div>
      </DrawerContent>
    </Drawer>

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Team Selection</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to assign {selectedTeam ? getTeamName(selectedTeam) : "this team"} to the{" "}
            {selectedSide === "left" ? "left" : "right"} side? This will also automatically assign the other team to the opposite side.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
