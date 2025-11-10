"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DisconnectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  accountEmail: string | null;
}

export default function DisconnectDialog({
  isOpen,
  onClose,
  onConfirm,
  accountEmail,
}: DisconnectDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disconnect Gmail Account</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove{" "}
            <span className="font-medium text-red-500">{accountEmail}</span>{" "}
            from your connected accounts? You can reconnect it anytime later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            Disconnect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
