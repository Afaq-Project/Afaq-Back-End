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

const SYSTEM_SETTINGS = [
  { key: 'matching.threshold', value: 60, description: 'Matching threshold' },
  {
    key: 'profile.weight_personal_identity',
    value: 18,
    description: 'Weight for personal identity',
  },
  {
    key: 'profile.weight_location_origin',
    value: 15,
    description: 'Weight for location and origin',
  },
  {
    key: 'profile.weight_education',
    value: 35,
    description: 'Weight for education',
  },
  {
    key: 'profile.weight_languages',
    value: 10,
    description: 'Weight for languages',
  },
  { key: 'profile.weight_tests', value: 7, description: 'Weight for tests' },
  {
    key: 'profile.weight_preferences_statuses',
    value: 15,
    description: 'Weight for preferences and statuses',
  },
  {
    key: 'profile.max_educations',
    value: 5,
    description: 'Max education records',
  },
  {
    key: 'profile.max_languages',
    value: 10,
    description: 'Max language records',
  },
  {
    key: 'profile.max_test_results',
    value: 10,
    description: 'Max test result records',
  },
  {
    key: 'profile.max_target_degrees',
    value: 5,
    description: 'Max target degrees',
  },
  {
    key: 'profile.max_target_majors',
    value: 10,
    description: 'Max target majors',
  },
  {
    key: 'profile.max_target_institutions',
    value: 10,
    description: 'Max target institutions',
  },
  { key: 'profile.max_bio_length', value: 1000, description: 'Max bio length' },
  {
    key: 'documents.max_size_bytes',
    value: 10485760,
    description: 'Max document size in bytes',
  },
  {
    key: 'documents.allowed_mime_types',
    value: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    description: 'Allowed document MIME types',
  },
];

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

  // ── System Settings ────────────────────────
  for (const setting of SYSTEM_SETTINGS) {
    await prisma.systemSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description },
      create: setting,
    });
    console.log(`  ✔ System Setting: ${setting.key}`);
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
            firstName: DEFAULT_ADMIN.firstName,
            lastName: DEFAULT_ADMIN.lastName,
            completionPct: 100,
            isMatchable: false,
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
