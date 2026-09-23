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
    key: 'profile.max_experiences',
    value: 10,
    description: 'Maximum number of experience entries per profile',
  },
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

const MARITAL_STATUSES = [
  { nameEn: 'Single', nameAr: 'أعزب', sortOrder: 1 },
  { nameEn: 'Married', nameAr: 'متزوج', sortOrder: 2 },
  { nameEn: 'Divorced', nameAr: 'مطلق', sortOrder: 3 },
  { nameEn: 'Widowed', nameAr: 'أرمل', sortOrder: 4 },
];

const EDUCATION_LEVELS = [
  { code: 'high_school', nameEn: 'High School', nameAr: 'ثانوية عامة', sortOrder: 1 },
  { code: 'diploma', nameEn: 'Diploma', nameAr: 'دبلوم', sortOrder: 2 },
  { code: 'bachelor', nameEn: 'Bachelor\'s Degree', nameAr: 'بكالوريوس', sortOrder: 3 },
  { code: 'master', nameEn: 'Master\'s Degree', nameAr: 'ماجستير', sortOrder: 4 },
  { code: 'phd', nameEn: 'Doctorate (PhD)', nameAr: 'دكتوراه', sortOrder: 5 },
  { code: 'other', nameEn: 'Other', nameAr: 'أخرى', sortOrder: 6 },
];

const SPECIAL_STATUSES = [
  { nameEn: 'Refugee', nameAr: 'لاجئ', sortOrder: 1 },
  { nameEn: 'Orphan', nameAr: 'يتيم', sortOrder: 2 },
  { nameEn: 'Person with Disability', nameAr: 'ذوي الاحتياجات الخاصة', sortOrder: 3 },
  { nameEn: 'First-Generation Student', nameAr: 'طالب الجيل الأول', sortOrder: 4 },
];

const STANDARDIZED_TESTS = [
  { nameEn: 'IELTS', nameAr: 'آيلتس', minScore: 0, maxScore: 9, scoreStep: 0.5, sortOrder: 1 },
  { nameEn: 'TOEFL iBT', nameAr: 'توفل', minScore: 0, maxScore: 120, scoreStep: 1, sortOrder: 2 },
  { nameEn: 'GRE', nameAr: 'جي آر إي', minScore: 260, maxScore: 340, scoreStep: 1, sortOrder: 3 },
  { nameEn: 'SAT', nameAr: 'سات', minScore: 400, maxScore: 1600, scoreStep: 10, sortOrder: 4 },
  { nameEn: 'Duolingo', nameAr: 'ديولينغو', minScore: 10, maxScore: 160, scoreStep: 5, sortOrder: 5 },
  { nameEn: 'PTE Academic', nameAr: 'بيرسون للغة الإنجليزية', minScore: 10, maxScore: 90, scoreStep: 1, sortOrder: 6 },
];

const LANGUAGES_MASTER = [
  { nameEn: 'Arabic', nameAr: 'العربية', isoCode: 'ar', sortOrder: 1 },
  { nameEn: 'English', nameAr: 'الإنجليزية', isoCode: 'en', sortOrder: 2 },
  { nameEn: 'French', nameAr: 'الفرنسية', isoCode: 'fr', sortOrder: 3 },
  { nameEn: 'Spanish', nameAr: 'الإسبانية', isoCode: 'es', sortOrder: 4 },
  { nameEn: 'German', nameAr: 'الألمانية', isoCode: 'de', sortOrder: 5 },
  { nameEn: 'Turkish', nameAr: 'التركية', isoCode: 'tr', sortOrder: 6 },
  { nameEn: 'Chinese', nameAr: 'الصينية', isoCode: 'zh', sortOrder: 7 },
  { nameEn: 'Hindi', nameAr: 'الهندية', isoCode: 'hi', sortOrder: 8 },
  { nameEn: 'Portuguese', nameAr: 'البرتغالية', isoCode: 'pt', sortOrder: 9 },
  { nameEn: 'Russian', nameAr: 'الروسية', isoCode: 'ru', sortOrder: 10 },
  { nameEn: 'Japanese', nameAr: 'اليابانية', isoCode: 'ja', sortOrder: 11 },
  { nameEn: 'Korean', nameAr: 'الكورية', isoCode: 'ko', sortOrder: 12 },
  { nameEn: 'Italian', nameAr: 'الإيطالية', isoCode: 'it', sortOrder: 13 },
  { nameEn: 'Persian', nameAr: 'الفارسية', isoCode: 'fa', sortOrder: 14 },
  { nameEn: 'Hebrew', nameAr: 'العبرية', isoCode: 'he', sortOrder: 15 },
  { nameEn: 'Urdu', nameAr: 'الأردية', isoCode: 'ur', sortOrder: 16 },
  { nameEn: 'Bengali', nameAr: 'البنغالية', isoCode: 'bn', sortOrder: 17 },
  { nameEn: 'Dutch', nameAr: 'الهولندية', isoCode: 'nl', sortOrder: 18 },
  { nameEn: 'Polish', nameAr: 'البولندية', isoCode: 'pl', sortOrder: 19 },
  { nameEn: 'Swedish', nameAr: 'السويدية', isoCode: 'sv', sortOrder: 20 },
];

