import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export const target = new URL(process.env.BINGO_TEST_TARGET || "http://127.0.0.1:5186").origin;
const hostname = new URL(target).hostname;
assert.ok(["localhost", "127.0.0.1"].includes(hostname) || hostname.endsWith(".vercel.app"), "Use a loopback or isolated Vercel preview.");
export const hostCookie = process.env.BINGO_TEST_HOST_COOKIE || "d".repeat(64);
export const otherCookie = process.env.BINGO_TEST_OTHER_COOKIE || "e".repeat(64);
const oidc = hostname.endsWith(".vercel.app") && process.env.VERCEL_OIDC_TOKEN;
const bypass = process.env.BINGO_TEST_VERCEL_BYPASS;
export const protection = oidc ? { "x-vercel-trusted-oidc-idp-token": oidc } :
  bypass ? { "x-vercel-protection-bypass": bypass } : {};
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function request(path, { data, token, host, status = 200, authorization, method } = {}) {
  const started = performance.now();
  const response = await fetch(target + "/api" + path, {
    method: method || (data === undefined ? "GET" : "POST"),
    headers: {
      origin: target,
      ...protection,
      ...(host ? { cookie: "string_session=" + host } : {}),
      ...(token ? { "x-bingo-player": token } : {}),
      ...(data === undefined ? {} : { "content-type": "application/json" }),
      ...(authorization ? { authorization } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  const ms = performance.now() - started;
  const body = await response.json().catch(() => null);
  assert.equal(response.status, status, `${path} HTTP ${response.status}${body?.error ? " " + body.error : ""}`);
  assert.ok(body, `${path} must return JSON`);
  return { body, ms };
}

export const guest = () => randomUUID();
export const join = (token, pin, nickname) => request("/checked/join", { token, data: { pin, nickname } });
export const control = (id, action, host = hostCookie, status = 200) =>
  request(`/checked/rounds/${id}/control`, { host, status, data: { action } });
export const state = (id, token) => request(`/checked/rounds/${id}/state`, { token });
export const move = (id, token, action, index, text, requestId = randomUUID(), status = 200) =>
  request(`/checked/rounds/${id}/action`, { token, status, data: { requestId, action, index, text } });
export const results = (id, host = hostCookie, status = 200) =>
  request(`/checked/rounds/${id}/results`, { host, status });
export const review = (id, player, pending, decision = "approve", host = hostCookie, status = 200) =>
  request(`/checked/rounds/${id}/review`, {
    host, status, data: { entryId: player.id, index: pending.index, requestId: pending.requestId, decision },
  });
