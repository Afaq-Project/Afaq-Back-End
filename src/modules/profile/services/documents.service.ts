import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../interfaces/storage.interface';
import { STORAGE_SERVICE } from '../storage/storage.service';
import { v4 as uuidv4 } from 'uuid';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { buildMeta } from '../../../common/utils/paginate.util';
import { SystemSettingsService } from './system-settings.service';
import {
  SystemSettingKeys,
  SystemSettingDefaults,
} from '../constants/system-settings.keys';
import { UploadDocumentDto } from '../dto/upload-document.dto';

@Injectable()
export class DocumentsService {
  private maxDocuments: number;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject(STORAGE_SERVICE) private storageService: StorageService,
    private systemSettings: SystemSettingsService,
  ) {
    this.maxDocuments =
      this.configService.get<number>('storage.limits.maxDocuments') || 20;
  }

  private async verifyOwnership(userId: string, documentId: string) {
    const doc = await this.prisma.documents.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document not found',
      });
    }
    if (doc.userId !== userId) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document not found',
      });
    }
    return doc;
  }

  async upload(
    userId: string,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
  ) {
    const maxSizeBytes = await this.systemSettings.getNumber(
      SystemSettingKeys.MAX_DOCUMENT_SIZE_BYTES,
      SystemSettingDefaults[
        SystemSettingKeys.MAX_DOCUMENT_SIZE_BYTES
      ] as number,
    );
    const allowedMimes = await this.systemSettings.getJson<string[]>(
      SystemSettingKeys.ALLOWED_DOCUMENT_MIME_TYPES,
      SystemSettingDefaults[
        SystemSettingKeys.ALLOWED_DOCUMENT_MIME_TYPES
      ] as string[],
    );

    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds limit of ${maxSizeBytes} bytes`,
      );
    }
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'INVALID_MIME_TYPE',
        message: 'Invalid MIME type',
      });
    }

    const docType = await this.prisma.documentTypes.findUnique({
      where: { id: dto.documentTypeId },
    });
    if (!docType) {
      throw new BadRequestException({
        code: 'INVALID_DOCUMENT_TYPE',
        message: 'Document type not found',
      });
    }

    const hex = file.buffer.toString('hex', 0, 4).toUpperCase();
    if (file.mimetype === 'application/pdf' && !hex.startsWith('25504446')) {
      throw new BadRequestException('DOCUMENT_TYPE_MISMATCH');
    }
    if (file.mimetype === 'image/jpeg' && !hex.startsWith('FFD8FF')) {
      throw new BadRequestException('DOCUMENT_TYPE_MISMATCH');
    }
    if (file.mimetype === 'image/png' && !hex.startsWith('89504E47')) {
      throw new BadRequestException('DOCUMENT_TYPE_MISMATCH');
    }

    const count = await this.prisma.documents.count({
      where: { userId },
    });
    if (count >= this.maxDocuments) {
      throw new BadRequestException(
        `Maximum of ${this.maxDocuments} documents reached`,
      );
    }

    const ext = file.originalname.split('.').pop() || '';
    const filename = `${uuidv4()}.${ext}`;

    const { key } = await this.storageService.upload(
      file.buffer,
      filename,
      file.mimetype,
    );

    try {
      const document = await this.prisma.documents.create({
        data: {
          userId,
          documentTypeId: dto.documentTypeId,
          displayName: file.originalname,
          storagePath: key,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
        select: {
          id: true,
          documentTypeId: true,
          displayName: true,
          storagePath: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      });

      return document;
    } catch (error) {
      await this.storageService.delete(key).catch((e) => {
        console.error(`Cleanup failed for ${key}`, e);
      });
      throw error;
    }
  }

  async getDownloadUrl(userId: string, documentId: string) {
    const doc = await this.verifyOwnership(userId, documentId);

    const url = await this.storageService.getSignedUrl(doc.storagePath, 900);
    return { signedUrl: url, expiresIn: 900 };
  }

  async delete(userId: string, id: string) {
    const doc = await this.verifyOwnership(userId, id);

    await this.storageService.delete(doc.storagePath);

    await this.prisma.documents.delete({
      where: { id: id },
    });
  }

  async findAll(userId: string, dto?: PaginationDto) {
    const skip = dto?.skip ?? 0;
    const limit = dto?.limit ?? 10;
    const page = dto?.page ?? 1;

    const [documents, total] = await Promise.all([
      this.prisma.documents.findMany({
        where: { userId },
        skip: skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          documentType: {
            select: {
              nameEn: true,
              nameAr: true,
            },
          },
        },
      }),
      this.prisma.documents.count({ where: { userId } }),
    ]);

    return {
      data: documents,
      meta: buildMeta(total, page, limit),
    };
  }
}
