"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount, type DeleteState } from "./actions";

export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteMyAccount, { error: null });

  if (!open) {
    return (
      <Button variant="destructive" className="h-11 w-full" onClick={() => setOpen(true)}>
        Delete my account…
      </Button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <Label htmlFor="confirm" className="text-sm">
        I-type ang <strong>DELETE</strong> para i-confirm:
      </Label>
      <Input
        id="confirm"
        name="confirm"
        autoComplete="off"
        autoCapitalize="characters"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        aria-describedby="delete-warning"
      />
      <p id="delete-warning" className="text-sm text-muted-foreground">
        Hindi na ito maibabalik (this can&apos;t be undone).
      </p>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="destructive" className="h-11 w-full" disabled={pending || typed.trim() !== "DELETE"}>
        {pending ? "Deleting..." : "Permanently delete my account"}
      </Button>
      <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setOpen(false)} disabled={pending}>
        Cancel
      </Button>
    </form>
  );
}
