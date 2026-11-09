import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, devices, expect } from "@playwright/test";
import { control, guest, hostCookie, join, move, otherCookie, pause, protection, request, results, review, state, target } from "./fixtures/checked-client.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ioAAAAASUVORK5CYII=", "base64");
const browser = await chromium.launch();
try {
  const host = await browser.newContext({ timezoneId: "America/New_York" });
  const a = await browser.newContext({ ...devices["iPhone 12"], timezoneId: "Asia/Singapore" });
  const b = await browser.newContext({ ...devices["iPhone 12"] });
  if (Object.keys(protection).length) {
    for (const context of [host, a, b]) {
      await context.route(target + "/**", (route) =>
        route.continue({ headers: { ...route.request().headers(), ...protection } }));
    }
  }
  const teacher = await host.newPage();
  const first = await a.newPage();
  const second = await b.newPage();
  await teacher.goto(target + "/play");
  await expect(teacher.getByRole("button", { name: "Sign in with String ID" })).toBeVisible();
  await host.addCookies([{ name: "string_session", value: hostCookie, url: target, httpOnly: true }]);
  await teacher.reload();
  await teacher.waitForURL("**/host/live/*");
  const lobbyUrl = teacher.url();
  await teacher.reload();
  assert.equal(teacher.url(), lobbyUrl);
  const pinLabel = teacher.getByLabel("Game PIN");
  await expect(pinLabel).toHaveText(/^\d{6}$/);
  const pin = (await pinLabel.textContent()).trim();
  for (const [page, nickname] of [[first, "Blue Owl"], [second, "Green Fox"]]) {
    await page.goto(target + "/join");
    await page.getByLabel("Game PIN").fill(pin);
    await page.getByLabel("Nickname").fill(nickname);
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page.getByText("Waiting for your teacher to start")).toBeVisible();
  }
  await second.reload();
  await expect(second.getByText("Waiting for your teacher to start")).toBeVisible();
  await expect(teacher.getByText("2 joined")).toBeVisible();
  await teacher.getByRole("button", { name: "Start", exact: true }).click();
  await Promise.all([first, second].map((page) => expect(page.locator(".bingo-cell")).toHaveCount(9)));
  await a.setOffline(true);
  await first.locator(".bingo-cell").nth(0).click();
  await first.locator("#cameraFileInput").setInputFiles({ name: "pencil.png", mimeType: "image/png", buffer: png });
  await expect(first.getByText("Waiting to sync. Reconnecting…")).toBeVisible();
  await expect(first.locator(".bingo-cell").nth(0)).not.toHaveClass(/completed/);
  await a.setOffline(false);
  await expect(first.locator(".bingo-cell").nth(0)).toHaveClass(/completed/);
  for (const [index, answer] of [[1, "100 "], [3, " KAH HOW "]]) {
    await first.locator(".bingo-cell").nth(index).click();
    await first.getByLabel("Your answer").fill(answer);
    await first.getByRole("button", { name: "Submit answer" }).click();
    await expect(first.locator(".bingo-cell").nth(index)).toHaveClass(/completed/);
  }
  await first.locator(".bingo-cell").nth(2).click();
  await first.getByLabel("Answer or note (optional)").fill("<paper triangle>");
  await first.getByRole("button", { name: "Request host check" }).click();
  await expect(first.getByText("Waiting for check", { exact: true })).toBeVisible();
  await expect(first.getByRole("button", { name: "Show Bingo time" })).toBeHidden();
  await teacher.getByRole("button", { name: "Private results" }).click();
  await expect(teacher.getByText("Show a triangle · <paper triangle>", { exact: true })).toBeVisible();
  await teacher.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(first.locator("#bingoTime")).toBeVisible();
  const stamp = await first.locator("#bingoTime").textContent();
  await expect(teacher.getByText("Bingo completed " + stamp.slice("Completed ".length), { exact: true })).toBeVisible();
  await teacher.getByText("First winning line", { exact: true }).click();
  await expect(teacher.getByText("Show a triangle · Host check · <paper triangle>", { exact: true })).toBeVisible();
  await expect(second.locator(".bingo-cell.completed")).toHaveCount(0);
  await first.reload();
  await first.getByRole("button", { name: "Show Bingo time" }).click();
  await expect(first.locator("#bingoTime")).toHaveText(stamp);
  await first.getByRole("button", { name: /Celebrate/ }).click();
  await first.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(first.locator(".bingo-cell.completed")).toHaveCount(0);
  await first.getByRole("button", { name: "Show Bingo time" }).click();
  await expect(first.locator("#bingoTime")).toHaveText(stamp);
  await teacher.getByRole("button", { name: "Close", exact: true }).click();
  teacher.once("dialog", (dialog) => dialog.accept());
  await teacher.getByRole("button", { name: "End session", exact: true }).click();
  await expect(second.getByRole("heading", { name: "Session ended" })).toBeVisible();
  await request("/checked/join", { token: guest(), data: { pin, nickname: "Late pupil" }, status: 410 });
  await teacher.goto(target + "/play");
  await expect(teacher.locator(".bingo-cell")).toHaveCount(25);
  console.log("PASS two-phone rehearsal, including offline photo, owner approval, timestamp, reload, reset and End");

  const board = await request("/games/bingodemoboard/play");
  const detail = await request("/games/bingodemoboard");
  for (const response of [board, detail]) assert.ok(response.body.challengesJson.every((tile) => !("aliases" in tile)));
  await request("/games/bingodemoboard/progress", { data: { sessionId: guest(), progressJson: [0, 1, 2] }, status: 409 });
  await request("/checked/join", { token: guest(), data: { pin: "600103", nickname: "Expired" }, status: 410 });
  await request("/checked/join", { token: guest(), data: { pin: "999999", nickname: "Unknown" }, status: 404 });
  const id = "bingoacceptance";
  const token = guest();
  await join(token, "600101", "Alias tester");
  await move(id, token, "typed", 1, "100", randomUUID(), 409);
  await control(id, "start", otherCookie, 403);
  await results(id, otherCookie, 403);
  await Promise.all([control(id, "start"), control(id, "start")]);
  for (const [i, alias] of ["kahhow", "Kah How", "Kahhow Lee", "leekahhow", " KAH HOW "].entries()) {
    const t = guest();
    await join(t, "600101", "Alias pupil " + i);
    assert.equal((await move(id, t, "typed", 3, alias)).body.player.tiles[3], "done");
  }
  assert.equal((await move(id, token, "typed", 3, "Kah  How")).body.outcome, "miss");
  const sameMiss = randomUUID();
  assert.equal((await move(id, token, "typed", 1, "100.0", sameMiss)).body.outcome, "miss");
  assert.equal((await move(id, token, "typed", 1, "100.0", sameMiss)).body.outcome, "miss");
  for (let i = 0; i < 4; i++) assert.equal((await move(id, token, "typed", 1, "0")).body.outcome, "miss");
  const cooldown = (await move(id, token, "typed", 1, "100", randomUUID(), 429)).body;
  assert.equal(cooldown.outcome, "cooldown");
  const retryAt = Date.now() + cooldown.retryAfter * 1000 + 500;
  const manual = guest();
  await join(manual, "600101", "Manual tester");
  await move(id, manual, "photo", 0);
  await move(id, manual, "typed", 1, "100");
  await move(id, manual, "manual", 2, "first");
  let row = (await results(id)).body.players.find(({ nickname }) => nickname === "Manual tester");
  assert.equal(row.completedAt, null);
  const older = row.pending[0];
  await review(id, row, older, "approve", otherCookie, 403);
  await review(id, row, older, "return");
  await move(id, manual, "manual", 2, "second");
  row = (await results(id)).body.players.find(({ nickname }) => nickname === "Manual tester");
  await review(id, row, older, "approve", hostCookie, 409);
  await Promise.all([review(id, row, row.pending[0]), review(id, row, row.pending[0])]);
  const done = (await state(id, manual)).body.player;
  assert.ok(done.completedAt);
  assert.deepEqual(done.line, [0, 1, 2]);
  const result = (await results(id)).body.players.find(({ nickname }) => nickname === "Manual tester");
  assert.equal(result.completedAt, done.completedAt);
  assert.equal(result.line[2].text, "second");
  await request(`/checked/rounds/${id}/state`, { token: guest(), status: 404 });
  assert.ok(!(JSON.stringify((await state(id, token)).body).includes("second")));
  const isolated = (await results(id)).body.players;
  assert.ok(isolated.every(({ nickname }) => !["Blue Owl", "Green Fox"].includes(nickname)));
  const retention = await request("/checked/boards/bingodemoboard/results", { host: hostCookie });
  assert.ok(retention.body.players.every(({ nickname }) => nickname !== "Expired synthetic pupil"));
  if (process.env.BINGO_TEST_CRON_SECRET) {
    await request("/checked/purge", { status: 401 });
    const purged = await request("/checked/purge", { authorization: "Bearer " + process.env.BINGO_TEST_CRON_SECRET });
    assert.ok(purged.body.removed >= 1);
  }
  for (const size of [3, 5]) {
    await teacher.goto(target + "/new.html");
    await teacher.getByLabel("Game name", { exact: true }).fill("Synthetic mixed " + size);
    await teacher.locator(`input[name=gridSize][value="${size}"]`).check();
    await teacher.getByRole("button", { name: "Continue", exact: true }).click();
    await teacher.getByRole("button", { name: "Fill blanks with starter prompts" }).click();
    await teacher.getByLabel("Mode for challenge 1", { exact: true }).selectOption("typed");
    await teacher.getByLabel("Mode for challenge 2", { exact: true }).selectOption("manual");
    await teacher.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(teacher.getByText("Enter 1 to 20 accepted answers", { exact: false })).toBeVisible();
    await teacher.getByLabel("Accepted answers for challenge 1", { exact: true }).fill("100");
    await teacher.getByRole("button", { name: "Continue", exact: true }).click();
    await teacher.getByRole("button", { name: "Create game", exact: true }).click();
    await expect(teacher.getByRole("heading", { name: "Your game is ready" })).toBeVisible();
    const link = await teacher.getByLabel("Game link", { exact: true }).inputValue();
    const boardId = new URL(link).pathname.split("/").pop();
    const created = (await request(`/games/${boardId}/play`)).body;
    assert.equal(created.gridSize, size);
    assert.equal(created.challengesJson[0].mode, "typed");
    assert.equal(created.challengesJson[1].mode, "manual");
    if (size === 5) assert.equal(created.challengesJson[12].text, "FREE");
    await request(`/games/${boardId}`, {
      host: hostCookie, method: "PUT", status: 409, data: { challenges: created.challengesJson },
    });
    const player = guest();
    await request(`/checked/boards/${boardId}/join`, { token: player, data: { nickname: "Synthetic pupil" } });
    await request(`/checked/boards/${boardId}/action`, {
      token: player, data: { action: "typed", index: 0, text: "100 ", requestId: randomUUID() },
    });
    const deleted = await teacher.request.delete(target + `/api/games/${boardId}`, {
      headers: { ...protection, origin: target, cookie: "string_session=" + hostCookie },
    });
    assert.equal(deleted.status(), 204);
    await request(`/checked/boards/${boardId}/state`, { token: player, status: 404 });
  }
  await pause(Math.max(0, retryAt - Date.now()));
  assert.equal((await move(id, token, "typed", 1, "100")).body.player.tiles[1], "done");
  await control(id, "end");
  await move(id, manual, "typed", 3, "kahhow", randomUUID(), 409);
  console.log("PASS mixed 3×3 and 5×5 authoring, exact aliases, retry and cooldown recovery, owner access, stale approvals, session isolation and retention");
} finally {
  await browser.close();
}
