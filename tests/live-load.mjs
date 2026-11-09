import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { control, guest, hostCookie, join, move, pause, request, results, review, state, target } from "./fixtures/checked-client.mjs";

const id = "bingoloadround";
const students = Array.from({ length: 100 }, (_, i) => ({ token: guest(), name: `Load pupil ${i + 1}` }));
const joins = [], writes = [], startDelays = [], endDelays = [];
const errors = [];
let running = true;
let startAt, endAt;
const path = "/checked/rounds/" + id;

async function poll(student) {
  while (running) {
    try {
      const { body } = await state(id, student.token);
      if (startAt && body.status === "playing" && !student.started) {
        student.started = true;
        startDelays.push(performance.now() - startAt);
      }
      if (endAt && body.status === "ended") {
        endDelays.push(performance.now() - endAt);
        return;
      }
    } catch (error) {
      errors.push(error.message);
    }
    await pause(1200);
  }
}
async function play(student, action, index, text, operation) {
  const result = await move(id, student.token, action, index, text, operation);
  writes.push(result.ms);
  return result.body;
}
const p95 = (values) => Math.round([...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1]);
const max = (values) => Math.round(Math.max(...values));
let pollers = [];
try {
  await Promise.all(students.map(async (student, i) => {
    await pause(i * 100);
    const response = await join(student.token, "600102", student.name);
    assert.equal(response.body.status, "waiting");
    joins.push(response.ms);
    pollers.push(poll(student));
  }));
  const lobby = await request(path + "/lobby", { host: hostCookie });
  assert.equal(lobby.body.players.length, 100);
  startAt = performance.now();
  assert.equal((await control(id, "start")).body.status, "playing");
  await Promise.all(students.map(async (student, i) => {
    await pause(i * 100);
    await play(student, "photo", 0);
    await play(student, "typed", 1, "100 ");
    if (i < 80) {
      await play(student, "typed", 3, " KAH HOW ");
      student.finalRequest = randomUUID();
    } else if (i < 90) {
      await play(student, "manual", 2, "paper triangle");
    }
  }));
  await Promise.all(students.slice(0, 80).map(async (student, i) => {
    await pause(i * 60);
    student.firstResult = await play(student, "photo", 6, undefined, student.finalRequest);
    assert.ok(student.firstResult.player.completedAt);
  }));
  const waiting = (await results(id)).body.players.filter((player) => player.pending.length);
  assert.equal(waiting.length, 10);
  for (const player of waiting.slice(0, 5)) await review(id, player, player.pending[0]);
  await Promise.all(students.slice(0, 10).map(async (student) => {
    await join(student.token, "600102", student.name);
    const again = await play(student, "photo", 6, undefined, student.finalRequest);
    assert.equal(again.player.completedAt, student.firstResult.player.completedAt);
  }));
  await pause(Math.max(0, 300000 - (performance.now() - startAt)));
  endAt = performance.now();
  assert.equal((await control(id, "end")).body.status, "ended");
  await Promise.race([Promise.all(pollers), pause(10000)]);
  const all = (await results(id)).body.players;
  const winners = all.filter((player) => player.completedAt);
  const report = {
    target, joined: joins.length, roster: all.length, winners: winners.length,
    durationSeconds: Math.round((endAt - startAt) / 1000),
    joinP95Ms: p95(joins), tileP95Ms: p95(writes), tileRequests: writes.length,
    startSeen: startDelays.length, startMaxMs: max(startDelays),
    endSeen: endDelays.length, endMaxMs: max(endDelays), unexpectedErrors: errors.length,
  };
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  assert.equal(all.length, 100);
  assert.equal(winners.length, 85);
  assert.equal(new Set(winners.map(({ id }) => id)).size, 85);
  assert.equal(startDelays.length, 100);
  assert.equal(endDelays.length, 100);
  assert.ok(report.startMaxMs <= 3000 && report.endMaxMs <= 3000, "Start and End must reach all students within 3 seconds.");
  assert.ok(report.joinP95Ms <= 1500 && report.tileP95Ms <= 1500, "Join and tile p95 must be at most 1.5 seconds.");
} finally {
  running = false;
}
