// [OMA-W002-T008] DraftExportService
// [OMA-W005-T001] Removed puppeteer-core and @sparticuz/chromium, using pdfmake
// [OMA-W005-T002] Pure Node.js pdfmake compiler for TipTap/ProseMirror AST
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DraftPageStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../profile/interfaces/storage.interface';
import { STORAGE_SERVICE } from '../../profile/storage/storage.service';
import { DraftFinalizeDto } from './dto/draft-finalize.dto';
import { v4 as uuidv4 } from 'uuid';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const PdfPrinter = require('pdfmake');

interface PdfStream {
  on(event: 'data', listener: (chunk: Buffer) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this;
  end(): void;
}

interface PdfMakePrinter {
  createPdfKitDocument: (
    docDefinition: unknown,
  ) => Promise<PdfStream> | PdfStream;
}

interface PdfMakeLibrary {
  setUrlAccessPolicy?: (policy: (url: string) => boolean) => void;
  setLocalAccessPolicy?: (policy: (path: string) => boolean) => void;
  setFonts?: (fonts: Record<string, unknown>) => void;
  createPdf: (docDefinition: unknown) => {
    getStream: () => Promise<PdfStream>;
  };
}

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
  Times: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italics: 'Times-Italic',
    bolditalics: 'Times-BoldOblique',
  },
  Courier: {
    normal: 'Courier',
    bold: 'Courier-Bold',
    italics: 'Courier-Oblique',
    bolditalics: 'Courier-BoldOblique',
  },
};

const createPrinter = (): PdfMakePrinter => {
  if (typeof PdfPrinter === 'function') {
    const PrinterConstructor = PdfPrinter as new (
      fontDescriptors: Record<string, unknown>,
    ) => PdfMakePrinter;
    return new PrinterConstructor(fonts);
  }
  const lib = PdfPrinter as PdfMakeLibrary;
  if (typeof lib.setUrlAccessPolicy === 'function') {
    lib.setUrlAccessPolicy(() => false);
  }
  if (typeof lib.setLocalAccessPolicy === 'function') {
    lib.setLocalAccessPolicy((p: string) =>
      ['Helvetica', 'Times', 'Courier'].some((f) => p.startsWith(f)),
    );
  }
  if (typeof lib.setFonts === 'function') {
    lib.setFonts(fonts);
  }
  return {
    createPdfKitDocument: (docDefinition: unknown) =>
      lib.createPdf(docDefinition).getStream(),
  };
};

const printer: PdfMakePrinter = createPrinter();

interface AstMark {
  type: string;
  attrs?: { href?: string };
}

interface AstNode {
  type: string;
  text?: string;
  marks?: AstMark[];
  attrs?: { level?: number; src?: string; alt?: string; href?: string };
  content?: AstNode[];
}

@Injectable()
export class DraftExportService {
  private readonly logger = new Logger(DraftExportService.name);
  private maxDocuments: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {
    this.maxDocuments =
      this.configService.get<number>('storage.limits.maxDocuments') || 20;
  }

