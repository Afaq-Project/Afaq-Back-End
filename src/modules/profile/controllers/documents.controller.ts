import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  Req,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseUUIDPipe,
  NotFoundException,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DocumentsService } from '../services/documents.service';
import { UploadDocumentDto } from '../dto/upload-document.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DocumentOwnershipGuard } from '../guards/document-ownership.guard';

interface RequestWithUser {
  user: { id: string };
}

// Lazy singleton — resolved once on first upload request, then cached.
// This eliminates the ~13s per-request dynamic-import penalty.
let _fileTypeFromBuffer:
  | ((buf: Uint8Array) => Promise<{ mime: string; ext: string } | undefined>)
  | null = null;
async function getFileTypeFromBuffer() {
  if (!_fileTypeFromBuffer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const mod = (await import('file-type')) as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    _fileTypeFromBuffer = mod.fileTypeFromBuffer ?? mod.fromBuffer;
  }
  return _fileTypeFromBuffer!;
}

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        if (
          !file.mimetype.match(
            /pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/png|image\/jpeg/,
          )
        ) {
          return cb(new BadRequestException('Invalid file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadDocument(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDocumentDto,
  ) {
    if (!file && !body.file) {
      throw new BadRequestException('File is required');
    }

    let actualFile = file;
    if (!actualFile && body.file) {
      actualFile = {
        fieldname: 'file',
        originalname: 'dummy.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from(body.file as string),
        size: Buffer.from(body.file as string).length,
      } as Express.Multer.File;
    }

    const checkFn = await getFileTypeFromBuffer();
    const typeInfo = await checkFn(actualFile.buffer);

    if (
      !typeInfo ||
      !typeInfo.mime.match(
        /pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/png|image\/jpeg/,
      )
    ) {
      throw new BadRequestException('Invalid file content signature');
    }

    if (typeInfo.mime !== actualFile.mimetype) {
      if (
        typeInfo.mime === 'application/zip' &&
        actualFile.mimetype ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        // Ok
      } else {
        throw new BadRequestException('File extension does not match content');
      }
    }

    const doc = await this.documentsService.uploadDocument(
      req.user.id,
      actualFile,
    );
    return doc;
  }

  @Get()
  @ApiOperation({ summary: 'Get all user documents' })
  async getDocuments(@Req() req: RequestWithUser, @Query() dto: PaginationDto) {
    const data = await this.documentsService.getDocuments(req.user.id, dto);
    return data;
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get download URL for a document' })
  async getDownloadUrl(
    @Req() req: RequestWithUser,
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () => new NotFoundException('Document not found'),
      }),
    )
    id: string,
  ) {
    return this.documentsService.getDownloadUrl(req.user.id, id);
  }

  @Delete(':id')
  @UseGuards(DocumentOwnershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 204, description: 'Document deleted successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async deleteDocument(
    @Req() req: RequestWithUser,
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () => new NotFoundException('Document not found'),
      }),
    )
    id: string,
  ): Promise<void> {
    await this.documentsService.deleteDocument(req.user.id, id);
  }
}
