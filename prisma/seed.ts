import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.plan.upsert({
    where: { code: "PRO_MONTHLY" },
    update: {},
    create: {
      code: "PRO_MONTHLY",
      name: "专业版月卡",
      durationDays: 30,
      credits: 200,
      priceAmount: 3900,
      currency: "CNY",
      entitlements: { maxFileMb: 30, concurrentJobs: 2, retentionDays: 30 },
    },
  });

  await db.plan.upsert({
    where: { code: "PRO_YEARLY" },
    update: {},
    create: {
      code: "PRO_YEARLY",
      name: "专业版年卡",
      durationDays: 365,
      credits: 3000,
      priceAmount: 39900,
      currency: "CNY",
      entitlements: { maxFileMb: 50, concurrentJobs: 4, retentionDays: 90 },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
