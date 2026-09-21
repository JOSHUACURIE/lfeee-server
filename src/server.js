// src/server.js
import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

async function main() {
  await prisma.$connect();

  app.listen(env.PORT, env.HOST, () => {
    console.log(`LeraFee API · http://${env.HOST}:${env.PORT}`);
  });
}

main().catch((e) => {
  console.error('[boot] failed:', e.message);
  process.exit(1);
});