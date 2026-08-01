import Link from "next/link";
import { getLocalContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { getCalendarEvent,listCalendarEvents,type CalendarEvent } from "@/lib/server/calendar";
import { CalendarEventForm } from "@/features/calendar/CalendarEventForm";
import { CalendarModal } from "@/features/calendar/CalendarModal";

export const dynamic="force-dynamic";
type View="month"|"week"|"day";
const iso=(d:Date)=>d.toISOString().slice(0,10);
const addDays=(d:Date,n:number)=>new Date(d.getTime()+n*86400000);
const parse=(s:string)=>new Date(`${s}T00:00:00Z`);
const monday=(d:Date)=>addDays(d,-((d.getUTCDay()+6)%7));

function range(view:View,selected:Date){
  if(view==="day")return {from:selected,to:selected,cells:[selected]};
  if(view==="week"){const from=monday(selected);return {from,to:addDays(from,6),cells:Array.from({length:7},(_,i)=>addDays(from,i))};}
  const first=new Date(Date.UTC(selected.getUTCFullYear(),selected.getUTCMonth(),1));
  const last=new Date(Date.UTC(selected.getUTCFullYear(),selected.getUTCMonth()+1,0));
  const from=monday(first),to=addDays(monday(last),6);
  return {from,to,cells:Array.from({length:Math.round((to.getTime()-from.getTime())/86400000)+1},(_,i)=>addDays(from,i))};
}
function move(view:View,date:Date,direction:number){if(view==="month")return new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+direction,1));return addDays(date,direction*(view==="week"?7:1));}
function EventLink({event,base}:{event:CalendarEvent;base:string}){const href=event.editable?`${base}&edit=${event.id}`:event.sourceUrl??base;return <Link className={`calendar-event event-${event.source}`} href={href}><span>{event.allDay?"종일":event.startTime}</span><strong>{event.title}</strong>{event.areaLabel&&<small>{event.areaLabel}</small>}</Link>}

export default async function CalendarPage({searchParams}:{searchParams:Promise<{view?:string;date?:string;edit?:string;new?:string}>}){
  const {projectId}=getLocalContext();const q=await searchParams;
  const view:View=q.view==="week"||q.view==="day"?q.view:"month";
  const today=iso(new Date()),selected=/^\d{4}-\d{2}-\d{2}$/.test(q.date??"")?parse(q.date!):parse(today),r=range(view,selected);
  const base=`/calendar?view=${view}&date=${iso(selected)}`;
  const [events,codes,edit]=await Promise.all([listCalendarEvents(projectId,iso(r.from),iso(r.to)),getCodeOptions(projectId),q.edit?getCalendarEvent(projectId,q.edit):null]);
  const byDate=events.reduce<Record<string,CalendarEvent[]>>((a,e)=>{(a[e.date]??=[]).push(e);return a;},{});
  const title=view==="month"?`${selected.getUTCFullYear()}년 ${selected.getUTCMonth()+1}월`:view==="week"?`${iso(r.from)} ~ ${iso(r.to)}`:new Intl.DateTimeFormat("ko-KR",{dateStyle:"full",timeZone:"UTC"}).format(selected);
  const newDate=/^\d{4}-\d{2}-\d{2}$/.test(q.new??"")?q.new!:null;
  return <>
    <header className="topbar"><div><h1>통합 캘린더</h1><p>날짜를 선택하면 일정을 등록하고, 등록 일정을 선택하면 수정할 수 있습니다.</p></div><Link className="button primary" href={`${base}&new=${iso(selected)}`}>+ 일정 등록</Link></header>
    <div className="content">
      <section className="panel calendar-panel">
        <div className="calendar-toolbar"><div className="calendar-nav"><Link className="button secondary" href={`/calendar?view=${view}&date=${iso(move(view,selected,-1))}`}>이전</Link><Link className="button secondary" href={`/calendar?view=${view}&date=${today}`}>오늘</Link><Link className="button secondary" href={`/calendar?view=${view}&date=${iso(move(view,selected,1))}`}>다음</Link></div><h2>{title}</h2><div className="calendar-views">{(["month","week","day"] as View[]).map(v=><Link className={`button ${view===v?"primary":"secondary"}`} href={`/calendar?view=${v}&date=${iso(selected)}`} key={v}>{v==="month"?"월간":v==="week"?"주간":"일간"}</Link>)}</div></div>
        {view==="month"?<><div className="calendar-weekdays">{["월","화","수","목","금","토","일"].map(d=><span key={d}>{d}</span>)}</div><div className="calendar-month">{r.cells.map(d=>{const key=iso(d),outside=d.getUTCMonth()!==selected.getUTCMonth();return <div className={`calendar-cell ${outside?"outside":""} ${key===today?"today":""}`} key={key}><Link className="calendar-date" title={`${key} 일정 등록`} href={`${base}&new=${key}`}>{d.getUTCDate()}</Link><div>{(byDate[key]??[]).slice(0,4).map(e=><EventLink event={e} base={base} key={`${e.source}-${e.id}`}/>)}{(byDate[key]?.length??0)>4&&<small className="calendar-more">+{byDate[key].length-4}개</small>}</div></div>})}</div></>:<div className={`calendar-period ${view}`}>{r.cells.map(d=>{const key=iso(d);return <div className={`calendar-period-day ${key===today?"today":""}`} key={key}><header><strong>{new Intl.DateTimeFormat("ko-KR",{weekday:"short",timeZone:"UTC"}).format(d)}</strong><Link title={`${key} 일정 등록`} href={`${base}&new=${key}`}>{d.getUTCDate()} <small>+</small></Link></header><div>{(byDate[key]??[]).map(e=><EventLink event={e} base={base} key={`${e.source}-${e.id}`}/>)}{!(byDate[key]?.length)&&<Link className="calendar-empty" href={`${base}&new=${key}`}>클릭하여 일정 등록</Link>}</div></div>})}</div>}
      </section>
      <div className="calendar-legend"><span><i className="schedule"/>등록 일정</span><span><i className="progress"/>목표일</span><span><i className="next_plan"/>차주 계획</span><span><i className="issue"/>이슈</span></div>
    </div>
    {(newDate||edit)&&<CalendarModal title={edit?"일정 수정":"일정 등록"} returnUrl={base}><CalendarEventForm areas={codes.tracks} event={edit} selectedDate={newDate??edit?.date??iso(selected)} returnUrl={base}/></CalendarModal>}
  </>;
}
