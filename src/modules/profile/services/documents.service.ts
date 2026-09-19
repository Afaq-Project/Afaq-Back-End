import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../interfaces/storage.interface';
import { STORAGE_SERVICE } from '../storage/storage.service';
import { encryptFile } from '../utils/encryption.util';
import { v4 as uuidv4 } from 'uuid';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { buildMeta } from '../../../common/utils/paginate.util';

@Injectable()
export class DocumentsService {
  private encryptionKey: string;
  private maxDocuments: number;
  private signedUrlExpires: number;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject(STORAGE_SERVICE) private storageService: StorageService,
  ) {
    this.encryptionKey = this.configService.get<string>(
      'storage.encryption.key',
    ) as string;
    this.maxDocuments =
      this.configService.get<number>('storage.limits.maxDocuments') || 20;
    this.signedUrlExpires =
      this.configService.get<number>('storage.limits.signedUrlExpires') || 300;
  }

  private async verifyOwnership(userId: string, documentId: string) {
    const doc = await this.prisma.documents.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    if (doc.userId !== userId) {
      throw new ForbiddenException('You do not own this document');
    }
    return doc;
  }

  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    docType: string,
  ) {
    const count = await this.prisma.documents.count({
      where: { userId, deletedAt: null },
    });
    if (count >= this.maxDocuments) {
      throw new BadRequestException(
        `Maximum of ${this.maxDocuments} documents reached`,
      );
    }

    const { encrypted, iv } = encryptFile(file.buffer, this.encryptionKey);
    const finalBuffer = Buffer.concat([Buffer.from(iv, 'hex'), encrypted]);

    const ext = file.originalname.split('.').pop() || '';
    const filename = `${uuidv4()}.${ext}`;

    const { key } = await this.storageService.upload(
      finalBuffer,
      filename,
      file.mimetype,
    );

    const document = await this.prisma.documents.create({
      data: {
        userId,
        docType,
        displayName: file.originalname,
        storagePath: key,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        isEncrypted: true,
      },
      select: {
        id: true,
        docType: true,
        displayName: true,
        storagePath: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });

    return document;
  }

  async getDownloadUrl(userId: string, documentId: string) {
    const doc = await this.verifyOwnership(userId, documentId);

    const url = await this.storageService.getSignedUrl(
      doc.storagePath,
      this.signedUrlExpires,
    );
    return {
      url,
      expiresAt: new Date(
        Date.now() + this.signedUrlExpires * 1000,
      ).toISOString(),
    };
  }

  async deleteDocument(userId: string, documentId: string) {
    const doc = await this.verifyOwnership(userId, documentId);

    // Hard delete in DB first. If this fails, storage is untouched.
    await this.prisma.documents.delete({
      where: { id: documentId },
    });

    // Then delete from storage. If this fails, the file is orphaned but inaccessible via API.
    try {
      await this.storageService.delete(doc.storagePath);
    } catch (error) {
      // In a real production app, you might want to use a Logger service here
      console.error(
        `Failed to delete document from storage: ${doc.storagePath}`,
        error,
      );
    }
  }

  async getDocuments(userId: string, dto: PaginationDto) {
    const [documents, total] = await Promise.all([
      this.prisma.documents.findMany({
        where: { userId, deletedAt: null },
        skip: dto.skip,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          docType: true,
          displayName: true,
          mimeType: true,
          sizeBytes: true,
          isEncrypted: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      }),
      this.prisma.documents.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      data: documents,
      meta: buildMeta(total, dto.page, dto.limit),
    };
  }
}
