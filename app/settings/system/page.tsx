import { ThemeSelector } from "@/components/ThemeSelector";

export default function SystemSettingsPage() {
  return <><header className="topbar"><div><h1>시스템 설정</h1><p>PMO CONTROL의 화면 표시 방식을 설정합니다.</p></div></header><div className="content settings-content"><ThemeSelector /></div></>;
}
