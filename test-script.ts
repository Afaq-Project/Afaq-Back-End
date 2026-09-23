import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AuthService } from './src/modules/auth/auth.service';
import { PrismaClient } from '@prisma/client';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  const prisma = new PrismaClient();
  
  const email = `test-login-${Date.now()}@example.com`;
  console.log('Registering', email);
  await authService.register({
    email,
    password: 'Password1!',
    firstName: 'John',
    lastName: 'Doe',
  });
  
  console.log('Logging in', email);
  try {
    const res = await authService.login({ email, password: 'Password1!' });
    console.log('Login success', res);
  } catch (e) {
    console.error('Login failed', e);
  }
  
  await app.close();
  await prisma.$disconnect();
}
bootstrap();
