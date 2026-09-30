import { notFound } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { getMeetingMinute } from "@/lib/server/meeting-minutes";
import { MeetingMinuteDocument } from "@/features/meeting-minutes/MeetingMinuteDocument";
import { MeetingMinutePrintActions } from "@/features/meeting-minutes/MeetingMinutePrintActions";
import { meetingMinuteFileName } from "@/lib/domain/meeting-minutes";

export const dynamic = "force-dynamic";

export default async function MeetingMinutePrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pdf?: string }> }) {
  const [{ id }, { pdf }] = await Promise.all([params, searchParams]);
  const { projectId, userId } = await getLocalContext();
  const minute = await getMeetingMinute(projectId, id, userId);
  if (!minute) notFound();
  return <div className="print-report-shell">
    <MeetingMinutePrintActions minuteId={id} fileName={meetingMinuteFileName(minute.meetingDate, minute.category, minute.title)} autoPrint={pdf === "1"} />
    <MeetingMinuteDocument minute={minute} />
  </div>;
}
