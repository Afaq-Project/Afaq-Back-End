// [OMA-W008-T001] Standalone StorageModule unifying STORAGE_SERVICE singleton
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageServiceProvider, STORAGE_SERVICE } from './storage.service';
import { LocalStorageService } from './local-storage.service';

// [OMA-W008-T001] Standalone StorageModule unifying STORAGE_SERVICE singleton
@Module({
  imports: [ConfigModule],
  providers: [StorageServiceProvider, LocalStorageService],
  exports: [StorageServiceProvider, LocalStorageService, STORAGE_SERVICE],
})
export class StorageModule {}
