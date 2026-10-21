import { useCallback, useEffect, useState } from "react";
import {
  ChefHat,
  Factory,
  Mouse,
  MousePointerClick,
  Orbit,
  Sparkles,
  Store,
  Wheat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const STORAGE_KEY = "clicker-save-v1";

// Nickname for the leaderboard + a marker for players who skipped onboarding.
export const NAME_STORAGE_KEY = "clicker-name-v1";
export const NAME_SKIP_KEY = "clicker-name-skip-v1";

export { ADMIN_PASSWORD } from "@/lib/admin";

export const COOKIE_EMOJIS = ["🍪", "🍩", "🥠", "🧁", "🍫"] as const;

export const MULTIPLIERS = [1, 2, 5, 10, 50] as const;

export const COOKIE_SIZES = [
  { id: "small", label: "Компактная" },
  { id: "normal", label: "Обычная" },
  { id: "large", label: "Огромная" },
] as const;

export type CookieSize = (typeof COOKIE_SIZES)[number]["id"];

export type GameState = {
  points: number;
  totalClicks: number;
  totalEarned: number;
  clickLevel: number;
  cursorLevel: number;
  helpers: number;
  farms: number;
  grandmas: number;
  bakeries: number;
  factories: number;
  portals: number;
  multiplier: number;
  cookieEmoji: string;
  cookieSize: CookieSize;
};

export const INITIAL_STATE: GameState = {
  points: 0,
  totalClicks: 0,
  totalEarned: 0,
  clickLevel: 0,
  cursorLevel: 0,
  helpers: 0,
  farms: 0,
  grandmas: 0,
  bakeries: 0,
  factories: 0,
  portals: 0,
  multiplier: 1,
  cookieEmoji: "🍪",
  cookieSize: "normal",
};

export type UpgradeKey =
  | "clickLevel"
  | "cursorLevel"
  | "helpers"
  | "farms"
  | "grandmas"
  | "bakeries"
  | "factories"
  | "portals";

export type Upgrade = {
  key: UpgradeKey;
  name: string;
  desc: string;
  icon: LucideIcon;
  baseCost: number;
  growth: number;
};

export const UPGRADES: Upgrade[] = [
  {
    key: "clickLevel",
    name: "Крепкий палец",
    desc: "+1 печенька за клик",
    icon: MousePointerClick,
    baseCost: 20,
    growth: 1.6,
  },
  {
    key: "cursorLevel",
    name: "Магический курсор",
    desc: "+5 печенек за клик",
    icon: Sparkles,
    baseCost: 300,
    growth: 1.7,
  },
  {
    key: "helpers",
    name: "Мышка-помощник",
    desc: "+1 печенька/сек",
    icon: Mouse,
    baseCost: 50,
    growth: 1.5,
  },
  {
    key: "farms",
    name: "Печенье-ферма",
    desc: "+6 печенек/сек",
    icon: Wheat,
    baseCost: 500,
    growth: 1.5,
  },
  {
    key: "grandmas",
    name: "Бабушка-пекарь",
    desc: "+12 печенек/сек",
    icon: ChefHat,
    baseCost: 2500,
    growth: 1.5,
  },
  {
    key: "bakeries",
    name: "Пекарня",
    desc: "+40 печенек/сек",
    icon: Store,
    baseCost: 12000,
    growth: 1.5,
  },
  {
    key: "factories",
    name: "Печенье-завод",
    desc: "+150 печенек/сек",
    icon: Factory,
    baseCost: 60000,
    growth: 1.5,
  },
  {
    key: "portals",
    name: "Портал в печенье",
    desc: "+600 печенек/сек",
    icon: Orbit,
    baseCost: 400000,
    growth: 1.5,
  },
];

export function costOf(item: Upgrade, count: number): number {
  return Math.round(item.baseCost * item.growth ** count);
}

export function perClick(state: GameState): number {
  return Math.round(
    (1 + state.clickLevel + state.cursorLevel * 5) * state.multiplier
  );
}

export function perSecond(state: GameState): number {
  const base =
    state.helpers +
    state.farms * 6 +
    state.grandmas * 12 +
    state.bakeries * 40 +
    state.factories * 150 +
    state.portals * 600;
  return base * state.multiplier;
}

export function totalUpgrades(state: GameState): number {
  return (
    state.clickLevel +
    state.cursorLevel +
    state.helpers +
    state.farms +
    state.grandmas +
    state.bakeries +
    state.factories +
    state.portals
  );
}

const SHORT_UNITS: { limit: number; suffix: string }[] = [
  { limit: 1e12, suffix: " трлн" },
  { limit: 1e9, suffix: " млрд" },
  { limit: 1e6, suffix: " млн" },
];

export function format(n: number): string {
  const v = Math.floor(n);
  for (const u of SHORT_UNITS) {
    if (v >= u.limit) {
      const scaled = v / u.limit;
      return scaled.toFixed(scaled < 100 ? 1 : 0).replace(".", ",") + u.suffix;
    }
  }
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatRate(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(".", ",");
}

export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

const NUMERIC_KEYS = [
  "points",
  "totalClicks",
  "totalEarned",
  "clickLevel",
  "cursorLevel",
  "helpers",
  "farms",
  "grandmas",
  "bakeries",
  "factories",
  "portals",
] as const;

function sanitize(raw: unknown): GameState {
  const source = (raw ?? {}) as Record<string, unknown>;
  const result = { ...INITIAL_STATE };
  for (const key of NUMERIC_KEYS) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value >= 0) {
      result[key] = value;
    }
  }
  const multiplier = Number(source.multiplier);
  if (Number.isFinite(multiplier) && multiplier >= 1) {
    result.multiplier = Math.min(multiplier, 1000);
  }
  const emoji = String(source.cookieEmoji ?? "");
  if ((COOKIE_EMOJIS as readonly string[]).includes(emoji)) {
    result.cookieEmoji = emoji;
  }
  if (COOKIE_SIZES.some((size) => size.id === source.cookieSize)) {
    result.cookieSize = source.cookieSize as CookieSize;
  }
  return result;
}

