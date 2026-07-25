import { useState } from "react";

import { AppearanceFields } from "@/components/settings-page.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import type { AppearanceSettings } from "@/lib/appearance.ts";
import { desktop } from "@/lib/desktop.ts";

export function Onboarding({
  initialAppearance,
  suggestedPath,
  onSaveAppearance,
  onComplete,
}: {
  initialAppearance: AppearanceSettings;
  suggestedPath: string;
  onSaveAppearance(settings: AppearanceSettings): boolean;
  onComplete(notesPath: string): void;
}) {
  const [appearance, setAppearance] = useState(initialAppearance);
  const [notesPath, setNotesPath] = useState(suggestedPath);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const changeAppearance = (next: AppearanceSettings) => {
    setAppearance(next);
    onSaveAppearance(next);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await desktop.appConfigSet({ notesPath });
      onComplete(result.notesPath);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "That folder could not be used.",
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="flex h-screen items-center justify-center overflow-y-auto bg-background p-6 text-foreground">
      <div className="w-full max-w-2xl space-y-8 py-10">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Welcome to Dyno Notes
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Pick a look and a place to keep your notes. You can change the look
            anytime in Settings.
          </p>
        </div>

        <AppearanceFields settings={appearance} onChange={changeAppearance} />

        <Card className="gap-5 shadow-none">
          <CardHeader>
            <CardTitle>Notes folder</CardTitle>
            <CardDescription>
              This folder will be created if it doesn't exist yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={notesPath}
              onChange={(event) => {
                setNotesPath(event.target.value);
                setError(null);
              }}
              placeholder={suggestedPath}
              aria-label="Notes folder path"
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            disabled={submitting || !notesPath.trim()}
            onClick={() => void submit()}
          >
            {submitting ? "Setting up…" : "Get started"}
          </Button>
        </div>
      </div>
    </main>
  );
}
