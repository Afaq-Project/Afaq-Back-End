import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting fieldOfStudy migration...');
  const profiles = await prisma.userProfiles.findMany({
    where: { NOT: { fieldOfStudy: { isEmpty: true } } }
  });

  let migrated = 0;
  const autoCreatedReport: string[] = [];

  for (const profile of profiles) {
    for (const fieldName of profile.fieldOfStudy) {
      let field = await prisma.fieldOfStudy.findFirst({
        where: { name: { equals: fieldName, mode: 'insensitive' } }
      });
      
      // Auto-create missing references to prevent data loss
      if (!field) {
        field = await prisma.fieldOfStudy.create({ data: { name: fieldName, category: 'Uncategorized' } });
        autoCreatedReport.push(`Auto-created Master Record: "${fieldName}" (User: ${profile.userId})`);
      }
      
      // Upsert join record to prevent duplicates
      await prisma.userFieldsOfStudy.upsert({
        where: { userId_fieldId: { userId: profile.userId, fieldId: field.id } },
        update: {},
        create: { userId: profile.userId, fieldId: field.id }
      });
      migrated++;
    }
  }
  
  console.log('\n--- AUTO-CREATE REPORT ---');
  autoCreatedReport.forEach(msg => console.log(msg));
  console.log(`\nMigration complete. Inserted ${migrated} join records.`);
}
migrate().finally(() => prisma.$disconnect());
