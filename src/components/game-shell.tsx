'use client';
import {
  ADMIN_PASSWORD,
  COOKIE_EMOJIS,
  COOKIE_SIZES,
  NAME_SKIP_KEY,
  NAME_STORAGE_KEY,
  costOf,
  format,
  formatRate,
  MULTIPLIERS,
  perClick,
  perSecond,
  plural,
  totalUpgrades,
  UPGRADES,
  useClickerGame,
  type ClickerGameApi,
  type CookieSize,
  type GameState,
  type Upgrade,
} from "@/components/clicker-logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WelcomeGate } from "@/components/welcome-gate";
import { cn } from "@/lib/utils";
import { validateDisplayName } from "@/lib/name-filter";
import {
  BarChart3,
  Coins,
  Cookie,
  Database,
  Gamepad2,
  LoaderCircle,
  LockKeyhole,
  Monitor,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Settings,
  Shield,
  Sun,
  Trash2,
  Trophy,
  Wrench,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

// 🔊 ЗВУК ПРИ КЛИКЕ — стабильная версия для телефона и ПК
let audioContext: AudioContext | null = null;

function playClickSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;

    // Создаём контекст ОДИН раз, а не при каждом клике
    if (!audioContext) {
      audioContext = new AudioCtx();
    }

    // Возобновляем, если браузер приостановил звук
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const o = audioContext.createOscillator();
    const g = audioContext.createGain();

    o.connect(g);
    g.connect(audioContext.destination);

    o.frequency.value = 600 + Math.random() * 300;
    o.type = "sine";

    g.gain.setValueAtTime(0.25, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);

    o.start(audioContext.currentTime);
    o.stop(audioContext.currentTime + 0.08);
  } catch {}
}

const TABS = [
  { id: "game", label: "Игра", icon: Gamepad2 },
  { id: "leaders", label: "Лидеры", icon: Trophy },
  { id: "stats", label: "Стата", icon: BarChart3 },
  { id: "settings", label: "Настройки", icon: Settings },
  { id: "admin", label: "Админ", icon: Shield },
] as const;
type TabId = (typeof TABS)[number]["id"];
type NameGate = "checking" | "open" | "closed";
const MEDALS = ["🥇", "🥈", "🥉"] as const;
const COOKIE_SIZE_STYLES: Record<
  CookieSize,
  { button: string; emoji: string }
