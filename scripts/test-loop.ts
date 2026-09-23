import AdmZip = require('adm-zip');
import * as XLSX from 'xlsx';

async function test() {
  const MAJORS_URL = 'https://nces.ed.gov/pubs2002/cip2000/xls/cip.zip';
  const res = await fetch(MAJORS_URL);
  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const xlsEntry = entries.find(
    (e: any) =>
      e.entryName.toLowerCase().endsWith('.xls') ||
      e.entryName.toLowerCase().endsWith('.xlsx'),
  );
  const xlsBuffer = xlsEntry!.getData();
  const workbook = XLSX.read(xlsBuffer, { type: 'buffer' });
  const sheetName =
    workbook.SheetNames.find((s) => s.toUpperCase().includes('CIP')) ||
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: any[] = XLSX.utils.sheet_to_json(sheet);

  const row = data[0];
  const rawCode = row['CIPCode'] || row['CIPCODE'] || row['CIP Code'] || '';
  const rawTitle = row['CIPTitle'] || row['CIPTITLE'] || row['CIP Title'] || '';
  console.log('row:', row);
  console.log('rawCode:', rawCode, 'rawTitle:', rawTitle);
  console.log('if condition:', !rawCode || !rawTitle);
}
test().catch(console.error);
