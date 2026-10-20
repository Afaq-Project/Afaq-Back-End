// [OMA-W007-T003] Execute and audit unit, e2e, and smoke tests across repository
// [OMA-W007-T004] Independent security verification, credential hygiene audit, and sign-off
import * as fs from 'fs';
import * as path from 'path';

interface AuditResult {
  suite: string;
  totalChecks: number;
  failures: string[];
  warnings: string[];
}

function runAudit() {
  const root = process.cwd();
  const collections = [
    { file: 'Levora_API.postman_collection.json', name: 'Postman Main' },
    { file: 'Levora_API_localhost.postman_collection.json', name: 'Postman Localhost' },
    { file: 'tests/levora-smoke-tests.json', name: 'Smoke Tests' },
  ];

  const results: AuditResult[] = [];

  for (const col of collections) {
    const fullPath = path.join(root, col.file);
    if (!fs.existsSync(fullPath)) {
      results.push({
        suite: col.name,
        totalChecks: 1,
        failures: [`File not found: ${col.file}`],
        warnings: [],
      });
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const json = JSON.parse(content);

    const audit: AuditResult = {
      suite: col.name,
      totalChecks: 0,
      failures: [],
      warnings: [],
    };

    // 1. Secret & Credential Hygiene
    audit.totalChecks++;
    const jwtMatches = content.match(/eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g);
    if (jwtMatches) {
      audit.failures.push(`Found ${jwtMatches.length} raw JWT signatures in ${col.file}`);
    }

    audit.totalChecks++;
    const privateKeyMatches = content.match(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g);
    if (privateKeyMatches) {
      audit.failures.push(`Found raw private key block in ${col.file}`);
    }

    audit.totalChecks++;
    const awsKeys = content.match(/(AKIA[0-9A-Z]{16})/g);
    if (awsKeys) {
      audit.failures.push(`Found potential AWS access key in ${col.file}`);
    }

    // 2. Placeholder Consistency
    audit.totalChecks++;
    function checkItems(items: any[], pathArr: string[]) {
      for (const item of items) {
        const itemPath = [...pathArr, item.name || 'unnamed'];
        if (item.request) {
          // Check URL
          const rawUrl = typeof item.request.url === 'string' ? item.request.url : item.request.url?.raw;
          if (rawUrl) {
            if (rawUrl.includes('{{base_url}}')) {
              audit.warnings.push(`Inconsistent placeholder {{base_url}} at ${itemPath.join(' > ')} (expected {{baseUrl}})`);
            }
            if (rawUrl.startsWith('{{baseUrl}}/api/v1/')) {
              audit.warnings.push(`Double api/v1 prefix in URL: ${rawUrl} at ${itemPath.join(' > ')}`);
            }
          }

          // Check Auth Bearer
          const auth = item.request.auth;
          if (auth && auth.type === 'bearer' && Array.isArray(auth.bearer)) {
            for (const b of auth.bearer) {
              if (b.type === 'string' && typeof b.value === 'string' && !b.value.startsWith('{{')) {
                audit.failures.push(`Static hardcoded bearer token at ${itemPath.join(' > ')}: ${b.value}`);
              }
            }
          }
        }
        if (item.item && Array.isArray(item.item)) {
          checkItems(item.item, itemPath);
        }
      }
    }

    if (json.item) {
      checkItems(json.item, []);
    }

    // 3. Request Body Payload Safety
    audit.totalChecks++;
    const dangerousPayloads = [
      /<script[\s\S]*?>/i,
      /\bDROP\s+TABLE\b/i,
      /\bSELECT\s+.*\s+FROM\s+.*\bWHERE\b/i,
      /;\s*rm\s+-rf/i,
      /`\s*rm\s+-rf/i,
      /\$\(rm\s+-rf\)/i,
    ];

    function checkBodies(items: any[], pathArr: string[]) {
      for (const item of items) {
        const itemPath = [...pathArr, item.name || 'unnamed'];
        if (item.request?.body?.raw) {
          const rawBody = item.request.body.raw;
          // Ignore explicit deliberate security negative test items
          const isSecurityTest = itemPath.some((p) => p.toLowerCase().includes('security') || p.toLowerCase().includes('negative') || p.toLowerCase().includes('xss') || p.toLowerCase().includes('injection'));
          if (!isSecurityTest) {
            for (const dp of dangerousPayloads) {
              if (dp.test(rawBody)) {
                audit.failures.push(`Dangerous payload pattern ${dp} found in non-security test at ${itemPath.join(' > ')}`);
              }
            }
          }
        }
        if (item.item && Array.isArray(item.item)) {
          checkBodies(item.item, itemPath);
        }
      }
    }

    if (json.item) {
      checkBodies(json.item, []);
    }

    results.push(audit);
  }

  console.log(JSON.stringify(results, null, 2));
}

runAudit();
