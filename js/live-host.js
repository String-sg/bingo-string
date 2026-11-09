import { button, checkedRequest, el, panel, singaporeTime, statusText } from "./checked-ui.js";

const modeLabel = { photo: "Photo (on player’s device)", typed: "Typed answer", manual: "Host check", free: "Free centre" };
const studentLink = () => {
  const link = el("a", location.host + "/join");
  link.href = "/join";
  return link;
};

function signIn(container, auth) {
  container.append(
    el("h1", "Host the Bingo demo"),
    button("Sign in with String ID", () => auth.showAuthModal("demo")),
    el("p", "Students join at "),
  );
  container.lastChild.append(studentLink());
}

export async function openDemo(auth) {
  const { active } = await checkedRequest("/demo").catch(() => ({ active: false }));
  if (!active) return false;
  const container = panel();
  await auth.ready;
  if (!auth.isLoggedIn()) {
    signIn(container, auth);
    return true;
  }
  try {
    const { id } = await checkedRequest("/demo", { data: {} });
    location.replace("/host/live/" + encodeURIComponent(id));
  } catch (error) {
    container.append(el("h1", "Bingo demo"), el("p", error.message), studentLink());
  }
  return true;
}

export async function openLobby(id, auth) {
  const container = panel();
  await auth.ready;
  if (!auth.isLoggedIn()) {
    signIn(container, auth);
    return;
  }
  const path = "/rounds/" + encodeURIComponent(id);
  const title = el("h1", "Bingo lobby");
  const join = el("p", "Join at ");
  join.append(studentLink());
  const pin = el("p", "", "live-pin");
  pin.setAttribute("aria-label", "Game PIN");
  const roster = el("ul", undefined, "live-roster");
  const count = statusText("Loading players…");
  const status = statusText();
  const actions = el("div", undefined, "live-actions");
  const start = button("Start", () => control("start"));
  const end = button("End session", () => control("end"), "btn btn-secondary");
  const results = button("Private results", () => showCheckedResults(path, title.textContent), "btn btn-outline");
  actions.append(start, end, results);
  actions.hidden = true;
  container.append(title, join, pin, count, roster, actions, status);
  let controlBusy = false;
  let ended = false;
  let lastRoster = "";
  async function refresh() {
    const data = await checkedRequest(path + "/lobby");
    title.textContent = data.name;
    pin.textContent = data.pin;
    count.textContent = `${data.players.length} joined`;
    const names = JSON.stringify(data.players);
    if (names !== lastRoster) {
      roster.replaceChildren(...data.players.map(({ nickname }) => el("li", nickname)));
      lastRoster = names;
    }
    ended = data.status === "ended";
    actions.hidden = false;
    join.hidden = pin.hidden = ended;
    start.hidden = data.status !== "waiting";
    end.hidden = ended;
    status.textContent = ended ? "Session ended" : data.status === "playing" ? "Playing" : "Waiting for players";
  }
  async function control(action) {
    if (controlBusy) return;
    controlBusy = true;
    start.disabled = end.disabled = true;
    try {
      if (action === "end") {
        const { players } = await checkedRequest(path + "/results");
        const pending = players.reduce((total, player) => total + player.pending.length, 0);
        if (!confirm(pending ? `End session with ${pending} pending checks?` : "End this session?")) return;
      }
      await checkedRequest(path + "/control", { data: { action } });
      await refresh();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      controlBusy = start.disabled = end.disabled = false;
    }
  }
  async function poll() {
    try { await refresh(); }
    catch (error) {
      status.textContent = error.message;
      if (error.status === 403 || error.status === 404 || error.status === 401) return;
    }
    if (!ended) setTimeout(poll, 1200);
  }
  await poll();
}

export async function showCheckedResults(path, name) {
  const dialog = el("dialog", undefined, "host-dialog checked-results");
  dialog.setAttribute("aria-label", "Game results");
  const status = statusText();
  const content = el("div");
  const refresh = button("Refresh results", load, "btn btn-outline");
  const close = button("Close", () => dialog.close(), "btn btn-secondary");
  dialog.append(el("h2", "Results · " + name), status, content, refresh, close);
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();

  async function load() {
    refresh.disabled = true;
    status.textContent = "Loading results…";
    try {
      const { players } = await checkedRequest(path + "/results");
      status.textContent = players.length ? "" : "No players yet.";
      const rows = players.map((player) => {
        const row = el("section", undefined, "checked-result");
        row.append(el("h3", player.nickname));
        if (player.completedAt) {
          const tied = players.some((other) => other.id !== player.id && other.completedAt === player.completedAt);
          row.append(el("p", "Bingo completed " + singaporeTime(player.completedAt) + (tied ? " · tied" : "")));
          const details = el("details");
          details.append(el("summary", "First winning line"));
          const line = el("ol");
          for (const tile of player.line || [])
            line.append(el("li", `${tile.prompt} · ${modeLabel[tile.mode]}${tile.text === undefined ? "" : " · " + tile.text}`));
          details.append(line);
          row.append(details);
        }
        for (const check of player.pending) {
          const review = el("div", undefined, "live-actions");
          review.append(el("p", check.text === undefined ? check.prompt : check.prompt + " · " + check.text));
          for (const [decision, label] of [["approve", "Approve"], ["return", "Return"]]) {
            const action = button(label, async () => {
              for (const child of review.querySelectorAll("button")) child.disabled = true;
              try {
                await checkedRequest(path + "/review", { data: {
                  entryId: player.id, index: check.index, requestId: check.requestId, decision,
                } });
                await load();
              } catch (error) {
                status.textContent = error.message;
                for (const child of review.querySelectorAll("button")) child.disabled = false;
              }
            });
            review.append(action);
          }
          row.append(review);
        }
        return row;
      });
      content.replaceChildren(...rows);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      refresh.disabled = false;
    }
  }
  await load();
}
