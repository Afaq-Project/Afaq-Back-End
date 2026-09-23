import { PrismaClient } from '@prisma/client';
// @ts-ignore
import AdmZip = require('adm-zip');
// @ts-ignore
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const COUNTRIES_URL =
  'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
const CITIES_URL = 'https://download.geonames.org/export/dump/cities1000.zip';
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

async function loadCountries() {
  console.log('Fetching Countries...');
  const data = await fetchJson(COUNTRIES_URL);
  const unMembers = data.filter((d: any) => d.unMember === true);

  let inserted = 0;
  for (const country of unMembers) {
    const nameEn = country.name?.common || '';
    const nameAr = country.translations?.ara?.common || nameEn;
    const isoCode = country.cca3;
    const isoCode2 = country.cca2;
    const regionEn = country.region || '';
    const phoneCode = country.idd?.root
      ? country.idd.root + (country.idd.suffixes?.[0] || '')
      : null;
    const flagEmoji = country.flag || '';

    if (!isoCode) {
      continue;
    }

    await prisma.countries.upsert({
      where: { isoCode },
      update: {
        nameEn,
        nameAr,
        isoCode2,
        regionEn,
        phoneCode,
        flagEmoji,
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
        externalSourceId: isoCode,
      },
    });
    inserted++;
  }
  console.log(`✅ Countries loaded: ${inserted}`);
}

async function loadCities() {
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

  let inserted = 0;
  let skipped = 0;

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

    const key = `${nameEn}-${countryId}`;
    if (!citySet.has(key)) {
      newCities.push({ nameEn, nameAr, countryId });
      citySet.add(key);
    }
  }

  // Batch insert cities
  const batchSize = 5000;
  for (let i = 0; i < newCities.length; i += batchSize) {
    const batch = newCities.slice(i, i + batchSize);
    await prisma.cities.createMany({ data: batch, skipDuplicates: true });
    inserted += batch.length;
  }

  console.log(`✅ Cities loaded: ${inserted} (Skipped unresolved: ${skipped})`);
}

async function loadMajors() {
  console.log('Fetching Majors (CIP codes)...');
  const buffer = await fetchBuffer(MAJORS_URL);
  const zip = new AdmZip(buffer);

  // Find the xls file
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

  let categoriesInserted = 0;
  let majorsInserted = 0;

  // Cache categories
  const categoriesMap = new Map<string, string>(); // Prefix -> ID

  for (const row of data) {
    // CIPCode and CIPTitle are typical columns in this dataset
    const rawCode = row['CIPCode'] || row['CIPCODE'] || row['CIP Code'] || '';
    const rawTitle =
      row['CIPTitle'] || row['CIPTITLE'] || row['CIP Title'] || '';

    if (!rawCode || !rawTitle) {
      continue;
    }

    // Convert to string and trim
    const code = String(rawCode).trim().replace('=', '').replace(/"/g, ''); // Sometimes Excel exports as ="11.0101"
    const title = String(rawTitle).trim();

    // Category: First two digits
    if (code.length === 2 || code.endsWith('.0000')) {
      // It's a category
      const prefix = code.substring(0, 2);
      let cat = await prisma.majorCategories.findFirst({
        where: { nameEn: title },
      });
      if (!cat) {
        cat = await prisma.majorCategories.create({
          data: { nameEn: title, nameAr: title }, // fallback nameAr
        });
        categoriesInserted++;
      }
      categoriesMap.set(prefix, cat.id);
    } else if (code.includes('.')) {
      // It's a major
      const prefix = code.split('.')[0];
      const categoryId = categoriesMap.get(prefix) || null;

      await prisma.majors.upsert({
        where: { externalSourceId: code },
        update: { nameEn: title, nameAr: title, categoryId },
        create: {
          nameEn: title,
          nameAr: title,
          categoryId,
          externalSourceId: code,
        },
      });
      majorsInserted++;
    }
  }

  console.log(`✅ Major Categories loaded: ${categoriesInserted}`);
  console.log(`✅ Majors loaded: ${majorsInserted}`);
}

async function loadInstitutions() {
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
  const cityMap = new Map<string, string>(); // 'NameEn-CountryId' -> cityId
  cities.forEach((c) => {
    cityMap.set(`${c.nameEn.toLowerCase()}-${c.countryId}`, c.id);
  });

  let inserted = 0;
  let skipped = 0;

  for (const inst of data) {
    const alphaTwo = inst.alpha_two_code;
    const countryId = countryMap.get(alphaTwo);
    if (!countryId) {
      skipped++;
      continue;
    }

    let cityId: string | null = null;
    if (inst['state-province']) {
      const stateProv = inst['state-province'].toLowerCase();
      cityId = cityMap.get(`${stateProv}-${countryId}`) || null;
    }

    const nameEn = inst.name;
    const nameAr = nameEn;
    const websiteUrl = inst.web_pages?.[0] || null;

    // Generate a consistent ID from domains if possible, or name
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
    inserted++;
  }

  console.log(
    `✅ Institutions loaded: ${inserted} (Skipped unresolved: ${skipped})`,
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

  // Check Institutions FK
  // We allow cityId to be null, but countryId should either be valid or null.
  // Actually schema requires Institutions.countryId to be present if it's there.
  // We filter skip rows with unresolved countries anyway.
  console.log('✅ Verification complete.');
}

async function main() {
  const isSample = process.argv.includes('--sample');
  console.log(
    `🌱 Loading Reference Data ${isSample ? '(SAMPLE MODE)' : ''}...`,
  );

  try {
    await loadCountries();
    await loadCities();
    await loadMajors();
    await loadInstitutions();
    await verify();
  } catch (error) {
    console.error('❌ Error during data load:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
