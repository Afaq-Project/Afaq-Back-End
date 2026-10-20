// [OMA-W002-T005] DraftAttachmentsController
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
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
import { DraftAttachmentsService } from './draft-attachments.service';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('Draft Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drafts/spaces/:slug/pages/:pageId/attachments')
export class DraftAttachmentsController {
  constructor(private readonly attachmentsService: DraftAttachmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload an embedded media attachment' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Attachment uploaded' })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Req() req: RequestWithUser,
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    // [OMA-W002-T005] Enforce file size limit (10MB) and allowed MIME types (pdf, images, markdown, txt, docx)
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          // [OMA-W003-T001] Enable fallbackToMimetype for text and SVG files
          new FileTypeValidator({
            fileType:
              /(application\/pdf|image\/(jpeg|png|webp|gif|svg\+xml)|text\/(markdown|plain)|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))/,
            fallbackToMimetype: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.attachmentsService.upload(req.user.id, slug, pageId, file);
  }

  @Get(':attachmentId/download')
  @ApiOperation({ summary: 'Get signed download URL for an attachment' })
  @ApiResponse({ status: 200, description: 'Signed URL returned' })
  async getDownloadUrl(
    @Req() req: RequestWithUser,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.attachmentsService.getDownloadUrl(req.user.id, attachmentId);
  }

  @Delete(':attachmentId')
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiResponse({ status: 200, description: 'Attachment deleted' })
  async delete(
    @Req() req: RequestWithUser,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.attachmentsService.delete(req.user.id, attachmentId);
  }
}
