import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'
import { env } from './env.js'

const databaseUrl = new URL(env.DATABASE_URL)
const adapter = new PrismaPg(
  { connectionString: env.DATABASE_URL },
  { schema: databaseUrl.searchParams.get('schema') ?? 'public' },
)

export const prisma = new PrismaClient({ adapter })
