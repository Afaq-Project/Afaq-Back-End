// [OMA-W002-T004] DraftsModule
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
// [OMA-W008-T001] Import unified StorageModule
import { StorageModule } from '../profile/storage/storage.module';

import { DraftSpacesController } from './spaces/draft-spaces.controller';
import { DraftSpacesService } from './spaces/draft-spaces.service';

import { DraftPagesController } from './pages/draft-pages.controller';
import { DraftPagesService } from './pages/draft-pages.service';

import { DraftAttachmentsController } from './attachments/draft-attachments.controller';
import { DraftAttachmentsService } from './attachments/draft-attachments.service';

import { DraftTagsController } from './tags/draft-tags.controller';
import { DraftTagsService } from './tags/draft-tags.service';

import { DraftTemplatesController } from './templates/draft-templates.controller';
import { DraftTemplatesService } from './templates/draft-templates.service';

import { DraftVersionsController } from './versions/draft-versions.controller';
import { DraftVersionsService } from './versions/draft-versions.service';

import { DraftExportController } from './export/draft-export.controller';
import { DraftExportService } from './export/draft-export.service';

// [OMA-W008-T001] Import unified StorageModule
@Module({
  imports: [ConfigModule, PrismaModule, StorageModule],
  controllers: [
    DraftSpacesController,
    DraftPagesController,
    DraftAttachmentsController,
    DraftTagsController,
    DraftTemplatesController,
    DraftVersionsController,
    DraftExportController,
  ],
  providers: [
    DraftSpacesService,
    DraftPagesService,
    DraftAttachmentsService,
    DraftTagsService,
    DraftTemplatesService,
    DraftVersionsService,
    DraftExportService,
  ],
  exports: [
    DraftSpacesService,
    DraftPagesService,
    DraftExportService,
    DraftVersionsService,
  ],
})
export class DraftsModule {}
