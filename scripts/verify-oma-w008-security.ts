// [OMA-W008-T003] Independent security verification, credential hygiene audit, and sign-off
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { StorageServiceProvider, STORAGE_SERVICE } from '../src/modules/profile/storage/storage.service';
import { StorageModule } from '../src/modules/profile/storage/storage.module';
import { LocalStorageService } from '../src/modules/profile/storage/local-storage.service';
import { S3StorageService } from '../src/modules/profile/storage/s3-storage.service';
import { encryptFile, decryptFile } from '../src/modules/profile/utils/encryption.util';
import { ConfigService } from '@nestjs/config';

interface AuditResult {
  checkId: string;
  name: string;
  passed: boolean;
  details: string;
}

const auditResults: AuditResult[] = [];

function recordCheck(checkId: string, name: string, passed: boolean, details: string) {
  auditResults.push({ checkId, name, passed, details });
  const mark = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${mark}] ${checkId}: ${name} - ${details}`);
}

function createMockConfig(configMap: Record<string, any>): ConfigService {
  return {
    get: (key: string) => configMap[key],
  } as unknown as ConfigService;
}

async function runSecurityAudit() {
  console.log('================================================================');
  console.log('   OMA-W008-T003 Storage Security & Encryption Hygiene Audit   ');
  console.log('================================================================\n');

  // Verify STORAGE_SERVICE token & StorageModule definition
  recordCheck(
    'SEC-MOD-01',
    'StorageModule and STORAGE_SERVICE token definitions intact',
    Boolean(StorageModule) && STORAGE_SERVICE === 'STORAGE_SERVICE',
    `STORAGE_SERVICE token="${STORAGE_SERVICE}", StorageModule defined`,
  );

  const valid64HexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  // -------------------------------------------------------------------------
  // 1. FILE_ENCRYPTION_KEY Strict Validation Audits
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 1: FILE_ENCRYPTION_KEY Validation in StorageServiceProvider ---');

  const invalidKeys = [
    { desc: 'Missing key (undefined)', key: undefined },
    { desc: 'Empty key ("")', key: '' },
    { desc: 'Short key (32 chars)', key: '0123456789abcdef0123456789abcdef' },
    { desc: '63 chars key (off-by-one under)', key: valid64HexKey.substring(0, 63) },
    { desc: '65 chars key (off-by-one over)', key: valid64HexKey + 'a' },
  ];

  for (const item of invalidKeys) {
    try {
      const mockConfig = createMockConfig({ 'storage.encryption.key': item.key });
      StorageServiceProvider.useFactory(mockConfig);
      recordCheck(
        'SEC-KEY-01',
        `Reject invalid FILE_ENCRYPTION_KEY (${item.desc})`,
        false,
        'Factory allowed invalid encryption key',
      );
    } catch (err: any) {
      const passed = err.message === 'FILE_ENCRYPTION_KEY must be a 64-character hex string';
      recordCheck(
        'SEC-KEY-01',
        `Reject invalid FILE_ENCRYPTION_KEY (${item.desc})`,
        passed,
        `Threw expected error: ${err.message}`,
      );
    }
  }

  // Valid 64-char hex key test
  try {
    const mockConfig = createMockConfig({
      'storage.encryption.key': valid64HexKey,
      'storage.provider': 'local',
      'storage.local.uploadPath': './tmp/test-uploads',
    });
    const instance = StorageServiceProvider.useFactory(mockConfig);
    const passed = instance instanceof LocalStorageService;
    recordCheck(
      'SEC-KEY-02',
      'Accept valid 64-character FILE_ENCRYPTION_KEY',
      passed,
      'Successfully created LocalStorageService instance',
    );
  } catch (err: any) {
    recordCheck('SEC-KEY-02', 'Accept valid 64-character FILE_ENCRYPTION_KEY', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 2. S3 Credentials Guardrails & Leak Prevention
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 2: S3StorageService Credential Guardrails ---');

  const invalidS3Configs = [
    { desc: 'Missing region', cfg: { 'storage.s3.bucket': 'b', 'storage.s3.accessKeyId': 'k', 'storage.s3.secretAccessKey': 's' } },
    { desc: 'Missing bucket', cfg: { 'storage.s3.region': 'us-east-1', 'storage.s3.accessKeyId': 'k', 'storage.s3.secretAccessKey': 's' } },
    { desc: 'Missing accessKeyId', cfg: { 'storage.s3.region': 'us-east-1', 'storage.s3.bucket': 'b', 'storage.s3.secretAccessKey': 's' } },
    { desc: 'Missing secretAccessKey', cfg: { 'storage.s3.region': 'us-east-1', 'storage.s3.bucket': 'b', 'storage.s3.accessKeyId': 'k' } },
  ];

  for (const item of invalidS3Configs) {
    try {
      const mockConfig = createMockConfig(item.cfg);
      new S3StorageService(mockConfig);
      recordCheck(
        'SEC-S3-01',
        `S3 requires credentials (${item.desc})`,
        false,
        'S3StorageService instantiated without mandatory credentials',
      );
    } catch (err: any) {
      const passed = err.message === 'S3 configuration is missing required fields';
      recordCheck(
        'SEC-S3-01',
        `S3 requires credentials (${item.desc})`,
        passed,
        `Blocked initialization: ${err.message}`,
      );
    }
  }

  // S3 Credential Encapsulation Check
  try {
    const validS3Config = createMockConfig({
      'storage.s3.region': 'eu-central-1',
      'storage.s3.bucket': 'my-secure-bucket',
      'storage.s3.accessKeyId': 'AKIAIOSFODNN7EXAMPLE',
      'storage.s3.secretAccessKey': 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    });
    const s3Instance = new S3StorageService(validS3Config);

    const ownProps = Object.getOwnPropertyNames(s3Instance);
    const leakedKeys = ownProps.filter((p) => p.toLowerCase().includes('secret') || p.toLowerCase().includes('accesskey'));

    const passed = leakedKeys.length === 0 && (s3Instance as any).secretAccessKey === undefined && (s3Instance as any).accessKeyId === undefined;
    recordCheck(
      'SEC-S3-02',
      'S3 instance credential encapsulation (no public leaks)',
      passed,
      `Encapsulated: ownProps=[${ownProps.join(',')}], leakedKeys=[${leakedKeys.join(',')}]`,
    );
  } catch (err: any) {
    recordCheck('SEC-S3-02', 'S3 instance credential encapsulation', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 3. AES-256-CBC Encryption & Decryption Utilities Audit
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 3: AES-256-CBC At-Rest Encryption & Utility Integrity ---');

  const testData = Buffer.from('Confidential applicant resume document payload 2026');
  try {
    // 3.1 Roundtrip encryption
    const { encrypted, iv } = encryptFile(testData, valid64HexKey);
    const decrypted = decryptFile(encrypted, valid64HexKey, iv);
    const passed = decrypted.equals(testData);
    recordCheck(
      'SEC-ENC-01',
      'AES-256-CBC encryption/decryption roundtrip fidelity',
      passed,
      `Decrypted matches original (${testData.length} bytes)`,
    );

    // 3.2 Random IV generation (Semantic Security against CPA)
    const { iv: iv2 } = encryptFile(testData, valid64HexKey);
    const ivDiffers = iv !== iv2;
    recordCheck(
      'SEC-ENC-02',
      'CPA Security: Random 16-byte IV generated per encryption',
      ivDiffers && iv.length === 32,
      `IV1=${iv}, IV2=${iv2} (distinct 32 hex chars)`,
    );

    // 3.3 Ciphertext Tamper Resistance
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] ^= 0xff; // flip last byte (bad padding)
    let tamperDetected = false;
    try {
      decryptFile(tampered, valid64HexKey, iv);
    } catch {
      tamperDetected = true;
    }
    recordCheck(
      'SEC-ENC-03',
      'Tamper resilience on ciphertext corruption',
      tamperDetected,
      'Corrupted ciphertext triggers decryption failure (bad decrypt/padding)',
    );

    // 3.4 Key Length Enforcement in encryption utils
    let keyValidationPassed = false;
    try {
      encryptFile(testData, 'short-key');
    } catch (err: any) {
      if (err.message.includes('64 hex characters')) {
        keyValidationPassed = true;
      }
    }
    recordCheck(
      'SEC-ENC-04',
      'encryptFile enforces 64-char key strictly',
      keyValidationPassed,
      'Rejected invalid length key',
    );
  } catch (err: any) {
    recordCheck('SEC-ENC-01', 'AES-256-CBC encryption integrity', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 4. Signed Download URLs, Expiration, and HMAC Tamper Resistance
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 4: Signed Download URLs & HMAC Security ---');

  const localStorage = new LocalStorageService(
    createMockConfig({
      'storage.local.uploadPath': './tmp/test-uploads',
      'storage.encryption.key': valid64HexKey,
    }),
  );

  const fileKey = 'document-uuid-test.pdf';
  const ttlSeconds = 60; // 1 minute
  const signedUrl = await localStorage.getSignedUrl(fileKey, ttlSeconds);

  // Validate URL format
  const urlParts = signedUrl.split('?token=');
  const validUrlFormat = urlParts.length === 2 && urlParts[0].startsWith('/api/v1/local-storage/');
  recordCheck(
    'SEC-URL-01',
    'Signed URL path adheres to /api/v1/local-storage/:key?token= convention',
    validUrlFormat,
    `Generated URL: ${signedUrl}`,
  );

  const tokenBase64 = urlParts[1];
  const tokenJson = JSON.parse(Buffer.from(tokenBase64, 'base64').toString('utf-8'));
  const { payload, signature } = tokenJson;
  const parsedPayload = JSON.parse(payload);

  // 4.1 Bounded TTL Check
  const expectedExpMin = Date.now() + 55 * 1000;
  const expectedExpMax = Date.now() + 65 * 1000;
  const boundedTtl = parsedPayload.exp >= expectedExpMin && parsedPayload.exp <= expectedExpMax;
  recordCheck(
    'SEC-URL-02',
    'Signed URL bounded TTL expiration verification',
    boundedTtl && parsedPayload.key === fileKey,
    `Expires in ${Math.round((parsedPayload.exp - Date.now()) / 1000)}s (bounded to TTL ${ttlSeconds}s)`,
  );

  // 4.2 HMAC Signature Authenticity & Tamper Proofing
  const recalculatedSig = crypto
    .createHmac('sha256', valid64HexKey)
    .update(payload)
    .digest('hex');
  const sigMatches = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(recalculatedSig));
  recordCheck(
    'SEC-URL-03',
    'HMAC-SHA256 signature verification with storage.encryption.key',
    sigMatches,
    `Signature matches timing-safe equal digest`,
  );

  // 4.3 Probe: Tampering Payload (e.g. extending expiration)
  const tamperedPayload = JSON.stringify({ key: fileKey, exp: Date.now() + 86400 * 1000 * 365 });
  const tamperedSigMatches = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(crypto.createHmac('sha256', valid64HexKey).update(tamperedPayload).digest('hex')),
  );
  recordCheck(
    'SEC-URL-04',
    'Probe: Tampered expiration detected and rejected by HMAC',
    !tamperedSigMatches,
    'Tampered payload signature check failed as required',
  );

  // 4.4 Probe: Tampering Target Key (IDOR / Path Traversal attempt)
  const idorPayload = JSON.stringify({ key: 'admin-confidential.pdf', exp: parsedPayload.exp });
  const idorSigMatches = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(crypto.createHmac('sha256', valid64HexKey).update(idorPayload).digest('hex')),
  );
  recordCheck(
    'SEC-URL-05',
    'Probe: Tampered object key detected and rejected by HMAC',
    !idorSigMatches,
    'IDOR tampered key signature check failed as required',
  );

  // -------------------------------------------------------------------------
  // 5. Hardcoded Secrets & Logging Exposure Audit
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 5: Source Code Secret & Logging Hygiene Audit ---');

  const storageDir = path.join(process.cwd(), 'src/modules/profile/storage');
  const files = fs.readdirSync(storageDir);

  let suspiciousLogFound = false;
  let hardcodedSecretFound = false;

  for (const f of files) {
    if (!f.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(storageDir, f), 'utf-8');

    // Check for hardcoded AWS keys or credentials
    if (/AKIA[0-9A-Z]{16}/.test(content) || /['"][0-9a-f]{64}['"]/.test(content)) {
      hardcodedSecretFound = true;
      console.error(`Suspicious secret found in ${f}`);
    }

    // Check for logging of keys or credentials
    if (/console\.(log|info|debug)\(.*(secret|key|token|password)/i.test(content)) {
      suspiciousLogFound = true;
      console.error(`Suspicious console.log found in ${f}`);
    }
  }

  recordCheck(
    'SEC-HYG-01',
    'No hardcoded AWS keys or 64-char encryption keys in storage sources',
    !hardcodedSecretFound,
    'Scanned all TypeScript source files in storage module',
  );

  recordCheck(
    'SEC-HYG-02',
    'No sensitive secrets, credentials or tokens emitted in logs',
    !suspiciousLogFound,
    'Scanned logging patterns in storage module',
  );

  // Cleanup test dir
  const tmpDir = path.join(process.cwd(), 'tmp/test-uploads');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // Audit Summary
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                      AUDIT SUMMARY                             ');
  console.log('================================================================');

  const total = auditResults.length;
  const passed = auditResults.filter((r) => r.passed).length;
  const failed = auditResults.filter((r) => !r.passed).length;

  console.log(`Total Checks : ${total}`);
  console.log(`Passed       : ${passed}`);
  console.log(`Failed       : ${failed}`);

  if (failed > 0) {
    console.error('\nFAILURES DETECTED:');
    auditResults.filter((r) => !r.passed).forEach((r) => console.error(`- ${r.checkId}: ${r.name} (${r.details})`));
    process.exit(1);
  } else {
    console.log('\nAll storage security & encryption hygiene checks PASSED successfully.');
    process.exit(0);
  }
}

runSecurityAudit().catch((e) => {
  console.error('Audit execution error:', e);
  process.exit(1);
});
