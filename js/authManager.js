import { getConfig } from "./config.js";
import { showCheckedResults } from "./live-host.js";
import { button, checkedRequest, clearResultsButton, singaporeTime, statusText } from "./checked-ui.js";
import { copyLink } from "./copy-link.js";
const SIGN_IN = "https://id.string.sg/login?continue=bingo";
const isDefaultBoard = () => ["/play", "/play/", "/play.html"].includes(location.pathname);
const activeRound = (game) => game.liveRounds?.find(({ endedAt, closesAt }) => !endedAt && Date.parse(closesAt) > Date.now());
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
function cardIcon(tag, label, path, style = "btn-outline") {
  const control = node(tag, undefined, "btn " + style);
  if (tag === "button") control.type = "button";
  control.setAttribute("aria-label", label);
  control.title = label;
  control.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="${path}" />
    </svg>`;
  return control;
}
export class AuthManager {
  constructor() {
    this.user = null;
    this.isAuthenticated = false;
    this.status = "loading";
    try {
      localStorage.removeItem("bingoAuth");
    } catch {}
    document
      .getElementById("hostGameBtn")
      ?.addEventListener("click", () => this.beginHost());
    document
      .getElementById("myGamesBtn")
      ?.addEventListener("click", () => this.redirectToAdmin());
    document
      .getElementById("stringLogoutBtn")
      ?.addEventListener("click", () => this.logout());
    for (const id of ["createNewGameBtn", "createNewGameBtn2"]) {
      document
        .getElementById(id)
        ?.addEventListener("click", () => this.beginHost());
    }
    document
      .getElementById("backToGameBtn")
      ?.addEventListener("click", () => this.hideAdminDashboard());
    const account = document.querySelector(".host-account");
    if (account) {
      const summary = account.querySelector("summary");
      document.addEventListener("click", (event) => {
        if (!account.open) return;
        if (!account.contains(event.target)) account.open = false;
        else if (event.target.closest("button")) {
          account.open = false;
          summary.focus();
        }
      });
      account.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !account.open) return;
        event.preventDefault();
        account.open = false;
        summary.focus();
      });
    }
    this.ready = this.refresh();
  }
  init() {
    return this.ready;
  }
  async refresh() {
    this.config = await getConfig();
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/auth/me`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 401) {
        this.status = "signedOut";
        this.user = null;
      } else if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        this.status = "error";
        this.message =
          body.error || "Host access is temporarily unavailable. Please retry.";
        this.user = null;
      } else {
        this.user = await response.json();
        this.status = "ready";
      }
    } catch {
      this.status = "error";
      this.message =
        "Could not reach the account service. Check your connection and retry.";
      this.user = null;
    }
    this.isAuthenticated = !!this.user;
    this.updateUI();
    let intent;
    try {
      intent = sessionStorage.getItem("bingo:host-intent");
    } catch {}
    if (this.user && isDefaultBoard() && intent === "create") {
      sessionStorage.removeItem("bingo:host-intent");
      window.location.assign("/new.html");
    } else if (
      this.user &&
      isDefaultBoard() &&
      (intent === "games" ||
        new URLSearchParams(location.search).get("host") === "1")
    ) {
      try {
        sessionStorage.removeItem("bingo:host-intent");
      } catch {}
      this.showAdminDashboard();
    }
    return this.user;
  }
  updateUI() {
    const identity = document.getElementById("hostIdentity");
    if (identity) {
      identity.hidden = !this.user;
      if (!this.user) identity.open = false;
    }
    const name = document.getElementById("hostName");
    if (name) name.textContent = this.user?.name || "String member";
  }
  async beginHost() {
    await this.ready;
    if (this.user) location.assign("/new.html");
    else this.showAuthModal("create");
  }
  showAuthModal(
    intent = location.pathname.includes("new.html") ? "create" : "games",
  ) {
    let dialog = document.getElementById("hostSignInDialog");
    if (dialog) dialog.remove();
    dialog = node("dialog");
    dialog.id = "hostSignInDialog";
    dialog.className = "host-dialog";
    dialog.setAttribute("aria-labelledby", "hostSignInTitle");
    const title = node("h2", "Host a game");
    title.id = "hostSignInTitle";
    dialog.append(
      title,
      node(
        "p",
        "Create a board and share it. Players join without an account.",
      ),
    );
    if (this.status === "error")
      dialog.append(node("p", this.message, "error"));
    dialog.append(node("p", "Your saved draft stays here while you sign in."));
    const link = node("a", "Continue with String ID", "btn btn-primary");
    link.href = SIGN_IN;
    link.addEventListener("click", () => {
      try {
        sessionStorage.setItem("bingo:host-intent", intent);
      } catch {}
    });
    dialog.append(link);
    const retry = node("button", "Retry account check", "btn btn-outline");
    retry.type = "button";
    retry.onclick = async () => {
      retry.disabled = true;
      await this.refresh();
      retry.disabled = false;
      if (this.user) {
        dialog.close();
        if (intent === "demo" || intent.startsWith("lobby:") || location.pathname.includes("new.html")) location.reload();
        else location.assign("/new.html");
      } else {
        dialog.close();
        this.showAuthModal(intent);
      }
    };
    dialog.append(retry);
    const close = node("button", "Keep playing", "btn btn-secondary");
    close.type = "button";
    close.onclick = () => dialog.close();
    dialog.append(close);
    if (this.message?.includes("Connect")) {
      const profile = node(
        "a",
        "Connect your original Google account in String ID",
      );
      profile.href = "https://id.string.sg/profile";
      dialog.append(profile);
    }
    document.body.append(dialog);
    dialog.addEventListener("close", () =>
      document.getElementById("hostGameBtn")?.focus(),
    );
    dialog.showModal();
  }
  closeAuthModal() {
    document.getElementById("hostSignInDialog")?.close();
  }
  async logout() {
    const response = await fetch(`${this.config.API_BASE_URL}/auth/logout`, {
      method: "POST",
    }).catch(() => null);
    if (!response?.ok) {
      this.showError(
        "Sign-out failed. Your session may still be active. Please retry.",
      );
      return;
    }
    this.user = null;
    this.isAuthenticated = false;
    this.status = "signedOut";
    this.updateUI();
    this.hideAdminDashboard();
    this.showError(
      "Signed out of String ID on this browser, including other String apps.",
    );
    if (location.pathname.includes("new.html")) location.reload();
    else document.getElementById("hostGameBtn")?.focus();
  }
  async redirectToAdmin() {
    await this.ready;
    if (this.user) {
      if (!isDefaultBoard()) location.assign("/play?host=1");
      else this.showAdminDashboard();
    } else this.showAuthModal();
  }
  showAdminDashboard() {
    const dashboard = document.getElementById("adminDashboard");
    if (!dashboard) return;
    dashboard.style.display = "block";
    document.querySelector(".grid-container").style.display = "none";
    document.querySelector(".footer").style.display = "none";
    this.fetchUserGames();
  }
  hideAdminDashboard() {
    const dashboard = document.getElementById("adminDashboard");
    if (dashboard) dashboard.style.display = "none";
    const grid = document.querySelector(".grid-container");
    if (grid) grid.style.display = "block";
    const footer = document.querySelector(".footer");
    if (footer) footer.style.display = "block";
  }
  async fetchUserGames() {
    const list = document.getElementById("gamesList"),
      empty = document.getElementById("emptyState"),
      state = document.getElementById("gamesState");
    if (!list) return;
    list.replaceChildren();
    empty.style.display = "none";
    state.replaceChildren(node("p", "Loading your games…"));
    state.setAttribute("role", "status");
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/games`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session expired. Sign in again; your games are retained."
            : "Could not load your games. Please retry.",
        );
      const games = await response.json();
      state.replaceChildren();
      this.renderGamesList(games);
    } catch (cause) {
      state.replaceChildren(node("p", cause.message));
      const retry = node("button", "Retry", "btn btn-outline");
      retry.onclick = () => this.fetchUserGames();
      const login = node("button", "Sign in", "btn btn-outline");
      login.onclick = () => this.showAuthModal();
      state.append(retry, login);
    }
  }
  renderGamesList(games) {
    const list = document.getElementById("gamesList"),
      empty = document.getElementById("emptyState");
    list.replaceChildren();
    list.style.display = games.length ? "grid" : "none";
    empty.style.display = games.length ? "none" : "block";
    for (const game of games) {
      const card = node("article", undefined, "game-card");
      const id = encodeURIComponent(game.id);
      const meta = node("p", `${game.gridSize} × ${game.gridSize} · ${new Date(game.updatedAt).toLocaleDateString()}`, "game-meta");
      const actions = node("div", undefined, "game-actions");
      const start = button("Start", async () => {
        start.disabled = true;
        try {
          const round = await checkedRequest("/boards/" + id + "/lobby", { data: {} });
          location.assign("/host/live/" + encodeURIComponent(round.id));
        } catch (error) {
          this.showError(error.message);
          start.disabled = false;
        }
      }, "btn btn-primary game-card-start");
      const preview = node("a", "Preview", "btn btn-outline game-card-preview");
      preview.href = `/play/${id}?preview=1`;
      actions.append(start, preview, button("Results", () => this.showCardResults(game), "btn btn-outline"));
      const tools = node("div", undefined, "game-card-tools");
      const copy = cardIcon("button", "Copy link", "M10 13a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2m2 6a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l2-2");
      copy.onclick = () => this.shareGame(game);
      const edit = cardIcon("a", "Edit", "M14 5l5 5M4 20l5-1L20 8l-5-5L4 14z");
      edit.href = `/new.html?edit=${id}`;
      const remove = cardIcon("button", `Delete ${game.name}`, "M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6", "game-card-delete");
      remove.onclick = () => activeRound(game)
        ? this.showError("End the live session before deleting this game.")
        : this.deleteGame(game.id);
      tools.append(copy, edit, remove);
      card.append(node("h3", game.name), meta, actions, tools);
      list.append(card);
    }
  }
  shareGame(game) {
    const d = node("dialog", undefined, "host-dialog");
    d.setAttribute("aria-label", "Share game");
    const round = activeRound(game);
    const path = round ? "/join#pin=" + round.pin : game.isPublic !== false ? "/play/" + encodeURIComponent(game.id) : null;
    d.append(
      node("h2", `Share ${game.name}`),
      node("p", round
        ? "This link opens the student join page with the game PIN filled in."
        : path ? "Anyone with this link can play without signing in."
          : "This board is private. Open its lobby with Start to get a student link."),
    );
    const close = button("Close", () => d.close(), "btn btn-outline");
    d.addEventListener("close", () => d.remove());
    if (!path) {
      d.append(close);
      document.body.append(d);
      d.showModal();
      return;
    }
    const input = node("input");
    input.value = location.origin + path;
    input.readOnly = true;
    input.setAttribute("aria-label", "Game link");
    const status = statusText();
    d.append(input, button("Copy link", () => copyLink(input, status)), close, status);
    document.body.append(d);
    d.showModal();
    void copyLink(input, status);
  }
  showCardResults(game, selected = game.liveRounds?.[0]) {
    const shared = () => game.checked
      ? showCheckedResults("/boards/" + encodeURIComponent(game.id), game.name)
      : this.showGameResults(game.id, game.name);
    if (!selected) return shared();
    const choices = game.liveRounds.filter(({ id }) => id !== selected.id).map(round => ({
      label: "Live session · " + singaporeTime(round.startedAt || round.endedAt || round.closesAt),
      open: () => this.showCardResults(game, round),
    }));
    choices.push({ label: "Shared board results", open: shared });
    return showCheckedResults("/rounds/" + encodeURIComponent(selected.id), game.name, undefined, choices);
  }
  async showGameResults(id, name) {
    const path = `${this.config.API_BASE_URL}/games/${encodeURIComponent(id)}/results`;
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      this.showError("Could not load results. Retry or sign in again.");
      return;
    }
    const version = response.headers.get("X-Bingo-Results-Version");
    this.renderResultsModal(name, await response.json(), async () => {
      const cleared = await fetch(path + "/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (!cleared.ok) throw new Error((await cleared.json().catch(() => ({}))).error || "Could not clear results. Please retry.");
      await this.showGameResults(id, name);
    });
  }
  renderResultsModal(name, sessions, clear) {
    const d = node("dialog", undefined, "host-dialog");
    d.setAttribute("aria-label", "Game results");
    d.append(node("h2", `Results: ${name}`));
    if (!sessions.length)
      d.append(
        node("p", "No players yet. Share your game link to invite them."),
      );
    const table = node("table");
    const head = node("tr");
    for (const title of ["Player", "Status", "First bingo"])
      head.append(node("th", title));
    table.append(head);
    for (const session of sessions) {
      const row = node("tr");
      for (const value of [
        session.playerName || "Anonymous",
        session.isCompleted ? "Bingo" : "Playing",
        session.completedAt
          ? new Date(session.completedAt).toLocaleString()
          : "—",
      ])
        row.append(node("td", value));
      table.append(row);
    }
    const status = statusText();
    d.append(table, status);
    if (sessions.length && clear) {
      d.append(clearResultsButton("this board’s shared link", async () => {
        await clear();
        d.close();
        d.remove();
      }, status));
    }
    const close = node("button", "Close", "btn btn-secondary");
    close.onclick = () => {
      d.close();
      d.remove();
    };
    d.append(close);
    document.body.append(d);
    d.showModal();
  }
  async deleteGame(id) {
    if (!confirm("Delete this game and its results?")) return;
    const r = await fetch(
      `${this.config.API_BASE_URL}/games/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (r.ok) this.fetchUserGames();
    else this.showError((await r.json().catch(() => ({}))).error || "Could not delete the game. Retry or sign in again.");
  }
  showError(message) {
    const status = document.getElementById("status");
    if (status) {
      status.textContent = message;
      status.className = "status error";
      status.style.display = "block";
      status.setAttribute("role", "alert");
    }
  }
  getUser() {
    return this.user;
  }
  isLoggedIn() {
    return this.isAuthenticated;
  }
  getAuthHeaders() {
    return {};
  }
}
