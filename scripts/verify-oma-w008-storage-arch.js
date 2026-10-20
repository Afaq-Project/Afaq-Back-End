// External verification script for OMA-W008-VER-ARC / OMA-W008-T003
// Validates:
// 1. StorageModule export and provider encapsulation
// 2. ProfileModule & DraftsModule imports of StorageModule
// 3. No duplicate StorageServiceProvider declarations across codebase
// 4. In-process singleton identity of STORAGE_SERVICE across consumers

const fs = require('fs');
const path = require('path');
const { NestFactory } = require('@nestjs/core');

async function verify() {
  console.log('=== Step 1: Static Architectural Boundaries Inspection ===');

  const rootDir = path.resolve(__dirname, '..');
  const storageModulePath = path.join(rootDir, 'src/modules/profile/storage/storage.module.ts');
  const profileModulePath = path.join(rootDir, 'src/modules/profile/profile.module.ts');
  const draftsModulePath = path.join(rootDir, 'src/modules/drafts/drafts.module.ts');

  const storageModuleContent = fs.readFileSync(storageModulePath, 'utf8');
  const profileModuleContent = fs.readFileSync(profileModulePath, 'utf8');
  const draftsModuleContent = fs.readFileSync(draftsModulePath, 'utf8');

  // Verify StorageModule exports and providers
  const hasStorageServiceProviderInStorage = storageModuleContent.includes('StorageServiceProvider');
  const hasLocalStorageServiceInStorage = storageModuleContent.includes('LocalStorageService');
  const hasStorageServiceTokenInStorage = storageModuleContent.includes('STORAGE_SERVICE');

  console.log('StorageModule encapsulates StorageServiceProvider & LocalStorageService:', hasStorageServiceProviderInStorage && hasLocalStorageServiceInStorage);
  console.log('StorageModule exports StorageServiceProvider, LocalStorageService, STORAGE_SERVICE:', storageModuleContent.includes('exports: [StorageServiceProvider, LocalStorageService, STORAGE_SERVICE]'));

  // Verify ProfileModule & DraftsModule import StorageModule
  const profileImportsStorageModule = profileModuleContent.includes('import { StorageModule } from \'./storage/storage.module\';') && profileModuleContent.includes('imports: [StorageModule');
  const draftsImportsStorageModule = draftsModuleContent.includes('import { StorageModule } from \'../profile/storage/storage.module\';') && draftsModuleContent.includes('StorageModule');

  console.log('ProfileModule imports StorageModule:', profileImportsStorageModule);
  console.log('DraftsModule imports StorageModule:', draftsImportsStorageModule);

  // Verify no duplicate StorageServiceProvider declarations in profile.module or drafts.module
  console.log('ProfileModule does NOT provide StorageServiceProvider:', !profileModuleContent.includes('StorageServiceProvider'));
  console.log('DraftsModule does NOT provide StorageServiceProvider:', !draftsModuleContent.includes('StorageServiceProvider'));

  console.log('\n=== Step 2: In-Process Singleton Identity Verification ===');
  const { AppModule } = require(path.join(rootDir, 'dist/app.module'));
  const { DocumentsService } = require(path.join(rootDir, 'dist/modules/profile/services/documents.service'));
  const { DraftAttachmentsService } = require(path.join(rootDir, 'dist/modules/drafts/attachments/draft-attachments.service'));
  const { DraftExportService } = require(path.join(rootDir, 'dist/modules/drafts/export/draft-export.service'));
  const { STORAGE_SERVICE } = require(path.join(rootDir, 'dist/modules/profile/storage/storage.service'));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const rootStorage = app.get(STORAGE_SERVICE);
    const docService = app.get(DocumentsService);
    const draftAttService = app.get(DraftAttachmentsService);
    const draftExportService = app.get(DraftExportService);

    const docStorage = docService.storageService;
    const draftStorage = draftAttService.storageService;
    const exportStorage = draftExportService.storageService;

    const docSame = docStorage === rootStorage;
    const draftAttSame = draftStorage === rootStorage;
    const draftExpSame = exportStorage === rootStorage;

    console.log('STORAGE_SERVICE resolved at root:', !!rootStorage);
    console.log('DocumentsService.storageService === rootStorage:', docSame);
    console.log('DraftAttachmentsService.storageService === rootStorage:', draftAttSame);
    console.log('DraftExportService.storageService === rootStorage:', draftExpSame);

    if (docSame && draftAttSame && draftExpSame) {
      console.log('\nSUCCESS: Single identity verified across all consumers.');
    } else {
      console.error('\nFAILURE: Singleton identity mismatch!');
      process.exit(1);
    }
  } finally {
    await app.close();
  }
}

verify().catch(err => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