export type ClickerGameApi = ReturnType<typeof useClickerGame>;

export function useClickerGame() {
  const [game, setGame] = useState<GameState>(INITIAL_STATE);
  const [loaded, setLoaded] = useState(false);

  // Load the save after mount so server and first client render match.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setGame(sanitize(JSON.parse(raw)));
      } catch {
        // Corrupted save — start fresh.
      }
      setLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Passive income tick.
  useEffect(() => {
    const timer = setInterval(() => {
      setGame((g) => {
        const income = perSecond(g) / 10;
        if (income <= 0) return g;
        return {
          ...g,
          points: g.points + income,
          totalEarned: g.totalEarned + income,
        };
      });
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Debounced save.
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
      } catch {
        // Storage unavailable — the game still works, just without saving.
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [game, loaded]);

  const click = useCallback(() => {
    setGame((g) => {
      const gain = perClick(g);
      return {
        ...g,
        points: g.points + gain,
        totalClicks: g.totalClicks + 1,
        totalEarned: g.totalEarned + gain,
      };
    });
  }, []);

  const buy = useCallback((item: Upgrade) => {
    setGame((g) => {
      const cost = costOf(item, g[item.key]);
      if (g.points < cost) return g;
      return { ...g, points: g.points - cost, [item.key]: g[item.key] + 1 };
    });
  }, []);

  const reset = useCallback(() => setGame({ ...INITIAL_STATE }), []);

  // Admin actions.
  const givePoints = useCallback((amount: number) => {
    const safe = Number.isFinite(amount) ? amount : 0;
    setGame((g) => ({
      ...g,
      points: Math.max(0, g.points + safe),
      totalEarned: g.totalEarned + Math.max(0, safe),
    }));
  }, []);

  const setPoints = useCallback((value: number) => {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
    setGame((g) => ({ ...g, points: safe }));
  }, []);

  const grantUpgrade = useCallback((item: Upgrade, count = 1) => {
    setGame((g) => ({ ...g, [item.key]: g[item.key] + count }));
  }, []);

  const resetUpgrades = useCallback(() => {
    setGame((g) => ({
      ...g,
      clickLevel: 0,
      cursorLevel: 0,
      helpers: 0,
      farms: 0,
      grandmas: 0,
      bakeries: 0,
      factories: 0,
      portals: 0,
    }));
  }, []);

  const setMultiplier = useCallback((value: number) => {
    setGame((g) => ({ ...g, multiplier: value }));
  }, []);

  const setAppearance = useCallback(
    (patch: { cookieEmoji?: string; cookieSize?: CookieSize }) => {
      setGame((g) => ({ ...g, ...patch }));
    },
    []
  );

  return {
    game,
    click,
    buy,
    reset,
    givePoints,
    setPoints,
    grantUpgrade,
    resetUpgrades,
    setMultiplier,
    setAppearance,
  };
}
