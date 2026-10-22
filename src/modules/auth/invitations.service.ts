// [OMA-W002-T009] InvitationsService
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { InviteUserDto } from './dto/invite-user.dto';
import { RegisterWithInviteDto } from './dto/register-with-invite.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async issueInvitation(invitedById: string, dto: InviteUserDto) {
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.users.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: 'A user with this email address already exists',
      });
    }

    if (dto.roleId) {
      const role = await this.prisma.roles.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new BadRequestException({
          code: 'ROLE_NOT_FOUND',
          message: 'Specified role not found',
        });
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresInDays = dto.expiresInDays || 7;
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    );

    const invitation = await this.prisma.invitations.create({
      data: {
        email,
        tokenHash,
        roleId: dto.roleId,
        invitedById,
        expiresAt,
      },
    });

    const appBaseUrl =
      this.configService.get<string>('APP_BASE_URL') || 'http://localhost:3000';
    const inviteUrl = `${appBaseUrl}/auth/register?token=${rawToken}`;

    return {
      id: invitation.id,
      email: invitation.email,
      roleId: invitation.roleId,
      token: rawToken,
      inviteUrl,
      expiresAt: invitation.expiresAt,
    };
  }

  async validateToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);

    const invitation = await this.prisma.invitations.findUnique({
      where: { tokenHash },
      include: { role: true },
    });

    if (!invitation) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invalid invitation token',
      });
    }

    if (invitation.acceptedAt) {
      throw new BadRequestException({
        code: 'INVITATION_ALREADY_ACCEPTED',
        message: 'Invitation token has already been consumed',
      });
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'INVITATION_EXPIRED',
        message: 'Invitation token has expired',
      });
    }

    return {
      valid: true,
      email: invitation.email,
      roleId: invitation.roleId,
      roleName: invitation.role?.name,
      expiresAt: invitation.expiresAt,
    };
  }

  async registerWithInvite(dto: RegisterWithInviteDto) {
    const tokenHash = this.hashToken(dto.token);

    const invitation = await this.prisma.invitations.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invalid invitation token',
      });
    }

    if (invitation.acceptedAt) {
      throw new BadRequestException({
        code: 'INVITATION_ALREADY_ACCEPTED',
        message: 'Invitation token has already been consumed',
      });
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'INVITATION_EXPIRED',
        message: 'Invitation token has expired',
      });
    }

    const existingUser = await this.prisma.users.findUnique({
      where: { email: invitation.email },
    });
    if (existingUser) {
      throw new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: 'Email already registered',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.users.create({
      data: {
        email: invitation.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isEmailVerified: true, // Auto-verified since invitation was delivered to recipient email
      },
    });

    await this.prisma.userProfiles.create({
      data: {
        userId: user.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    if (invitation.roleId) {
      await this.prisma.userRoles.create({
        data: {
          userId: user.id,
          roleId: invitation.roleId,
        },
      });
    }

    await this.prisma.invitations.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return {
      message: 'Account successfully registered and invitation accepted',
      userId: user.id,
      email: user.email,
    };
  }
}
