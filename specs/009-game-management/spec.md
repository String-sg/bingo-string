# Edit boards and clear results

## My games

Each card puts a full-width mint **Start** button above equal-width **Preview** and **Results** controls. Copy link, Edit, and Delete sit on a single row of compact, labelled icon controls. The white trash icon turns red on hover or press and requires confirmation. End any open session before deleting the board.

**Start** opens the board’s owner-only lobby with a six-digit PIN, a QR code, a student roster, and **Start game** and **End session** controls. The join links use the primary colour. Students open `/join`, enter the PIN and a nickname, and wait for **Start game**. The QR code fills in the PIN. Reopening the card’s lobby resumes the open session. Starting after End or expiry creates a fresh PIN. Standard sessions expire after 24 hours. The scheduled demo keeps its configured window.

**Preview** opens private boards for their owner and records no player entry. **Copy link** copies the PIN-prefilled student link while a session is open. For a public board without an open lobby it copies the shared board link. For a private board it prompts the owner to open a lobby.

## Edit

- Only the owner can open the editor or save changes. The existing editor loads the saved name, board size, prompts, tile modes and accepted answers. The 5 × 5 centre remains free. Guest responses keep answer keys private.
- A board with no open live session or saved player activity can be edited in place. Its link and visibility stay the same. A board with saved play or a waiting or playing session offers **Save as copy**. The copy keeps the source visibility and has a new ID. Its results start empty.
- The server checks eligibility and the board version again at save. If play starts while the editor is open, keep the draft and offer **Save as copy**. A save from an older version cannot overwrite a newer one. New students joining from a stale board reload before playing.

## Clear results

- Put **Clear results** inside the scorecard. **Results** on the card opens the latest live scorecard when available, with older scorecards and shared board results accessible separately. The clear action applies only to the selected scorecard. A waiting or playing session cannot be cleared.
- Confirm before removing the selected scorecard’s saved progress, nicknames, completion records, and submitted evidence or checks. Keep the board, its link, and any other scorecard. An ended PIN stays closed. Photos are stored on student devices.
- Only the owner can clear results. The server checks the roster shown at confirmation. A stale confirmation cannot clear players who joined after it was shown. Requests from cleared entries cannot restore their old progress.

## Acceptance tests

| Given and when | Expected result |
| --- | --- |
| Edit an unused mixed 3 × 3 and 5 × 5 board, then reopen its link. | Prompts and keys prefill. Saving keeps the link and preserves the free centre. Guests see the updated prompts and cannot read the keys. |
| Open Edit after a student joins, or save an editor that was opened before a student joined. | The owner can save a separate copy. The original link and results are preserved. |
| Cancel Clear results, then confirm it from My games. | Cancel keeps the scorecard. Confirm empties it and leaves the board playable. The cleared player's previous state no longer loads. |
| Clear a live scorecard while waiting or playing, then End and clear it. | The first attempts are rejected. After End, only the selected scorecard empties and its PIN stays closed. |
| Try to edit or clear as a guest or another owner, submit a stale editor, or retry a clear after another student joins. | Unauthorized requests and stale writes cannot change existing data. |
| Open My games on mobile and desktop. | The heading and controls stay in the viewport. Start spans the card, Preview and Results split a row, and the three icon controls stay on one row with 44 px targets. |
| Open Start twice for the same game, then open Start on a different game. | The first lobby keeps its PIN and roster. The other board has its own lobby. Guests and other owners cannot create the first board’s lobby. |
| Join a private board through its lobby QR code, then have the teacher start and end the session. | The PIN is prefilled. The student waits, sees the selected board when it starts, and sees Session ended after End. Results retain that session and its old PIN rejects further joins. |
| Copy the link from a game card with an open session and deny browser clipboard access. | The link opens the correct student join page. If copying fails, the link stays visible and selectable. |
| Preview a private board as its owner, then open the same preview as a guest or another host. | The owner sees the board without answer keys or a player entry. The other viewers cannot see it. |
