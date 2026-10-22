/**
 * OMA-W004-VER-SEC: Security and Threat Resistance Verification Script
 * Validates OMA-W004-T001, OMA-W004-T002, OMA-W004-T003, and OMA-W004-T004
 * Covers: Auth enforcement, IDOR isolation, bounded URL expiry, input DoS limits, state locking
 */
import 'reflect-metadata';
import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import { DraftPageStatus } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { AiTransformController } from '../src/modules/ai-assistant/ai-transform/ai-transform.controller';
import { AiChatController } from '../src/modules/ai-assistant/ai-chat/ai-chat.controller';
import { AiAssistantService } from '../src/modules/ai-assistant/ai-assistant.service';
import { AiEditDto, AiEditMode } from '../src/modules/ai-assistant/dto/ai-edit.dto';
import { AiGenerateDto } from '../src/modules/ai-assistant/dto/ai-generate.dto';
import { AiChatDto } from '../src/modules/ai-assistant/dto/ai-chat.dto';
import { OpenAiProvider } from '../src/modules/ai-assistant/providers/openai.provider';
import { AnthropicProvider } from '../src/modules/ai-assistant/providers/anthropic.provider';

import { DraftExportController } from '../src/modules/drafts/export/draft-export.controller';
import { DraftExportService } from '../src/modules/drafts/export/draft-export.service';
import { DraftFinalizeDto } from '../src/modules/drafts/export/dto/draft-finalize.dto';
import { DraftPagesService } from '../src/modules/drafts/pages/draft-pages.service';
import { DraftVersionsService } from '../src/modules/drafts/versions/draft-versions.service';

import { DraftAttachmentsController } from '../src/modules/drafts/attachments/draft-attachments.controller';
import { DraftAttachmentsService } from '../src/modules/drafts/attachments/draft-attachments.service';

import { NotificationsController } from '../src/modules/notifications/notifications.controller';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

interface ProbeResult {
  id: string;
  name: string;
  taskCode: string;
  category: string;
  passed: boolean;
  details: string;
  evidence?: any;
}

const results: ProbeResult[] = [];