const PROFICIENCY_LEVELS = [
  { nameEn: 'Beginner', nameAr: 'مبتدئ', sortOrder: 1 },
  { nameEn: 'Intermediate', nameAr: 'متوسط', sortOrder: 2 },
  { nameEn: 'Advanced', nameAr: 'متقدم', sortOrder: 3 },
  { nameEn: 'Fluent', nameAr: 'طليق', sortOrder: 4 },
  { nameEn: 'Native', nameAr: 'اللغة الأم', sortOrder: 5 },
];

const DOCUMENT_TYPES = [
  { nameEn: 'Academic Transcript', nameAr: 'كشف الدرجات', sortOrder: 1 },
  { nameEn: 'Passport Copy', nameAr: 'نسخة من جواز السفر', sortOrder: 2 },
  { nameEn: 'Recommendation Letter', nameAr: 'خطاب توصية', sortOrder: 3 },
  { nameEn: 'CV', nameAr: 'السيرة الذاتية', sortOrder: 4 },
  { nameEn: 'Personal Statement', nameAr: 'بيان شخصي', sortOrder: 5 },
  { nameEn: 'Certificate', nameAr: 'شهادة', sortOrder: 6 },
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

  // ── Marital Statuses ────────────────────────
  console.log('\n── Marital Statuses ──────────────────');
  for (const ms of MARITAL_STATUSES) {
    await prisma.maritalStatuses.upsert({
      where: { nameEn: ms.nameEn },
      update: { nameAr: ms.nameAr, sortOrder: ms.sortOrder },
      create: ms,
    });
    console.log(`  ✔ Marital Status: ${ms.nameEn}`);
  }

  // ── Education Levels ────────────────────────
  console.log('\n── Education Levels ──────────────────');
  for (const el of EDUCATION_LEVELS) {
    await prisma.educationLevel.upsert({
      where: { code: el.code },
      update: { nameEn: el.nameEn, nameAr: el.nameAr, sortOrder: el.sortOrder },
      create: el,
    });
    console.log(`  ✔ Education Level: ${el.nameEn}`);
  }

  // ── Special Statuses ────────────────────────
  console.log('\n── Special Statuses ──────────────────');
  for (const ss of SPECIAL_STATUSES) {
    await prisma.specialStatuses.upsert({
      where: { nameEn: ss.nameEn },
      update: { nameAr: ss.nameAr, sortOrder: ss.sortOrder },
      create: ss,
    });
    console.log(`  ✔ Special Status: ${ss.nameEn}`);
  }

  // ── Standardized Tests ──────────────────────
  console.log('\n── Standardized Tests ────────────────');
  for (const st of STANDARDIZED_TESTS) {
    await prisma.standardizedTests.upsert({
      where: { nameEn: st.nameEn },
      update: { 
        nameAr: st.nameAr, 
        minScore: st.minScore, 
        maxScore: st.maxScore, 
        scoreStep: st.scoreStep, 
        sortOrder: st.sortOrder 
      },
      create: st,
    });
    console.log(`  ✔ Standardized Test: ${st.nameEn}`);
  }

  // ── Languages Master ────────────────────────
  console.log('\n── Languages Master ──────────────────');
  for (const lm of LANGUAGES_MASTER) {
    await prisma.languagesMaster.upsert({
      where: { nameEn: lm.nameEn },
      update: { nameAr: lm.nameAr, isoCode: lm.isoCode, sortOrder: lm.sortOrder },
      create: lm,
    });
    console.log(`  ✔ Language: ${lm.nameEn}`);
  }

  // ── Proficiency Levels ──────────────────────
  console.log('\n── Proficiency Levels ────────────────');
  for (const pl of PROFICIENCY_LEVELS) {
    await prisma.proficiencyLevels.upsert({
      where: { nameEn: pl.nameEn },
      update: { nameAr: pl.nameAr, sortOrder: pl.sortOrder },
      create: pl,
    });
    console.log(`  ✔ Proficiency Level: ${pl.nameEn}`);
  }

  // ── Document Types ──────────────────────────
  console.log('\n── Document Types ────────────────────');
  for (const dt of DOCUMENT_TYPES) {
    await prisma.documentTypes.upsert({
      where: { nameEn: dt.nameEn },
      update: { nameAr: dt.nameAr, sortOrder: dt.sortOrder },
      create: dt,
    });
    console.log(`  ✔ Document Type: ${dt.nameEn}`);
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
            isMatchable: false,
            completionPct: 0,
          },
        },
      },
      select: { id: true, email: true },
    });

    const adminRole = await prisma.roles.findUnique({
      where: { name: 'system_admin' },
    });
    if (!adminRole) {
      throw new Error('system_admin role missing — did roles seed run?');
    }
    await prisma.userRoles.create({
      data: { userId: user.id, roleId: adminRole.id },
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
