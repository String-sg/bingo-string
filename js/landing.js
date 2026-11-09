// String ID returns to the fixed Bingo homepage. Resume only a tab's own intent.
if (new URLSearchParams(location.search).get("host") === "1") {
  location.replace("/play" + location.search + location.hash);
} else {
  try {
    const intent = sessionStorage.getItem("bingo:host-intent");
    if (intent === "create" || intent === "games") {
      sessionStorage.removeItem("bingo:host-intent");
      location.replace(intent === "create" ? "/new.html" : "/play?host=1");
    }
  } catch {
    // The landing links still work when browser storage is unavailable.
  }
}
