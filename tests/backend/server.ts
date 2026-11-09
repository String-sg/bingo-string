// Local browser-test boundary: only identity is mocked; Bingo uses real HTTP + DB.
if (
  !process.env.BINGO_TEST_DATABASE_URL ||
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.BINGO_TEST_DATABASE_URL).hostname,
  )
)
  throw new Error("BINGO_TEST_DATABASE_URL must be an isolated local database");
process.env.DATABASE_URL = process.env.BINGO_TEST_DATABASE_URL;
process.env.VERCEL = "1";
process.env.BINGO_APP_ORIGIN = "http://127.0.0.1:5186";
process.env.CORS_ORIGINS = "http://127.0.0.1:5186";
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (String(input) === "https://id.string.sg/api/me") {
    const cookie = new Headers(init?.headers).get("cookie");
    const other = cookie === `string_session=${"e".repeat(64)}`;
    const known = other || cookie === `string_session=${"d".repeat(64)}`;
    return new Response(
      JSON.stringify({
        member: {
          id: other ? "44444444-4444-4444-8444-444444444444" : "33333333-3333-4333-8333-333333333333",
          email: other ? "other-host@example.com" : "browser-host@example.com",
          name: other ? "Other host" : "Browser host",
          googleAccountId: other ? "other-host-subject" : "browser-host-subject",
        },
      }),
      {
        status: known ? 200 : 401,
        headers: { "content-type": "application/json" },
      },
    );
  }
  if (String(input) === "https://id.string.sg/api/logout")
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "content-type": "application/json",
        "set-cookie":
          "string_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      },
    });
  if (
    !String(input).startsWith("http://127.0.0.1") &&
    !String(input).startsWith("http://localhost")
  )
    throw new Error("Browser test blocked external request");
  return realFetch(input, init);
};
async function start() {
  const app = (await import("../../backend/src/index")).default;
  app.listen(3186, "127.0.0.1", () =>
    console.log("Isolated Bingo test API ready"),
  );
}
start();
