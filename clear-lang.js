const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.userLanguages.deleteMany({});
  console.log('Cleared UserLanguages');
}
main().catch(console.error).finally(() => prisma.$disconnect());
