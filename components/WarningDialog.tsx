"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";

// 폼 액션 실패·안내 문구를 인라인 텍스트 대신 모달 팝업 하나로 통일해서 보여준다(2026-09-05 사용자 요청) —
// 화면마다 제각각이던 경고 문구 위치·스타일을 없애고, 어디서든 같은 모양으로 확인 후 닫도록 한다.
// message가 빈 문자열이면 자동으로 닫힌 상태다.
export function WarningDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <AlertDialog.Root open={!!message} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="calendar-modal-backdrop" />
        <AlertDialog.Content className="alert-dialog" role="alertdialog">
          <AlertDialog.Title asChild><h2>확인 필요</h2></AlertDialog.Title>
          <AlertDialog.Description asChild><p>{message}</p></AlertDialog.Description>
          <div className="alert-dialog-actions">
            <AlertDialog.Action asChild><button className="button primary" type="button" onClick={onClose}>확인</button></AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
