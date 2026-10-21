// Shared nickname moderation (NSFW / mat filter). Used by the onboarding
// screen and by the leaderboard API, so hand-typed names can't poison the
// shared board. Pure sync functions — safe on client and server.

// Latin lookalikes and leet digits -> cyrillic, for catching mixed-script
// evasions like "хyй" inside words that are otherwise cyrillic.
const CYR_LEET: Record<string, string> = {
  a: "а",
  b: "б",
  c: "с",
  e: "е",
  h: "н",
  k: "к",
  m: "м",
  o: "о",
  p: "р",
  t: "т",
  x: "х",
  y: "у",
  "@": "а",
  "0": "о",
  "3": "з",
  "4": "ч",
  "6": "б",
};

// Mirror transliteration for latin stems: "хуй" -> "xyy", "сука" -> "cyka".
const LAT_LEET: Record<string, string> = {
  а: "a",
  б: "b",
  в: "b",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "h",
  о: "o",
  п: "p",
  р: "p",
  с: "c",
  т: "t",
  у: "y",
  ф: "f",
  х: "x",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ы: "y",
  э: "e",
  ю: "u",
  я: "a",
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "b",
  "@": "a",
  $: "s",
};

type Mode = "contains" | "start" | "exact";
type Stem = { t: string; m?: Mode };

const CYR_STEMS: Stem[] = [
  { t: "бля" },
  { t: "хуе" },
  { t: "хуи" },
  { t: "хуя" },
  { t: "хую" },
  { t: "хуй" },
  { t: "пизд" },
  { t: "пезд" },
  { t: "шлюх" },
  { t: "шлюш" },
  { t: "сучк" },
  { t: "сука" },
  { t: "мудак" },
  { t: "мудил" },
  { t: "гандон" },
  { t: "гондон" },
  { t: "дроч" },
  { t: "сперм" },
  { t: "залуп" },
  { t: "пенис" },
  { t: "вагина" },
  { t: "порн" },
  { t: "секс" },
  { t: "член" },
  { t: "пидор" },
  { t: "пидар" },
  { t: "трах" },
  { t: "анал" },
  // еб-family is anchored to the word start: a bare contains-match would
  // block innocent words like "неба" or "хлеба".
  { t: "еба", m: "start" },
  { t: "ебе", m: "start" },
  { t: "еби", m: "start" },
  { t: "ебо", m: "start" },
  { t: "ебу", m: "start" },
  { t: "уеб", m: "start" },
  { t: "заеб", m: "start" },
  { t: "выеб", m: "start" },
  { t: "доеб", m: "start" },
  { t: "поеб", m: "start" },
  { t: "отеб", m: "start" },
  { t: "разеб", m: "start" },
  { t: "приеб", m: "start" },
  { t: "долбо", m: "start" },
  { t: "еб", m: "exact" },
];

const LAT_STEMS: Stem[] = [
  { t: "fuck" },
  { t: "fck" },
  { t: "fuk" },
  { t: "bitch" },
  { t: "shit" },
  { t: "cunt" },
  { t: "whore" },
  { t: "slut" },
  { t: "porn" },
  { t: "nigg" },
  { t: "faggot" },
  { t: "penis" },
  { t: "vagina" },
  { t: "boob" },
  { t: "nude" },
  { t: "hentai" },
  { t: "sex", m: "start" },
  { t: "dick", m: "start" },
  { t: "cock", m: "start" },
  { t: "rape", m: "start" },
  { t: "cum", m: "start" },
  { t: "anal", m: "start" },
  // Common cyrillic-to-latin transliterations.
  { t: "xyy" },
  { t: "xuy" },
  { t: "xyu" },
  { t: "xui" },
  { t: "hui" },
  { t: "huy" },
  { t: "huj" },
  { t: "cyka" },
  { t: "syka" },
  { t: "pizd" },
  { t: "ebal", m: "start" },
  { t: "ebat", m: "start" },
  { t: "blya" },
  { t: "mudak" },
  { t: "pidor" },
  { t: "shlyu" },
  { t: "shlux" },
];

const HAS_CYRILLIC = /[а-яё]/i;

function toForm(
  word: string,
  leet: Record<string, string>,
  keep: (ch: string) => boolean
): string {
  let out = "";
  for (const ch of word.toLowerCase().replace(/ё/g, "е").replace(/[ьъ]/g, "")) {
    const mapped = leet[ch] ?? ch;
    if (keep(mapped)) out += mapped;
  }
  return out;
}

const isCyrillic = (ch: string) => /[а-я ]/.test(ch);
const isLatin = (ch: string) => /[a-z ]/.test(ch);

const collapseRuns = (text: string) => text.replace(/(.)\1+/g, "$1");

function hits(text: string, stems: Stem[]): boolean {
  if (!text) return false;
  return stems.some((stem) => {
    if (stem.m === "start" || stem.m === "exact") {
      return text.split(" ").some((word) =>
        stem.m === "exact" ? word === stem.t : word.startsWith(stem.t)
      );
    }
    return text.includes(stem.t);
  });
}

export type NameCheck = { ok: true } | { ok: false; error: string };

export const NAME_REJECTED = "Имя содержит недопустимый контент";

export function validateDisplayName(raw: string): NameCheck {
  // Per word: only words that already contain cyrillic go through the
  // lookalike/translit maps — otherwise latin nicknames like "Ebay" would be
  // transliterated into "ебау" and blocked by cyrillic stems.
  const cyrWords: string[] = [];
  const latWords: string[] = [];
  for (const word of raw.split(/\s+/)) {
    if (!word) continue;
    if (HAS_CYRILLIC.test(word)) {
      const cyr = toForm(word, CYR_LEET, isCyrillic);
      const lat = toForm(word, LAT_LEET, isLatin);
      if (cyr) cyrWords.push(cyr);
      if (lat) latWords.push(lat);
    } else {
      const lat = toForm(word, LAT_LEET, isLatin);
      if (lat) latWords.push(lat);
    }
  }

  const cyr = cyrWords.join(" ");
  const lat = latWords.join(" ");
  const found =
    hits(cyr, CYR_STEMS) ||
    hits(collapseRuns(cyr), CYR_STEMS) ||
    hits(lat, LAT_STEMS) ||
    hits(collapseRuns(lat), LAT_STEMS);

  return found ? { ok: false, error: NAME_REJECTED } : { ok: true };
}
