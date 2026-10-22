'use client';
import {
  ADMIN_PASSWORD,
  COOKIE_EMOJIS,
  COOKIE_SIZES,
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
  type GameState,
} from "@/components/clicker-logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WelcomeGate } from "@/components/welcome-gate";
import {
  LoaderCircle,
  LogIn,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";

// 🔊 Звук клика
let audioContext: AudioContext | null = null;
function playClickSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioContext) audioContext = new AudioCtx();
    if (audioContext.state === 'suspended') audioContext.resume();
    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    o.connect(g); g.connect(audioContext.destination);
    o.frequency.value = 600 + Math.random() * 300;
    o.type = "sine";
    g.gain.setValueAtTime(0.25, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
    o.start(audioContext.currentTime);
    o.stop(audioContext.currentTime + 0.08);
  } catch {}
}

// 🔐 Конфиг
const GIST_API = "/api/gist-sync";
const SESSION_TOKEN_KEY = "game_session_token";

type GistData = {
  users: Record<string, {
    passwordHash: string;
    progress: Partial<GameState>;
    createdAt: number;
  }>;
};

function getSessionToken() {
  try { return localStorage.getItem(SESSION_TOKEN_KEY); } catch { return null; }
}
function setSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(SESSION_TOKEN_KEY, token);
    else localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {}
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "your-secret-salt-here");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

// 📋 Форма входа — без лишних уведомлений
function LoginGate({ onSuccess }: { onSuccess: (username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      setError("Заполни оба поля");
      return;
    }

    setLoading(true);
    try {
      // Читаем данные из гиста
      const res = await fetch(`${GIST_API}?action=read`);
      if (!res.ok) throw new Error("Не удалось подключиться");
      
      const data: GistData = await res.json();
      if (!data.users) data.users = {};

      const userRecord = data.users[trimmedUser];
      const passHash = await hashPassword(trimmedPass);

      if (userRecord) {
        // Пользователь существует — проверяем пароль
        if (userRecord.passwordHash !== passHash) {
          throw new Error("Неверный пароль");
        }
        // Вошли — без сообщений
      } else {
        // Нет пользователя — создаём ТИХО, без уведомлений
        data.users[trimmedUser] = {
          passwordHash: passHash,
          progress: {},
          createdAt: Date.now()
        };
        
        // Сохраняем в гист
        const saveRes = await fetch(GIST_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "write", data })
        });
        if (!saveRes.ok) throw new Error("Не удалось создать аккаунт");
      }

      // Создаём сессию и заходим
      const token = btoa(`${trimmedUser}:${Date.now()}`);
      setSessionToken(token);
      localStorage.setItem(NAME_STORAGE_KEY, trimmedUser);
      
      onSuccess(trimmedUser);
    } catch (err: any) {
      setError(err.message || "Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="animate-panel-in mx-auto max-w-sm pt-10">
      <form onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border bg-card p-6 text-center shadow-sm"
      >
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-secondary">
          <User className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Вход в игру</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Введи данные — аккаунт создастся автоматически
          </p>
        </div>

        <div className="space-y-2 text-left">
          <label className="text-sm font-medium">Юзернейм</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Введи юзернейм"
            disabled={loading}
            autoComplete="username"
          />
        </div>
        <div className="space-y-2 text-left">
          <label className="text-sm font-medium">Пароль</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Введи пароль"
            disabled={loading}
            autoComplete="current-password"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? <LoaderCircle className="size-4 animate-spin mr-2" />
            : <LogIn className="size-4 mr-2" />}
          {loading ? "Подключение..." : "Войти"}
        </Button>
      </form>
    </section>
  );
}

// Основной компонент
export default function GameShell() {
  const [user, setUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getSessionToken();
    if (token) {
      try {
        const [savedUser] = atob(token).split(":");
        if (savedUser) {
          setUser(savedUser);
          localStorage.setItem(NAME_STORAGE_KEY, savedUser);
        }
      } catch {}
    }
    setChecking(false);
  }, []);

  const handleLogout = () => {
    setSessionToken(null);
    setUser(null);
    localStorage.removeItem(NAME_STORAGE_KEY);
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <LoginGate onSuccess={setUser} />;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold">🍪 Кликер</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">👤 {user}</span>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Выйти
            </Button>
          </div>
        </div>
        <WelcomeGate />
      </div>
    </main>
  );
}
