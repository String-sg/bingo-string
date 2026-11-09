import assert from "node:assert/strict";
import { chromium, devices, expect } from "@playwright/test";
import { hostCookie, protection, target } from "./fixtures/checked-client.mjs";

const browser = await chromium.launch();
try {
  const teacherContext = await browser.newContext();
  const phoneContext = await browser.newContext(devices["iPhone 12"]);
  const manualContext = await browser.newContext(devices["iPhone 12"]);
  if (Object.keys(protection).length) {
    for (const context of [teacherContext, phoneContext, manualContext]) {
      await context.route(target + "/**", (route) =>
        route.continue({ headers: { ...route.request().headers(), ...protection } }));
    }
  }
  await teacherContext.addCookies([{ name: "string_session", value: hostCookie, url: target, httpOnly: true }]);
  const teacher = await teacherContext.newPage();
  await teacher.goto(target + "/play");
  await teacher.waitForURL("**/host/live/*");
  const pinLabel = teacher.getByLabel("Game PIN");
  await expect(pinLabel).toHaveText(/^\d{6}$/);
  const pin = await pinLabel.textContent();
  const scan = teacher.getByRole("link", { name: "Scan to join", exact: true });
  await expect(scan).toHaveAttribute("href", target + "/join#pin=" + pin);
  await expect.poll(() => scan.locator("img").evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  const phone = await phoneContext.newPage();
  await phone.goto(await scan.getAttribute("href"));
  await expect(phone.getByLabel("Game PIN")).toHaveValue(pin);
  await expect(phone.getByLabel("Nickname")).toHaveValue("");
  await phone.getByLabel("Nickname").fill("QR pupil");
  await phone.getByRole("button", { name: "Join", exact: true }).click();
  await expect(phone.getByText("Waiting for your teacher to start")).toBeVisible();
  assert.equal(new URL(phone.url()).hash, "");
  await phone.goto(target + "/join#pin=" + pin);
  await expect(phone.getByText("Waiting for your teacher to start")).toBeVisible();
  await expect(teacher.getByText("1 joined")).toBeVisible();

  const manual = await manualContext.newPage();
  await manual.goto(target + "/join#pin=not-a-pin");
  await expect(manual.getByLabel("Game PIN")).toHaveValue("");
  await manual.getByLabel("Game PIN").fill(pin);
  await manual.getByLabel("Nickname").fill("PIN pupil");
  await manual.getByRole("button", { name: "Join", exact: true }).click();
  await expect(teacher.getByText("2 joined")).toBeVisible();
  await teacher.getByRole("button", { name: "Start", exact: true }).click();
  await expect(phone.locator(".bingo-cell")).toHaveCount(9);
  await expect(manual.locator(".bingo-cell")).toHaveCount(9);
  teacher.once("dialog", (dialog) => dialog.accept());
  await teacher.getByRole("button", { name: "End session", exact: true }).click();
  await expect(scan).toBeHidden();
  await expect(phone.getByRole("heading", { name: "Session ended" })).toBeVisible();
  console.log("PASS QR image and destination, PIN prefill, nickname requirement, resume, manual join, Start and End");
} finally {
  await browser.close();
}
