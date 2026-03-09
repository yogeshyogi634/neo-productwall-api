import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── Create 5 Products ───
  const products = [
    "Perkle",
    "Blutic", 
    "Collectbot",
    "ProfileX",
    "Svitch",
    "Neokred"
  ];

  for (const productName of products) {
    await prisma.product.upsert({
      where: { name: productName },
      update: { name: productName },
      create: { name: productName },
    });
    console.log(`  ✅ Product: ${productName}`);
  }

  // ─── Create management users ───
  const managementUsers = [
    {
      email: "cto@neokred.tech", 
      name: "CTO",
      role: "MANAGEMENT",
    },
    {
      email: "manager1@neokred.tech",
      name: "Manager One",
      role: "MANAGEMENT",
    },
  ];

  for (const mgmtUser of managementUsers) {
    const user = await prisma.user.upsert({
      where: { email: mgmtUser.email },
      update: {},
      create: mgmtUser,
    });
    console.log(`  ✅ Management user: ${user.email}`);
  }

  // ─── Create a test employee user ───
  const employeeUser = await prisma.user.upsert({
    where: { email: "madhav@neokred.tech" },
    update: {},
    create: {
      email: "madhav@neokred.tech",
      name: "Madhav",
      role: "EMPLOYEE",
    },
  });
  console.log(`  ✅ Employee user: ${employeeUser.email}`);

  // ─── Create sample updates ───
  const collectbot = await prisma.product.findUnique({
    where: { name: "Collectbot" },
  });

  if (collectbot) {
    const sampleUpdate = await prisma.update.create({
      data: {
        title: "Payment Integration on Collectbot",
        description:
          "We are integrating with our own payment gateway and from next quarter we will be integrating this to all our internal products.",
        status: "WIP",
        productId: collectbot.id,
        authorId: employeeUser.id,
      },
    });
    console.log(`  ✅ Sample update: ${sampleUpdate.title}`);

    // ─── Create sample feedback ───
    const sampleFeedback = await prisma.feedback.create({
      data: {
        message: "New UI is good!",
        productId: collectbot.id,
        authorId: employeeUser.id,
      },
    });
    console.log(`  ✅ Sample feedback: "${sampleFeedback.message}"`);
  }

  console.log("\n🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
