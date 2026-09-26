const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.userEducations.deleteMany({});
  console.log('Cleared UserEducations');
}
main().catch(console.error).finally(() => prisma.$disconnect());
