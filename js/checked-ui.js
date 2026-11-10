import { getConfig } from "./config.js";

export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function button(label, onClick, className = "btn btn-primary") {
  const node = el("button", label, className);
  node.type = "button";
  node.onclick = onClick;
  return node;
}

export function statusText(text = "") {
  const node = el("p", text);
  node.setAttribute("role", "status");
  return node;
}

export function clearResultsButton(scope, clear, status) {
  const control = button("Clear results", async () => {
    if (!confirm(`Clear saved progress and results for ${scope}? This cannot be undone.`)) return;
    control.disabled = true;
    try {
      await clear();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      control.disabled = false;
    }
  }, "btn btn-danger");
  return control;
}

export function panel() {
  document.querySelector(".grid-container").hidden = true;
  document.querySelector("main .footer").hidden = true;
  const node = document.getElementById("livePanel");
  node.hidden = false;
  return node;
}

export function singaporeTime(value) {
  const date = new Date(value);
  const options = { timeZone: "Asia/Singapore" };
  return date.toLocaleDateString("en-SG", { ...options, dateStyle: "medium" }) +
    ", " + date.toLocaleTimeString("en-SG", { ...options, timeStyle: "medium" }) + " SGT";
}

export async function checkedRequest(path, { token, data, signal } = {}) {
  const response = await fetch((await getConfig()).API_BASE_URL + "/checked" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { "x-bingo-player": token } : {}),
      ...(data === undefined ? {} : { "content-type": "application/json" }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
    signal: signal || AbortSignal.timeout(8000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok && body.outcome !== "cooldown")
    throw Object.assign(new Error(body.error || "Could not reach Bingo. Please retry."), { status: response.status });
  return body;
}
