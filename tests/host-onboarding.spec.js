import { test, expect } from "@playwright/test";
async function host(context) {
  await context.addCookies([
    {
      name: "string_session",
      value: "d".repeat(64),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
for (const size of [3, 5])
  test(`host creates ${size}x${size}, shares it, and guest plays without login`, async ({
    page,
    context,
    browser,
  }) => {
    await host(context);
    await page.goto("/new.html");
    await expect(page.locator("#wizard")).toBeVisible();
    await page
      .getByLabel("Game name", { exact: true })
      .fill(`Browser game ${size} ${Date.now()}`);
    await page.locator(`input[name=gridSize][value="${size}"]`).check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("button", { name: "Fill blanks with starter prompts" })
      .click();
    await expect(page.locator("#promptCount")).toContainText(
      size === 3 ? "9 of 9" : "24 of 24",
    );
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.locator("#boardPreview > div")).toHaveCount(size * size);
    await page
      .getByRole("button", { name: "Create game", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your game is ready" }),
    ).toBeVisible();
    const link = await page
      .getByLabel("Game link", { exact: true })
      .inputValue();
    const guest = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const gp = await guest.newPage();
    await gp.goto(link);
    await expect(gp.locator(".bingo-cell")).toHaveCount(size * size);
    await gp.getByLabel("Your name", { exact: true }).fill("Guest player");
    await gp.getByRole("button", { name: "Join Game", exact: true }).click();
    await expect(
      gp.getByRole("button", { name: "Host a game", exact: true }),
    ).toBeVisible();
    await gp.locator(".bingo-cell").first().focus();
    await gp.keyboard.press("Enter");
    await expect(gp.locator("#cameraModal")).toBeVisible();
    await gp.keyboard.press("Escape");
    await expect(gp.locator("#cameraModal")).toBeHidden();
    const imageBase64 = await gp.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      canvas.getContext("2d").fillRect(0, 0, 64, 64);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    await gp.locator(".bingo-cell").first().click();
    const progress = gp.waitForResponse(
      (response) =>
        response.url().endsWith("/progress") &&
        response.request().method() === "POST",
    );
    await gp
      .locator("#cameraFileInput")
      .setInputFiles({
        name: "proof.png",
        mimeType: "image/png",
        buffer: Buffer.from(imageBase64, "base64"),
      });
    await expect(gp.locator(".bingo-cell").first()).toHaveClass(/completed/);
    expect((await progress).status()).toBe(200);
    const gameId = new URL(link).pathname.split("/").pop();
    const results = await page.request.get(`/api/games/${gameId}/results`);
    expect(results.status()).toBe(200);
    const players = await results.json();
    expect(
      players.some(
        (player) =>
          player.playerName === "Guest player" &&
          player.progressJson.includes(0),
      ),
    ).toBe(true);
    await guest.close();
  });
test("draft survives size changes and reload; partial board cannot publish", async ({
  page,
  context,
}) => {
  await host(context);
  await page.goto("/new.html");
  await page.getByLabel("Game name", { exact: true }).fill("My saved draft");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Challenge 1", { exact: true })
    .fill("Keep this prompt");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Add challenge 2");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.locator('input[name=gridSize][value="5"]').check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Challenge 1", { exact: true })).toHaveValue(
    "Keep this prompt",
  );
  await page.reload();
  await expect(page.getByLabel("Game name", { exact: true })).toHaveValue(
    "My saved draft",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Challenge 1", { exact: true })).toHaveValue(
    "Keep this prompt",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("signed-out editor offers recoverable String ID login", async ({
  page,
}) => {
  await page.goto("/new.html");
  await expect(page.locator("#wizard")).toBeHidden();
  await page
    .getByRole("button", { name: "Continue with String ID", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continue with String ID" }),
  ).toHaveAttribute("href", "https://id.string.sg/login?continue=bingo");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
test("results render guest HTML literally and unavailable games never show a default board", async ({
  page,
  context,
}) => {
  await host(context);
  await page.goto("/");
  await page.evaluate(() =>
    window.bingoApp.authManager.renderResultsModal("Test", [
      { playerName: "<img src=x onerror=alert(1)>", isCompleted: false },
    ]),
  );
  await expect(page.getByRole("dialog")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.getByRole("dialog").locator("img")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/play/not-a-real-game");
  await expect(
    page.getByText(
      "Game unavailable. Check the link with your host or try again later.",
    ),
  ).toBeVisible();
  await expect(page.locator(".bingo-cell")).toHaveCount(0);
});
test("valid 9-prompt quoted CSV imports and dashboard failures are not empty states", async ({
  page,
  context,
}) => {
  await host(context);
  await page.goto("/new.html");
  await page.getByLabel("Game name", { exact: true }).fill("CSV");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator("#csvFile").setInputFiles({
    name: "test.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "id,text\n" +
        Array.from(
          { length: 9 },
          (_, i) => `${i},"Prompt ${i}, with comma"`,
        ).join("\n"),
    ),
  });
  await expect(page.locator("#promptCount")).toContainText("9 of 9");
  await page.route("**/api/games", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/?host=1");
  await expect(page.locator("#gamesState")).toContainText(
    "Could not load your games",
  );
  await expect(page.locator("#emptyState")).toBeHidden();
});
test("failed save retains draft and retries do not duplicate the committed game", async ({
  page,
  context,
}) => {
  await host(context);
  await page.goto("/new.html");
  await page
    .getByLabel("Game name", { exact: true })
    .fill("Retry after failure");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Fill blanks with starter prompts" })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  let committedId;
  await page.route("**/api/games", async (route) => {
    if (route.request().method() === "POST" && !committedId) {
      const result = await route.fetch();
      committedId = (await result.json()).id;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"Temporary response failure. Please retry."}',
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Create game", exact: true }).click();
  await expect(page.locator("#formError")).toContainText(
    "Temporary response failure",
  );
  expect(
    await page.evaluate(() => sessionStorage.getItem("bingo:host-draft:v1")),
  ).toContain("Retry after failure");
  await page.getByRole("button", { name: "Create game", exact: true }).click();
  await expect(page.locator("#shareLink")).toHaveValue(
    new RegExp(`/play/${committedId}$`),
  );
});
test("session expiry during creation preserves prompts and offers login", async ({
  page,
  context,
}) => {
  await host(context);
  await page.goto("/new.html");
  await page.getByLabel("Game name", { exact: true }).fill("Expired draft");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Fill blanks with starter prompts" })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await context.clearCookies();
  await page.getByRole("button", { name: "Create game", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Your saved draft stays here",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#formError")).toContainText(
    "Your session expired",
  );
  expect(
    await page.evaluate(() => sessionStorage.getItem("bingo:host-draft:v1")),
  ).toContain("Expired draft");
});
test("saved photos remain isolated per game and player session", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(
    () =>
      window.bingoApp?.sessionId && window.bingoApp?.bingoGrid?.cells.length,
  );
  const result = await page.evaluate(() => {
    const app = window.bingoApp;
    app.gameId = "first-game";
    app.sessionId = "first-session";
    app.storeCellImage(0, "data:image/png;base64,AA==");
    const first = app.photoStorageKey();
    app.gameId = "second-game";
    const second = app.photoStorageKey();
    app.sessionId = "second-session";
    const third = app.photoStorageKey();
    return {
      first,
      second,
      third,
      firstExists: !!localStorage.getItem(first),
      secondEmpty: !localStorage.getItem(second),
      thirdEmpty: !localStorage.getItem(third),
    };
  });
  expect(new Set([result.first, result.second, result.third]).size).toBe(3);
  expect(result.firstExists && result.secondEmpty && result.thirdEmpty).toBe(
    true,
  );
});
