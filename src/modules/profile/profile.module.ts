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

import { SkillsController } from './controllers/skills.controller';
import { SkillsService } from './services/skills.service';
import { LanguagesController } from './controllers/languages.controller';
import { LanguagesService } from './services/languages.service';

import { FieldsOfStudyController } from './controllers/fields-of-study.controller';
import { FieldsOfStudyService } from './services/fields-of-study.service';

@Module({
  controllers: [
    ProfileController,
    ReferenceController,
    DocumentsController,
    LocalStorageController,
    SkillsController,
    LanguagesController,
    FieldsOfStudyController,
  ],
  providers: [
    ProfileService,
    ReferenceService,
    DocumentsService,
    StorageServiceProvider,
    LocalStorageService,
    SkillsService,
    LanguagesService,
    FieldsOfStudyService,
  ],
})
export class ProfileModule {}
