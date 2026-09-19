import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Prisma } from '@prisma/client';
import { UsersRepository } from './repositories/users.repository';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectPinoLogger(UsersService.name)
    private readonly logger: PinoLogger,
    private readonly repo: UsersRepository,
  ) {}

  async findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }

  async findById(id: string) {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async createUser(data: {
    email: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  }) {
    this.logger.info(`Creating user: ${data.email}`);

    const fullName =
      [data.firstName, data.lastName].filter(Boolean).join(' ') || undefined;

    const user = await this.repo.create({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      userProfile: {
        create: {
          fullName,
          isDraft: true,
          completionPct: 0,
        },
      },
      userRoles: {
        create: {
          roleId: 1, // default 'user' role
        },
      },
    });

    return user;
  }

  async createProfile(userId: string, fullName?: string) {
    return this.repo.createProfile(userId, fullName);
  }

  async getUserWithProfile(id: string) {
    return this.findById(id);
  }

  async updateLastLogin(id: string) {
    return this.repo.update(id, { lastLoginAt: new Date() });
  }

  async create(dto: CreateUserDto) {
    return this.createUser({
      email: dto.email,
      firstName: dto.name,
    });
  }

  async findAll(query: UserQueryDto) {
    const where: Prisma.UsersWhereInput = {};

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.role) {
      where.userRoles = {
        some: {
          roles: { name: { equals: query.role, mode: 'insensitive' } },
          isActive: true,
        },
      };
    }

    const orderBy = {
      [query.sort ?? 'createdAt']: query.order ?? 'desc',
    } as Prisma.UsersOrderByWithRelationInput;

    const [data, total] = await Promise.all([
      this.repo.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy,
      }),
      this.repo.count(where),
    ]);

    const totalPages = Math.ceil(total / query.limit);
    return {
      data,
      meta: {
        pagination: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages,
          hasNext: query.page < totalPages,
          hasPrev: query.page > 1,
        },
      },
    };
  }

  async findOne(id: string) {
    return this.findById(id);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    return this.repo.update(id, dto);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.repo.delete(id);
  }
}
