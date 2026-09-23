const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const users = await prisma.users.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log(users);
}
run();
