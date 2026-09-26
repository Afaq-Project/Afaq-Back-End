import { getLoggerToken } from 'nestjs-pino';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            createProfile: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getLoggerToken(UsersService.name),
          useValue: { info: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repo = module.get(UsersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should return user', async () => {
      repo.findByEmail.mockResolvedValue({ id: '1' } as any);
      const res = await service.findByEmail('test@test.com');
      expect(res).toEqual({ id: '1' });
    });
  });

  describe('findById', () => {
    it('should return user', async () => {
      repo.findById.mockResolvedValue({ id: '1' } as any);
      const res = await service.findById('1');
      expect(res).toEqual({ id: '1' });
    });

    it('should throw NotFoundException', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createUser', () => {
    it('should create a user', async () => {
      repo.create.mockResolvedValue({ id: '1' } as any);
      const res = await service.createUser({
        email: 'test@test.com',
        firstName: 'A',
        lastName: 'B',
      });
      expect(res).toEqual({ id: '1' });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repo.create).toHaveBeenCalled();
    });
  });

  describe('createProfile', () => {
    it('should create a profile', async () => {
      repo.createProfile.mockResolvedValue({ id: '1' } as any);
      const res = await service.createProfile('userId');
      expect(res).toEqual({ id: '1' });
    });
  });

  describe('getUserWithProfile', () => {
    it('should return user', async () => {
      repo.findById.mockResolvedValue({ id: '1' } as any);
      const res = await service.getUserWithProfile('1');
      expect(res).toEqual({ id: '1' });
    });
  });

  describe('updateLastLogin', () => {
    it('should update', async () => {
      repo.update.mockResolvedValue({ id: '1' } as any);
      const res = await service.updateLastLogin('1');
      expect(res).toEqual({ id: '1' });
    });
  });

  describe('create', () => {
    it('should create user', async () => {
      repo.create.mockResolvedValue({ id: '1' } as any);
      const res = await service.create({ email: 'a@a.com', name: 'A' });
      expect(res).toEqual({ id: '1' });
    });
  });

  describe('findAll', () => {
    it('should return paginated data', async () => {
      repo.findMany.mockResolvedValue([{ id: '1' }] as any);
      repo.count.mockResolvedValue(1);
      const res = await service.findAll({
        page: 1,
        limit: 10,
        search: 'test',
        role: 'admin',
      } as any);
      expect(res.meta.pagination.total).toBe(1);
      expect(res.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return one', async () => {
      repo.findById.mockResolvedValue({ id: '1' } as any);
      const res = await service.findOne('1');
      expect(res).toEqual({ id: '1' });
    });
  });

  describe('update', () => {
    it('should update', async () => {
      repo.findById.mockResolvedValue({ id: '1' } as any);
      repo.update.mockResolvedValue({ id: '1', email: 'b' } as any);
      const res = await service.update('1', { name: 'A' });
      expect(res.email).toBe('b');
    });
  });

  describe('remove', () => {
    it('should remove', async () => {
      repo.findById.mockResolvedValue({ id: '1' } as any);
      repo.delete.mockResolvedValue({ id: '1' } as any);
      const res = await service.remove('1');
      expect(res).toEqual({ id: '1' });
    });
  });
});
