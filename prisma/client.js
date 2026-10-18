// PrismaClient keeps a connection pool alive. Requiring it per-request would
// leak connections, so one instance is cached here and reused.
const { PrismaClient } = require('@prisma/client');

const prisma = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

module.exports = prisma;