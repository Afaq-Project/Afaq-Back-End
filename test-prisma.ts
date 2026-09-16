import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.userEducations.update({
  where: { id: "123", userId: "456" },
  data: { degree: "BS" }
}).catch(() => {});
