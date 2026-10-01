# Local Setup

1. Copy `.env.example` to `.env` and fill in the required variables.
   Ensure that `DATABASE_AIService_URL` is set to point to the external AI service database (read-only).
2. Install dependencies: `pnpm install`
3. Generate the AI Prisma client: `pnpm generate:ai`
4. Generate the main Prisma client: `pnpm run prisma:generate`
5. Start the server: `pnpm start:dev`
