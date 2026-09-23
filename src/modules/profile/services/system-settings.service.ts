import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SystemSettingKey } from '../constants/system-settings.keys';

@Injectable()
export class SystemSettingsService {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getNumber(
    key: SystemSettingKey,
    defaultValue: number,
  ): Promise<number> {
    try {
      const setting = await this.prisma.systemSettings.findUnique({
        where: { key },
      });

      if (!setting) {
        return defaultValue;
      }

      if (typeof setting.value === 'number') {
        return setting.value;
      }

      if (typeof setting.value === 'string') {
        const parsed = Number(setting.value);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }

      return defaultValue;
    } catch (error) {
      this.logger.error(
        `Failed to get setting ${key}, returning default ${defaultValue}`,
        error,
      );
      return defaultValue;
    }
  }

  async getJson<T>(key: SystemSettingKey, defaultValue: T): Promise<T> {
    try {
      const setting = await this.prisma.systemSettings.findUnique({
        where: { key },
      });

      if (!setting || setting.value === null) {
        return defaultValue;
      }

      // If Prisma returns it as a string instead of an object in some cases (e.g. invalid JSON format)
      // Prisma usually returns the parsed JSON object directly for 'Json' type.
      return setting.value as unknown as T;
    } catch (error) {
      this.logger.error(
        `Failed to get JSON setting ${key}, returning default`,
        error,
      );
      return defaultValue;
    }
  }
}
