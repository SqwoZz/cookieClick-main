import { NextResponse } from 'next/server';

const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_FILENAME = "game-users.json";

async function fetchGist() {
  if (!GIST_ID || !GITHUB_TOKEN) {
    throw new Error("Переменные окружения не настроены");
  }

  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: {
      "Authorization": `token ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json"
    }
  });

  if (!res.ok) throw new Error(`GitHub ошибка: ${res.status}`);
  return res.json();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "read") {
      const gist = await fetchGist();
      const file = gist.files[GIST_FILENAME];
      
      if (!file) return NextResponse.json({ users: {} });
      return NextResponse.json(JSON.parse(file.content));
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { action, data } = await req.json();

    if (action === "write") {
      if (!GIST_ID || !GITHUB_TOKEN) {
        throw new Error("Переменные окружения не настроены");
      }

      await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: "PATCH",
        headers: {
          "Authorization": `token ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          files: {
            [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) }
          }
        })
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}