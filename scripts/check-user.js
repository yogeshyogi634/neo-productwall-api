
import prisma from '../src/utils/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkUserStatus() {
  const email = process.argv[2];

  try {
    if (email) {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });
      if (!user) console.log('User not found');
      else printUser(user);
    } else {
      console.log('Listing all users:');
      const users = await prisma.user.findMany();
      users.forEach(printUser);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function printUser(user) {
  console.log('---');
  console.log(`ID: ${user.id}`);
  console.log(`Email: ${user.email}`);
  console.log(`Name: ${user.name}`);
  console.log(`Role: ${user.role}`);
  console.log(`isVerified: ${user.isVerified}`);
  console.log(`Department: ${user.department}`);
}

checkUserStatus();
