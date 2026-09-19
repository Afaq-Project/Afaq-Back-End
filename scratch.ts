const fos1 = ["CS"];
const fos2 = "[\"CS\"]";
const fos3 = "CS";
const fos4 = null;

function hasValidFieldOfStudy(fos: any): boolean {
  if (!fos) return false;
  if (Array.isArray(fos)) return fos.length > 0;
  if (typeof fos === 'string') {
    try {
      const parsed = JSON.parse(fos);
      if (Array.isArray(parsed)) return parsed.length > 0;
    } catch {}
    return fos.trim().length > 0;
  }
  if (typeof fos === 'object') {
    return Object.keys(fos).length > 0;
  }
  return false;
}

console.log(hasValidFieldOfStudy(fos1)); // true
console.log(hasValidFieldOfStudy(fos2)); // true
console.log(hasValidFieldOfStudy(fos3)); // true
console.log(hasValidFieldOfStudy(fos4)); // false
