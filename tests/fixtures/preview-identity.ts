// Import only from a disposable preview entry point, never from the shipped API.
const host = process.env.BINGO_TEST_HOST_COOKIE;
const other = process.env.BINGO_TEST_OTHER_COOKIE;
const database = new URL(process.env.DATABASE_URL || "");
if (
  process.env.VERCEL_ENV !== "preview" ||
  database.hostname !== process.env.BINGO_ISOLATED_DATABASE_HOST ||
  database.pathname !== "/bingo_preview" ||
  !host || !other || host === other ||
  !/^[a-f0-9]{64}$/.test(host) || !/^[a-f0-9]{64}$/.test(other)
) throw new Error("Preview identity requires an isolated preview database and distinct test tokens.");

const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (String(input) !== "https://id.string.sg/api/me") return original(input, init);
  const cookie = new Headers(init?.headers).get("cookie");
  const owner = cookie === "string_session=" + host;
  if (!owner && cookie !== "string_session=" + other) return new Response(null, { status: 401 });
  return Response.json({ member: {
    id: owner ? "33333333-3333-4333-8333-333333333333" : "44444444-4444-4444-8444-444444444444",
    email: owner ? "browser-host@example.com" : "other-host@example.com",
    name: owner ? "Browser host" : "Other host",
  } });
};
