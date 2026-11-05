import { getConfig } from "./config.js";
const SIGN_IN = "https://id.string.sg/login?continue=bingo";
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
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
    if (this.user && window.location.pathname === "/" && intent === "create") {
      sessionStorage.removeItem("bingo:host-intent");
      window.location.assign("/new.html");
    } else if (
      this.user &&
      window.location.pathname === "/" &&
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
    if (identity) identity.hidden = !this.user;
    const name = document.getElementById("hostName");
    if (name) name.textContent = this.user?.name || "String member";
    const myGames = document.getElementById("myGamesBtn");
    if (myGames) myGames.hidden = !this.user;
  }
  async beginHost() {
    await this.ready;
    if (this.user) location.assign("/new.html");
    else this.showAuthModal("create");
  }
  showAuthModal(
    intent = location.pathname.includes("new.html") ? "create" : "games",
  ) {
    try {
      sessionStorage.setItem("bingo:host-intent", intent);
    } catch {}
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
    dialog.append(link);
    const retry = node("button", "Retry account check", "btn btn-outline");
    retry.type = "button";
    retry.onclick = async () => {
      retry.disabled = true;
      await this.refresh();
      retry.disabled = false;
      if (this.user) {
        dialog.close();
        if (location.pathname.includes("new.html")) location.reload();
        else location.assign("/new.html");
      } else {
        dialog.close();
        this.showAuthModal();
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
  }
  async redirectToAdmin() {
    await this.ready;
    if (this.user) {
      if (location.pathname !== "/") location.assign("/?host=1");
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
      card.append(
        node("h3", game.name),
        node(
          "p",
          `${game.gridSize} × ${game.gridSize} · ${new Date(game.updatedAt).toLocaleDateString()}`,
          "game-meta",
        ),
      );
      const actions = node("div", undefined, "game-actions");
      const preview = node("a", "Preview", "btn btn-sm btn-outline");
      preview.href = `/play/${encodeURIComponent(game.id)}?preview=1`;
      actions.append(preview);
      for (const [label, fn, style] of [
        ["Share", () => this.shareGame(game), "outline"],
        ["Results", () => this.showGameResults(game.id, game.name), "outline"],
        ["Delete", () => this.deleteGame(game.id), "danger"],
      ]) {
        const b = node("button", label, `btn btn-sm btn-${style}`);
        b.type = "button";
        b.onclick = fn;
        actions.append(b);
      }
      card.append(actions);
      list.append(card);
    }
  }
  shareGame(game) {
    const d = node("dialog", undefined, "host-dialog");
    d.setAttribute("aria-label", "Share game");
    d.append(
      node("h2", `Share ${game.name}`),
      node("p", "Anyone with this link can play without signing in."),
    );
    const input = node("input");
    input.value = `${location.origin}/play/${encodeURIComponent(game.id)}`;
    input.readOnly = true;
    input.setAttribute("aria-label", "Game link");
    d.append(input);
    const copy = node("button", "Copy link", "btn btn-primary");
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(input.value);
        copy.textContent = "Copied";
      } catch {
        input.select();
        copy.textContent = "Select and copy the link";
      }
    };
    const close = node("button", "Close", "btn btn-secondary");
    close.onclick = () => {
      d.close();
      d.remove();
    };
    d.append(copy, close);
    document.body.append(d);
    d.showModal();
  }
  async showGameResults(id, name) {
    const response = await fetch(
      `${this.config.API_BASE_URL}/games/${encodeURIComponent(id)}/results`,
    );
    if (!response.ok) {
      this.showError("Could not load results. Retry or sign in again.");
      return;
    }
    this.renderResultsModal(name, await response.json());
  }
  renderResultsModal(name, sessions) {
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
    d.append(table);
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
    else this.showError("Could not delete the game. Retry or sign in again.");
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
