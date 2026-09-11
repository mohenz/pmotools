import { NextRequest, NextResponse } from "next/server";
import ical, { VEvent } from "node-ical";
import { getPrisma } from "@/lib/server/db-pg";
import { requireManagerContext } from "@/lib/server/context";

export async function POST(req: NextRequest) {
  try {
    const { projectId, userId } = await requireManagerContext();
    const contentType = req.headers.get("content-type") || "";

    // 1. JSON 기반 실제 등록 로직
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const eventsToCreate = body.events || [];
      const prisma = getPrisma();
      
      const createdEvents = [];
      for (const ev of eventsToCreate) {
        // 등록시 기본 속성(eventType="meeting", priority="MEDIUM") 적용 및 Note 합치기
        const fullMemo = ev.note ? ev.note : "";
        const event = await prisma.calendarEvent.create({
          data: {
            projectId,
            title: ev.title,
            description: ev.description || "",
            eventType: "meeting", // 기본 속성
            priority: "MEDIUM",   // 기본 속성
            startAt: new Date(ev.startAt),
            endAt: new Date(ev.endAt),
            location: ev.location || "",
            memo: fullMemo,
            createdBy: userId,
            assignees: {
              create: ev.assignees.map((a: any) => ({
                userId: a.userId
              }))
            }
          }
        });
        createdEvents.push(event);
      }
      return NextResponse.json({ success: true, count: createdEvents.length });
    }

    // 2. FormData 기반 파일 업로드 및 미리보기용 파싱 로직
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: { message: "파일이 제공되지 않았습니다." } }, { status: 400 });

    const text = await file.text();
    const events = ical.sync.parseICS(text);
    const prisma = getPrisma();
    
    // 이메일 기반 시스템 사용자 사전 조회
    const emailToUserId = new Map<string, string>();
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    users.forEach((u) => {
      if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
    });

    const parsedEvents = [];

    for (const k in events) {
      if (events.hasOwnProperty(k)) {
        const ev = events[k] as VEvent;
        if (ev.type === "VEVENT") {
          const assignees: { userId?: string; guestName?: string }[] = [];
          const missingAttendees: string[] = [];

          if (ev.attendee) {
            const attendees = Array.isArray(ev.attendee) ? ev.attendee : [ev.attendee];
            for (const att of attendees) {
              let email = "";
              let name = "";
              if (typeof att === 'string') {
                email = att;
              } else {
                email = att.val;
                if (att.params && att.params.CN) name = att.params.CN;
              }
              const emailMatches = email.match(/mailto:(.*)/i);
              if (emailMatches) email = emailMatches[1];
              if (!name) name = email;

              if (emailToUserId.has(email.toLowerCase())) {
                assignees.push({ userId: emailToUserId.get(email.toLowerCase())! });
              } else {
                missingAttendees.push(`${name} (${email})`);
              }
            }
          }

          let note = "";
          if (missingAttendees.length > 0) {
            note = `[미등록 참석자]\n${missingAttendees.join("\n")}`;
          }

          parsedEvents.push({
            tempId: k,
            title: ev.summary || "제목 없음",
            startAt: ev.start ? new Date(ev.start as any).toISOString() : new Date().toISOString(),
            endAt: ev.end ? new Date(ev.end as any).toISOString() : (ev.start ? new Date(ev.start as any).toISOString() : new Date().toISOString()),
            description: ev.description || "",
            location: ev.location || "",
            assignees,
            note
          });
        }
      }
    }

    return NextResponse.json({ events: parsedEvents });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: { message: "처리 중 오류가 발생했습니다." } }, { status: 500 });
  }
}
