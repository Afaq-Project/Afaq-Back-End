// [OMA-W002-T005] DraftAttachmentsService
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../profile/interfaces/storage.interface';
import { STORAGE_SERVICE } from '../../profile/storage/storage.service';
import { DraftPagesService } from '../pages/draft-pages.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DraftAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagesService: DraftPagesService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  async upload(
    userId: string,
    spaceSlug: string,
    pageId: string,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const page = await this.pagesService.findBySpaceAndId(
      userId,
      spaceSlug,
      pageId,
    );

    const ext = file.originalname.split('.').pop() || '';
    const storedFilename = `attachments/${uuidv4()}${ext ? `.${ext}` : ''}`;

    const { key } = await this.storageService.upload(
      file.buffer,
      storedFilename,
      file.mimetype,
    );

    const attachment = await this.prisma.draftAttachments.create({
      data: {
        pageId: page.id,
        uploaderId: userId,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: key,
      },
    });

    const url = await this.storageService.getSignedUrl(key, 86400);

    return {
      ...attachment,
      url,
    };
  }

  async getDownloadUrl(userId: string, attachmentId: string) {
    const attachment = await this.prisma.draftAttachments.findUnique({
      where: { id: attachmentId },
      include: { page: true },
    });

    if (!attachment || attachment.page.userId !== userId) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Attachment not found',
      });
    }

    const url = await this.storageService.getSignedUrl(
      attachment.storagePath,
      3600,
    );
    // [OMA-W004-T003] Standardize attachment download URL response key to downloadUrl
    return { downloadUrl: url, filename: attachment.filename };
  }

  async delete(userId: string, attachmentId: string) {
    const attachment = await this.prisma.draftAttachments.findUnique({
      where: { id: attachmentId },
      include: { page: true },
    });

    if (!attachment || attachment.page.userId !== userId) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Attachment not found',
      });
    }

    await this.storageService.delete(attachment.storagePath);
    await this.prisma.draftAttachments.delete({
      where: { id: attachmentId },
    });

    return { deleted: true };
  }
}
