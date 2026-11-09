import { randomUUID } from "node:crypto";
import prisma from "../../backend/src/lib/prisma";
import { hashToken } from "../../backend/src/lib/checked-bingo";

const url = new URL(process.env.DATABASE_URL || "");
const local = ["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/bingo_e2e";
const preview = url.hostname === process.env.BINGO_ISOLATED_DATABASE_HOST && url.pathname === "/bingo_preview";
if (!local && !preview) throw new Error("Seed only the isolated Bingo test database.");

const boardId = "bingodemoboard";
const challenges = [
  { id: "q0", text: "Take a photo of a pencil", mode: "photo" },
  { id: "q1", text: "10 × 10 = ___", mode: "typed", aliases: ["100"] },
  { id: "q2", text: "Show a triangle", mode: "manual" },
  { id: "q3", text: "Breakdancer", mode: "typed", aliases: ["kahhow", "kah how", "kahhow lee", "leekahhow"] },
  { id: "q4", text: "2 + 2 = ___", mode: "typed", aliases: ["4"] },
  { id: "q5", text: "Name a colour", mode: "typed", aliases: ["green"] },
  { id: "q6", text: "Take a photo of a book", mode: "photo" },
  { id: "q7", text: "Take a photo of a pen", mode: "photo" },
  { id: "q8", text: "Take a photo of a ruler", mode: "photo" },
];
async function seed() {
  const memberId = "33333333-3333-4333-8333-333333333333";
  const owner = await prisma.user.upsert({
    where: { stringMemberId: memberId },
    create: { stringMemberId: memberId, name: "Browser host", email: "browser-host@example.com" },
    update: {},
  });
  // This ID is reserved for synthetic data in the guarded database above.
  await prisma.game.deleteMany({ where: { id: boardId } });
  await prisma.game.create({ data: {
    id: boardId, creatorId: owner.id, name: "Class Bingo", gridSize: 3, checked: true, challengesJson: challenges,
  } });
  const closesAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.liveRound.createMany({ data: [
    { id: "bingoacceptance", gameId: boardId, pin: "600101", closesAt },
    { id: "bingoloadround", gameId: boardId, pin: "600102", closesAt },
    { id: "bingoexpiredround", gameId: boardId, pin: "600103", closesAt: new Date(0) },
  ] });
  await prisma.checkedEntry.create({ data: {
    gameId: boardId, scope: "board:" + boardId, tokenHash: hashToken(randomUUID()),
    nickname: "Expired synthetic pupil", activeAt: new Date(0),
  } });
  console.log("Synthetic demo, acceptance and load rounds are ready.");
}
seed().finally(() => prisma.$disconnect());
