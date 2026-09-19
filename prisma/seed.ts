/**
 * Prisma seed script.
 * Run with: npx prisma db seed
 *
 * Seeds default roles (user, content_admin, system_admin) and initial admin user.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_ROLES = [
  { id: 1, name: 'user', description: 'Standard user access' },
  {
    id: 2,
    name: 'content_admin',
    description: 'Content Administrator for managing opportunities',
  },
  {
    id: 3,
    name: 'system_admin',
    description: 'Full system administrator access',
  },
];

const DEFAULT_ADMIN = {
  email: 'admin@levora.app',
  password: 'AdminPassword123!',
  firstName: 'System',
  lastName: 'Admin',
};

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── Roles ──────────────────────────────────
  for (const role of DEFAULT_ROLES) {
    await prisma.roles.upsert({
      where: { id: role.id },
      update: { name: role.name, description: role.description },
      create: role,
    });
    console.log(`  ✔ Role: ${role.name} (ID: ${role.id})`);
  }

  // ── Admin user ─────────────────────────────
  const existing = await prisma.users.findUnique({
    where: { email: DEFAULT_ADMIN.email },
  });

  if (existing) {
    console.log(
      `\n  ⏭ Admin "${DEFAULT_ADMIN.email}" already exists — skipping`,
    );
  } else {
    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 12);

    const user = await prisma.users.create({
      data: {
        email: DEFAULT_ADMIN.email,
        password: hashedPassword,
        firstName: DEFAULT_ADMIN.firstName,
        lastName: DEFAULT_ADMIN.lastName,
        isEmailVerified: true,
        userProfile: {
          create: {
            fullName: `${DEFAULT_ADMIN.firstName} ${DEFAULT_ADMIN.lastName}`,
            isDraft: false,
            completionPct: 100,
          },
        },
      },
      select: { id: true, email: true },
    });

    await prisma.userRoles.create({
      data: { userId: user.id, roleId: 3 }, // system_admin
    });

    console.log(`\n  ✔ Admin created: ${user.email} (${user.id})`);
  }

  // ── Fields of Study ──────────────────────
  const fieldsOfStudy = [
    { name: 'Computer Science', category: 'STEM' },
    { name: 'Software Engineering', category: 'STEM' },
    { name: 'Data Science', category: 'STEM' },
    { name: 'Artificial Intelligence', category: 'STEM' },
    { name: 'Business Administration', category: 'Business' },
    { name: 'Finance', category: 'Business' },
    { name: 'Marketing', category: 'Business' },
    { name: 'Fine Arts', category: 'Arts' },
    { name: 'Graphic Design', category: 'Arts' },
    { name: 'Physics', category: 'Science' },
    { name: 'Chemistry', category: 'Science' },
    { name: 'Biology', category: 'Science' },
    { name: 'Mechanical Engineering', category: 'Engineering' },
    { name: 'Electrical Engineering', category: 'Engineering' },
    { name: 'Civil Engineering', category: 'Engineering' },
    { name: 'Nursing', category: 'Healthcare' },
    { name: 'Medicine', category: 'Healthcare' },
    { name: 'Public Health', category: 'Healthcare' },
  ];

  for (const fos of fieldsOfStudy) {
    await prisma.fieldOfStudy.upsert({
      where: { name: fos.name },
      update: { category: fos.category },
      create: fos,
    });
  }
  console.log(`  ✔ Seeded ${fieldsOfStudy.length} fields of study`);

  // ── Skills ─────────────────────────────────
  const skills = [
    {
      id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      name: 'JavaScript',
      category: 'Tech',
    },
    { name: 'TypeScript', category: 'Tech' },
    { name: 'Python', category: 'Tech' },
    { name: 'Java', category: 'Tech' },
    { name: 'C++', category: 'Tech' },
    { name: 'React', category: 'Tech' },
    { name: 'Node.js', category: 'Tech' },
    { name: 'AWS', category: 'Tech' },
    { name: 'Docker', category: 'Tech' },
    { name: 'Kubernetes', category: 'Tech' },
    { name: 'SQL', category: 'Tech' },
    { name: 'MongoDB', category: 'Tech' },
    { name: 'PostgreSQL', category: 'Tech' },
    { name: 'Project Management', category: 'Business' },
    { name: 'Data Analysis', category: 'Business' },
    { name: 'Financial Modeling', category: 'Business' },
    { name: 'Marketing Strategy', category: 'Business' },
    { name: 'Business Development', category: 'Business' },
    { name: 'Illustration', category: 'Arts' },
    { name: 'Photography', category: 'Arts' },
    { name: 'Video Editing', category: 'Arts' },
    { name: 'Research', category: 'Science' },
    { name: 'Statistical Analysis', category: 'Science' },
    { name: 'AutoCAD', category: 'Engineering' },
    { name: 'MATLAB', category: 'Engineering' },
    { name: 'Patient Care', category: 'Healthcare' },
    { name: 'Medical Research', category: 'Healthcare' },
  ];

  for (const skill of skills) {
    const { id } = skill;
    await prisma.skillsMaster.upsert({
      where: { name: skill.name },
      update: { category: skill.category, ...(id ? { id } : {}) },
      create: { ...skill },
    });
  }
  console.log(`  ✔ Seeded ${skills.length} skills`);

  // ── Languages ──────────────────────────────
  const languages = [
    { id: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', name: 'English' },
    { name: 'Arabic' },
    { name: 'French' },
    { name: 'Spanish' },
    { name: 'German' },
    { name: 'Chinese' },
    { name: 'Japanese' },
    { name: 'Russian' },
    { name: 'Portuguese' },
    { name: 'Italian' },
  ];

  for (const lang of languages) {
    const { id } = lang;
    await prisma.languagesMaster.upsert({
      where: { name: lang.name },
      update: { ...(id ? { id } : {}) },
      create: { ...lang },
    });
  }
  console.log(`  ✔ Seeded ${languages.length} languages`);

  // ── Education Levels ───────────────────────
  const educationLevels = [
    { name: 'high_school', labelEn: 'High School', labelAr: 'ثانوية عامة' },
    { name: 'diploma', labelEn: 'Diploma', labelAr: 'دبلوم' },
    { name: 'bachelor', labelEn: 'Bachelor', labelAr: 'بكالوريوس' },
    { name: 'master', labelEn: 'Master', labelAr: 'ماجستير' },
    { name: 'phd', labelEn: 'PhD', labelAr: 'دكتوراه' },
    { name: 'certificate', labelEn: 'Certificate', labelAr: 'شهادة مهنية' },
    { name: 'other', labelEn: 'Other', labelAr: 'أخرى' },
  ];

  for (const level of educationLevels) {
    await prisma.educationLevel.upsert({
      where: { name: level.name },
      update: { labelEn: level.labelEn, labelAr: level.labelAr },
      create: level,
    });
  }
  console.log(`  ✔ Seeded ${educationLevels.length} education levels`);

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
