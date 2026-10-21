import { GameShell } from "@/components/game-shell";

export default function IndexPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden>🍪</span> Кликер
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 pb-28 pt-2 sm:px-6">
        <GameShell />
      </main>
    </div>
  );
}
