import Link from "next/link";
import { getLocalContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listProjectMembers } from "@/lib/server/users";
import { getCalendarEvent,listCalendarEvents,type CalendarEvent } from "@/lib/server/calendar";
import { CalendarEventForm } from "@/features/calendar/CalendarEventForm";
import { CalendarModal } from "@/features/calendar/CalendarModal";
import { CALENDAR_END_MINUTES, CALENDAR_SLOT_MINUTES, CALENDAR_START_MINUTES, calendarTimePlacement, calendarTodayKey } from "@/lib/domain/calendar-layout";

export const dynamic="force-dynamic";
type View="year"|"month"|"week"|"day"|"agenda";
const VIEW_LABEL:Record<View,string>={year:"년간",month:"월간",week:"주간",day:"일간",agenda:"목록"};
const iso=(d:Date)=>d.toISOString().slice(0,10);
const addDays=(d:Date,n:number)=>new Date(d.getTime()+n*86400000);
const parse=(s:string)=>new Date(`${s}T00:00:00Z`);
const monday=(d:Date)=>addDays(d,-((d.getUTCDay()+6)%7));
const monthCells=(monthStart:Date)=>{const firstWeekday=(monthStart.getUTCDay()+6)%7,lastDay=new Date(Date.UTC(monthStart.getUTCFullYear(),monthStart.getUTCMonth()+1,0)).getUTCDate();return Array.from({length:42},(_,index)=>{const day=index-firstWeekday+1;return day>=1&&day<=lastDay?new Date(Date.UTC(monthStart.getUTCFullYear(),monthStart.getUTCMonth(),day)):null;});};

