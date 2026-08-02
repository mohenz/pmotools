"use client";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export function CalendarModal({title,returnUrl,children}:{title:string;returnUrl:string;children:ReactNode}){
  const router=useRouter();
  function handleOpenChange(open:boolean){if(!open)router.push(returnUrl);}
  return <Dialog.Root open onOpenChange={handleOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="calendar-modal-backdrop" />
      <Dialog.Content className="calendar-modal" aria-describedby={undefined}>
        <header>
          <div><Dialog.Title asChild><h2>{title}</h2></Dialog.Title><p>프로젝트 일정 정보를 입력해 주세요.</p></div>
          <Dialog.Close asChild><button type="button" aria-label="일정 창 닫기"><X aria-hidden="true" /></button></Dialog.Close>
        </header>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
