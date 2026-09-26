const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const country = await prisma.countries.findFirst();
  await prisma.institutions.upsert({
    where: { externalSourceId: "MOCK_INST" },
    update: {},
    create: {
      nameEn: "Smoke Test University",
      nameAr: "جامعة الاختبار",
      countryId: country.id,
      externalSourceId: "MOCK_INST",
      isActive: true
    }
  });
  console.log("Mock institution seeded");
}
main().catch(console.error).finally(() => prisma.$disconnect());
