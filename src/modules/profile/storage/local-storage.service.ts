import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageService } from '../interfaces/storage.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly uploadPath: string;

  constructor(private configService: ConfigService) {
    this.uploadPath =
      this.configService.get<string>('storage.local.uploadPath') || './uploads';

    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async upload(
    file: Buffer,
    filename: string,
    _mimeType: string,
  ): Promise<{ key: string; url?: string }> {
    try {
      const sanitizedFilename = filename.replace(/^[/\\]+/, '');
      const key = `${uuidv4()}-${sanitizedFilename}`;
      const filePath = path.join(this.uploadPath, key);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      await fs.promises.writeFile(filePath, file);
      return { key };
    } catch {
      throw new InternalServerErrorException(
        'Failed to upload file to local storage',
      );
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.uploadPath, key);
      return await fs.promises.readFile(filePath);
    } catch {
      throw new InternalServerErrorException(
        'Failed to read file from local storage',
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadPath, key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch {
      throw new InternalServerErrorException(
        'Failed to delete file from local storage',
      );
    }
  }

  getSignedUrl(key: string, expiresIn: number): Promise<string> {
    const payload = JSON.stringify({ key, exp: Date.now() + expiresIn * 1000 });
    const secret = this.configService.get<string>(
      'storage.encryption.key',
    ) as string;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    const token = Buffer.from(JSON.stringify({ payload, signature })).toString(
      'base64',
    );
    return Promise.resolve(`/api/v1/local-storage/${key}?token=${token}`);
  }
}
