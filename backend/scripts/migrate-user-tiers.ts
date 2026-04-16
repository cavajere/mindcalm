#!/usr/bin/env tsx

import { PrismaClient, UserTier } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateUserTiers() {
  console.log('🔄 Migrating existing users to PREMIUM tier...')
  
  // All existing users become PREMIUM since they used invite codes
  const result = await prisma.user.updateMany({
    where: {
      tier: 'FREE', // Only update users that are currently FREE (default)
    },
    data: {
      tier: 'PREMIUM',
    },
  })
  
  console.log(`✅ Updated ${result.count} users to PREMIUM tier`)
  
  // Set all existing audio to PUBLIC by default for backward compatibility
  console.log('🔄 Setting existing audio to PUBLIC visibility...')
  
  const audioResult = await prisma.audio.updateMany({
    data: {
      visibility: 'PUBLIC',
    },
  })
  
  console.log(`✅ Updated ${audioResult.count} audio tracks to PUBLIC visibility`)
  
  console.log('🎉 Migration completed successfully!')
}

migrateUserTiers()
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })