import { getConfig } from "./config.js";
import { AuthManager } from "./authManager.js";
import { DRAFT_KEY, parseChallengeCsv, STARTERS } from "./host-draft.js";
const $ = (id) => document.getElementById(id);
class GameCreationApp {
  constructor() {
    this.authManager = new AuthManager();
    this.step = 0;
    this.busy = false;
    this.draft = {
      name: "",
      size: 3,
      prompts: Array(24).fill(""),
      createKey: crypto.randomUUID(),
    };
    this.init();
  }
  async init() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
      if (saved && [3, 5].includes(saved.size) && Array.isArray(saved.prompts))
        this.draft = {
          ...this.draft,
          ...saved,
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
    this.bind();
    await this.authManager.ready;
    this.config = await getConfig();
    this.updateAuth();
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
    $("editorSignIn").onclick = () => this.authManager.showAuthModal();
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
        values.forEach((v, i) => (this.draft.prompts[i] = v));
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
    $("copyLinkBtn").onclick = async () => {
      try {
        await navigator.clipboard.writeText($("shareLink").value);
        $("shareStatus").textContent = "Link copied. Send it to your players.";
      } catch {
        $("shareLink").focus();
        $("shareLink").select();
        $("shareStatus").textContent = "Select and copy the link above.";
      }
    };
  }
  count() {
    return this.draft.size === 3 ? 9 : 24;
  }
  save() {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(this.draft));
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
      list.append(label);
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
    this.error("");
    return true;
  }
  challenges() {
    const prompts = this.draft.prompts
      .slice(0, this.count())
      .map((v) => v.trim());
    if (this.draft.size === 5) prompts.splice(12, 0, "FREE");
    return prompts.map((text, i) => ({ id: `q${i}`, text }));
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
    button.textContent = "Creating…";
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/games`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: this.draft.name.trim(),
          gridSize: this.draft.size,
          challenges: this.challenges(),
          isPublic: true,
          createKey: this.draft.createKey,
        }),
      });
      if (response.status === 401) {
        this.authManager.isAuthenticated = false;
        this.authManager.user = null;
        this.authManager.updateUI();
        this.authManager.status = "signedOut";
        this.authManager.showAuthModal();
        throw new Error(
          "Your session expired. Sign in again; your draft is saved.",
        );
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error ||
            "Could not create the game. Your draft is saved; please retry.",
        );
      }
      const game = await response.json();
      $("wizard").hidden = true;
      $("shareReady").hidden = false;
      $("shareLink").value =
        `${location.origin}/play/${encodeURIComponent(game.id)}`;
      $("previewGameLink").href =
        `/play/${encodeURIComponent(game.id)}?preview=1`;
      $("readyTitle").focus();
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
    } catch (cause) {
      this.error(cause.message);
    } finally {
      this.busy = false;
      button.disabled = false;
      button.textContent = "Create game";
    }
  }
}
window.gameCreationApp = new GameCreationApp();
