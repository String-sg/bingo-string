export const DRAFT_KEY = "bingo:host-draft:v1";
export function parseChallengeCsv(source) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted)
    throw new Error("CSV has an unclosed quote. Check the last edited row.");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const clean = rows.filter((r) => r.some((v) => v.trim()));
  if (!clean.length) throw new Error("The CSV is empty.");
  const header = clean[0].map((v) =>
    v
      .trim()
      .replace(/^\uFEFF/, "")
      .toLowerCase(),
  );
  const named = header.findIndex((v) =>
    ["text", "challenge", "question", "prompt"].includes(v),
  );
  const hasHeader = named >= 0 || header[0] === "id";
  const col = named >= 0 ? named : clean[0].length > 1 ? 1 : 0;
  return clean.slice(hasHeader ? 1 : 0).map((r, i) => {
    const value = (r[col] || "").trim();
    if (!value || value.length > 100)
      throw new Error(
        `CSV row ${i + (hasHeader ? 2 : 1)} needs a prompt between 1 and 100 characters.`,
      );
    return value;
  });
}
export const STARTERS = [
  "Find someone who enjoys the same hobby as you",
  "Learn a new person’s name",
  "Share a useful tip with someone",
  "Find someone who has visited a place you want to go",
  "Ask someone what they are learning",
  "Give someone a sincere compliment",
  "Find someone who speaks another language",
  "Share a small win from this week",
  "Introduce two people to each other",
  "Find someone who enjoys cooking",
  "Ask someone for a book recommendation",
  "Discover a shared favourite food",
  "Find someone who plays an instrument",
  "Share a favourite way to relax",
  "Find someone who enjoys hiking",
  "Learn about someone’s first job",
  "Share a skill you could teach",
  "Find someone who loves a different sport",
  "Ask someone about a project they enjoyed",
  "Find someone with a pet",
  "Share a place you grew up",
  "Ask someone what inspires them",
  "Find someone who enjoys making things",
  "Thank someone for something they did",
];
