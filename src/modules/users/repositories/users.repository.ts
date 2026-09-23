import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma';

export const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isEmailVerified: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,

  userRoles: {
    where: { isActive: true },
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  },
} satisfies Prisma.UsersSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.users.findUnique({
      where: { email },
      select: USER_SELECT,
    });
  }

  findByEmailRaw<T extends Omit<Prisma.UsersFindUniqueArgs, 'where'>>(
    email: string,
    args?: T,
  ) {
    return this.prisma.users.findUnique({
      where: { email },
      ...(args ?? {}),
    });
  }

  findById(id: string) {
    return this.prisma.users.findUnique({
      where: { id },
      select: USER_SELECT,
    });
  }

  findByIdRaw<T extends Omit<Prisma.UsersFindUniqueArgs, 'where'>>(
    id: string,
    args?: T,
  ) {
    return this.prisma.users.findUnique({
      where: { id },
      ...(args ?? {}),
    });
  }

  findUniqueRaw<T extends Prisma.UsersFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.UsersFindUniqueArgs>,
  ): Prisma.Prisma__UsersClient<Prisma.UsersGetPayload<T> | null, null> {
    return this.prisma.users.findUnique(args);
  }

  findFirstRaw<T extends Prisma.UsersFindFirstArgs>(args: T) {
    return this.prisma.users.findFirst(args);
  }

  create(data: Prisma.UsersCreateInput) {
    return this.prisma.users.create({
      data,
      select: USER_SELECT,
    });
  }

  findMany(args: Omit<Prisma.UsersFindManyArgs, 'select' | 'include'> = {}) {
    return this.prisma.users.findMany({
      ...args,
      select: USER_SELECT,
    });
  }

  count(where?: Prisma.UsersWhereInput) {
    return this.prisma.users.count({ where });
  }

  update(id: string, data: Prisma.UsersUpdateInput) {
    return this.prisma.users.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
  }

  delete(id: string) {
    return this.prisma.users.delete({
      where: { id },
      select: USER_SELECT,
    });
  }

  createProfile(userId: string) {
    return this.prisma.userProfiles.create({
      data: {
        userId,
        isMatchable: false,
      },
    });
  }
}
