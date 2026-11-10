// String ID returns to the fixed Bingo homepage. Resume only a tab's own intent.
if (new URLSearchParams(location.search).get("host") === "1") {
  location.replace("/play" + location.search + location.hash);
} else {
  try {
    const intent = sessionStorage.getItem("bingo:host-intent");
    if (intent?.startsWith("edit:")) {
      sessionStorage.removeItem("bingo:host-intent");
      location.replace("/new.html?edit=" + encodeURIComponent(intent.slice(5)));
    } else if (/^lobby:[a-z0-9]+$/.test(intent || "")) {
      sessionStorage.removeItem("bingo:host-intent");
      location.replace("/host/live/" + intent.slice(6));
    } else if (["create", "games", "demo"].includes(intent)) {
      sessionStorage.removeItem("bingo:host-intent");
      location.replace(intent === "create" ? "/new.html" : intent === "demo" ? "/play" : "/play?host=1");
    }
  } catch {
    // The landing links still work when browser storage is unavailable.
  }
}
