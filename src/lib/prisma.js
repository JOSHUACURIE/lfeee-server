// src/lib/prisma.js
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const logLevels = env.isDev
  ? ['query', 'warn', 'error']
  : ['warn', 'error'];

export const prisma = new PrismaClient({
  adapter,
  log: logLevels,
});

// In dev, pipe Prisma's query log to stdout in a readable format.
if (env.isDev) {
  prisma.$on('query', (e) => {
    const ms = e.duration;
    const sql = e.query.replace(/\s+/g, ' ').trim();
    console.log(`[prisma] ${ms}ms · ${sql}`);
  });

  prisma.$on('warn', (e) => {
    console.warn(`[prisma] warn · ${e.message}`);
  });

  prisma.$on('error', (e) => {
    console.error(`[prisma] error · ${e.message}`);
  });
}

// Graceful shutdown
async function shutdown(signal) {
  try {
    await prisma.$disconnect();
    console.log(`[prisma] disconnected (${signal})`);
  } catch (e) {
    console.error('[prisma] error during disconnect:', e.message);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGUSR2', async () => {
  await prisma.$disconnect();
  process.kill(process.pid, 'SIGUSR2');
});