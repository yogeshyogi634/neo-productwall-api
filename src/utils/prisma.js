import { PrismaClient } from "@prisma/client";

// Singleton pattern — prevents multiple Prisma instances in dev (hot reload)
let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ["query", "warn", "error"],
    });
  }
  prisma = global.__prisma;
}

export default prisma;
