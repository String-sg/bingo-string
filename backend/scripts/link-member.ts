// Explicit audited ownership mapping. Dry-run unless --apply is present.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const [userId, memberId, ...flags] = process.argv.slice(2);
  if (!userId || !/^[0-9a-f-]{36}$/i.test(memberId || ""))
    throw new Error("Usage: link-member USER_ID STRING_MEMBER_UUID [--apply]");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const taken = await prisma.user.findUnique({
    where: { stringMemberId: memberId },
  });
  if (
    (user.stringMemberId && user.stringMemberId !== memberId) ||
    (taken && taken.id !== userId)
  )
    throw new Error("Conflicting identity; no changes made");
  if (!flags.includes("--apply")) {
    console.log(
      "Mapping valid; dry-run only. Verify ownership evidence before --apply.",
    );
    return;
  }
  await prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: { id: userId, stringMemberId: user.stringMemberId },
      data: { stringMemberId: memberId },
    });
    if (!changed.count) throw new Error("Identity changed; retry review");
    await tx.identityLinkAudit.create({
      data: {
        userId,
        stringMemberId: memberId,
        method: "admin_approved_mapping",
      },
    });
  });
  console.log(
    "Approved mapping recorded. Existing user and game IDs retained.",
  );
}
main()
  .finally(() => prisma.$disconnect())
  .catch(() => {
    console.error("Mapping failed. No credentials or member details logged.");
    process.exitCode = 1;
  });
