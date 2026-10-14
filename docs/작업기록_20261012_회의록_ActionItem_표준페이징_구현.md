# 작업기록: 회의록 Action Item 목록 표준 페이징 기능 구현

- **작성일자**: 2026-10-12
- **작성자**: Rick Deckard (Strategic PMO Agent)
- **대상**: `pmotools` 회의록 Action Item 기능 (`MeetingActionItemListScreen.tsx`, `page.tsx`, `meeting-action-items.ts`)

---

## 1. 개요 및 요구사항

### 1) 배경
- 회의록 Action Item 화면(`/meeting-minutes/action-items`)은 기존에 서버 기본 50건 고정 페이징 및 단순 번호 링크만 제공하고 있어, PMOTOOLS 전역의 표준 페이징(요구사항관리·WBS·WBS상세내용 기준)과 일관성이 결여되어 있었음.
- 특히 1페이지(50건 이하)일 경우 페이징 영역이 완전히 숨겨져 표시 개수 변경 및 총 페이지 요약 정보 확인이 불가능했던 한계 개선 필요.

### 2) 표준 페이징 규격 적용 (PMOTOOLS Standard)
1. **표시 개수(Page Size) 선택 지원**:
   - 기본 20건 / 40건 / 60건 / 80건 / 100건 / 전체(`all`) 옵션 제공.
   - 드롭다운 선택 후 '적용' 버튼 클릭 시 기존 검색 필터 조건(`status`, `assignee`, `dateFrom`, `dateTo`, `q`, `mine`, `overdue`)을 hidden input으로 온전히 보존하여 폼 전송.
2. **페이지 링크 및 내비게이션**:
   - `이전` / `다음` 내비게이션 링크 제공.
   - 현재 페이지 강조(`strong.current[aria-current="page"]`) 및 최대 10개 단위 페이지 번호 버튼 노출.
3. **요약 정보**:
   - 우측에 `총 {total}건 · {page} / {totalPages} 페이지` 요약 문구 상시 노출.
4. **필터 및 KPI 카드 연동**:
   - 검색 필터 및 상단 KPI 카드(전체/대기/진행/보류/완료/기한경과) 클릭 시 페이지 번호 1로 초기화, 선택된 `pageSize` 유지.

---

## 2. 세부 구현 내역

### 1) 서버 조회 로직 보완 (`lib/server/meeting-action-items.ts`)
- `MeetingActionItemFilters` 타입에 `pageSize?: number | "all"` 반영.
- `filters.pageSize === "all"`인 경우 `take: undefined`, `pageSize: total || 1`, `totalPages: 1` 처리.
- 숫자 `pageSize` 요청 시 `[10, 100]` 범위 클램핑 (기본값 20).
- 총 건수(`total`) 변경으로 범위를 벗어난 `page` 요청 시 마지막 페이지(`totalPages`)로 안전 보정.

### 2) 라우트 파라미터 파싱 (`app/meeting-minutes/action-items/page.tsx`)
- URL 쿼리스트링에서 `pageSize`와 `page`를 파싱하여 검증된 값만 서버 함수로 전달:
  ```ts
  const pageSizeParam = params.pageSize;
  const pageSize: number | "all" = pageSizeParam === "all"
    ? "all"
    : typeof pageSizeParam === "string" && [20, 40, 60, 80, 100].includes(Number(pageSizeParam))
    ? Number(pageSizeParam)
    : 20;
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;
  ```

### 3) 화면 UI 컴포넌트 (`screens/MeetingActionItemListScreen.tsx`)
- 표준 페이징 클래스 `.pagination.requirement-pagination` 적용.
- `result.total > 0` 조건으로 변경하여 데이터가 존재하는 경우 상시 페이징 바가 안정적으로 렌더링되도록 개선.
- 검색 폼 내 `pageSize` hidden input 추가로 검색 실행 시 표시 개수 유지.
- 상단 KPI 링크 클릭 시 `page: 1` 리셋 및 `pageSize` 유지.

### 4) 단위 테스트 구축 (`lib/domain/meeting-action-pagination-ui.test.ts`)
- `renderToStaticMarkup`을 활용한 Vitest 단위 테스트 추가:
  - 표준 클래스 렌더링 검증.
  - 20/40/60/80/100/all 드롭다운 옵션 및 selected 상태 검증.
  - 활성 필터의 hidden input 보존 검증.
  - 이전/다음 링크 및 페이지 요약 문구 일치 검증.

---

## 3. 수정 및 생성 파일 내역
- [MeetingActionItemListScreen.tsx](file:///d:/workspace/pmotools/screens/MeetingActionItemListScreen.tsx): 표준 페이징 nav, page-size-form, page-links 렌더링.
- [page.tsx](file:///d:/workspace/pmotools/app/meeting-minutes/action-items/page.tsx): URL `pageSize`/`page` 파라미터 파싱 및 서버 연동.
- [meeting-action-items.ts](file:///d:/workspace/pmotools/lib/server/meeting-action-items.ts): `pageSize: number | "all"` 및 클램프 페이징 계산.
- [meeting-action-pagination-ui.test.ts](file:///d:/workspace/pmotools/lib/domain/meeting-action-pagination-ui.test.ts): 표준 페이징 UI 렌더링 단위 테스트.