  private mapAstInline(node: AstNode): Record<string, unknown> {
    if (!node) {
      return { text: '' };
    }
    if (node.type !== 'text') {
      return { text: node.text || '' };
    }
    const inline: Record<string, unknown> = { text: node.text || '' };
    if (node.marks && Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'bold':
            inline.bold = true;
            break;
          case 'italic':
            inline.italics = true;
            break;
          case 'strike':
            inline.decoration =
              inline.decoration === 'underline'
                ? ['underline', 'lineThrough']
                : 'lineThrough';
            break;
          case 'underline':
            inline.decoration =
              inline.decoration === 'lineThrough'
                ? ['underline', 'lineThrough']
                : 'underline';
            break;
          case 'code':
            inline.font = 'Courier';
            inline.background = '#eeeeee';
            break;
          // [OMA-W005-T002] Sanitize link schemes (allow http, https, mailto only)
          case 'link':
            if (mark.attrs?.href) {
              const href = mark.attrs.href.trim();
              const lowerHref = href.toLowerCase();
              if (
                lowerHref.startsWith('http://') ||
                lowerHref.startsWith('https://') ||
                lowerHref.startsWith('mailto:')
              ) {
                inline.link = href;
              }
              inline.color = '#1a0dab';
              inline.decoration = 'underline';
            }
            break;
        }
      }
    }
    return inline;
  }

  // [OMA-W005-T002] Defensive AST node mapping against non-array content structures
  private mapAstNode(node: AstNode | null | undefined): unknown {
    if (!node) {
      return null;
    }

    switch (node.type) {
      case 'doc': {
        const contentList = Array.isArray(node.content) ? node.content : [];
        const children = contentList
          .map((child) => this.mapAstNode(child))
          .filter(Boolean);
        return children.length > 0
          ? children
          : [{ text: '', margin: [0, 0, 0, 6] }];
      }
      case 'heading': {
        const level = node.attrs?.level || 1;
        let fontSize = 22;
        let margin: [number, number, number, number] = [0, 10, 0, 6];
        if (level === 2) {
          fontSize = 16;
          margin = [0, 8, 0, 4];
        } else if (level === 3) {
          fontSize = 13;
          margin = [0, 6, 0, 2];
        } else if (level > 3) {
          fontSize = 12;
          margin = [0, 6, 0, 2];
        }
        const contentList = Array.isArray(node.content) ? node.content : [];
        const inlines = contentList.map((child) => this.mapAstInline(child));
        return {
          text: inlines.length > 0 ? inlines : [{ text: '' }],
          fontSize,
          bold: true,
          margin,
        };
      }
      case 'paragraph': {
        const contentList = Array.isArray(node.content) ? node.content : [];
        const inlines = contentList.map((child) => this.mapAstInline(child));
        return {
          text: inlines.length > 0 ? inlines : ' ',
          margin: [0, 0, 0, 6],
        };
      }
      case 'bulletList': {
        const contentList = Array.isArray(node.content) ? node.content : [];
        const items = contentList
          .map((itemNode) => {
            if (itemNode.type === 'listItem') {
              const itemContent = Array.isArray(itemNode.content)
                ? itemNode.content
                : [];
              const contents = itemContent
                .map((c) => this.mapAstNode(c))
                .filter(Boolean);
              return contents.length === 1 ? contents[0] : contents;
            }
            return this.mapAstNode(itemNode);
          })
          .filter(Boolean);
        return { ul: items, margin: [0, 0, 0, 6] };
      }
      case 'orderedList': {
        const contentList = Array.isArray(node.content) ? node.content : [];
        const items = contentList
          .map((itemNode) => {
            if (itemNode.type === 'listItem') {
              const itemContent = Array.isArray(itemNode.content)
                ? itemNode.content
                : [];
              const contents = itemContent
                .map((c) => this.mapAstNode(c))
                .filter(Boolean);
              return contents.length === 1 ? contents[0] : contents;
            }
            return this.mapAstNode(itemNode);
          })
          .filter(Boolean);
        return { ol: items, margin: [0, 0, 0, 6] };
      }
      case 'listItem': {
        const contentList = Array.isArray(node.content) ? node.content : [];
        const contents = contentList
          .map((c) => this.mapAstNode(c))
          .filter(Boolean);
        return contents.length === 1 ? contents[0] : contents;
      }
      case 'blockquote': {
        const contentList = Array.isArray(node.content) ? node.content : [];
        const contents = contentList
          .map((c) => this.mapAstNode(c))
          .filter(Boolean);
        return {
          stack: contents,
          margin: [10, 4, 10, 4],
          italics: true,
          color: '#444444',
        };
      }
      case 'codeBlock': {
        const contentList = Array.isArray(node.content) ? node.content : [];
        const textContent = contentList
          .map((c) => (c.text !== undefined ? c.text : ''))
          .join('');
        return {
          text: textContent,
          font: 'Courier',
          fontSize: 10,
          background: '#f5f5f5',
          margin: [0, 4, 0, 6],
        };
      }
      case 'horizontalRule': {
        return {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 5,
              x2: 482,
              y2: 5,
              lineWidth: 0.5,
              lineColor: '#cccccc',
            },
          ],
          margin: [0, 6, 0, 8],
        };
      }
      case 'text':
        return this.mapAstInline(node);
      default:
        if (node.content && Array.isArray(node.content)) {
          return node.content.map((c) => this.mapAstNode(c)).filter(Boolean);
        }
        return null;
    }
  }

  private mapContentJsonToPdfContent(contentJson: unknown): unknown[] {
    if (!contentJson) {
      return [{ text: '', margin: [0, 0, 0, 6] }];
    }
    let parsed: unknown = contentJson;
    if (typeof contentJson === 'string') {
      try {
        parsed = JSON.parse(contentJson) as unknown;
      } catch {
        return [{ text: contentJson, margin: [0, 0, 0, 6] }];
      }
    }
    if (typeof parsed !== 'object' || parsed === null) {
      const textVal =
        typeof parsed === 'string' ||
        typeof parsed === 'number' ||
        typeof parsed === 'boolean'
          ? String(parsed)
          : '';
      return [{ text: textVal, margin: [0, 0, 0, 6] }];
    }
    const mapped = this.mapAstNode(parsed as AstNode);
    if (!mapped) {
      return [{ text: '', margin: [0, 0, 0, 6] }];
    }
    const flatten = (val: unknown): unknown[] => {
      if (Array.isArray(val)) {
        return val.reduce<unknown[]>(
          (acc, item) => acc.concat(flatten(item)),
          [],
        );
      }
      return [val];
    };
    return flatten(mapped);
  }

  // [OMA-W005-T002] Pure Node.js pdfmake compiler for TipTap/ProseMirror AST
  async compilePdf(title: string, contentJson: unknown): Promise<Buffer> {
    this.logger.debug(`Compiling PDF for draft: ${title}`);
    const content = this.mapContentJsonToPdfContent(contentJson);

    const docDefinition = {
      pageSize: 'A4' as const,
      pageMargins: [56.7, 56.7, 56.7, 56.7] as [number, number, number, number],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 11,
        lineHeight: 1.3,
      },
      header: () => ({
        margin: [56.7, 20, 56.7, 0] as [number, number, number, number],
        stack: [
          {
            text: title || '',
            fontSize: 9,
            color: '#888888',
          },
          {
            canvas: [
              {
                type: 'line',
                x1: 0,
                y1: 4,
                x2: 482,
                y2: 4,
                lineWidth: 0.5,
                lineColor: '#e5e7eb',
              },
            ],
          },
        ],
      }),
      footer: (currentPage: number, pageCount: number) => ({
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: 'right' as const,
        margin: [0, 10, 56.7, 0] as [number, number, number, number],
        fontSize: 9,
        color: '#888888',
      }),
      content,
    };

    const pdfDoc = await printer.createPdfKitDocument(docDefinition);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (err: Error) => reject(err));
      pdfDoc.end();
    });
  }

  async finalize(userId: string, pageId: string, dto: DraftFinalizeDto) {
    const page = await this.prisma.draftPages.findFirst({
      where: { id: pageId, userId, deletedAt: null },
    });

    if (!page) {
      throw new NotFoundException({
        code: 'PAGE_NOT_FOUND',
        message: 'Draft page not found',
      });
    }

    // Verify user profile exists; if not, initialize profile
    let profile = await this.prisma.userProfiles.findUnique({
      where: { userId },
    });
    if (!profile) {
      profile = await this.prisma.userProfiles.create({
        data: { userId },
      });
    }

    // Check document limit
    const existingCount = await this.prisma.documents.count({
      where: { userId },
    });
    if (existingCount >= this.maxDocuments) {
      throw new BadRequestException(
        `Maximum limit of ${this.maxDocuments} official documents reached in profile`,
      );
    }

    // Validate documentTypeId if provided, or fallback to first active document type
    let targetDocTypeId = dto.documentTypeId;
    if (targetDocTypeId) {
      const docType = await this.prisma.documentTypes.findUnique({
        where: { id: targetDocTypeId },
      });
      if (!docType) {
        throw new BadRequestException({
          code: 'INVALID_DOCUMENT_TYPE',
          message: 'Document type not found',
        });
      }
    } else {
      const defaultDocType = await this.prisma.documentTypes.findFirst({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      if (!defaultDocType) {
        throw new BadRequestException(
          'No active document types configured in system',
        );
      }
      targetDocTypeId = defaultDocType.id;
    }

    // Render HTML to PDF
    const pdfBuffer = await this.compilePdf(page.title, page.contentJson);

    // Upload to Storage
    const baseDisplayName = dto.displayName || `${page.title}.pdf`;
    const cleanDisplayName = baseDisplayName.endsWith('.pdf')
      ? baseDisplayName
      : `${baseDisplayName}.pdf`;
    const storageKey = `documents/${userId}/${uuidv4()}-${cleanDisplayName}`;

    const { key } = await this.storageService.upload(
      pdfBuffer,
      storageKey,
      'application/pdf',
    );

    // Create official document entry in Afaq base documents table
    const document = await this.prisma.documents.create({
      data: {
        userId,
        documentTypeId: targetDocTypeId,
        displayName: cleanDisplayName,
        storagePath: key,
        mimeType: 'application/pdf',
        sizeBytes: pdfBuffer.length,
      },
      include: {
        documentType: true,
      },
    });

    // Update draft page: link documentId and set status to FINALIZED
    await this.prisma.draftPages.update({
      where: { id: pageId },
      data: {
        status: DraftPageStatus.FINALIZED,
        documentId: document.id,
      },
    });

    // Record finalized snapshot in version history
    await this.prisma.draftPageVersions.create({
      data: {
        pageId,
        userId,
        contentJson: page.contentJson || {},
        isFinalizedSnapshot: true,
        finalizedDocumentId: document.id,
      },
    });

    const downloadUrl = await this.storageService.getSignedUrl(
      document.storagePath,
      3600,
    );

    // [OMA-W004-T002] Return composite finalize DTO with presigned downloadUrl and status
    return {
      documentId: document.id,
      pageId,
      status: DraftPageStatus.FINALIZED,
      pdfUrl: downloadUrl,
      downloadUrl,
      message:
        'Draft compiled into PDF, stored in documents, and activated in candidate profile.',
    };
  }

  async unlock(userId: string, pageId: string) {
    const page = await this.prisma.draftPages.findFirst({
      where: { id: pageId, userId, deletedAt: null },
    });

    if (!page) {
      throw new NotFoundException({
        code: 'PAGE_NOT_FOUND',
        message: 'Draft page not found',
      });
    }

    const updated = await this.prisma.draftPages.update({
      where: { id: pageId },
      data: {
        status: DraftPageStatus.IN_PROGRESS,
      },
    });

    return {
      unlocked: true,
      status: updated.status,
    };
  }
}
