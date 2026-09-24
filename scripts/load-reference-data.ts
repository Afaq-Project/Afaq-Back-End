import { PrismaClient } from '@prisma/client';
import AdmZip = require('adm-zip');
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const COUNTRIES_URL =
  'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
const CITIES_URL = 'http://download.geonames.org/export/dump/cities1000.zip';
const INSTITUTIONS_URL =
  'https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json';
const MAJORS_URL = 'https://nces.ed.gov/pubs2002/cip2000/xls/cip.zip';

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.json();
}

async function processInBatches<T>(items: T[], batchSize: number, processItem: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(processItem));
  }
}

async function loadCountries(limit?: number) {
  console.log('Fetching Countries...');
  const data = await fetchJson(COUNTRIES_URL);
  const unMembers = data.filter((d: any) => d.unMember === true);

  const countriesToProcess = [];
  for (const country of unMembers) {
    const isoCode = country.cca3;
    if (!isoCode) continue;
    
    countriesToProcess.push(country);
    if (limit && countriesToProcess.length >= limit) break;
  }

  let processed = 0;
  await processInBatches(countriesToProcess, 20, async (country) => {
    const nameEn = country.name?.common || '';
    const nameAr = country.translations?.ara?.common || nameEn;
    const isoCode = country.cca3;
    const isoCode2 = country.cca2;
    const regionEn = country.region || '';
    const phoneCode = country.idd?.root
      ? country.idd.root + (country.idd.suffixes?.[0] || '')
      : null;
    const flagEmoji = country.flag || '';
    const nationalityNameEn = country.demonyms?.eng?.m || null;
    const nationalityNameAr = country.demonyms?.ara?.m || null;

    await prisma.countries.upsert({
      where: { isoCode },
      update: {
        nameEn,
        nameAr,
        isoCode2,
        regionEn,
        phoneCode,
        flagEmoji,
        nationalityNameEn,
        nationalityNameAr,
        externalSourceId: isoCode,
      },
      create: {
        nameEn,
        nameAr,
        isoCode,
        isoCode2,
        regionEn,
        phoneCode,
        flagEmoji,
        nationalityNameEn,
        nationalityNameAr,
        externalSourceId: isoCode,
      },
    });
    processed++;
  });
  
  console.log(`✅ Countries processed: ${processed}`);
}

async function loadCities(limit?: number) {
  console.log('Fetching Cities...');
  const buffer = await fetchBuffer(CITIES_URL);
  const zip = new AdmZip(buffer);
  const zipEntry = zip.getEntry('cities1000.txt');
  if (!zipEntry) {
    throw new Error('cities1000.txt not found in ZIP');
  }

  const text = zipEntry.getData().toString('utf8');
  const lines = text.split('\n');

  const countries = await prisma.countries.findMany({
    select: { id: true, isoCode2: true },
  });
  const countryMap = new Map<string, string>();
  countries.forEach((c) => {
    if (c.isoCode2) {
      countryMap.set(c.isoCode2, c.id);
    }
  });

  const existingCities = await prisma.cities.findMany({
    select: { nameEn: true, countryId: true },
  });
  const citySet = new Set(
    existingCities.map((c) => `${c.nameEn}-${c.countryId}`),
  );

  let processed = 0;
  let skipped = 0;
  let validCount = 0;

  const newCities = [];

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const cols = line.split('\t');
    if (cols.length < 9) {
      continue;
    }

    const nameEn = cols[1];
    const nameAr = nameEn; // Fallback
    const countryIsoCode2 = cols[8];

    const countryId = countryMap.get(countryIsoCode2);
    if (!countryId) {
      skipped++;
      continue;
    }

    validCount++;

    const key = `${nameEn}-${countryId}`;
    if (!citySet.has(key)) {
      newCities.push({ nameEn, nameAr, countryId });
      citySet.add(key);
    }

    if (limit && validCount >= limit) break;
  }

  // Deduplication handled by in-memory citySet
  const batchSize = 5000;
  for (let i = 0; i < newCities.length; i += batchSize) {
    const batch = newCities.slice(i, i + batchSize);
    await prisma.cities.createMany({ data: batch });
    processed += batch.length;
  }

  console.log(`✅ Cities processed: ${processed} (Skipped unresolved: ${skipped})`);
}

