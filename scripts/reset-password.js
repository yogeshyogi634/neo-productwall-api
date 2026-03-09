
import prisma from '../src/utils/prisma.js';
import { hash } from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

async function resetPassword() {
  const email = 'hello@neokred.tech';
  const newPassword = 'password123';

  try {
    const hashedPassword = await hash(newPassword, 10);
    
    const user = await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });
    
    console.log(`Password updated for ${email}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
