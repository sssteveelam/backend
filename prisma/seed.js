const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data (Robust Mode)...');
  
  const sqlFilePath = path.join(__dirname, '../seed/seed_demo_full.sql');
  const fullSqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  // Xóa ghi chú và các phần không cần thiết để tránh lỗi khi split (phân tách)
  const cleanSql = fullSqlContent
    .replace(/^BEGIN;$/m, '')
    .replace(/^COMMIT;$/m, '')
    .replace(/--.*$/gm, '')      // Xóa ghi chú dạng --
    .replace(/\/\*[\s\S]*?\*\//gm, ''); // Xóa ghi chú dạng /* */

  // Phân tách theo dấu chấm phẩy (;)
  const commands = cleanSql
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0);

  console.log(`Found ${commands.length} SQL commands to execute.`);

  try {
    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        // Bỏ qua các câu lệnh SELECT kiểm tra
        if (cmd.toUpperCase().startsWith('SELECT')) continue;
        
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
