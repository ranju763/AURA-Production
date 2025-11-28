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

export default function ScoreDrawer({
  isLoading,
  teamId,
  teamName,
  currentScore,
  onConfirm,
  trigger,
}) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleIncrement = () => {
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    onConfirm(teamId);
    setOpen(false);
    setConfirmOpen(false);
  };

  const handleCancel = () => {
    setConfirmOpen(false);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add Score - {teamName}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-2">Current Score</div>
                <div className="text-4xl font-bold">{currentScore}</div>
              </div>
              <div className="text-sm text-gray-600 text-center mb-4">
                Click the button below to increment the score by 1
              </div>
              <Button
                onClick={handleIncrement}
                className="w-full"
                size="lg"
                variant="default"
              >
                <Plus className="size-5 mr-2" />
                Increment Score
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Score Update</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to increment {teamName}'s score from {currentScore} to{" "}
              {currentScore + 1}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isLoading} onClick={handleConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

