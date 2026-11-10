# Edit boards and clear results

## My games

Each card has a white trash icon in its top-right corner that turns red on hover or press. The four equal controls below the title read **Share**, **Edit**, **Results**, and **Preview** in row order. Share uses mint. Preview is last and uses a quieter outline. It opens private boards for their owner and records no player entry. The delete icon names the board for screen readers and requires confirmation.

## Edit

- Only the owner can open the editor or save changes. The existing editor loads the saved name, board size, prompts, tile modes and accepted answers. The 5 × 5 centre remains free. Guest responses keep answer keys private.
- A board with no open live session or saved player activity can be edited in place. Its link and visibility stay the same. A board with saved play or a waiting or playing session offers **Save as copy**. The copy keeps the source visibility and has a new ID. Its results start empty.
- The server checks eligibility and the board version again at save. If play starts while the editor is open, keep the draft and offer **Save as copy**. A save from an older version cannot overwrite a newer one. New students joining from a stale board reload before playing.

## Clear results

- Put **Clear results** inside the scorecard. In My games it clears board-link play. In a live lobby it clears that one ended session. A waiting or playing session cannot be cleared.
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
| Open My games on mobile and desktop. | The four main actions stay aligned and tappable. Preview is last and outlined. Delete remains an icon with a confirmation. |
| Preview a private board as its owner, then open the same preview as a guest or another host. | The owner sees the board without answer keys or a player entry. The other viewers cannot see it. |
