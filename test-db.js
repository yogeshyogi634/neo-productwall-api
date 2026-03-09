import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.product.findMany();
  console.log('Products:', products);
  const updates = await prisma.update.findMany({ include: { product: true } });
  console.log('Updates:', updates);
}
main().catch(console.error).finally(() => prisma.$disconnect());
