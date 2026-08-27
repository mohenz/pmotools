import { NextRequest } from "next/server";
import { csvCell } from "@/lib/domain/csv";
import { getLocalContext } from "@/lib/server/context";
import { listStaffChanges,listWeeklyProgress } from "@/lib/server/work-management";

export async function GET(req:NextRequest){
  const {projectId}=await getLocalContext();const type=req.nextUrl.searchParams.get("type")??"reports";
  if(type==="reports") return Response.redirect(new URL("/weekly-reports/print?pdf=1",req.url),307);
  let header:string[]=[],rows:unknown[][]=[];
  if(type==="progress"){const data=await listWeeklyProgress(projectId);header=["주차","영역","업무","계획","목표일","실적","완료일","공정률","차주계획","차주목표일","상태","비고"];rows=data.map(r=>[r.weekLabel,r.areaLabel,r.taskName,r.planDetail,r.planTargetDate,r.actualDetail,r.actualDate,r.progress,r.nextPlan,r.nextTargetDate,r.delayed?"지연":r.progress===100?"완료":"진행중",r.notes]);}
  else if(type==="staff"){const data=await listStaffChanges(projectId);header=["주차","영역","구분","금주인원","차주인원","비고"];rows=data.map(r=>[r.weekLabel,r.areaLabel,r.changeType==="join"?"투입":"철수",r.currentCount,r.nextCount,r.notes]);}
  else return Response.json({error:{code:"INVALID_TYPE",message:"지원하지 않는 내보내기 형식입니다."}},{status:400});
  const csv=`\uFEFF${[header,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="pmo-${type}-${new Date().toISOString().slice(0,10)}.csv"`}});
}
