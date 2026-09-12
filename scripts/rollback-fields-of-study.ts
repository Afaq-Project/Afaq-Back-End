import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function rollback() {
  console.log('Starting fieldOfStudy rollback...');
  const records = await prisma.userFieldsOfStudy.findMany({
    include: { field: true }
  });

  for (const record of records) {
    const profile = await prisma.userProfiles.findUnique({ where: { userId: record.userId } });
    if (profile) {
      const fields = new Set(profile.fieldOfStudy || []);
      fields.add(record.field.name);
      await prisma.userProfiles.update({
        where: { userId: record.userId },
        data: { fieldOfStudy: Array.from(fields) }
      });
    }
  }
  
  console.log('Rollback complete. Synchronized join records back to string arrays.');
}
rollback().finally(() => prisma.$disconnect());
