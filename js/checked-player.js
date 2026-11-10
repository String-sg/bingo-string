import { button, checkedRequest, el, panel, singaporeTime, statusText } from "./checked-ui.js";

const liveKey = "bingo:live-player";
const joinKey = "bingo:join-token";
function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); }
  catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* The current tab can still play. */ }
}
function field(label, input) {
  const node = el("label", label);
  node.append(input);
  return node;
}

export class CheckedPlayer {
  constructor(app, boardId) {
    this.app = app;
    this.live = !boardId;
    this.status = statusText();
    this.receipt = button("Show Bingo time", () => this.showReceipt(), "btn btn-outline");
    this.receipt.hidden = true;
    this.boardReady = !!boardId;
    this.revision = -1;
    if (boardId) {
      this.path = "/boards/" + encodeURIComponent(boardId);
      this.key = "bingo:checked:" + boardId;
    }
    document.querySelector("main .footer").prepend(this.receipt, this.status);
  }

  async connect() {
    if (this.live) {
      document.querySelector(".host-header nav").hidden = true;
      const previous = read(liveKey);
      if (!previous?.id || !previous.token) return this.joinForm();
      this.path = "/rounds/" + encodeURIComponent(previous.id);
      this.token = previous.token;
      this.app.gameId = "live-" + previous.id;
      panel().replaceChildren(el("h1", "bingo"), this.status);
    } else {
      this.token = read(this.key);
      if (!this.token) return this.joinForm();
    }
    this.app.sessionId = this.token;
    await this.poll();
  }

