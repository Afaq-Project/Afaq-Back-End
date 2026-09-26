const fs = require('fs');
let content = fs.readFileSync('scripts/load-reference-data.ts', 'utf8');

content = content.replace(
  'const cityMap = new Map<string, string>();',
  'const cityMap = new Map<string, string>();\n  const countryDefaultCityMap = new Map<string, string>();'
);

content = content.replace(
  'cityMap.set(`${c.countryId}|${c.nameEn.toLowerCase()}`, c.id);',
  'cityMap.set(`${c.countryId}|${c.nameEn.toLowerCase()}`, c.id);\n      if (!countryDefaultCityMap.has(c.countryId)) {\n        countryDefaultCityMap.set(c.countryId, c.id);\n      }'
);

content = content.replace(
  `    if (limit && !cityId) {
      const anyCity =
        cities.find((c) => c.countryId === countryId) || cities[0];
      if (anyCity) {
        cityId = anyCity.id;
      }
    }`,
  `    if (limit && !cityId) {
      cityId = countryDefaultCityMap.get(countryId) || null;
    }`
);

fs.writeFileSync('scripts/load-reference-data.ts', content);
