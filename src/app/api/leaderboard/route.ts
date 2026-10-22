import { ADMIN_PASSWORD } from "@/lib/admin";
import { validateDisplayName } from "@/lib/name-filter";

export const dynamic = "force-dynamic";

const GIST_ID = process.env.GIST_ID ?? "";
const GIST_TOKEN = process.env.GIST_TOKEN ?? "";
const GIST_FILENAME = "leaderboard.json";

const MAX_ENTRIES = 100;
const TOP_LISTED = 50;
const MAX_NAME_LENGTH = 24;
const MAX_SCORE = 1e15;

export type LeaderboardEntry = {
  name: string;
  score: number;
  updatedAt: string;
};

const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 5;
const recentPosts = new Map<string, number[]>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const stamps = (recentPosts.get(key) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (stamps.length >= RATE_MAX) {
    recentPosts.set(key, stamps);
    return true;
  }
  stamps.push(now);
  recentPosts.set(key, stamps);
  return false;
}

function sanitizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  return name.length > 0 ? name : null;
}

function sanitizeScore(value: unknown): number | null {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0) return null;
  return Math.min(Math.floor(score), MAX_SCORE);
}

function sortEntries(entries: LeaderboardEntry[]): void {
  entries.sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name, "ru")
  );
}

// Чтение из GitHub Gist
async function readEntries(): Promise<LeaderboardEntry[]> {
  if (!GIST_ID || !GIST_TOKEN) return [];
  
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Authorization: `token ${GIST_TOKEN}` },
      next: { revalidate: 0 }
    });
    
    if (!res.ok) return [];
    const data = await res.json();
    const file = data.files?.[GIST_FILENAME];
    if (!file?.content) return [];
    
    const parsed: unknown = JSON.parse(file.content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Запись в GitHub Gist
async function writeEntries(entries: LeaderboardEntry[]): Promise<void> {
  if (!GIST_ID || !GIST_TOKEN) return;
  
  await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `token ${GIST_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(entries, null, 2)
        }
      }
    })
  });
}

export async function GET() {
  const entries = await readEntries();
  sortEntries(entries);
  return Response.json({
    entries: entries.slice(0, TOP_LISTED),
    total: entries.length,
  });
}

export async function POST(request: Request) {
  if (!GIST_ID || !GIST_TOKEN) {
    return Response.json(
      { error: "Хранилище не настроено" },
      { status: 503 }
    );
  }

  if (isRateLimited(clientKey(request))) {
    return Response.json(
      { error: "Слишком часто. Подождите немного." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const source = (body ?? {}) as Record<string, unknown>;
  const name = sanitizeName(source.name);
  const score = sanitizeScore(source.score);

  if (!name || score === null) {
    return Response.json(
      { error: "Нужны имя и корректный счёт" },
      { status: 400 }
    );
  }

  const check = validateDisplayName(name);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
  }

  const entries = await readEntries();
  const key = name.toLowerCase();
  const existing = entries.find(
    (entry) => entry.name.toLowerCase() === key
  );

  if (existing) {
    if (score > existing.score) {
      existing.score = score;
      existing.updatedAt = new Date().toISOString();
    }
  } else {
    entries.push({ name, score, updatedAt: new Date().toISOString() });
  }

  sortEntries(entries);
  const rank = entries.findIndex(
    (entry) => entry.name.toLowerCase() === key
  ) + 1;

  await writeEntries(entries.slice(0, MAX_ENTRIES));

  return Response.json({ ok: true, rank: rank > 0 ? rank : null });
}

export async function DELETE(request: Request) {
  const password = request.headers.get("x-admin-password");
  if (password !== ADMIN_PASSWORD) {
    return Response.json({ error: "Неверный пароль" }, { status: 403 });
  }
  await writeEntries([]);
  return Response.json({ ok: true });
}
