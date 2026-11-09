import assert from "node:assert/strict";
import { test } from "node:test";
import { firstLine, normalizeAnswer, parseChallenges, publicChallenges } from "../../backend/src/lib/checked-bingo";

test("first line uses rows, columns, diagonals and the 5×5 free centre", () => {
  assert.deepEqual(firstLine(3, new Set([0, 1, 2, 3, 6])), [0, 1, 2]);
  assert.deepEqual(firstLine(3, new Set([0, 3, 6])), [0, 3, 6]);
  assert.deepEqual(firstLine(3, new Set([2, 4, 6])), [2, 4, 6]);
  assert.deepEqual(firstLine(5, new Set([0, 6, 18, 24])), [0, 6, 12, 18, 24]);
  assert.equal(firstLine(3, new Set([0, 8])), undefined);
});

test("tile schema keeps aliases private and rejects blank keys", () => {
  const cells = Array.from({ length: 9 }, (_, i) => ({ id: String(i), text: "Prompt", mode: "photo" }));
  const key = { ...cells[0], mode: "typed", aliases: [" Kah How ", "KAH HOW", "leekahhow"] };
  const parsed = parseChallenges([key, ...cells.slice(1)], 3, true);
  assert.deepEqual(parsed?.[0].aliases, ["kah how", "leekahhow"]);
  assert.deepEqual(publicChallenges(parsed!)[0], { id: "0", text: "Prompt", mode: "typed" });
  assert.equal(parseChallenges([{ ...key, aliases: [" "] }, ...cells.slice(1)], 3, true), null);
  assert.equal(normalizeAnswer("100 "), "100");
  assert.notEqual(normalizeAnswer("Kah  How"), normalizeAnswer("Kah How"));
});
