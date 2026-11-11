import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

async function createBoard(context, baseURL, size, checked = true, isPublic = true) {
  await context.addCookies([{ name: "string_session", value: "d".repeat(64), url: baseURL }]);
  const response = await context.request.post("/api/games", {
    headers: { origin: baseURL },
    data: {
      name: `Management ${size} ${randomUUID()}`,
      gridSize: size,
      checked,
      isPublic,
      challenges: Array.from({ length: size * size }, (_, i) => ({
        id: `q${i}`, text: `Prompt ${i + 1}`,
        mode: i === 0 ? "typed" : i === 1 ? "manual" : "photo",
        ...(i === 0 ? { aliases: ["answer", "alternate"] } : {}),
      })),
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

const action = (page, name) => page.getByRole("button", { name, exact: true });
const card = (page, name) => page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });

test("Start opens an owner-only lobby for each game and students join with its PIN", async ({ page, context, browser, baseURL }) => {
  const game = await createBoard(context, baseURL, 3, true, false);
  const olderGame = await createBoard(context, baseURL, 3, false);
  const endpoint = `/api/checked/boards/${game.id}/lobby`;
  const options = { headers: { origin: baseURL }, data: {} };
  const guest = await browser.newContext({ baseURL });
  try {
    expect((await guest.request.post(endpoint, options)).status()).toBe(401);
    await guest.addCookies([{ name: "string_session", value: "e".repeat(64), url: baseURL }]);
    expect((await guest.request.post(endpoint, options)).status()).toBe(403);
    await guest.clearCookies();

    await page.goto("/play?host=1");
    const gameCard = card(page, game.name);
    await gameCard.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByText("Open its lobby with Start", { exact: false })).toBeVisible();
    await action(page, "Close").click();
    const [, duplicate] = await Promise.all([
      gameCard.getByRole("button", { name: "Start", exact: true }).click(),
      context.request.post(endpoint, options),
    ]);
    expect(duplicate.status()).toBe(200);
    const round = await duplicate.json();
    await expect(page).toHaveURL(`/host/live/${round.id}`);
    await expect(page.getByRole("heading", { name: game.name })).toBeVisible();
    const pinLabel = page.getByLabel("Game PIN");
    await expect(pinLabel).toHaveText(/^\d{6}$/);
    const pin = await pinLabel.textContent();
    await page.reload();
    await expect(pinLabel).toHaveText(pin);
    const scan = page.getByRole("link", { name: "Scan to join", exact: true });
    await expect(scan).toHaveAttribute("href", `${baseURL}/join#pin=${pin}`);
    await expect(scan).toHaveCSS("color", "rgb(117, 248, 204)");
    const lobby = `/api/checked/rounds/${round.id}/lobby`;
    expect((await guest.request.get(lobby)).status()).toBe(401);
    expect((await context.request.delete(`/api/games/${game.id}`, { headers: options.headers })).status()).toBe(409);

    const student = await guest.newPage();
    await student.goto(await scan.getAttribute("href"));
    await expect(student.getByLabel("Game PIN")).toHaveValue(pin);
    await student.getByLabel("Nickname").fill("Class pupil");
    await action(student, "Join").click();
    await expect(student.getByText("Waiting for your teacher to start")).toBeVisible();
    await expect(page.getByText("1 joined")).toBeVisible();
    await action(page, "Start game").click();
    await expect(student.locator(".bingo-cell")).toHaveCount(9);
    page.once("dialog", dialog => dialog.accept());
    await action(page, "End session").click();
    await expect(student.getByRole("heading", { name: "Session ended" })).toBeVisible();
    expect((await guest.request.post("/api/checked/join", {
      headers: { "x-bingo-player": randomUUID() }, data: { pin, nickname: "Late pupil" },
    })).status()).toBe(410);

    const back = page.getByRole("link", { name: "← My games" });
    await back.click();
    await gameCard.getByRole("button", { name: "Results", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Game results" }).getByText("Class pupil")).toBeVisible();
    await action(page, "Close").click();
    await gameCard.getByRole("button", { name: "Start", exact: true }).click();
    await expect(pinLabel).toHaveText(/^\d{6}$/);
    expect(await pinLabel.textContent()).not.toBe(pin);
    const nextLobby = page.url();
    await back.click();
    await card(page, olderGame.name).getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("heading", { name: olderGame.name })).toBeVisible();
    expect(page.url()).not.toBe(nextLobby);
  } finally {
    await guest.close();
  }
});

for (const size of [3, 5]) {
  test(`edit an unused ${size} × ${size} board in place`, async ({ page, context, baseURL }) => {
    const game = await createBoard(context, baseURL, size);
    await page.goto("/play?host=1");
    await card(page, game.name).getByRole("link", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit game", exact: true })).toBeVisible();
    await expect(page.getByLabel("Game name", { exact: true })).toHaveValue(game.name);
    await expect(page.locator(`input[name=gridSize][value="${size}"]`)).toBeChecked();
    await action(page, "Continue").click();
    await expect(page.getByLabel("Mode for challenge 1", { exact: true })).toHaveValue("typed");
    await expect(page.getByLabel("Mode for challenge 2", { exact: true })).toHaveValue("manual");
    const keys = page.getByLabel("Accepted answers for challenge 1", { exact: true });
    await expect(keys).toHaveValue("answer\nalternate");
    await keys.fill("new answer");
    await page.getByLabel("Challenge 1", { exact: true }).fill("Edited prompt");
    await action(page, "Continue").click();
    await expect(page.locator("#boardPreview > div")).toHaveCount(size * size);
    if (size === 5) await expect(page.locator("#boardPreview > div").nth(12)).toHaveText("FREE");
    await action(page, "Save changes").click();
    await expect(page.getByRole("heading", { name: "Changes saved" })).toBeVisible();
    await expect(page.getByLabel("Game link", { exact: true })).toHaveValue(`${baseURL}/play/${game.id}`);
    const play = await (await context.request.get(`/api/games/${game.id}/play`)).json();
    expect(play.challengesJson[0]).toMatchObject({ text: "Edited prompt", mode: "typed" });
    expect(play.challengesJson[0]).not.toHaveProperty("aliases");
    const edited = await (await context.request.get(`/api/games/${game.id}/editor`)).json();
    expect(edited.challengesJson[0].aliases).toEqual(["new answer"]);
  });
}

test("a stale editor saves a copy and Clear results only resets the original scorecard", async ({ page, context, baseURL }) => {
  const game = await createBoard(context, baseURL, 3);
  const path = `/api/checked/boards/${game.id}`;
  const playerHeaders = { "x-bingo-player": randomUUID() };
  await page.goto(`/new.html?edit=${game.id}`);
  await action(page, "Continue").click();
  await page.getByLabel("Challenge 1", { exact: true }).fill("Copied prompt");
  await action(page, "Continue").click();
  expect((await context.request.post(`${path}/join`, { headers: playerHeaders, data: { nickname: "Pupil" } })).status()).toBe(200);
  expect((await context.request.post(`${path}/action`, {
    headers: playerHeaders, data: { action: "manual", index: 1, text: "Submitted evidence", requestId: randomUUID() },
  })).status()).toBe(200);
  await action(page, "Save changes").click();
  await expect(page.getByRole("alert").filter({ hasText: "This board has saved play" })).toBeVisible();
  await action(page, "Save as copy").click();
  await expect(page.getByRole("heading", { name: "Board copy saved" })).toBeVisible();
  const copyLink = await page.getByLabel("Game link", { exact: true }).inputValue();
  const copyId = new URL(copyLink).pathname.split("/").pop();
  expect(copyId).not.toBe(game.id);
  const original = await (await context.request.get(`/api/games/${game.id}/play`)).json();
  const copy = await (await context.request.get(`/api/games/${copyId}/play`)).json();
  expect(original.challengesJson[0].text).toBe("Prompt 1");
  expect(copy.challengesJson[0].text).toBe("Copied prompt");
  const copyPath = `/api/checked/boards/${copyId}`;
  expect((await (await context.request.get(`${copyPath}/results`)).json()).players).toEqual([]);
  expect((await context.request.post(`${copyPath}/join`, { headers: playerHeaders, data: { nickname: "Other scorecard" } })).status()).toBe(200);

  await page.goto(`/new.html?edit=${game.id}`);
  await expect(page.getByText("Save a copy to keep the original board and its results.")).toBeVisible();
  await page.goto("/play?host=1");
  await card(page, game.name).filter({ has: page.locator(`a[href="/new.html?edit=${game.id}"]`) })
    .getByRole("button", { name: "Results", exact: true }).click();
  const results = page.getByRole("dialog", { name: "Game results" });
  await expect(results.getByText("Submitted evidence")).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await results.getByRole("button", { name: "Clear results" }).click();
  await expect(results.getByRole("heading", { name: "Pupil", exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await results.getByRole("button", { name: "Clear results" }).click();
  await expect(results.getByText("No players yet.", { exact: true })).toBeVisible();
  expect((await context.request.get(`${path}/state`, { headers: playerHeaders })).status()).toBe(404);
  expect((await context.request.get(`${copyPath}/state`, { headers: playerHeaders })).status()).toBe(200);
  expect((await context.request.get(`/api/games/${game.id}/play`)).status()).toBe(200);
  expect((await (await context.request.get(`/api/games/${game.id}/editor`)).json()).canEdit).toBe(true);
});

test("only the owner can preview a private board without creating a player entry", async ({ page, context, browser, baseURL }) => {
  const game = await createBoard(context, baseURL, 3, true, false);
  const path = `/api/games/${game.id}/play`;
  await page.goto("/play?host=1");
  const loaded = page.waitForResponse((response) => response.url().endsWith(path + "?preview=1"));
  await card(page, game.name).getByRole("link", { name: "Preview", exact: true }).click();
  const preview = await loaded;
  expect(preview.status()).toBe(200);
  expect((await preview.json()).challengesJson[0]).not.toHaveProperty("aliases");
  await expect(page.locator(".bingo-cell")).toHaveCount(9);
  await expect(page.getByText("Board preview — no player entry is recorded.")).toBeVisible();
  expect((await (await context.request.get(`/api/checked/boards/${game.id}/results`)).json()).players).toEqual([]);
  expect((await context.request.get(path)).status()).toBe(403);

  const guest = await browser.newContext({ baseURL });
  try {
    expect((await guest.request.get(path + "?preview=1")).status()).toBe(403);
    await guest.addCookies([{ name: "string_session", value: "e".repeat(64), url: baseURL }]);
    expect((await guest.request.get(path + "?preview=1")).status()).toBe(403);
  } finally {
    await guest.close();
  }
});

test("clear an older photo-only scorecard from My games", async ({ page, context, baseURL }) => {
  const game = await createBoard(context, baseURL, 3, false);
  const path = `/api/games/${game.id}`;
  const sessionId = randomUUID();
  expect((await context.request.post(`${path}/join`, { data: { sessionId, playerName: "Photo pupil" } })).status()).toBe(200);
  expect((await context.request.post(`${path}/progress`, { data: { sessionId, progressJson: [0, 1, 2] } })).status()).toBe(200);
  await page.goto("/play?host=1");
  await card(page, game.name).getByRole("button", { name: "Results", exact: true }).click();
  const results = page.getByRole("dialog", { name: "Game results" });
  await expect(results.getByRole("cell", { name: "Photo pupil" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await results.getByRole("button", { name: "Clear results" }).click();
  await expect(results.getByText("No players yet.")).toBeVisible();
  await expect(results.getByRole("button", { name: "Clear results" })).toHaveCount(0);
  expect((await context.request.get(`${path}/play`)).status()).toBe(200);
});
