"use client";
import { useEffect,type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function CalendarModal({title,returnUrl,children}:{title:string;returnUrl:string;children:ReactNode}){
  const router=useRouter();
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")router.push(returnUrl);};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close);},[router,returnUrl]);
  return <div className="calendar-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)router.push(returnUrl);}}>
    <section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-modal-title">
      <header><div><h2 id="calendar-modal-title">{title}</h2><p>프로젝트 일정 정보를 입력해 주세요.</p></div><button type="button" aria-label="일정 창 닫기" onClick={()=>router.push(returnUrl)}>×</button></header>
      {children}
    </section>
  </div>;
}