async function loadMajors(catLimit?: number, majorLimit?: number) {
  console.log('Fetching Majors (CIP codes)...');
  const buffer = await fetchBuffer(MAJORS_URL);
  const zip = new AdmZip(buffer);

  const entries = zip.getEntries();
  const xlsEntry = entries.find(
    (e: any) =>
      e.entryName.toLowerCase().endsWith('.xls') ||
      e.entryName.toLowerCase().endsWith('.xlsx'),
  );
  if (!xlsEntry) {
    throw new Error('Excel file not found in CIP zip');
  }

  const xlsBuffer = xlsEntry.getData();
  const workbook = XLSX.read(xlsBuffer, { type: 'buffer' });
  const sheetName =
    workbook.SheetNames.find((s) => s === 'CIP2000' || s === 'CIPCode2020') ||
    workbook.SheetNames.find((s) => s.toUpperCase().includes('CIP')) ||
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: any[] = XLSX.utils.sheet_to_json(sheet);

  let categoriesProcessed = 0;
  let majorsProcessed = 0;
  let validCatCount = 0;
  let validMajorCount = 0;
  const majorCountPerCat = new Map<string, number>();

  const categoriesMap = new Map<string, string>(); // Prefix -> ID
  const majorsToProcess = [];
  const seenMajors = new Set<string>();

  for (const row of data) {
    const rawCode = row['CIPCode'] || row['CIPCODE'] || row['CIP Code'] || '';
    const rawTitle =
      row['CIPTitle'] || row['CIPTITLE'] || row['CIP Title'] || '';

    if (!rawCode || !rawTitle) {
      continue;
    }

    const code = String(rawCode).trim().replace('=', '').replace(/"/g, '');
    const title = String(rawTitle).trim();

    if (code.length === 2 || code.endsWith('.0000')) {
      const prefix = code.substring(0, 2);
      
      if (!categoriesMap.has(prefix)) {
        if (catLimit && validCatCount >= catLimit) continue;
        validCatCount++;
        
        const cat = await prisma.majorCategories.upsert({
          where: { nameEn: title },
          update: { nameAr: title },
          create: { nameEn: title, nameAr: title }
        });
        categoriesProcessed++;
        categoriesMap.set(prefix, cat.id);
      }
    } else if (code.includes('.')) {
      const prefix = code.split('.')[0];
      const categoryId = categoriesMap.get(prefix) || null;
      
      if (majorLimit && !categoryId) {
        continue; // Fix 4: Skip majors with no category in sample mode
      }

      const majorKey = `${title}|${categoryId}`;
      if (seenMajors.has(majorKey)) {
        continue;
      }
      seenMajors.add(majorKey);

      if (majorLimit) {
        const count = majorCountPerCat.get(categoryId!) || 0;
        if (count >= 10) continue;
        majorCountPerCat.set(categoryId!, count + 1);
      }

      if (majorLimit && validMajorCount >= majorLimit) continue;
      validMajorCount++;
      
      majorsToProcess.push({
        code,
        title,
        categoryId
      });
    }

    const catDone = catLimit !== undefined && validCatCount >= catLimit;
    const majorDone = majorLimit !== undefined && validMajorCount >= majorLimit;
    const anyLimitSet = catLimit !== undefined || majorLimit !== undefined;
    
    if (anyLimitSet && (catLimit === undefined || catDone) && (majorLimit === undefined || majorDone)) {
      break;
    }
  }
  
  await processInBatches(majorsToProcess, 20, async (majorData) => {
    await prisma.majors.upsert({
      where: { externalSourceId: majorData.code },
      update: { nameEn: majorData.title, nameAr: majorData.title, categoryId: majorData.categoryId },
      create: {
        nameEn: majorData.title,
        nameAr: majorData.title,
        categoryId: majorData.categoryId,
        externalSourceId: majorData.code,
      },
    });
    majorsProcessed++;
  });

  console.log(`✅ Major Categories processed: ${categoriesProcessed}`);
  console.log(`✅ Majors processed: ${majorsProcessed}`);
}

async function loadInstitutions(limit?: number) {
  console.log('Fetching Institutions...');
  const data = await fetchJson(INSTITUTIONS_URL);

  const countries = await prisma.countries.findMany({
    select: { id: true, isoCode2: true },
  });
  const countryMap = new Map<string, string>();
  countries.forEach((c) => {
    if (c.isoCode2) {
      countryMap.set(c.isoCode2, c.id);
    }
  });

  const cities = await prisma.cities.findMany({
    select: { id: true, nameEn: true, countryId: true },
  });
  const cityMap = new Map<string, string>();
  cities.forEach((c) => {
    cityMap.set(`${c.countryId}|${c.nameEn.toLowerCase()}`, c.id);
  });

  let skipped = 0;
  let validCount = 0;
  
  const instsToProcess = [];

  for (const inst of data) {
    const alphaTwo = inst.alpha_two_code;
    const countryId = countryMap.get(alphaTwo);
    if (!countryId) {
      skipped++;
      continue;
    }

    const province = inst['state-province'];
    let cityId: string | null = null;
    if (province) {
      cityId = cityMap.get(`${countryId}|${province.toLowerCase()}`) || null;
    }

    if (limit && !cityId) {
      const anyCity = cities.find(c => c.countryId === countryId) || cities[0];
      if (anyCity) {
        cityId = anyCity.id;
      }
    }

    if (limit && !cityId) {
      skipped++;
      continue;
    }
    
    validCount++;
    instsToProcess.push({ inst, countryId, cityId });

    if (limit && validCount >= limit) break;
  }

  let processed = 0;
  
  await processInBatches(instsToProcess, 20, async ({ inst, countryId, cityId }) => {
    const nameEn = inst.name;
    const nameAr = nameEn;
    const websiteUrl = inst.web_pages?.[0] || null;
    const externalSourceId = inst.domains?.[0] || nameEn;

    await prisma.institutions.upsert({
      where: { externalSourceId },
      update: {
        nameEn,
        nameAr,
        countryId,
        cityId,
        websiteUrl,
      },
      create: {
        nameEn,
        nameAr,
        countryId,
        cityId,
        websiteUrl,
        externalSourceId,
      },
    });
    processed++;
  });

  console.log(
    `✅ Institutions processed: ${processed} (Skipped unresolved: ${skipped})`,
  );
}

async function verify() {
  console.log('\n--- Post-Seeding Verification ---');
  const counts = {
    Countries: await prisma.countries.count(),
    Cities: await prisma.cities.count(),
    MajorCategories: await prisma.majorCategories.count(),
    Majors: await prisma.majors.count(),
    Institutions: await prisma.institutions.count(),
  };

  console.table(counts);

  let hasErrors = false;
  const errors: string[] = [];
  const warnings: string[] = [];

  const dupCountries = await prisma.$queryRaw<any[]>`SELECT "name_en", count(*) FROM "countries" GROUP BY "name_en" HAVING count(*) > 1`;
  if (dupCountries.length > 0) {
    hasErrors = true;
    errors.push(`Duplicate Countries (nameEn) found: ${dupCountries.length}`);
  }

  const dupCities = await prisma.$queryRaw<any[]>`SELECT "name_en", "country_id", count(*) FROM "cities" GROUP BY "name_en", "country_id" HAVING count(*) > 1`;
  if (dupCities.length > 0) {
    hasErrors = true;
    errors.push(`Duplicate Cities (nameEn, countryId) found: ${dupCities.length}`);
  }

  const dupInstExt = await prisma.$queryRaw<any[]>`SELECT "external_source_id", count(*) FROM "institutions" WHERE "external_source_id" IS NOT NULL GROUP BY "external_source_id" HAVING count(*) > 1`;
  if (dupInstExt.length > 0) {
    hasErrors = true;
    errors.push(`Duplicate Institutions (externalSourceId) found: ${dupInstExt.length}`);
  }

  const dupInstNameCountry = await prisma.$queryRaw<any[]>`SELECT "name_en", "country_id", count(*) FROM "institutions" GROUP BY "name_en", "country_id" HAVING count(*) > 1`;
  if (dupInstNameCountry.length > 0) {
    warnings.push(`Duplicate Institutions (nameEn, countryId) found: ${dupInstNameCountry.length}`);
  }

  const dupMajorCat = await prisma.$queryRaw<any[]>`SELECT "name_en", count(*) FROM "major_categories" GROUP BY "name_en" HAVING count(*) > 1`;
  if (dupMajorCat.length > 0) {
    hasErrors = true;
    errors.push(`Duplicate MajorCategories (nameEn) found: ${dupMajorCat.length}`);
  }

  const dupMajors = await prisma.$queryRaw<any[]>`SELECT "name_en", "category_id", count(*) FROM "majors" GROUP BY "name_en", "category_id" HAVING count(*) > 1`;
  if (dupMajors.length > 0) {
    hasErrors = true;
    errors.push(`Duplicate Majors (nameEn, categoryId) found: ${dupMajors.length}`);
  }

  const orphanCities = await prisma.$queryRaw<any[]>`SELECT count(*) as count FROM "cities" WHERE "country_id" IS NULL OR "country_id" NOT IN (SELECT "id" FROM "countries")`;
  if (Number(orphanCities[0]?.count || 0) > 0) {
    hasErrors = true;
    errors.push(`Orphan Cities (missing/invalid countryId) found: ${orphanCities[0].count}`);
  }

  const nullInstCountries = await prisma.institutions.count({ where: { countryId: null } });
  if (nullInstCountries > 0) {
    warnings.push(`Institutions with null countryId: ${nullInstCountries}`);
  }

  const orphanInstCities = await prisma.$queryRaw<any[]>`SELECT count(*) as count FROM "institutions" WHERE "city_id" IS NOT NULL AND "city_id" NOT IN (SELECT "id" FROM "cities")`;
  if (Number(orphanInstCities[0]?.count || 0) > 0) {
    hasErrors = true;
    errors.push(`Orphan Institutions (invalid cityId) found: ${orphanInstCities[0].count}`);
  }

  const orphanMajors = await prisma.$queryRaw<any[]>`SELECT count(*) as count FROM "majors" WHERE "category_id" IS NOT NULL AND "category_id" NOT IN (SELECT "id" FROM "major_categories")`;
  if (Number(orphanMajors[0]?.count || 0) > 0) {
    hasErrors = true;
    errors.push(`Orphan Majors (invalid categoryId) found: ${orphanMajors[0].count}`);
  }

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    warnings.forEach((w) => console.log(` - ⚠️ ${w}`));
  }

  if (hasErrors) {
    console.error('\n❌ Verification Failed:');
    errors.forEach((e) => console.error(` - ${e}`));
    throw new Error('Verification failed.');
  }

  console.log('\n✅ Verification complete.');
}

async function main() {
  const isSample = process.argv.includes('--sample');
  console.log(
    `🌱 Loading Reference Data ${isSample ? '(SAMPLE MODE)' : ''}...`,
  );

  let exitCode = 0;
  try {
    if (isSample) {
      await loadCountries(20);
      await loadCities(50);
      await loadMajors(8, 40);
      await loadInstitutions(30);
    } else {
      await loadCountries();
      await loadCities();
      await loadMajors();
      await loadInstitutions();
    }
    await verify();
  } catch (error) {
    console.error('❌ Error during data load:', error);
    exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
  
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

main();
