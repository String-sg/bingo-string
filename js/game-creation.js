import { getConfig } from "./config.js";
import { AuthManager } from "./authManager.js";
import { copyLink } from "./copy-link.js";
import { DRAFT_KEY, parseChallengeCsv, STARTERS } from "./host-draft.js";
const $ = (id) => document.getElementById(id);
class GameCreationApp {
  constructor() {
    this.authManager = new AuthManager();
    this.step = 0;
    this.busy = false;
    this.editId = new URLSearchParams(location.search).get("edit");
    this.draftKey = this.editId ? `${DRAFT_KEY}:${this.editId}` : DRAFT_KEY;
    this.draft = {
      name: "",
      size: 3,
      prompts: Array(24).fill(""),
      modes: Array(24).fill("photo"),
      aliases: Array(24).fill(""),
      createKey: crypto.randomUUID(),
    };
    this.init();
  }
  async init() {
    if (this.editId) {
      document.title = "Edit game · bingo";
      $("editorTitle").textContent = "Edit game";
      $("editorIntro").textContent = "Update your board and review the changes before saving.";
    }
    this.bind();
    await this.authManager.ready;
    this.config = await getConfig();
    if (this.editId && this.authManager.isLoggedIn()) {
      try {
        await this.loadGame();
      } catch (cause) {
        $("authGate").textContent = cause.message;
        return;
      }
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(this.draftKey) || "null");
      if (saved && (!this.editId || (this.board && saved.version === this.board.updatedAt)) &&
          [3, 5].includes(saved.size) && Array.isArray(saved.prompts))
        this.draft = {
          ...this.draft,
          ...saved,
          modes: Array.from({ length: 24 }, (_, i) =>
            ["typed", "manual"].includes(saved.modes?.[i]) ? saved.modes[i] : "photo",
          ),
          aliases: Array.from({ length: 24 }, (_, i) => String(saved.aliases?.[i] || "").slice(0, 3300)),
          prompts: Array.from({ length: 24 }, (_, i) =>
            String(saved.prompts[i] || "").slice(0, 100),
          ),
        };
    } catch {}
    $("gameName").value = this.draft.name;
    document.querySelector(
      `input[name=gridSize][value="${this.draft.size}"]`,
    ).checked = true;
    this.renderPrompts();
    this.updateAuth();
  }
  async loadGame() {
    this.editorPath = `${this.config.API_BASE_URL}/games/${encodeURIComponent(this.editId)}/editor`;
    const response = await fetch(this.editorPath, { cache: "no-store" });
    const board = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(board.error || "Could not open the editor. Please retry.");
    this.board = board;
    if (!board.isPublic)
      $("reviewAudience").textContent = "This board is private. Students join live sessions with a PIN.";
    this.draft.name = board.name;
    this.draft.size = board.gridSize;
    this.draft.version = board.updatedAt;
    const tiles = board.challengesJson.filter((_, i) => board.gridSize !== 5 || i !== 12);
    tiles.forEach((tile, i) => {
      this.draft.prompts[i] = tile.text;
      this.draft.modes[i] = tile.mode || "photo";
      this.draft.aliases[i] = tile.aliases?.join("\n") || "";
    });
    this.updateEditNotice();
  }
  updateEditNotice() {
    const notice = $("editNotice");
    notice.hidden = false;
    notice.textContent = this.board.canEdit
      ? "Saving changes keeps this board’s link."
      : "Save a copy to keep the original board and its results.";
    $("createGameBtn").textContent = this.submitLabel();
  }
  submitLabel() {
    return this.board ? (this.board.canEdit ? "Save changes" : "Save as copy") : "Create game";
  }
  signIn() {
    this.authManager.showAuthModal(this.editId ? `edit:${this.editId}` : "create");
  }
  updateAuth() {
    const ready = this.authManager.isLoggedIn();
    $("wizard").hidden = !ready;
    $("editorSignIn").hidden = ready;
    $("authGate").hidden = ready;
    $("authGate").textContent =
      this.authManager.status === "error"
        ? this.authManager.message
        : "Sign in with String ID to create and manage your game. Your draft stays here.";
    if (ready) this.showStep(0);
  }
  bind() {
    $("editorSignIn").onclick = () => this.signIn();
    $("gameName").oninput = () => {
      this.draft.name = $("gameName").value;
      this.save();
    };
    document.querySelectorAll("input[name=gridSize]").forEach(
      (input) =>
        (input.onchange = () => {
          this.draft.size = Number(input.value);
          this.renderPrompts();
          this.save();
        }),
    );
    $("starterBtn").onclick = () => {
      this.draft.prompts = this.draft.prompts.map((v, i) =>
        v.trim() ? v : STARTERS[i],
      );
      this.renderPrompts();
      this.save();
    };
    $("csvFile").onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 100000)
          throw new Error("CSV must be smaller than 100 KB.");
        let values = parseChallengeCsv(await file.text());
        if (
          this.draft.size === 5 &&
          values.length === 25 &&
          values[12].toUpperCase() === "FREE"
        )
          values.splice(12, 1);
        const needed = this.count();
        if (values.length !== needed)
          throw new Error(
            `This board needs exactly ${needed} prompts; the CSV contains ${values.length}.`,
          );
        values.forEach((v, i) => {
          this.draft.prompts[i] = v;
          this.draft.modes[i] = "photo";
          this.draft.aliases[i] = "";
        });
        this.renderPrompts();
        this.save();
        this.error("");
      } catch (cause) {
        this.error(cause.message);
      } finally {
        e.target.value = "";
      }
    };
    $("previousBtn").onclick = () => this.showStep(this.step - 1);
    $("nextBtn").onclick = () => {
      if (this.validate()) this.showStep(this.step + 1);
    };
    $("createGameBtn").onclick = () => this.handleGameSubmit();
    $("copyLinkBtn").onclick = () => copyLink($("shareLink"), $("shareStatus"));
  }
  count() {
    return this.draft.size === 3 ? 9 : 24;
  }
  save() {
    try {
      sessionStorage.setItem(this.draftKey, JSON.stringify(this.draft));
      $("draftNote").textContent = "Draft saved in this browser tab.";
    } catch {
      $("draftNote").textContent =
        "Browser storage is unavailable. Keep this tab open to retain your draft.";
    }
    this.updateCount();
  }
  updateCount() {
    const n = this.draft.prompts
      .slice(0, this.count())
      .filter((v) => v.trim()).length;
    $("promptCount").textContent = `${n} of ${this.count()} challenges ready`;
  }
  renderPrompts() {
    const list = $("promptList");
    list.replaceChildren();
    for (let i = 0; i < this.count(); i++) {
      const label = document.createElement("label");
      label.htmlFor = `prompt-${i}`;
      label.textContent = `Challenge ${i + 1}`;
      const input = document.createElement("textarea");
      input.id = `prompt-${i}`;
      input.maxLength = 100;
      input.rows = 2;
      input.value = this.draft.prompts[i];
      input.placeholder = "An action players can complete";
      input.oninput = () => {
        this.draft.prompts[i] = input.value;
        input.removeAttribute("aria-invalid");
        this.save();
      };
      label.append(input);
      const mode = document.createElement("select");
      mode.setAttribute("aria-label", `Mode for challenge ${i + 1}`);
      for (const [value, name] of [["photo", "Photo"], ["typed", "Typed answer"], ["manual", "Host check"]])
        mode.add(new Option(name, value));
      mode.value = this.draft.modes[i];
      const answers = document.createElement("textarea");
      answers.rows = 3;
      answers.maxLength = 3300;
      answers.placeholder = "One accepted answer or alias per line";
      answers.setAttribute("aria-label", `Accepted answers for challenge ${i + 1}`);
      answers.value = this.draft.aliases[i];
      answers.hidden = mode.value !== "typed";
      answers.oninput = () => {
        this.draft.aliases[i] = answers.value;
        this.save();
      };
      mode.onchange = () => {
        this.draft.modes[i] = mode.value;
        answers.hidden = mode.value !== "typed";
        this.save();
      };
      const tile = document.createElement("div");
      tile.className = "editor-tile";
      tile.append(label, mode, answers);
      list.append(tile);
    }
    this.updateCount();
  }
  error(message) {
    $("formError").textContent = message;
    if (message) $("formError").focus();
  }
  validate() {
    if (!this.draft.name.trim()) {
      this.error("Give your game a name before continuing.");
      $("gameName").focus();
      return false;
    }
    if (this.step >= 1) {
      const missing = this.draft.prompts
        .slice(0, this.count())
        .findIndex((v) => !v.trim());
      if (missing >= 0) {
        this.error(
          `Add challenge ${missing + 1} before continuing. Fill blanks with starter prompts if you need ideas.`,
        );
        const field = $(`prompt-${missing}`);
        field.setAttribute("aria-invalid", "true");
        field.focus();
        return false;
      }
    }
    if (this.step >= 1) {
      const badKey = this.challenges().findIndex(({ mode, aliases }) =>
        mode === "typed" && (!aliases.length || aliases.length > 20 || aliases.some((value) => value.length > 160)),
      );
      if (badKey >= 0) {
        this.error(`Enter 1 to 20 accepted answers of up to 160 characters for tile ${badKey + 1}.`);
        return false;
      }
    }
    this.error("");
    return true;
  }
  challenges() {
    const tiles = this.draft.prompts.slice(0, this.count()).map((text, index) => {
      const mode = this.draft.modes[index];
      return {
        text: text.trim(),
        mode,
        ...(mode === "typed" ? { aliases: this.draft.aliases[index].split(/\r?\n/).map((value) => value.trim()).filter(Boolean) } : {}),
      };
    });
    if (this.draft.size === 5) tiles.splice(12, 0, { text: "FREE" });
    return tiles.map((tile, i) => ({ id: `q${i}`, ...tile }));
  }
  showStep(step) {
    this.step = Math.max(0, Math.min(2, step));
    this.error("");
    document
      .querySelectorAll("[data-step]")
      .forEach((el) => (el.hidden = Number(el.dataset.step) !== this.step));
    document.querySelectorAll("#stepList li").forEach((el, i) => {
      if (i === this.step) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
    $("previousBtn").hidden = this.step === 0;
    $("nextBtn").hidden = this.step === 2;
    $("createGameBtn").hidden = this.step !== 2;
    if (this.step === 2) {
      $("reviewName").textContent = this.draft.name;
      $("reviewSummary").textContent =
        `${this.draft.size} × ${this.draft.size} · ${this.count()} challenges${this.draft.size === 5 ? " + FREE centre" : ""}`;
      const preview = $("boardPreview");
      preview.replaceChildren();
      preview.style.gridTemplateColumns = `repeat(${this.draft.size},1fr)`;
      for (const c of this.challenges()) {
        const cell = document.createElement("div");
        cell.textContent = c.text;
        preview.append(cell);
      }
    }
    document.querySelector(`[data-step="${this.step}"] h2`).focus();
  }
  async handleGameSubmit() {
    if (this.busy || !this.validate()) return;
    this.save();
    this.busy = true;
    const button = $("createGameBtn");
    button.disabled = true;
    button.textContent = this.board ? "Saving…" : "Creating…";
    const inPlace = this.board?.canEdit;
    try {
      const response = await fetch(inPlace ? this.editorPath : `${this.config.API_BASE_URL}/games`, {
        method: inPlace ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: this.draft.name.trim(),
          gridSize: this.draft.size,
          challenges: this.challenges(),
          ...(inPlace ? { version: this.board.updatedAt } : {
            checked: true,
            isPublic: this.board?.isPublic ?? true,
            createKey: this.draft.createKey,
          }),
        }),
      });
      if (response.status === 401) {
        this.authManager.isAuthenticated = false;
        this.authManager.user = null;
        this.authManager.updateUI();
        this.authManager.status = "signedOut";
        this.signIn();
        throw new Error(
          "Your session expired. Sign in again; your draft is saved.",
        );
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (inPlace && body.code === "board_in_use") {
          this.board.canEdit = false;
          this.updateEditNotice();
        }
        throw new Error(
          body.error ||
            "Could not create the game. Your draft is saved; please retry.",
        );
      }
      const game = await response.json();
      $("wizard").hidden = true;
      $("shareReady").hidden = false;
      if (inPlace) $("readyTitle").textContent = "Changes saved";
      else if (this.board) $("readyTitle").textContent = "Board copy saved";
      if (game.isPublic === false)
        $("readyIntro").textContent = "This board is private. For live play, give students the PIN from your host lobby.";
      const sharePath = game.isPublic === false ? "/join" : `/play/${encodeURIComponent(game.id)}`;
      $("shareLink").value = location.origin + sharePath;
      $("previewGameLink").href =
        `/play/${encodeURIComponent(game.id)}?preview=1`;
      $("readyTitle").focus();
      try {
        sessionStorage.removeItem(this.draftKey);
      } catch {}
    } catch (cause) {
      this.error(cause.message);
    } finally {
      this.busy = false;
      button.disabled = false;
      button.textContent = this.submitLabel();
    }
  }
}
window.gameCreationApp = new GameCreationApp();
