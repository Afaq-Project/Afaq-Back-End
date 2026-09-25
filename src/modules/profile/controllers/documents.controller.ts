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

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.documentsService.upload(req.user.id, file, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user documents' })
  async getDocuments(@Req() req: RequestWithUser, @Query() dto: PaginationDto) {
    return this.documentsService.findAll(req.user.id, dto);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get download URL for a document' })
  async getDownloadUrl(
    @Req() req: RequestWithUser,
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new NotFoundException({
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found',
          }),
      }),
    )
    id: string,
  ) {
    return this.documentsService.getDownloadUrl(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(DocumentOwnershipGuard)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 204, description: 'Document deleted successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async delete(
    @Req() req: RequestWithUser,
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new NotFoundException({
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found',
          }),
      }),
    )
    id: string,
  ): Promise<void> {
    await this.documentsService.delete(req.user.id, id);
  }
}
