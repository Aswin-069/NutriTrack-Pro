import { PrismaClient } from '@prisma/client';

let dbUrl = (process.env.DATABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');

if (dbUrl && dbUrl.includes('neon.tech')) {
  // Automatically convert direct Neon hostname to pgBouncer pooled hostname if missing '-pooler'
  if (!dbUrl.includes('-pooler')) {
    dbUrl = dbUrl.replace(/(@ep-[a-z0-9-]+)\./i, '$1-pooler.');
  }

  // Automatically enforce sslmode=require and connect_timeout=30 for Neon
  if (!dbUrl.includes('sslmode=')) {
    const separator = dbUrl.includes('?') ? '&' : '?';
    dbUrl = `${dbUrl}${separator}sslmode=require&connect_timeout=30`;
  }
}

const prisma = new PrismaClient(dbUrl ? {
  datasources: {
    db: { url: dbUrl }
  }
} : undefined);

export default prisma;
