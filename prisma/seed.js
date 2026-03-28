const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');
  
  // Read the SQL file from the seed directory
  const sqlFilePath = path.join(__dirname, '../seed/seed_demo_full.sql');
  const sql = fs.readFileSync(sqlFilePath, 'utf-8');

  try {
    // Execute the full SQL content. 
    // Prisma's $executeRawUnsafe can handle multiple statements for Postgres.
    await prisma.$executeRawUnsafe(sql);
    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
