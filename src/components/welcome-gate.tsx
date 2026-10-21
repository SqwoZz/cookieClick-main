"use client";

import { NAME_SKIP_KEY, NAME_STORAGE_KEY } from "@/components/clicker-logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { validateDisplayName } from "@/lib/name-filter";
import { useEffect, useRef, useState } from "react";

// First-launch screen: asks for a nickname before the game starts. The name
// is shared with the leaderboard tab (same storage key).
export function WelcomeGate({ onFinish }: { onFinish: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  function fail(message: string) {
    setError(message);
    setAttempts((n) => n + 1);
  }

  function play() {
    const trimmed = name.trim();
    if (!trimmed) {
      fail("Введите имя, чтобы вас узнали другие игроки");
      return;
    }
    const check = validateDisplayName(trimmed);
    if (!check.ok) {
      fail(check.error);
      return;
    }
    try {
      localStorage.setItem(NAME_STORAGE_KEY, trimmed);
      localStorage.removeItem(NAME_SKIP_KEY);
    } catch {
      // Storage unavailable — the name just won't survive a reload.
    }
    onFinish();
  }

  function skip() {
    try {
      localStorage.setItem(NAME_SKIP_KEY, "1");
    } catch {
      // Storage unavailable — the question reappears on the next visit.
    }
    onFinish();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Знакомство"
      className="fixed inset-0 z-[60] grid place-items-center bg-background/95 p-4 backdrop-blur"
    >
      <div
        key={attempts}
        className={cn(
          "w-full max-w-sm animate-panel-in rounded-2xl border bg-card p-6 text-center shadow-xl",
          error && "animate-shake"
        )}
      >
        <span
          aria-hidden
          className="mx-auto mb-4 grid size-16 place-items-center rounded-full border-4 border-amber-600/30 bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-4xl shadow-lg shadow-amber-500/30"
        >
          🍪
        </span>
        <h2 className="text-xl font-bold">Добро пожаловать в Кликер!</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Как вас зовут? Это имя увидят другие игроки в таблице лидеров.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            play();
          }}
          className="mt-5 space-y-3"
        >
          <Input
            ref={inputRef}
            type="text"
            value={name}
            maxLength={24}
            placeholder="Ваше имя"
            aria-label="Ваше имя"
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setName(event.target.value.slice(0, 24));
              setError(null);
            }}
          />
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full">
            Играть
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={skip}
          >
            Пропустить
          </Button>
        </form>
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          Имя можно поменять позже во вкладке «Лидеры»
        </p>
      </div>
    </div>
  );
}
