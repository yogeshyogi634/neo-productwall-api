
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.adminLog.count();
    console.log(`Total Admin Logs in Database: ${count}`);

    const logs = await prisma.adminLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        adminUser: { select: { email: true } },
        targetUser: { select: { email: true } }
      }
    });

    console.log("Latest 5 Logs:");
    console.log(JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