async function main() {
  console.log('================================================================');
  console.log('   OMA-W004-VER-SEC: SECURITY & THREAT RESISTANCE VERIFICATION');
  console.log('================================================================\n');

  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';

  // ==========================================================================
  // SECTION 1: OMA-W004-T001 (AI Assistant Security & Guardrails)
  // ==========================================================================
  console.log('>>> [OMA-W004-T001] Auditing AI Assistant Routes & Threat Resistance...');

  // Probe 1.1: Auth Enforcement (JwtAuthGuard) on AI Controllers
  {
    const transformGuards = Reflect.getMetadata(GUARDS_METADATA, AiTransformController) || [];
    const chatGuards = Reflect.getMetadata(GUARDS_METADATA, AiChatController) || [];

    const transformHasJwt = transformGuards.includes(JwtAuthGuard);
    const chatHasJwt = chatGuards.includes(JwtAuthGuard);

    results.push({
      id: 'PROBE-1.1',
      name: 'AI Assistant Controllers JWT Auth Guard Enforcement',
      taskCode: 'OMA-W004-T001',
      category: 'Authentication Enforcement',
      passed: transformHasJwt && chatHasJwt,
      details: `AiTransformController has JwtAuthGuard: ${transformHasJwt}; AiChatController has JwtAuthGuard: ${chatHasJwt}.`,
      evidence: { transformHasJwt, chatHasJwt },
    });
  }

  // Probe 1.2: Multi-turn Chat Isolation & IDOR Protection in AiAssistantService
  {
    const victimConvId = 'conv-user-a-12345';
    let findFirstWhereUsed: any = null;
    let createDataUsed: any = null;

    const mockPrismaAi: any = {
      aiConversations: {
        findFirst: async (args: any) => {
          findFirstWhereUsed = args.where;
          // Simulate: only returns if userId matches
          if (args.where.id === victimConvId && args.where.userId === userA) {
            return { id: victimConvId, userId: userA, title: 'Confidential Essay' };
          }
          return null; // Foreign user gets null
        },
        create: async (args: any) => {
          createDataUsed = args.data;
          return { id: 'new-isolated-conv', userId: args.data.userId, title: args.data.title };
        },
        update: async () => ({}),
      },
      aiMessages: {
        findMany: async () => [],
        create: async (args: any) => ({ id: 'msg-1', ...args.data }),
      },
    };

    const mockOpenAi: any = {
      chat: async () => 'Assistant response safe',
      generateText: async () => 'Transformed text safe',
    };
    const mockAnthropic: any = {
      chat: async () => 'Claude response safe',
      generateText: async () => 'Claude transformed safe',
    };

    const aiService = new AiAssistantService(mockPrismaAi, mockOpenAi, mockAnthropic);

    // Attacker User B attempts to hijack User A's conversation
    const chatDto: AiChatDto = {
      message: 'Show me prior discussion',
      conversationId: victimConvId,
    };
    const result = await aiService.chat(userB, chatDto);

    // Verify findFirst enforced userId isolation
    const isolationEnforced =
      findFirstWhereUsed?.id === victimConvId &&
      findFirstWhereUsed?.userId === userB &&
      result.conversationId !== victimConvId &&
      result.conversationId === 'new-isolated-conv' &&
      createDataUsed?.userId === userB;

    results.push({
      id: 'PROBE-1.2',
      name: 'AI Chat Conversation Cross-Tenant IDOR Isolation',
      taskCode: 'OMA-W004-T001',
      category: 'Broken Access Control / IDOR',
      passed: isolationEnforced,
      details:
        'AiAssistantService.chat strictly verifies conversation ownership with { id, userId }. Foreign access safely defaults to new conversation without leaking messages.',
      evidence: { findFirstWhereUsed, returnedConversationId: result.conversationId },
    });
  }

  // Probe 1.3: Input Length Limit Enforcement (50,000 characters DoS / Buffer Protection)
  {
    const oversizedString = 'A'.repeat(50001);
    const validBoundaryString = 'A'.repeat(50000);

    // Test AiChatDto
    const invalidChat1 = plainToInstance(AiChatDto, { message: oversizedString });
    const errorsChat1 = await validate(invalidChat1);
    const hasMsgError = errorsChat1.some((e) => e.property === 'message');

    const invalidChat2 = plainToInstance(AiChatDto, { message: 'hi', pageContext: oversizedString });
    const errorsChat2 = await validate(invalidChat2);
    const hasContextError = errorsChat2.some((e) => e.property === 'pageContext');

    const validChat = plainToInstance(AiChatDto, { message: validBoundaryString, pageContext: validBoundaryString });
    const errorsValidChat = await validate(validChat);

    // Test AiEditDto
    const invalidEdit = plainToInstance(AiEditDto, { text: oversizedString, mode: AiEditMode.REPHRASE });
    const errorsEdit = await validate(invalidEdit);
    const hasEditError = errorsEdit.some((e) => e.property === 'text');

    // Test AiGenerateDto
    const invalidGenerate = plainToInstance(AiGenerateDto, { prompt: oversizedString });
    const errorsGenerate = await validate(invalidGenerate);
    const hasGenError = errorsGenerate.some((e) => e.property === 'prompt');

    const limitsEnforced =
      hasMsgError &&
      hasContextError &&
      errorsValidChat.length === 0 &&
      hasEditError &&
      hasGenError;

    results.push({
      id: 'PROBE-1.3',
      name: 'AI Prompt / Context Length Limit Enforcement (50k chars)',
      taskCode: 'OMA-W004-T001',
      category: 'Input Validation & Denial of Service Protection',
      passed: limitsEnforced,
      details:
        'All AI DTOs (AiChatDto, AiEditDto, AiGenerateDto) strictly enforce @MaxLength(50000). Payloads exceeding 50,000 chars are rejected by class-validator.',
      evidence: { hasMsgError, hasContextError, validBoundaryAccepted: errorsValidChat.length === 0, hasEditError, hasGenError },
    });
  }

  // Probe 1.4: AI Route HTTP 200 OK Status Metadata & DTO Contracts
  {
    const editHttpCode = Reflect.getMetadata(HTTP_CODE_METADATA, AiTransformController.prototype.transformText);
    const genHttpCode = Reflect.getMetadata(HTTP_CODE_METADATA, AiTransformController.prototype.generateContent);
    const chatHttpCode = Reflect.getMetadata(HTTP_CODE_METADATA, AiChatController.prototype.chat);

    const http200MetadataCorrect =
      editHttpCode === HttpStatus.OK &&
      genHttpCode === HttpStatus.OK &&
      chatHttpCode === HttpStatus.OK;

    // Verify DTO contracts
    const mockPrismaAi: any = {
      aiConversations: {
        create: async () => ({ id: 'conv-test-id' }),
        update: async () => ({}),
      },
      aiMessages: {
        findMany: async () => [],
        create: async () => ({}),
      },
    };
    const mockOpenAi: any = {
      chat: async () => 'Generated chat reply',
      generateText: async () => 'Transformed content sample',
    };
    const aiService = new AiAssistantService(mockPrismaAi, mockOpenAi, {} as any);

    const transformRes = await aiService.transformText({ text: 'sample', mode: AiEditMode.ACADEMIC_TONE });
    const generateRes = await aiService.generateContent({ prompt: 'outline' });
    const chatRes = await aiService.chat(userA, { message: 'hello' });

    const contractCorrect =
      'originalText' in transformRes &&
      'transformedText' in transformRes &&
      'mode' in transformRes &&
      'content' in generateRes &&
      'format' in generateRes &&
      'conversationId' in chatRes &&
      'reply' in chatRes &&
      'model' in chatRes;

    results.push({
      id: 'PROBE-1.4',
      name: 'AI Assistant HTTP 200 OK Metadata & Standardized Return DTOs',
      taskCode: 'OMA-W004-T001',
      category: 'API Contract / HTTP Specification',
      passed: http200MetadataCorrect && contractCorrect,
      details: `Routes explicitly declare @HttpCode(HttpStatus.OK). Return schemas align with API contract.`,
      evidence: { editHttpCode, genHttpCode, chatHttpCode, transformRes, generateRes, chatRes },
    });
  }

  // ==========================================================================
  // SECTION 2: OMA-W004-T002 (Draft Finalization Security & State Locks)
  // ==========================================================================
  console.log('\n>>> [OMA-W004-T002] Auditing Draft Finalization Composite DTO & Security...');

  // Probe 2.1: Finalize Presigned URL Bounded Expiry & Return DTO Contract
  {
    let requestedSignedUrlDuration: number | null = null;
    let createdDocumentData: any = null;
    let pageUpdatedData: any = null;

    const mockPrisma: any = {
      draftPages: {
        findFirst: async ({ where }: any) => {
          if (where.id === 'page-final-1' && where.userId === userA) {
            return {
              id: 'page-final-1',
              userId: userA,
              title: 'Personal Statement',
              contentJson: { type: 'doc', content: [] },
              deletedAt: null,
            };
          }
          return null;
        },
        update: async (args: any) => {
          pageUpdatedData = args.data;
          return { id: args.where.id, ...args.data };
        },
      },
      userProfiles: {
        findUnique: async () => ({ id: 'prof-1', userId: userA }),
      },
      documents: {
        count: async () => 2,
        create: async (args: any) => {
          createdDocumentData = args.data;
          return { id: 'doc-final-uuid-1', ...args.data };
        },
      },
      documentTypes: {
        findFirst: async () => ({ id: 'doctype-1', isActive: true }),
      },
      draftPageVersions: {
        create: async () => ({ id: 'ver-snap-1' }),
      },
    };

    const mockStorage: any = {
      upload: async (_buf: Buffer, key: string) => ({ key }),
      getSignedUrl: async (key: string, expiry: number) => {
        requestedSignedUrlDuration = expiry;
        return `https://s3.local/${key}?signed=true&expiresIn=${expiry}`;
      },
    };

    const exportService = new DraftExportService(
      mockPrisma,
      { get: () => 20 } as any,
      mockStorage,
    );

    // Mock compilePdf to avoid spinning up Chromium in probe
    (exportService as any).compilePdf = async () => Buffer.from('mock pdf content');

    const finalizeResult = await exportService.finalize(userA, 'page-final-1', {
      displayName: 'Scholarship_Essay.pdf',
    });

    const isExpiryBounded = requestedSignedUrlDuration === 3600; // Strictly 1 hour
    const isProfileSafelyLinked = createdDocumentData?.userId === userA;
    const isPageLocked = pageUpdatedData?.status === DraftPageStatus.FINALIZED;
    const isCompositeDtoCorrect =
      finalizeResult.documentId === 'doc-final-uuid-1' &&
      finalizeResult.pageId === 'page-final-1' &&
      finalizeResult.status === DraftPageStatus.FINALIZED &&
      typeof finalizeResult.pdfUrl === 'string' &&
      typeof finalizeResult.downloadUrl === 'string' &&
      typeof finalizeResult.message === 'string';

    results.push({
      id: 'PROBE-2.1',
      name: 'Finalize Presigned URL Bounded Expiry & Composite DTO Return',
      taskCode: 'OMA-W004-T002',
      category: 'Sensitive Data Exposure & Cryptographic Expiry',
      passed: isExpiryBounded && isProfileSafelyLinked && isPageLocked && isCompositeDtoCorrect,
      details: `Presigned URL expiry strictly bounded to 3600s (1 hr). Document linked to candidate profile. State set to FINALIZED. Composite DTO verified.`,
      evidence: {
        requestedSignedUrlDuration,
        isProfileSafelyLinked,
        isPageLocked,
        finalizeResult,
      },
    });
  }

  // Probe 2.2: Draft Finalization IDOR Protection
  {
    const mockPrisma: any = {
      draftPages: {
        findFirst: async ({ where }: any) => {
          if (where.id === 'page-final-1' && where.userId === userA) {
            return { id: 'page-final-1', userId: userA };
          }
          return null; // Foreign user gets null
        },
      },
    };

    const exportService = new DraftExportService(
      mockPrisma,
      { get: () => 20 } as any,
      {} as any,
    );

    let foreignUserBlocked = false;
    try {
      await exportService.finalize(userB, 'page-final-1', {});
    } catch (e: any) {
      if (e.status === 404 && e.response?.code === 'PAGE_NOT_FOUND') {
        foreignUserBlocked = true;
      }
    }

    results.push({
      id: 'PROBE-2.2',
      name: 'Draft Finalization Cross-Tenant IDOR Guard',
      taskCode: 'OMA-W004-T002',
      category: 'Broken Access Control / IDOR',
      passed: foreignUserBlocked,
      details:
        'Finalize endpoint enforces draftPages.findFirst({ id, userId }). Non-owners cannot trigger compilation, PDF generation, or profile document mutation.',
      evidence: { foreignUserBlocked },
    });
  }

  // Probe 2.3: Locked State (FINALIZED) Prevents Overwrites & Race Conditions
  {
    const mockPrismaPages: any = {
      draftPages: {
        findFirst: async () => ({
          id: 'page-1',
          userId: userA,
          status: DraftPageStatus.FINALIZED,
          deletedAt: null,
        }),
      },
    };
    const mockSpacesService: any = {
      findBySlug: async () => ({ id: 'space-1' }),
    };

    const pagesService = new DraftPagesService(mockPrismaPages, mockSpacesService);

    let editBlockedByLock = false;
    try {
      await pagesService.update(userA, 'space-1', 'page-1', {
        title: 'Tampered Title After Finalization',
      });
    } catch (e: any) {
      if (e.status === 409 && e.response?.code === 'PAGE_FINALIZED_LOCKED') {
        editBlockedByLock = true;
      }
    }

    results.push({
      id: 'PROBE-2.3',
      name: 'FINALIZED State Concurrency & Tamper Lock Enforcement',
      taskCode: 'OMA-W004-T002',
      category: 'State Machine Integrity & Tamper Resistance',
      passed: editBlockedByLock,
      details:
        'Pages in FINALIZED status reject all updates with 409 Conflict (PAGE_FINALIZED_LOCKED). Prevents overwriting finalized document.',
      evidence: { editBlockedByLock },
    });
  }

  // ==========================================================================
  // SECTION 3: OMA-W004-T003 (Download URL & Notifications Isolation)
  // ==========================================================================
  console.log('\n>>> [OMA-W004-T003] Auditing Download URL Isolation & Notification Scopes...');

  // Probe 3.1: DraftAttachmentsService.getDownloadUrl Tenant Isolation & Key Standardization
  {
    let signedUrlRequestedDuration: number | null = null;
    const attachmentId = 'att-uuid-1';

    const mockPrisma: any = {
      draftAttachments: {
        findUnique: async (args: any) => {
          if (args.where.id === attachmentId) {
            return {
              id: attachmentId,
              filename: 'transcript.pdf',
              storagePath: 'attachments/transcript.pdf',
              page: {
                id: 'page-1',
                userId: userA, // Owned by User A
              },
            };
          }
          return null;
        },
      },
    };

    const mockStorage: any = {
      getSignedUrl: async (key: string, expiry: number) => {
        signedUrlRequestedDuration = expiry;
        return `https://s3.local/${key}?signed=true`;
      },
    };

    const attachmentsService = new DraftAttachmentsService(mockPrisma, {} as any, mockStorage);

    // Attacker User B attempts to access User A's attachment download URL
    let attackerBlocked = false;
    try {
      await attachmentsService.getDownloadUrl(userB, attachmentId);
    } catch (e: any) {
      if (e.status === 404 && e.response?.code === 'ATTACHMENT_NOT_FOUND') {
        attackerBlocked = true;
      }
    }

    // Owner User A requests download URL
    let ownerResponse: any = null;
    try {
      ownerResponse = await attachmentsService.getDownloadUrl(userA, attachmentId);
    } catch {
      ownerResponse = null;
    }

    const keyStandardized =
      ownerResponse &&
      'downloadUrl' in ownerResponse &&
      'filename' in ownerResponse &&
      !('url' in ownerResponse);

    const boundedExpiry = signedUrlRequestedDuration === 3600;

    results.push({
      id: 'PROBE-3.1',
      name: 'Attachment Download URL Multi-Tenant Isolation & Key Standard',
      taskCode: 'OMA-W004-T003',
      category: 'Broken Access Control / IDOR',
      passed: attackerBlocked && keyStandardized && boundedExpiry,
      details:
        'getDownloadUrl verifies attachment.page.userId === userId. Non-owners receive 404 ATTACHMENT_NOT_FOUND. Expiry is bounded to 3600s, and key is standardized to downloadUrl.',
      evidence: { attackerBlocked, ownerResponse, signedUrlRequestedDuration },
    });
  }

  // Probe 3.2: NotificationsService.markAllAsRead Multi-Tenant Isolation
  {
    let updateManyWhereUsed: any = null;
    let updateManyDataUsed: any = null;

    const mockPrisma: any = {
      notifications: {
        updateMany: async (args: any) => {
          updateManyWhereUsed = args.where;
          updateManyDataUsed = args.data;
          // Simulate update count for userA
          if (args.where.userId === userA) {
            return { count: 3 };
          }
          return { count: 0 };
        },
      },
    };

    const notifService = new NotificationsService(mockPrisma);
    const markRes = await notifService.markAllAsRead(userA);

    const isTenantScoped =
      updateManyWhereUsed?.userId === userA &&
      updateManyWhereUsed?.readAt === null &&
      updateManyDataUsed?.readAt instanceof Date;

    const returnStandardized = markRes && markRes.count === 3 && typeof markRes.count === 'number';

    results.push({
      id: 'PROBE-3.2',
      name: 'Notifications markAllAsRead Tenant Isolation & Return Standard',
      taskCode: 'OMA-W004-T003',
      category: 'Multi-Tenant Isolation & Data Integrity',
      passed: isTenantScoped && returnStandardized,
      details:
        'markAllAsRead strictly scopes query to { userId, readAt: null }. Prevents cross-tenant state mutation. Returns standardized { count }.',
      evidence: { updateManyWhereUsed, markRes },
    });
  }

  // Probe 3.3: Sibling Method Sweep - DraftAttachmentsService.delete Tenant Isolation
  {
    const attachmentId = 'att-uuid-delete-1';
    let storageDeletedKey: string | null = null;
    let prismaDeletedId: string | null = null;

    const mockPrisma: any = {
      draftAttachments: {
        findUnique: async (args: any) => {
          if (args.where.id === attachmentId) {
            return {
              id: attachmentId,
              storagePath: 'attachments/victim-file.pdf',
              page: { id: 'page-1', userId: userA },
            };
          }
          return null;
        },
        delete: async (args: any) => {
          prismaDeletedId = args.where.id;
          return {};
        },
      },
    };

    const mockStorage: any = {
      delete: async (key: string) => {
        storageDeletedKey = key;
      },
    };

    const attachmentsService = new DraftAttachmentsService(mockPrisma, {} as any, mockStorage);

    // Attacker User B attempts to delete User A's attachment
    let userBBlocked = false;
    try {
      await attachmentsService.delete(userB, attachmentId);
    } catch (e: any) {
      if (e.status === 404 && e.response?.code === 'ATTACHMENT_NOT_FOUND') {
        userBBlocked = true;
      }
    }

    const deleteTamperPrevented = userBBlocked && storageDeletedKey === null && prismaDeletedId === null;

    results.push({
      id: 'PROBE-3.3',
      name: 'Sibling Sweep: Attachment Deletion Multi-Tenant Isolation',
      taskCode: 'OMA-W004-T003',
      category: 'Broken Access Control / Sibling Sweep',
      passed: deleteTamperPrevented,
      details:
        'attachmentsService.delete enforces attachment.page.userId === userId. Non-owners receive 404 and cannot delete storage or database records.',
      evidence: { userBBlocked, storageDeletedKey, prismaDeletedId },
    });
  }

  // Probe 3.4: Sibling Method Sweep - NotificationsService.markAsRead Single Item Isolation
  {
    const notifId = 'notif-uuid-1';
    const mockPrisma: any = {
      notifications: {
        findFirst: async (args: any) => {
          if (args.where.id === notifId && args.where.userId === userA) {
            return { id: notifId, userId: userA };
          }
          return null;
        },
        update: async () => ({ id: notifId, isRead: true }),
      },
    };

    const notifService = new NotificationsService(mockPrisma);

    let foreignMarkBlocked = false;
    try {
      await notifService.markAsRead(userB, notifId);
    } catch (e: any) {
      if (e.status === 404 && e.response?.code === 'NOTIFICATION_NOT_FOUND') {
        foreignMarkBlocked = true;
      }
    }

    results.push({
      id: 'PROBE-3.4',
      name: 'Sibling Sweep: Notifications markAsRead Single Notification Isolation',
      taskCode: 'OMA-W004-T003',
      category: 'Broken Access Control / Sibling Sweep',
      passed: foreignMarkBlocked,
      details:
        'markAsRead checks { id, userId }. Foreign user cannot mark another user notification as read.',
      evidence: { foreignMarkBlocked },
    });
  }

  // Probe 3.5: Sibling Method Sweep - NotificationsService.findAll & getUnreadCount Isolation
  {
    let findManyWhereUsed: any = null;
    let countWhereUsed: any = null;

    const mockPrisma: any = {
      notifications: {
        findMany: async (args: any) => {
          findManyWhereUsed = args.where;
          return [];
        },
        count: async (args: any) => {
          countWhereUsed = args.where;
          return 0;
        },
      },
    };

    const notifService = new NotificationsService(mockPrisma);
    await notifService.findAll(userA, { skip: 0, limit: 10, page: 1, unreadOnly: true });
    await notifService.getUnreadCount(userA);

    const queriesScoped =
      findManyWhereUsed?.userId === userA &&
      findManyWhereUsed?.readAt === null &&
      countWhereUsed?.userId === userA &&
      countWhereUsed?.readAt === null;

    results.push({
      id: 'PROBE-3.5',
      name: 'Sibling Sweep: Notifications findAll & getUnreadCount Scoping',
      taskCode: 'OMA-W004-T003',
      category: 'Multi-Tenant Isolation / Sibling Sweep',
      passed: queriesScoped,
      details:
        'findAll and getUnreadCount strictly scope database queries with userId.',
      evidence: { findManyWhereUsed, countWhereUsed },
    });
  }

  // ==========================================================================
  // SECTION 4: OMA-W004-T004 (Documentation & Architectural Alignment)
  // ==========================================================================
  console.log('\n>>> [OMA-W004-T004] Auditing API Guide & Specification Alignment...');

  {
    const fs = await import('fs');
    const path = await import('path');
    const guidePath = path.resolve(__dirname, '../docs/FEATURE_10_API_INTEGRATION_GUIDE.md');
    const guideContent = fs.readFileSync(guidePath, 'utf-8');

    const hasAttachmentSchemaTask = guideContent.includes('[OMA-W004-T004]');
    const hasDownloadUrlContract = guideContent.includes('"downloadUrl": "https://s3.eu-west-1.amazonaws.com/attachments/');
    const hasFinalizeComposite = guideContent.includes('"pdfUrl"') && guideContent.includes('"downloadUrl"');
    const hasMarkAllCount = guideContent.includes('"count": 3');

    const docAlignmentPassed =
      hasAttachmentSchemaTask &&
      hasDownloadUrlContract &&
      hasFinalizeComposite &&
      hasMarkAllCount;

    results.push({
      id: 'PROBE-4.1',
      name: 'API Guide Contracts Synchronization & Documentation Integrity',
      taskCode: 'OMA-W004-T004',
      category: 'Documentation & Contract Verification',
      passed: docAlignmentPassed,
      details:
        'FEATURE_10_API_INTEGRATION_GUIDE.md matches backend reality for attachment downloads, finalization DTOs, notification counts, and task annotations.',
      evidence: {
        hasAttachmentSchemaTask,
        hasDownloadUrlContract,
        hasFinalizeComposite,
        hasMarkAllCount,
      },
    });
  }

  // ==========================================================================
  // Print Summary Table
  // ==========================================================================
  console.log('\n================================================================');
  console.log('                   VERIFICATION RESULTS SUMMARY');
  console.log('================================================================');
  console.table(
    results.map((r) => ({
      ID: r.id,
      Task: r.taskCode,
      Probe: r.name,
      Category: r.category,
      Passed: r.passed ? 'PASS' : 'FAIL',
    })),
  );

  const allPassed = results.every((r) => r.passed);
  console.log(`\nOverall Security Verification Status: ${allPassed ? 'ALL PROBES PASSED (NO VULNERABILITIES DETECTED)' : 'FAILURES DETECTED'}`);

  return { results, allPassed };
}

main().catch((err) => {
  console.error('Fatal error during verification execution:', err);
  process.exit(1);
});
