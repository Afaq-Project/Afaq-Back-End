const fs = require('fs');
const file = 'src/common/pipes/configurable-validation.pipe.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'return this.tolerantPipe.transform(value, metadata);',
  '// eslint-disable-next-line @typescript-eslint/no-unsafe-return\n      return this.tolerantPipe.transform(value, metadata);'
);

code = code.replace(
  'return super.transform(value, metadata);',
  '// eslint-disable-next-line @typescript-eslint/no-unsafe-return\n    return super.transform(value, metadata);'
);

fs.writeFileSync(file, code);
