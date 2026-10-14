import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const isLocal = raw.includes("localhost") || raw.includes("127.0.0.1");
const pool = new Pool({
  connectionString: raw,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const allRooms = await prisma.meetingRoom.findMany();
  console.log('=== All Meeting Rooms ===');
  console.table(allRooms.map(r => ({ id: r.id, name: r.name })));

  const allRecurring = await prisma.recurringMeetingReservation.findMany({
    include: {
      room: true,
      applicant: { select: { name: true } },
    },
  });

  console.log('=== All Recurring Meeting Reservations ===');
  console.log(JSON.stringify(allRecurring, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
