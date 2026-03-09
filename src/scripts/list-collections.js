
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // Run a raw command to list collections
    const collections = await prisma.$runCommandRaw({
      listCollections: 1,
    });

    console.log("Collections in 'producthub' database:");
    const names = collections.cursor.firstBatch.map(c => c.name);
    names.sort();
    names.forEach(name => console.log(`- ${name}`));
    
    if (names.includes("AdminLog")) {
        console.log("\nSUCCESS: 'AdminLog' collection exists.");
    } else {
        console.log("\nWARNING: 'AdminLog' collection NOT found.");
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
