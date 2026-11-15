import 'dotenv/config';
import { prisma } from '../db.js';
import { hashPassword } from '../auth/auth.js';

/**
 * Cria (ou atualiza) o administrador inicial.
 * Uso: npx tsx src/scripts/createAdmin.ts <email> <nome> <senha>
 */
async function main(): Promise<void> {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error('Uso: createAdmin <email> <nome> <senha>');
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.adminUser.upsert({
    where: { email },
    create: { email, name, passwordHash, role: 'ADMIN' },
    update: { name, passwordHash, active: true },
  });
  console.log(`Administrador pronto: ${user.email} (${user.name})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
