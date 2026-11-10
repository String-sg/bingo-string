# String Bingo live sessions and non-photo tiles

**Approved scope · 9 November 2026**

For the 10 November demo, the teacher opens `/play` on the projector. Students go to `/join`, enter the PIN and a nickname, then wait for the teacher to start. They work through the board in any order and can show the teacher when they completed Bingo.

**Demo scope.** Use one preselected board with **Photo**, **Typed answer** and **Host check** tiles. The demo includes the PIN lobby, Start and End, owner approval of pending checks, and a timestamped Bingo result with winning-line evidence. Verify the flow with **100 concurrent students and one teacher** before the class.

The lobby borrows Kahoot’s separation between the teacher’s projected screen and the student’s join page. The checked-in Bingo flow currently opens the default board at `/play` and uses direct links for shared boards. [Kahoot host flow](https://support.kahoot.com/hc/en-us/articles/360039422694-How-to-host-a-live-kahoot) · [Kahoot join flow](https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game) · [Bingo routing](https://github.com/String-sg/bingo-string/blob/89b0c60/js/app.js#L24)

## A. Host and join a live session

- **A1 · Demo shortcut.** During the 10 November demo window, `/play` opens one configured live session. The owner lands in its lobby after String ID sign-in. Other visitors can go to `/join` to enter the PIN. Reloading or signing in again returns the owner to the same session. The shortcut ends when the owner ends the session or at 00:00 on 11 November SGT, whichever comes first. `/play` then returns to the default board. Existing shared links retain their direct, self-paced flow.
- **A2 · Project and join.** The lobby shows the board title, **bingo.string.sg/join**, a large six-digit PIN, the joined count, nicknames and **Start**. At `/join`, a student enters the PIN, chooses a nickname and sees **Waiting for your teacher to start**. Joining needs a browser and a valid PIN. Unknown, expired and ended PINs prompt the student to check with the teacher. Limit automated PIN guessing while allowing a class to share Wi-Fi. Each live session has its own PIN, roster, progress and results, even when two sessions use the same saved board. Only the owner’s lobby exposes the roster.
- **A3 · Start, resume and end.** The owner presses **Start** and the board opens automatically on connected student devices. Aim for the roster and state changes to appear within three seconds on a stable connection. Late arrivals can join while play is open. A reload in the same browser resumes the same player entry. **End session** closes joining and completion, including unresolved host checks. Show the pending count before ending when host checks are in use. Existing participants can reopen their own result after End, and the owner can still open Results. The server enforces the session state and owner permissions, including when a browser shows stale controls.

### Live session acceptance tests

| Test | Given and when | Expected result |
| --- | --- | --- |
| A-T1 · Demo entry | Owner opens `/play` signed out, signs in and reloads. A guest opens the same URL and follows the student link. | Owner resumes the same lobby. The guest reaches `/join` without access to host controls or the roster. After End or the cutoff, `/play` opens the default board. A saved shared link opens as before throughout. |
| A-T2 · Join and start | Two signed-out phones enter a valid PIN and different nicknames. One reloads. Owner presses Start twice. | The lobby counts two players. Both phones wait, then open the board within three seconds on a stable connection. One start is recorded. A late third guest opens the running board. |
| A-T3 · State and access | Try a wrong or expired PIN. A guest attempts early play. Another host tries to start, end or read Results. A player submits after End. | The server rejects each action. The ended PIN admits nobody. Previously earned results still open for the player and the board owner. |
| A-T4 · Separate classes | Two sessions use the same board. A student joins one and wins. | Each PIN resolves to its own session. The win and roster entry appear only in the session the student joined. |

## B. Configure and verify non-photo tiles

- **B1 · Choose a mode.** While creating a new hosted board, the teacher chooses **Photo**, **Typed answer** or **Host check** for each playable tile. Photo is the default. A 3×3 has nine playable tiles. A 5×5 has a fixed free centre. Drafts can be edited. The owner can edit an unused published board or save a copy once it has saved play or an open live session. [Board management rules](../009-game-management/spec.md). Existing boards and prompt-only imports keep their photo defaults.
- **B2 · Check typed answers.** Enter one accepted answer or alias per line. Require at least one nonblank entry. On the server, trim surrounding whitespace and compare case-insensitively. Internal spacing, punctuation, accents and numeric formatting stay significant. The student receives a generic retry message for a miss. After five misses within a rolling minute per player and tile, pause further guesses until the oldest of those misses is one minute old. Limit bulk guessing across sessions while allowing a class to share Wi-Fi. A retry of the same request consumes at most one attempt.
- **B3 · Check in person.** A student can request a host check with optional short text. The teacher can also ask for an in-person demonstration. The owner can approve or return the pending request in Results. Allow one pending request per tile. Only approved tiles count. A returned request can be resubmitted. An action on an earlier request cannot approve a later one.
- **B4 · Protect the evidence.** Guest responses include the board prompts, modes and that guest’s own state. Keep answer keys, aliases and other players’ answers out of those responses. Boards using the new flow send all progress through the checked API. The legacy progress route cannot modify them. Tell students their teacher can see submitted evidence. Discard wrong guesses and returned evidence. Keep pending and accepted text needed for review out of analytics and logs.

### Non-photo tile acceptance tests

| Test | Given and when | Expected result |
| --- | --- | --- |
| B-T1 · Board setup | Create mixed 3×3 and 5×5 boards. Try saving a typed tile with only whitespace in its key. Try editing the published key through the legacy update endpoint. | Both sizes render the selected modes. The 5×5 centre is free and the 3×3 centre is playable. The blank key blocks creation. Published keys are editable through the owner editor under the board management rules. |
| B-T2 · Exact matching | Configure `100` for `10 × 10 = ___`. Configure `kahhow`, `Kah How`, `Kahhow Lee` and `leekahhow` for `Breakdancer`. | `100` and `100 ` pass. `100.0` requires its own alias. All four names and ` KAH HOW ` pass. `Kah  How` requires its own alias. |
| B-T3 · Guessing | Make five distinct misses in a minute, retry one after a lost response, then try again after cooldown. A second pupil plays on the same Wi-Fi. | One count per distinct request. The first player sees the cooldown, then can retry. The second player can submit independently. The response gives no answer hint. |
| B-T4 · Manual approval | A pending tile would finish a line. The owner returns it. The student resubmits. Replay the first request’s approval, then approve the current request. | Pending and returned states never finish the line. The stale approval has no effect. Approval of the current request records one Bingo. |
| B-T5 · Access and privacy | Inspect both public board endpoints, preview and progress responses. Try to forge a typed or manual completion through legacy progress, approve as another owner, or read another guest’s evidence. | The server rejects the cross-session and cross-owner actions and forged completions. Keys and other guests’ evidence are absent from guest responses. |

## C. Record and review the first Bingo

The server records the first complete row, column or diagonal once per player entry. If one move completes several lines, choose the first in board order across rows, then columns, then diagonals. Store the time in UTC and show a labelled Singapore time on the player’s celebration and in Results. For a host check, use the time the server records approval. Each qualifying player gets a result. Equal stored times are ties.

The first result survives reload, retries, later lines and Reset. Reload restores accepted and pending tile states for the same browser session. Reset clears current progress and pending checks. A temporary connection loss shows **Waiting to sync**. Photos can stay on the device. Text submission and approval require a connection, and the finish time is set when the server records the line. If the session ends before the server accepts the change, show **Session ended**.

In private **Results**, the owner can expand the first winning line to see its prompts, completion modes and the submitted text for typed and manual tiles where available. Photo tiles are player-reported. The teacher can inspect the photo on the player’s device. Reopening a result shows the original line and time.

Purge new guest entries, results and evidence after seven days of guest inactivity, or sooner on game deletion. Viewing Results does not extend that period.

### Results acceptance tests

| Test | Given and when | Expected result |
| --- | --- | --- |
| C-T1 · Lines and time | Complete a row, column and diagonal in separate fixtures, including a 5×5 diagonal through the free centre. Complete two lines in one move. | Each fixture records one valid first line. The two-line case uses the defined order. Player and owner see the same labelled time, even on devices with different time zones. |
| C-T2 · Retry and concurrency | Drop the successful response to a final move. Replay it and send another completion concurrently. Have two guests finish at the same stored time. | Each guest gets one immutable result. The retry returns the existing line and timestamp. Two guests with the same time both appear as tied. |
| C-T3 · Offline and reset | Reload with an accepted tile and a pending check. Lose connection before the final move. Reconnect and sync while the session is open. Reload, then reset. Repeat with End occurring before sync. | Reload restores tile states. The final move shows a waiting state until sync, then the server time. Reset preserves that result and clears current progress. The closed-session attempt earns no result. |
| C-T4 · Review evidence | Win with photo, typed and manual tiles. Submit text containing HTML-like characters and play another line. | The owner sees only the first line’s evidence in the win details. Text renders literally. Photos remain on the device. Later activity cannot rewrite the saved evidence. |
| C-T5 · Retention | Leave a guest inactive for seven days and view Results just before expiry. Delete another game before its guest data expires. | Both sets of guest results and evidence are purged on their respective deadlines. The first game’s board remains available. |

## D. Demo rehearsal and load test

### D-T1. Two-phone rehearsal

Use a 3×3 test board with a photo tile, `10 × 10 = ___` and a host check in one row, plus `Breakdancer` elsewhere. Open `/play` as the teacher and join from two phones via `/join`. Start, then complete the photo, enter `100 `, test ` KAH HOW ` on the alias tile and request the host check with a short answer. Approve it from the teacher view, then end the session.

Both phones wait and open the board on Start. Both typed answers pass. The row stays incomplete until approval. The student’s Bingo time matches Results, which shows the winning row and its submitted text. The second student’s board stays independent. The PIN closes at End.

### D-T2. 100 concurrent students

Use an isolated deployment with production-like hosting and database settings. Use synthetic nicknames and tile inputs.

1. Send 100 distinct guest joins over 10 seconds through a shared network address. Start from a separate teacher session. Keep the 100 guests active for five minutes at the normal client refresh cadence, with each completing photo and typed tiles.
2. Bring 80 guests to one tile from a win, then submit their final moves within five seconds. Have 10 other guests request a host check as their final move and approve five. Keep the remaining 10 in progress.
3. Reconnect 10 guests using their original browser sessions and retry already committed submissions. End while clients are connected, with five host checks still pending.

Pass if the roster shows exactly 100 and all connected clients see Start and End within three seconds. For joins and valid tile submissions, the 95th-percentile response time must be at most 1.5 seconds, with zero unexpected errors or rate limits. Results must contain exactly 85 first wins with stable timestamps. Retries and reconnects preserve player count and progress. The five pending checks earn no win.

Record the deployment, actual concurrency, response times, Start and End delays, error counts and win count. Count deliberate invalid submissions separately.

## Checks before release

Automate the host and two-guest journeys in Playwright on desktop and mobile. Cover matching, access, time, retention and races in backend tests. Re-run existing camera, upload, reset, download, board sizing, guest links and host sign-in regressions. Run `npm run check:backend`, `npm run check:startup`, `npm run test:backend`, `npm test` and `npm run build`. [Repo test guide](https://github.com/String-sg/bingo-string/blob/89b0c60/tests/README.md)
