const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const country = await prisma.countries.findFirst();
  await prisma.institutions.upsert({
    where: { externalSourceId: "MOCK_INST_3" },
    update: {},
    create: {
      nameEn: "Smoke Test University 3",
      nameAr: "جامعة الاختبار 3",
      countryId: country.id,
      externalSourceId: "MOCK_INST_3",
      isActive: true
    }
  });
  console.log("Mock institution 3 seeded");
}
main().catch(console.error).finally(() => prisma.$disconnect());
