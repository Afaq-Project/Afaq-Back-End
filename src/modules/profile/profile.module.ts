import { Module } from '@nestjs/common';
import { ProfileController } from './controllers/profile.controller';
import { ProfileService } from './services/profile.service';

import { ReferenceController } from './controllers/reference.controller';
import { ReferenceService } from './services/reference.service';

import { DocumentsController } from './controllers/documents.controller';
import { DocumentsService } from './services/documents.service';
import { StorageServiceProvider } from './storage/storage.service';
import { LocalStorageController } from './controllers/local-storage.controller';
import { LocalStorageService } from './storage/local-storage.service';

import { EducationsController } from './controllers/educations.controller';
import { EducationsService } from './services/educations.service';

import { SkillsController } from './controllers/skills.controller';
import { SkillsService } from './services/skills.service';

import { LanguagesController } from './controllers/languages.controller';
import { LanguagesService } from './services/languages.service';

@Module({
  controllers: [
    ProfileController,
    ReferenceController,
    DocumentsController,
    LocalStorageController,
    EducationsController,
    SkillsController,
    LanguagesController,
  ],
  providers: [
    ProfileService,
    ReferenceService,
    DocumentsService,
    StorageServiceProvider,
    LocalStorageService,
    EducationsService,
    SkillsService,
    LanguagesService,
  ],
})
export class ProfileModule {}
