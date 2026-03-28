const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data (Split Mode)...');
  
  const sqlFilePath = path.join(__dirname, '../seed/seed_demo_full.sql');
  const fullSqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  // 1. Remove BEGIN; and COMMIT; (Prisma will handle statements individually)
  // 2. Split by semicolon (;) but handle DO $$ blocks correctly by being careful
  // A simple split by semicolon at the end of a line works for this script's structure
  const commands = fullSqlContent
    .replace(/^BEGIN;$/m, '')
    .replace(/^COMMIT;$/m, '')
    .split(/;\s*$/m) // Split by ; followed by optional whitespace at end of line
    .filter(cmd => cmd.trim().length > 0);

  console.log(`Found ${commands.length} SQL commands to execute.`);

  try {
    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i].trim();
        // Skip sanity queries (SELECT ...) to keep logs clean
        if (cmd.startsWith('SELECT')) continue;
        
        console.log(`Executing command ${i + 1}/${commands.length}...`);
        await prisma.$executeRawUnsafe(cmd);
    }
    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
