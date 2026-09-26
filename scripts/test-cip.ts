import AdmZip = require('adm-zip');
import * as XLSX from 'xlsx';

async function test() {
  const MAJORS_URL = 'https://nces.ed.gov/pubs2002/cip2000/xls/cip.zip';
  const fetchBuffer = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }
    return Buffer.from(await res.arrayBuffer());
  };
  const buffer = await fetchBuffer(MAJORS_URL);
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const xlsEntry = entries.find(
    (e: any) =>
      e.entryName.toLowerCase().endsWith('.xls') ||
      e.entryName.toLowerCase().endsWith('.xlsx') ||
      e.entryName.toLowerCase().endsWith('.csv'),
  );
  if (!xlsEntry) {
    throw new Error('Excel file not found');
  }
  const xlsBuffer = xlsEntry.getData();

  if (xlsEntry.entryName.endsWith('.csv')) {
    console.log("It's a CSV");
    console.log(xlsBuffer.toString('utf8').substring(0, 500));
  } else {
    const workbook = XLSX.read(xlsBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.includes('CIP2000')
      ? 'CIP2000'
      : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log('SheetName used:', sheetName);
    console.log('Columns:', Object.keys(data[0] || {}));
    console.log('First row from utils:', data[0]);
  }
}
test().catch(console.error);
