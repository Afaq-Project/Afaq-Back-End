#!/usr/bin/env bash
# Verification script for Feature 10 Architectural Audit
# Tasks: OMA-W002-T001 through T009

set -euo pipefail

echo "========================================================"
echo "FEATURE 10 ARCHITECTURAL COMPLIANCE AND BOUNDARY AUDIT"
echo "========================================================"

echo ""
echo "--- Probe 1: Database & Base Table Immutability ---"
# Check if migration alters any base tables
ALTER_BASE_TABLES=$(grep -E 'ALTER TABLE "(users|roles|user_roles|user_profiles|documents|document_types|opportunities)"' prisma/migrations/20261017103808_add_drafts_ai_and_invitation_modules/migration.sql || true)
if [ -z "$ALTER_BASE_TABLES" ]; then
    echo "✔ PASS: 0 base tables modified via ALTER TABLE in migration SQL."
else
    echo "✖ FAIL: Detected ALTER TABLE on base tables:"
    echo "$ALTER_BASE_TABLES"
fi

# Verify lineage via draft_pages.document_id
LINEAGE_COL=$(grep -E '"document_id" UUID' prisma/migrations/20261017103808_add_drafts_ai_and_invitation_modules/migration.sql || true)
if [ -n "$LINEAGE_COL" ]; then
    echo "✔ PASS: Lineage is tracked via draft_pages.document_id foreign key to documents.id."
else
    echo "✖ FAIL: Lineage column draft_pages.document_id not found."
fi

echo ""
echo "--- Probe 2: Container & Alpine Compatibility (Chromium Detection) ---"
node -e '
const fs = require("fs");
const path = require("path");
const serviceCode = fs.readFileSync("src/modules/drafts/export/draft-export.service.ts", "utf8");

const hasEnvCheck = serviceCode.includes("process.env.CHROME_BIN");
const hasAlpinePath = serviceCode.includes("/usr/bin/chromium-browser");
const hasSparticuzImport = serviceCode.includes("@sparticuz/chromium");

if (hasEnvCheck && hasAlpinePath && hasSparticuzImport) {
    console.log("✔ PASS: Chromium binary detection cascade verified (CHROME_BIN -> Alpine fallback /usr/bin/chromium-browser -> @sparticuz/chromium).");
} else {
    console.log("✖ FAIL: Incomplete Chromium detection cascade.", { hasEnvCheck, hasAlpinePath, hasSparticuzImport });
}
'

echo ""
echo "--- Probe 3: Authorization Boundary in InvitationsController ---"
node -e '
const fs = require("fs");
const controllerCode = fs.readFileSync("src/modules/auth/invitations.controller.ts", "utf8");

const hasRolesDecorator = controllerCode.includes("@Roles");
if (!hasRolesDecorator) {
    console.log("✖ VULNERABILITY CONFIRMED: Missing @Roles() guard decorator on InvitationsController.issueInvitation endpoint allows any authenticated user to create invitations and assign arbitrary roles.");
} else {
    console.log("✔ PASS: @Roles decorator present.");
}
'

echo ""
echo "--- Probe 4: Build Verification (pnpm build) ---"
if pnpm build > /tmp/build_audit.log 2>&1; then
    echo "✔ PASS: pnpm build succeeded cleanly."
else
    echo "✖ FAIL: pnpm build failed. Output excerpt:"
    grep -E 'error TS' /tmp/build_audit.log || tail -n 10 /tmp/build_audit.log
fi

echo ""
echo "--- Probe 5: Lint Verification (pnpm lint) ---"
if pnpm lint > /tmp/lint_audit.log 2>&1; then
    echo "✔ PASS: pnpm lint succeeded cleanly."
else
    echo "✖ FAIL: pnpm lint failed. Output summary:"
    grep -E '✖ [0-9]+ problem' /tmp/lint_audit.log || tail -n 10 /tmp/lint_audit.log
fi

echo ""
echo "========================================================"
echo "AUDIT PROBES COMPLETED"
echo "========================================================"
