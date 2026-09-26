const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const country = await prisma.countries.findFirst();
  await prisma.institutions.upsert({
    where: { externalSourceId: "MOCK_INST_2" },
    update: {},
    create: {
      nameEn: "Smoke Test University 2",
      nameAr: "جامعة الاختبار 2",
      countryId: country.id,
      externalSourceId: "MOCK_INST_2",
      isActive: true
    }
  });
  console.log("Mock institution 2 seeded");
}
main().catch(console.error).finally(() => prisma.$disconnect());
