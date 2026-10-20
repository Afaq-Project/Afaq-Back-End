import { Module } from '@nestjs/common';
import { ProfileController } from './controllers/profile.controller';
import { ProfileService } from './services/profile.service';
import { SystemSettingsService } from './services/system-settings.service';

import { ReferenceController } from './controllers/reference.controller';
import { ReferenceService } from './services/reference.service';

import { DocumentsController } from './controllers/documents.controller';
import { DocumentsService } from './services/documents.service';
// [OMA-W008-T001] Import unified StorageModule
import { StorageModule } from './storage/storage.module';
import { LocalStorageController } from './controllers/local-storage.controller';

// Disabled until Batch 2 (T039) / Batch 3 (T050) — see tasks.md
import { EducationsController } from './controllers/educations.controller';
import { EducationsService } from './services/educations.service';

import { LanguagesController } from './controllers/languages.controller';
import { LanguagesService } from './services/languages.service';

import { TestResultsController } from './controllers/test-results.controller';
import { TestResultsService } from './services/test-results.service';

import { SpecialStatusesController } from './controllers/special-statuses.controller';
import { SpecialStatusesService } from './services/special-statuses.service';

import { PreferencesController } from './controllers/preferences.controller';
import { PreferencesService } from './services/preferences.service';

// [OMA-W008-T001] Import unified StorageModule
@Module({
  imports: [StorageModule],
  controllers: [
    ProfileController,
    ReferenceController,
    DocumentsController,
    LocalStorageController,
    EducationsController,
    LanguagesController,
    TestResultsController,
    SpecialStatusesController,
    PreferencesController,
  ],
  providers: [
    ProfileService,
    SystemSettingsService,
    ReferenceService,
    DocumentsService,
    EducationsService,
    LanguagesService,
    TestResultsService,
    SpecialStatusesService,
    PreferencesService,
  ],
  exports: [ProfileService, SystemSettingsService, StorageModule],
})
export class ProfileModule {}
