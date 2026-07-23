import { PrismaClient } from '@prisma/client';

let dbUrl = process.env.DATABASE_URL || '';

// Ensure Neon PostgreSQL URL automatically appends sslmode=require & connect_timeout
if (dbUrl && dbUrl.includes('neon.tech') && !dbUrl.includes('sslmode=')) {
  const separator = dbUrl.includes('?') ? '&' : '?';
  dbUrl = `${dbUrl}${separator}sslmode=require&connect_timeout=15`;
}

const prisma = new PrismaClient(dbUrl ? {
  datasources: {
    db: { url: dbUrl }
  }
} : undefined);

export default prisma;
