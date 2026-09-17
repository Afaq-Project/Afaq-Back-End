import { execSync } from 'child_process';

export default function globalSetup() {
  console.log(
    '\n[Global Setup] Synchronizing database (npx prisma db push)...',
  );
  execSync('npx prisma db push', { stdio: 'inherit' });
  console.log('[Global Setup] Database synchronization complete.');
}
