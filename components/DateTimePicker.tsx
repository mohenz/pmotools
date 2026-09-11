"use client";

const DEFAULT_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const DEFAULT_MINUTES = ["00", "10", "20", "30", "40", "50"];

// value는 "YYYY-MM-DDTHH:MM" 형식의 지역 날짜/시간 문자열이다.
function replacePart(value: string, part: "date" | "hour" | "minute", next: string) {
  const date = value.slice(0, 10), hour = value.slice(11, 13), minute = value.slice(14, 16);
  if (part === "date") return `${next}T${hour}:${minute}`;
  if (part === "hour") return `${date}T${next}:${minute}`;
  return `${date}T${hour}:${next}`;
}

// 날짜 입력 + 시(select) + 분(select)을 한 행에 묶어 보여주는 공용 일시 선택기.
export function DateTimePicker({ label, value, onChange, hours = DEFAULT_HOURS, minutes = DEFAULT_MINUTES, required = true }: { label: string; value: string; onChange: (value: string) => void; hours?: string[]; minutes?: string[]; required?: boolean }) {
  return <label>{label}<div className="calendar-time-picker">
    <input aria-label={`${label} 날짜`} type="date" value={value.slice(0, 10)} onChange={(e) => onChange(replacePart(value, "date", e.target.value))} required={required} />
    <select aria-label={`${label} 시간`} value={value.slice(11, 13)} onChange={(e) => onChange(replacePart(value, "hour", e.target.value))}>{hours.map((hour) => <option value={hour} key={hour}>{hour}시</option>)}</select>
    <select aria-label={`${label} 분`} value={value.slice(14, 16)} onChange={(e) => onChange(replacePart(value, "minute", e.target.value))}>{minutes.map((minute) => <option value={minute} key={minute}>{minute}분</option>)}</select>
  </div></label>;
}
