// [OMA-W006-T006] Mock uuid module to resolve Jest ESM parsing
const crypto = require('crypto');

module.exports = {
  v4: () => crypto.randomUUID(),
  v1: () => crypto.randomUUID(),
  v3: () => crypto.randomUUID(),
  v5: () => crypto.randomUUID(),
  validate: () => true,
  version: () => 4,
};
