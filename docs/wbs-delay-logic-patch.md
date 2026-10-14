# WBS 지연 판정 로직 예외 처리 패치 가이드

## 1. 개요 및 현상
- **현상:** WBS 화면에서 '지연' 필터를 켜면, 진짜 지연 중인 테스크(예: 실적시작/종료일이 모두 없는 상태로 계획일정이 경과된 건)가 첫 페이지에 보이지 않고, '완료제외'를 켰을 때만 1페이지로 올라오는 현상 발생.
- **원인:** 과거 WBS 담당자들이 업무를 완료 처리할 때 **'실적종료일'은 입력하였으나 '실적시작일'을 누락**한 데이터가 다수 존재함. 
- **시스템 로직의 맹점:** 현재 시스템은 '계획시작일이 경과했는데 실적시작일이 공백'이면 무조건 **'착수 지연'**으로 판정함. 이로 인해 이미 끝난 업무들이 지연 리스트 앞단(1페이지)을 가득 채워, 진짜 미완료 지연 건이 뒤 페이지로 밀려나는 **'페이징(Pagination) 밀림 현상'**이 발생함.

## 2. 해결 방안 (Core Logic Patch)
- **개선 방향:** 이미 완료된(실적종료일이 입력된) 항목이라면, '실적시작일'이 실수로 누락되었더라도 현재 지연(Delayed) 중인 상태가 아니므로 지연 리스트에서 원천 제외하도록 예외 룰을 추가.

## 3. 코드 수정 가이드

### 대상 파일
- `lib/domain/wbs.ts` (pmotools 워크스페이스)

### 수정 내용
파일 내의 `isWbsItemDelayed` 함수를 찾아 가장 첫 줄에 예외 검증 로직(`if (item.actualDue !== null) return false;`)을 삽입합니다.

```diff
  export function isWbsItemDelayed(today: string, item: WbsDelayCheckInput): boolean {
+   // [2026-10-06 패치] 실적종료일이 존재하여 이미 완료된 업무는, 
+   // 실적시작일 누락 여부와 상관없이 현재 '착수/종료 지연' 대상에서 원천 제외한다.
+   if (item.actualDue !== null) return false;
+
    const startDelayed = item.plannedStart !== null && item.plannedStart < today && item.actualStart === null;
    const dueDelayed = item.plannedDue !== null && item.plannedDue < today && item.actualDue === null;
    const notYetDue = item.plannedDue !== null && item.plannedDue >= today && item.actualStart === null && item.actualDue === null;
    return (startDelayed || dueDelayed) && !notYetDue;
  }
```

## 4. 기대 효과
1. '완료제외' 토글 여부와 상관없이, 지연 필터를 적용하면 **정말로 완료되지 않고 일정이 경과된 진짜 지연 건들만 정확하게 1페이지부터 렌더링**됩니다.
2. 실적시작일 누락이라는 현업의 데이터 품질 저하 이슈가 시스템의 지연 통계를 교란(노이즈)시키는 문제를 영구적으로 방지합니다.