function range(view:View,selected:Date){
  if(view==="day")return {from:selected,to:selected,cells:[selected]};
  if(view==="week"){const from=monday(selected);return {from,to:addDays(from,6),cells:Array.from({length:7},(_,i)=>addDays(from,i))};}
  if(view==="year"){const from=new Date(Date.UTC(selected.getUTCFullYear(),0,1)),to=new Date(Date.UTC(selected.getUTCFullYear(),11,31));return {from,to,cells:Array.from({length:12},(_,i)=>new Date(Date.UTC(selected.getUTCFullYear(),i,1)))};}
  const first=new Date(Date.UTC(selected.getUTCFullYear(),selected.getUTCMonth(),1));
  const last=new Date(Date.UTC(selected.getUTCFullYear(),selected.getUTCMonth()+1,0));
  if(view==="agenda")return {from:first,to:last,cells:Array.from({length:last.getUTCDate()},(_,i)=>addDays(first,i))};
  const from=monday(first),to=addDays(monday(last),6);
  return {from,to,cells:Array.from({length:Math.round((to.getTime()-from.getTime())/86400000)+1},(_,i)=>addDays(from,i))};
}
function move(view:View,date:Date,direction:number){if(view==="year")return new Date(Date.UTC(date.getUTCFullYear()+direction,0,1));if(view==="month"||view==="agenda")return new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+direction,1));return addDays(date,direction*(view==="week"?7:1));}
const CAL_START=CALENDAR_START_MINUTES,CAL_END=CALENDAR_END_MINUTES,CAL_SLOT=CALENDAR_SLOT_MINUTES,CAL_SLOTS=Array.from({length:(CAL_END-CAL_START)/CAL_SLOT},(_,i)=>CAL_START+i*CAL_SLOT);
const hhmm=(m:number)=>`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const durationMinutes=(event:CalendarEvent)=>Math.max(0,(new Date(event.endAt).getTime()-new Date(event.startAt).getTime())/60_000);
const placementOf=(event:CalendarEvent)=>calendarTimePlacement(event.startTime,durationMinutes(event));
function EventLink({event,base,canNavigate,timeGrid=false}:{event:CalendarEvent;base:string;canNavigate:boolean;timeGrid?:boolean}){const priorityClass=event.source==="schedule"?`priority-${event.priority.toLowerCase()}`:"";const className=`calendar-event event-${event.source} ${priorityClass}${timeGrid?" time-grid-event":""}`;const placement=timeGrid?placementOf(event):null;const style=placement?{top:`${placement.offsetPx+1}px`,height:`${Math.max(24,placement.heightPx-2)}px`}:undefined;const content=<><span>{event.allDay?"종일":timeGrid&&event.endTime?`${event.startTime}–${event.endTime}`:event.startTime}</span><strong>{event.isMilestone&&"★ "}{event.title}{event.isRecurring&&" ↻"}</strong>{event.areaLabel&&<small>{event.areaLabel}</small>}</>;if(event.source==="schedule")return <Link className={className} style={style} href={`${base}&edit=${encodeURIComponent(event.id)}`}>{content}</Link>;if(!canNavigate||!event.sourceUrl)return <div className={className} style={style}>{content}</div>;return <Link className={className} style={style} href={event.sourceUrl}>{content}</Link>}

export default async function CalendarPage({searchParams}:{searchParams:Promise<{view?:string;date?:string;edit?:string;new?:string;time?:string}>}){
  const {projectId,userId,role}=await getLocalContext();const canWrite=role==="ADMIN"||role==="OPERATOR";const q=await searchParams;
  const view:View=(["year","month","week","day","agenda"] as View[]).includes(q.view as View)?(q.view as View):"month";
  const today=calendarTodayKey(),selected=/^\d{4}-\d{2}-\d{2}$/.test(q.date??"")?parse(q.date!):parse(today),r=range(view,selected);
  const base=`/calendar?view=${view}&date=${iso(selected)}`;
  const [events,codes,members,edit]=await Promise.all([listCalendarEvents(projectId,iso(r.from),iso(r.to),{},userId),getCodeOptions(projectId),listProjectMembers(projectId),q.edit?getCalendarEvent(projectId,q.edit,userId):null]);
  const byDate=events.reduce<Record<string,CalendarEvent[]>>((a,e)=>{(a[e.date]??=[]).push(e);return a;},{});
  const title=view==="year"?`${selected.getUTCFullYear()}년`:view==="month"||view==="agenda"?`${selected.getUTCFullYear()}년 ${selected.getUTCMonth()+1}월`:view==="week"?`${iso(r.from)} ~ ${iso(r.to)}`:new Intl.DateTimeFormat("ko-KR",{dateStyle:"full",timeZone:"UTC"}).format(selected);
  const newDate=/^\d{4}-\d{2}-\d{2}$/.test(q.new??"")?q.new!:null;
  const newTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(q.time??"")?q.time!:undefined;
  const canModifyEvent=Boolean(edit?.editable&&canWrite);
  return <>
    <header className="topbar"><div><h1>캘린더</h1></div><div className="topbar-actions">{canWrite&&<Link className="button secondary" href="/calendar/excel">엑셀</Link>}<Link className="button secondary" href="/calendar/search">검색</Link><Link className="button secondary" href="/calendar/milestones">주요 이벤트</Link>{canWrite&&<Link className="button primary" href={`${base}&new=${iso(selected)}`}>+ 일정 등록</Link>}</div></header>
    <div className="content">
      <section className="panel calendar-panel">
        <div className="calendar-toolbar"><div className="calendar-nav"><Link className="button secondary" href={`/calendar?view=${view}&date=${iso(move(view,selected,-1))}`}>이전</Link><Link className="button secondary" href={`/calendar?view=${view}&date=${today}`}>오늘</Link><Link className="button secondary" href={`/calendar?view=${view}&date=${iso(move(view,selected,1))}`}>다음</Link></div><h2>{title}</h2><div className="calendar-views">{(["year","month","week","day","agenda"] as View[]).map(v=><Link className={`button ${view===v?"primary":"secondary"}`} href={`/calendar?view=${v}&date=${iso(selected)}`} key={v}>{VIEW_LABEL[v]}</Link>)}</div></div>
        {view==="month"&&<><div className="calendar-weekdays">{["월","화","수","목","금","토","일"].map(d=><span key={d}>{d}</span>)}</div><div className="calendar-month">{r.cells.map(d=>{const key=iso(d),outside=d.getUTCMonth()!==selected.getUTCMonth();return <div className={`calendar-cell ${outside?"outside":""} ${key===today?"today":""}`} key={key}>{canWrite?<Link className="calendar-date" title={`${key} 일정 등록`} href={`${base}&new=${key}`}>{d.getUTCDate()}</Link>:<span className="calendar-date">{d.getUTCDate()}</span>}<div>{(byDate[key]??[]).slice(0,4).map(e=><EventLink event={e} base={base} canNavigate={canWrite} key={`${e.source}-${e.id}`}/>)}{(byDate[key]?.length??0)>4&&<small className="calendar-more">+{byDate[key].length-4}개</small>}</div></div>})}</div></>}
        {(view==="week"||view==="day")&&<div className={`calendar-time-grid ${view}`} style={{gridTemplateColumns:`60px repeat(${r.cells.length},minmax(${view==="day"?"0":"120px"},1fr))`}}>
          <div className="calendar-time-corner" />
          {r.cells.map(d=>{const key=iso(d);return <div className={`calendar-time-daycol ${key===today?"today":""}`} key={key}><strong>{new Intl.DateTimeFormat("ko-KR",{weekday:"short",timeZone:"UTC"}).format(d)}</strong>{canWrite?<Link title={`${key} 일정 등록`} href={`${base}&new=${key}`}>{d.getUTCDate()} <small>+</small></Link>:<span>{d.getUTCDate()}</span>}</div>})}
          <div className="calendar-time-corner">종일</div>
          {r.cells.map(d=>{const key=iso(d),items=(byDate[key]??[]).filter(e=>e.allDay);return <div className="calendar-time-allday" key={key}>{items.map(e=><EventLink event={e} base={base} canNavigate={canWrite} key={`${e.source}-${e.id}`}/>)}</div>})}
          {CAL_SLOTS.map(slot=><div style={{display:"contents"}} key={slot}>
            <time className={slot%60===0?"hour":""}>{slot%60===0?hhmm(slot):""}</time>
            {r.cells.map(d=>{const key=iso(d),items=(byDate[key]??[]).filter(e=>!e.allDay&&placementOf(e).slot===slot);return <div className={`calendar-time-cell ${slot%60===0?"hour":""}`} key={key}>{items.map(e=><EventLink event={e} base={base} canNavigate={canWrite} timeGrid key={`${e.source}-${e.id}`}/>)}{!items.length&&canWrite&&<Link className="calendar-slot-add" aria-label={`${key} ${hhmm(slot)} 일정 등록`} title={`${hhmm(slot)} 일정 등록`} href={`${base}&new=${key}&time=${hhmm(slot)}`}>+</Link>}</div>})}
          </div>)}
        </div>}
        {view==="year"&&<div className="calendar-year">{r.cells.map(monthStart=>{const monthKey=`${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth()+1).padStart(2,"0")}`,monthEvents=events.filter(e=>e.date.startsWith(monthKey));return <section className="calendar-year-month" key={monthKey}>
          <header><Link href={`/calendar?view=month&date=${iso(monthStart)}`}>{monthStart.getUTCMonth()+1}월</Link><span>{monthEvents.length>0?`${monthEvents.length}건`:"일정 없음"}</span></header>
          <div className="calendar-year-weekdays">{["월","화","수","목","금","토","일"].map(day=><span key={day}>{day}</span>)}</div>
          <div className="calendar-year-days">{monthCells(monthStart).map((date,index)=>{if(!date)return <span className="empty" aria-hidden="true" key={`empty-${index}`}/>;const key=iso(date),dayEvents=byDate[key]??[];return <Link className={`calendar-year-date ${key===today?"today":""} ${dayEvents.length?"has-events":""}`} href={`/calendar?view=day&date=${key}`} aria-label={`${key}${dayEvents.length?`, 일정 ${dayEvents.length}건`:""}`} key={key}><span>{date.getUTCDate()}</span>{dayEvents.length>0&&<small>{dayEvents.length}</small>}</Link>})}</div>
        </section>})}</div>}
        {view==="agenda"&&<div className="calendar-agenda">{r.cells.map(d=>{const key=iso(d);const dayEvents=byDate[key]??[];if(!dayEvents.length)return null;return <div className="calendar-agenda-day" key={key}><header>{new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",weekday:"short",timeZone:"UTC"}).format(d)}</header><div>{dayEvents.map(e=><EventLink event={e} base={base} canNavigate={canWrite} key={`${e.source}-${e.id}`}/>)}</div></div>})}{!events.length&&<p className="empty">이 달에는 일정이 없습니다.</p>}</div>}
      </section>
      <div className="calendar-legend"><span><i className="priority-high"/>우선순위 상</span><span><i className="priority-medium"/>우선순위 중</span><span><i className="priority-low"/>우선순위 하</span><span><i className="progress"/>목표일</span><span><i className="next_plan"/>차주 계획</span><span><i className="issue"/>이슈</span><span>★ 마일스톤</span><span>↻ 반복 일정</span></div>
    </div>
    {((newDate&&canWrite)||edit)&&<CalendarModal title={edit?(canModifyEvent?"일정 수정":"일정 보기"):"일정 등록"} returnUrl={base}><CalendarEventForm areas={codes.tracks} members={members} event={edit} selectedDate={newDate??edit?.date??iso(selected)} selectedTime={newTime} returnUrl={base} canWrite={edit?canModifyEvent:canWrite}/></CalendarModal>}
  </>;
}
