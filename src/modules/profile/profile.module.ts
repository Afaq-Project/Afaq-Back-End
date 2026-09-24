import { Module } from '@nestjs/common';
import { ProfileController } from './controllers/profile.controller';
import { ProfileService } from './services/profile.service';
import { SystemSettingsService } from './services/system-settings.service';

import { ReferenceController } from './controllers/reference.controller';
import { ReferenceService } from './services/reference.service';

import { DocumentsController } from './controllers/documents.controller';
import { DocumentsService } from './services/documents.service';
import { StorageServiceProvider } from './storage/storage.service';
import { LocalStorageController } from './controllers/local-storage.controller';
import { LocalStorageService } from './storage/local-storage.service';

// Disabled until Batch 2 (T039) / Batch 3 (T050) — see tasks.md
import { EducationsController } from './controllers/educations.controller';
import { EducationsService } from './services/educations.service';

import { LanguagesController } from './controllers/languages.controller';
import { LanguagesService } from './services/languages.service';

@Module({
  controllers: [
    ProfileController,
    ReferenceController,
    DocumentsController,
    LocalStorageController,
    EducationsController,
    LanguagesController,
  ],
  providers: [
    ProfileService,
    SystemSettingsService,
    ReferenceService,
    DocumentsService,
    StorageServiceProvider,
    LocalStorageService,
    EducationsService,
    LanguagesService,
  ],
  exports: [ProfileService, SystemSettingsService],
})
export class ProfileModule {}