  joinForm(message = "") {
    const container = panel();
    const form = el("form", undefined, "live-form");
    const pin = el("input");
    pin.inputMode = "numeric";
    pin.pattern = "[0-9]{6}";
    pin.maxLength = 6;
    pin.required = this.live;
    pin.autocomplete = "off";
    const nickname = el("input");
    nickname.maxLength = 40;
    nickname.required = true;
    nickname.autocomplete = "off";
    if (this.live) form.append(field("Game PIN", pin));
    form.append(field("Nickname", nickname), el("p", "Your teacher can see your nickname and submitted evidence."));
    const join = el("button", "Join", "btn btn-primary");
    join.type = "submit";
    form.append(join, this.status);
    this.status.textContent = message;
    container.replaceChildren(el("h1", this.live ? "Join bingo" : "Join this board"), form);
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (join.disabled) return;
      join.disabled = true;
      this.token ||= read(joinKey + (this.key || "")) || crypto.randomUUID();
      save(joinKey + (this.key || ""), this.token);
      try {
        const data = await checkedRequest(this.live ? "/join" : this.path + "/join", {
          token: this.token, data: { nickname: nickname.value, ...(this.live ? { pin: pin.value } : {}) },
        });
        if (this.live) {
          this.path = "/rounds/" + encodeURIComponent(data.roundId);
          this.app.gameId = "live-" + data.roundId;
          save(liveKey, { id: data.roundId, token: this.token });
        } else save(this.key, this.token);
        save(joinKey + (this.key || ""), null);
        this.app.sessionId = this.token;
        await this.apply(data);
        this.schedule();
      } catch (error) {
        this.status.textContent = error.message;
      } finally {
        join.disabled = false;
      }
    };
  }

  schedule() {
    clearTimeout(this.timer);
    if (!this.closed) this.timer = setTimeout(() => this.poll(), 1200);
  }

  async poll() {
    try {
      const data = await checkedRequest(this.path + "/state", { token: this.token });
      await this.apply(data);
      if (this.pending && !this.closed) await this.flush();
    } catch (error) {
      if (error.status === 404 || error.status === 401) {
        this.token = null;
        this.pending = null;
        this.revision = -1;
        this.completedAt = null;
        this.receipt.hidden = true;
        this.app.sessionId = null;
        save(this.live ? liveKey : this.key, null);
        return this.joinForm(error.message);
      }
      this.status.textContent = "Waiting to sync. Reconnecting…";
    }
    this.schedule();
  }

  async apply(data) {
    if (this.closed && data.status !== "ended") return;
    if (data.player.revision < this.revision && data.status !== "ended") return;
    this.revision = Math.max(this.revision, data.player.revision);
    const wasPlaying = this.playing;
    this.playing = data.status === "playing";
    if (data.player.completedAt) {
      const first = !this.completedAt;
      this.completedAt = data.player.completedAt;
      this.receipt.hidden = false;
      if (first && wasPlaying) this.showReceipt();
    }
    if (data.status === "ended") {
      this.closed = true;
      this.pending = null;
      if (this.form?.open) this.form.close();
      const another = button("Join another game", () => {
        save(liveKey, null);
        location.reload();
      }, "btn btn-outline");
      const actions = el("div", undefined, "button-row");
      actions.append(this.receipt, another, document.getElementById("downloadBtn"));
      panel().replaceChildren(el("h1", "Session ended"), el("p", data.name), actions);
      return;
    }
    if (!this.playing) {
      this.status.textContent = "Waiting for your teacher to start";
      if (!this.waiting) panel().replaceChildren(el("h1", data.name), this.status);
      this.waiting = true;
      return;
    }

    if (!this.boardReady) {
      this.loadingBoard ||= this.app.setupGrid(data.challenges, data.gridSize).then(() => {
        this.boardReady = true;
        this.app.setupEventListeners();
        this.app.setupTouchManager();
        this.app.loadCellImages(false);
      });
      await this.loadingBoard;
      if (this.closed || data.player.revision < this.revision) return;
    }
    document.getElementById("livePanel").hidden = true;
    document.querySelector(".grid-container").hidden = false;
    const footer = document.querySelector("main .footer");
    footer.hidden = false;
    if (this.status.parentNode !== footer) footer.prepend(this.status);
    if (this.receipt.parentNode !== footer) footer.prepend(this.receipt);
    if (this.waiting) {
      this.waiting = false;
      this.app.bingoGrid.cells[0]?.focus();
    }
    if (!this.pending && this.status.textContent.startsWith("Waiting")) this.status.textContent = "";
    this.draw(data.player);
  }

  draw(player) {
    const grid = this.app.bingoGrid;
    if (!grid) return;
    grid.removeBingoHighlight();
    grid.completedCells.clear();
    grid.cells.forEach((cell, index) => {
      const free = grid.gridSize === 5 && index === 12;
      const state = free ? "done" : player.tiles[index];
      const done = state === "done";
      cell.classList.toggle("completed", done);
      cell.setAttribute("aria-pressed", String(done));
      if (done) grid.completedCells.add(index);
      const badge = cell.querySelector(".tile-mode");
      if (badge) {
        badge.textContent = { pending: "Waiting for check", returned: "Try again", done: "Complete" }[state] ||
          (grid.challenges[index].mode === "typed" ? "Typed answer" : "Host check");
      }
    });
    if (player.line?.every((index) => grid.completedCells.has(index)))
      grid.highlightBingoLine(player.line);
  }

  showReceipt() {
    if (!this.completedAt) return;
    document.getElementById("bingoTime").textContent = "Completed " + singaporeTime(this.completedAt);
    document.getElementById("bingoTime").hidden = false;
    this.app.handleBingo();
  }

  openTile(index, tile) {
    const cell = this.app.bingoGrid.cells[index];
    if (cell.classList.contains("completed") || this.pending) return;
    if (cell.querySelector(".tile-mode")?.textContent === "Waiting for check") {
      this.status.textContent = "Waiting for your teacher to check this tile.";
      return;
    }
    const typed = tile.mode === "typed";
    const dialog = el("dialog", undefined, "host-dialog");
    dialog.setAttribute("aria-label", tile.text);
    const form = el("form", undefined, "live-form");
    const input = el("input");
    input.maxLength = 160;
    input.required = typed;
    input.autocomplete = "off";
    const error = statusText();
    const submit = el("button", typed ? "Submit answer" : "Request host check", "btn btn-primary");
    submit.type = "submit";
    form.append(field(typed ? "Your answer" : "Answer or note (optional)", input), submit, error,
      button("Close", () => dialog.close(), "btn btn-secondary"));
    dialog.append(el("h2", tile.text), form);
    document.body.append(dialog);
    this.form = dialog;
    dialog.addEventListener("close", () => { dialog.remove(); cell.focus(); });
    form.onsubmit = (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      this.send(tile.mode, index, input.value, (message) => {
        submit.disabled = false;
        if (message) error.textContent = message;
        else if (dialog.open) dialog.close();
      });
    };
    dialog.showModal();
    input.focus();
  }

  send(action, index, text, after) {
    if (!this.playing || this.pending) return after?.("Wait for the previous update to finish.");
    this.pending = { data: { requestId: crypto.randomUUID(), action, index, text }, after };
    void this.flush();
  }

  async flush() {
    if (this.sending || !this.pending) return;
    this.sending = true;
    const { data, after } = this.pending;
    try {
      const result = await checkedRequest(this.path + "/action", { token: this.token, data });
      this.pending = null;
      await this.apply(result);
      const message = result.outcome === "miss" ? "Try again." :
        result.outcome === "cooldown" ? `Try again in ${result.retryAfter} seconds.` : "";
      this.status.textContent = after ? "" : message;
      after?.(message);
    } catch (error) {
      if (!error.status || error.status >= 500) {
        this.status.textContent = "Waiting to sync. Reconnecting…";
      } else {
        this.pending = null;
        this.status.textContent = error.message;
        after?.(error.message);
      }
    } finally {
      this.sending = false;
    }
  }
}