> = {
  small: { button: "size-44 sm:size-48", emoji: "text-6xl sm:text-7xl" },
  normal: { button: "size-52 sm:size-60", emoji: "text-8xl sm:text-9xl" },
  large: { button: "size-64 sm:size-80", emoji: "text-[7rem] sm:text-[10rem]" },
};
const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
export function GameShell() {
  const api = useClickerGame();
  const [active, setActive] = useState<TabId>("game");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [nameGate, setNameGate] = useState<NameGate>("checking");
  useEffect(() => {
    const timer = setTimeout(() => {
      let saved = "";
      let skipped = false;
      try {
        saved = (localStorage.getItem(NAME_STORAGE_KEY) ?? "").trim();
        skipped = localStorage.getItem(NAME_SKIP_KEY) === "1";
      } catch {}
      setNameGate(saved.length > 0 || skipped ? "closed" : "open");
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="w-full max-w-3xl">
      {active === "game" && <GamePanel api={api} />}
      {active === "leaders" && <LeaderboardPanel game={api.game} />}
      {active === "stats" && <StatsPanel game={api.game} />}
      {active === "settings" && (
        <SettingsPanel
          onReset={() => {
            api.reset();
            setActive("game");
          }}
        />
      )}
      {active === "admin" && (
        <AdminPanel
          api={api}
          unlocked={adminUnlocked}
          onUnlock={() => setAdminUnlocked(true)}
          onLock={() => setAdminUnlocked(false)}
          onReset={() => {
            api.reset();
            setActive("game");
          }}
        />
      )}
      <TabBar active={active} onChange={setActive} />
      {nameGate === "open" && <WelcomeGate onFinish={() => setNameGate("closed")} />}
    </div>
  );
}
type Pop = { id: number; x: number; y: number; text: string };
function GamePanel({ api }: { api: ClickerGameApi }) {
  const game = api.game;
  const [pops, setPops] = useState<Pop[]>([]);
  const [justBought, setJustBought] = useState<string | null>(null);
  const popId = useRef(0);
  const click = perClick(game);
  const cps = perSecond(game);
  const size = COOKIE_SIZE_STYLES[game.cookieSize];
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    playClickSound(); // 🔊 ЗВУК ПРИ КЛИКЕ
    const rect = event.currentTarget.getBoundingClientRect();
    const id = ++popId.current;
    api.click();
    setPops((prev) => [
      ...prev.slice(-20),
      {
        id,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        text: `+${format(click)}`,
      },
    ]);
    setTimeout(() => {
      setPops((prev) => prev.filter((p) => p.id !== id));
    }, 900);
  }
  function handleBuy(item: Upgrade) {
    api.buy(item);
    setJustBought(item.key);
    setTimeout(() => {
      setJustBought((key) => (key === item.key ? null : key));
    }, 400);
  }
  return (
    <div className="grid animate-panel-in items-start gap-8 md:grid-cols-[1fr_320px]">
      <section className="flex flex-col items-center gap-6 md:pt-6">
        <div className="relative">
          <div className="motion-safe:animate-cookie-idle">
            <button
              type="button"
              onClick={handleClick}
              aria-label="Печенька — нажми, чтобы получить печеньки"
              className={cn(
                "group grid touch-manipulation select-none place-items-center rounded-full border-4 border-amber-600/30 bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 shadow-xl shadow-amber-500/30 outline-none transition-transform duration-100 hover:scale-[1.03] active:scale-95 focus-visible:ring-4 focus-visible:ring-ring",
                size.button
              )}
            >
              <span
                className={cn(
                  "drop-shadow-sm transition-transform duration-100 group-active:scale-110",
                  size.emoji
                )}
              >
                {game.cookieEmoji}
              </span>
            </button>
          </div>
          {pops.map((pop) => (
            <span
              key={pop.id}
              style={{ left: pop.x, top: pop.y }}
              className="pointer-events-none absolute z-10 font-bold text-amber-600 motion-safe:animate-float-up motion-reduce:hidden dark:text-amber-300"
            >
              {pop.text}
            </span>
          ))}
        </div>
        <div className="text-center">
          <p className="text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
            {format(game.points)}
          </p>
          <p className="text-sm text-muted-foreground">
            {plural(Math.floor(game.points), [
              "печенька",
              "печеньки",
              "печенек",
            ])}
          </p>
          {game.multiplier > 1 && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
              <Zap className="size-3" aria-hidden /> Множитель ×
              {formatRate(game.multiplier)}
            </p>
          )}
        </div>
        <div className="grid w-full max-w-xs grid-cols-3 divide-x divide-border rounded-xl border bg-card text-center shadow-sm">
          <div className="px-2 py-3">
            <p className="text-lg font-semibold tabular-nums">{format(click)}</p>
            <p className="text-xs text-muted-foreground">за клик</p>
          </div>
          <div className="px-2 py-3">
            <p className="text-lg font-semibold tabular-nums">
              {formatRate(cps)}
            </p>
            <p className="text-xs text-muted-foreground">в секунду</p>
          </div>
          <div className="px-2 py-3">
            <p className="text-lg font-semibold tabular-nums">
              {format(game.totalClicks)}
            </p>
            <p className="text-xs text-muted-foreground">
              {plural(game.totalClicks, ["клик", "клика", "кликов"])}
            </p>
          </div>
        </div>
        {game.totalClicks === 0 && (
          <p className="text-sm font-medium text-muted-foreground">
            Нажми на печеньку!
          </p>
        )}
      </section>
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Cookie className="size-4" /> Магазин улучшений
        </h2>
        <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {UPGRADES.map((item) => {
            const count = game[item.key];
            const cost = costOf(item, count);
            const affordable = game.points >= cost;
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleBuy(item)}
                  disabled={!affordable}
                  className={cn(
                    "h-auto w-full justify-between px-3 py-2.5 text-left",
                    affordable && "border-amber-500/50 hover:border-amber-500",
                    justBought === item.key && "animate-buy-pop"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {item.name}
                        {count > 0 && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ×{count}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.desc}
                      </span>
                    </span>
                  </span>
                  <span className="ml-2 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {format(cost)}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          Прогресс сохраняется автоматически
        </p>
      </section>
    </div>
  );
}
type LeaderboardData = {
  entries: { name: string; score: number }[];
  total: number;
};
type LoadState = "loading" | "ready" | "error";
function LeaderboardPanel({ game }: { game: GameState }) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [name, setName] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageError, setMessageError] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as LeaderboardData;
      setData(json);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setName(localStorage.getItem(NAME_STORAGE_KEY) ?? "");
      } catch {}
      setNameLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.slice(0, 24);
    setName(value);
    if (nameLoaded) {
      try {
        localStorage.setItem(NAME_STORAGE_KEY, value);
      } catch {}
    }
  }
  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || sending) return;
    const check = validateDisplayName(trimmed);
    if (!check.ok) {
      setMessage(check.error);
      setMessageError(true);
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          score: Math.floor(game.totalEarned),
        }),
      });
      const json = (await res.json()) as { rank?: number | null; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Не удалось отправить результат");
      setMessage(
        typeof json.rank === "number" && json.rank > 0
          ? `Результат отправлен! Вы на ${json.rank} месте.`
          : "Результат отправлен!"
      );
      setMessageError(false);
      void load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось отправить результат");
      setMessageError(true);
    } finally {
      setSending(false);
    }
  }
  const ownName = name.trim().toLowerCase();
  return (
    <section className="animate-panel-in space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Trophy className="size-4" /> Мой результат
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="text"
            value={name}
            onChange={handleNameChange}
            maxLength={24}
            placeholder="Ваше имя"
            aria-label="Имя для лидерборда"
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={sending || name.trim().length === 0}
            className="sm:w-48"
          >
            {sending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            Отправить счёт
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          В зачёт идёт «всего заработано»:{" "}
          <span className="font-semibold text-foreground">
            {format(game.totalEarned)}
          </span>{" "}
          {plural(Math.floor(game.totalEarned), [
            "печенька",
            "печеньки",
            "печенек",
          ])}
          . Повторная отправка обновляет результат, только если он стал лучше.
        </p>
        {message && (
          <p
            role="status"
            className={cn(
              "mt-2 text-sm font-medium",
              messageError ? "text-destructive" : "text-foreground"
            )}
          >
            {message}
          </p>
        )}
      </div>
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Trophy className="size-4" /> Топ-50 игроков
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoadState("loading");
              void load();
            }}
            disabled={loadState === "loading"}
          >
            <RefreshCw
              className={cn("size-4", loadState === "loading" && "animate-spin")}
              aria-hidden
            />
            Обновить
          </Button>
        </div>
        {loadState === "loading" && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Загружаем лидерборд…
          </p>
        )}
        {loadState === "error" && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Не удалось загрузить лидерборд. Попробуйте ещё раз.
          </p>
        )}
        {loadState === "ready" && data && data.entries.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Пока никто не отправил результат. Станьте первым!
          </p>
        )}
        {loadState === "ready" && data && data.entries.length > 0 && (
          <ol className="space-y-1.5">
            {data.entries.map((entry, index) => {
              const isOwn =
                ownName !== "" && entry.name.toLowerCase() === ownName;
              return (
                <li
                  key={`${entry.name}-${index}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2",
                    isOwn
                      ? "border-amber-500/60 bg-amber-500/10"
                      : "bg-background/50"
                  )}
                >
                  <span className="w-8 shrink-0 text-center text-sm font-semibold tabular-nums">
                    {MEDALS[index] ?? index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {entry.name}
                    {isOwn && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        (вы)
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {format(entry.score)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {loadState === "ready" && data && data.total > data.entries.length && (
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            Показаны лучшие {data.entries.length} из {data.total} игроков
          </p>
        )}
      </div>
    </section>
  );
}
function StatsPanel({ game }: { game: GameState }) {
  const upgradesBought = totalUpgrades(game);
  const stats: { label: string; value: string }[] = [
    { label: "Баланс", value: format(game.points) },
    { label: "Сделано кликов", value: format(game.totalClicks) },
    { label: "Печенек за клик", value: format(perClick(game)) },
    { label: "Печенек в секунду", value: formatRate(perSecond(game)) },
    { label: "Печенек в минуту", value: formatRate(perSecond(game) * 60) },
    { label: "Куплено улучшений", value: String(upgradesBought) },
  ];
  if (game.multiplier > 1) {
    stats.push({ label: "Множитель", value: `×${formatRate(game.multiplier)}` });
  }
  return (
    <section className="animate-panel-in space-y-4">
      <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">Всего заработано</p>
        <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
          {format(game.totalEarned)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {plural(Math.floor(game.totalEarned), [
            "печенька",
            "печеньки",
            "печенек",
          ])}{" "}
          за всё время
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            style={{ animationDelay: `${index * 40}ms` }}
            className="animate-panel-in rounded-xl border bg-card p-4 shadow-sm"
          >
            <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
const THEME_OPTIONS = [
  { id: "light", label: "Светлая", icon: Sun },
  { id: "dark", label: "Тёмная", icon: Moon },
  { id: "system", label: "Системная", icon: Monitor },
] as const;
function SettingsPanel({ onReset }: { onReset: () => void }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const activeTheme = mounted ? (theme ?? "system") : "system";
  return (
    <section className="animate-panel-in space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Palette className="size-4" /> Внешний вид
        </h2>
        <div
          role="group"
          aria-label="Тема оформления"
          className="grid grid-cols-3 gap-2"
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = activeTheme === option.id;
            return (
              <Button
                key={option.id}
                type="button"
                variant={isActive ? "default" : "outline"}
                onClick={() => setTheme(option.id)}
                aria-pressed={isActive}
                className="h-auto flex-col gap-1 py-3"
              >
                <Icon className="size-4" />
                <span className="text-xs">{option.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Database className="size-4" /> Данные
        </h2>
        <p className="text-sm text-muted-foreground">
          Прогресс хранится в этом браузере и сохраняется автоматически.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-3"
          onClick={() => {
            if (window.confirm("Точно сбросить весь прогресс?")) onReset();
          }}
        >
          <RotateCcw className="size-4" /> Сбросить прогресс
        </Button>
      </div>
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Cookie className="size-4" /> Об игре
        </h2>
        <p className="text-sm font-semibold">
          By:{" "}
          <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            SqwoZz
          </span>
          <span className="text-muted-foreground"> (aka ломалио)</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Мини-кликер: жми печеньку, копи печеньки и покупай улучшения.
          Написан на React и Tailwind, без игровых движков.
        </p>
      </div>
    </section>
  );
}
const POINT_PRESETS = [
  { amount: 1_000, label: "+1 тыс" },
  { amount: 100_000, label: "+100 тыс" },
  { amount: 1_000_000, label: "+1 млн" },
  { amount: 100_000_000, label: "+100 млн" },
  { amount: 1_000_000_000, label: "+1 млрд" },
] as const;
function AdminPanel({
  api,
  unlocked,
  onUnlock,
  onLock,
  onReset,
}: {
  api: ClickerGameApi;
  unlocked: boolean;
  onUnlock: () => void;
  onLock: () => void;
  onReset: () => void;
}) {
  if (!unlocked) return <AdminLogin onUnlock={onUnlock} />;
  return <AdminControls api={api} onLock={onLock} onReset={onReset} />;
}
function AdminLogin({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState(false);
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (value.trim() === ADMIN_PASSWORD) {
      onUnlock();
      return;
    }
    setError(true);
    setAttempts((n) => n + 1);
    setValue("");
  }
  return (
    <section className="animate-panel-in mx-auto max-w-sm pt-6">
      <form
        key={attempts}
        onSubmit={handleSubmit}
        className={cn(
          "space-y-4 rounded-2xl border bg-card p-6 text-center shadow-sm",
          error && "animate-shake"
        )}
      >
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-secondary">
          <LockKeyhole className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Админ-панель</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Введите пароль администратора
          </p>
        </div>
        <Input
          type="password"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(false);
          }}
          placeholder="Пароль"
          aria-label="Пароль администратора"
          aria-invalid={error}
        />
        {error && (
          <p className="text-sm font-medium text-destructive">
            Неверный пароль
          </p>
        )}
        <Button type="submit" className="w-full">
          Войти
        </Button>
        <p className="text-xs text-muted-foreground">
          Шутливая защита: пароль проверяется только в вашем браузере.
        </p>
      </form>
    </section>
  );
}
function AdminControls({
  api,
  onLock,
  onReset,
}: {
  api: ClickerGameApi;
  onLock: () => void;
  onReset: () => void;
}) {
  const game = api.game;
  const [amount, setAmount] = useState("1000");
  const parsed = Number(amount.replace(/\s/g, "").replace(",", "."));
  const validAmount = amount.trim() !== "" && Number.isFinite(parsed);
  const [clearingBoard, setClearingBoard] = useState(false);
  const [boardMessage, setBoardMessage] = useState<string | null>(null);
  const [boardError, setBoardError] = useState(false);
  async function clearBoard() {
    if (clearingBoard) return;
    if (!window.confirm("Удалить ВСЕ результаты из лидерборда?")) return;
    setClearingBoard(true);
    setBoardMessage(null);
    try {
      const res = await fetch("/api/leaderboard", {
        method: "DELETE",
        headers: { "x-admin-password": ADMIN_PASSWORD },
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Не удалось очистить лидерборд");
      setBoardMessage("Лидерборд очищен");
      setBoardError(false);
    } catch (err) {
      setBoardMessage(
        err instanceof Error
          ? err.message
          : "Не удалось очистить лидерборд"
      );
      setBoardError(true);
    } finally {
      setClearingBoard(false);
    }
  }
  return (
    <section className="animate-panel-in space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Shield className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold leading-tight">Админ-панель</h2>
            <p className="text-xs text-muted-foreground">
              Доступ открыт. Изменения сохраняются автоматически.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onLock}>
          <LockKeyhole className="size-4" /> Выйти
        </Button>
      </div>
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Coins className="size-4" /> Печеньки
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {POINT_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="secondary"
              className="h-auto px-2 py-2 text-xs"
              onClick={() => api.givePoints(preset.amount)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Своя сумма, можно с минусом"
            aria-label="Сумма печенек"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1 sm:w-28"
              disabled={!validAmount || parsed === 0}
              onClick={() => api.givePoints(parsed)}
            >
              Выдать
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:w-40"
              disabled={!validAmount || parsed < 0}
              onClick={() => api.setPoints(parsed)}
            >
              Установить баланс
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Отрицательная сумма забирает печеньки, но баланс не уходит ниже нуля.
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Wrench className="size-4" /> Улучшения
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              UPGRADES.forEach((item) => api.grantUpgrade(item));
            }}
          >
            <Plus className="size-4" /> По +1 ко всем
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (window.confirm("Обнулить все улучшения?")) api.resetUpgrades();
            }}
          >
            Обнулить улучшения
          </Button>
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Zap className="size-4" /> Множитель дохода
        </h3>
        <div
          role="group"
          aria-label="Множитель дохода"
          className="grid grid-cols-5 gap-2"
        >
          {MULTIPLIERS.map((value) => {
            const isActive = game.multiplier === value;
            return (
              <Button
                key={value}
                type="button"
                variant={isActive ? "default" : "outline"}
                aria-pressed={isActive}
                className="px-0"
                onClick={() => api.setMultiplier(value)}
              >
                ×{value}
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Влияет и на клик, и на пассивный доход.
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Palette className="size-4" /> Вид печеньки
        </h3>
        <div
          role="group"
          aria-label="Эмодзи печеньки"
          className="flex flex-wrap gap-2"
        >
          {COOKIE_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => api.setAppearance({ cookieEmoji: emoji })}
              aria-pressed={game.cookieEmoji === emoji}
              aria-label={`Печенька ${emoji}`}
              className={cn(
                "grid size-11 place-items-center rounded-xl border text-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                game.cookieEmoji === emoji
                  ? "border-amber-500 bg-amber-500/10"
                  : "hover:bg-accent"
              )}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label="Размер печеньки"
          className="mt-3 grid grid-cols-3 gap-2"
        >
          {COOKIE_SIZES.map((sizeOption) => {
            const isActive = game.cookieSize === sizeOption.id;
            return (
              <Button
                key={sizeOption.id}
                type="button"
                variant={isActive ? "default" : "outline"}
                aria-pressed={isActive}
                className="h-auto py-2 text-xs"
                onClick={() =>
                  api.setAppearance({ cookieSize: sizeOption.id })
                }
              >
                {sizeOption.label}
              </Button>
            );
          })}
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Trophy className="size-4" /> Лидерборд
        </h3>
        <p className="text-sm text-muted-foreground">
          Очистка удалит результаты всех игроков с сервера. Это действие нельзя отменить.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-3"
          disabled={clearingBoard}
          onClick={() => void clearBoard()}
        >
          {clearingBoard ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
          Очистить лидерборд
        </Button>
        {boardMessage && (
          <p
            role="status"
            className={cn(
              "mt-2 text-sm font-medium",
              boardError ? "text-destructive" : "text-foreground"
            )}
          >
            {boardMessage}
          </p>
        )}
      </div>
      <div className="rounded-2xl border border-destructive/40 bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-destructive">
          <RotateCcw className="size-4" /> Опасная зона
        </h3>
        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            if (window.confirm("Точно обнулить весь прогресс?")) onReset();
          }}
        >
          <RotateCcw className="size-4" /> Сбросить весь прогресс
        </Button>
      </div>
    </section>
  );
}
function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav
      aria-label="Разделы игры"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4"
    >
      <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] gap-1 overflow-x-auto rounded-2xl border bg-card/95 p-1.5 shadow-lg backdrop-blur">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex select-none flex-col items-center gap-0.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:px-5",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-5" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
