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
  // 1. 소회의실 D 찾기
  const rooms = await prisma.meetingRoom.findMany({
    where: {
      name: {
        contains: 'D',
      },
    },
  });

  console.log('=== Meeting Rooms (Contains D) ===');
  console.log(rooms);

  const roomIds = rooms.map((r) => r.id);

  // 2. 해당 회의실의 정기예약 신청(RecurringMeetingReservation) 조회
  const recurringList = await prisma.recurringMeetingReservation.findMany({
    where: {
      roomId: { in: roomIds },
    },
    include: {
      room: true,
      applicant: {
        select: { id: true, name: true, userId: true },
      },
      reservations: true,
    },
  });

  console.log('=== Recurring Meeting Reservations ===');
  console.log(JSON.stringify(recurringList, null, 2));

  // 3. 정기예약 id가 매핑된 개별 예약(MeetingReservation)들도 조회
  const reservations = await prisma.meetingReservation.findMany({
    where: {
      roomId: { in: roomIds },
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  console.log('=== All Reservations for Room D ===');
  console.log(JSON.stringify(reservations, null, 2));
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
