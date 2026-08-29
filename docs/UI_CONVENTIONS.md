# UI 구성 표준 (조회 목록 화면)

프로젝트 전반의 목록(리스트) 화면 레이아웃 표준입니다. 신규 목록 화면을 만들거나 기존 화면을 정리할 때 이 문서를 기준으로 삼습니다.

## 목록 화면 구조

```
<header className="topbar">          ← 제목 + 총 건수만. 액션 버튼 없음.
<div className="content">
  <section className="panel compact">
    <form className="filters ..." method="get">   ← 검색/필터 입력 + 조회 버튼 + (필요 시 초기화) + 신규 등록 버튼
  <section className="panel compact">  ← 목록 테이블
  <nav className="pagination">         ← 페이지네이션
```

### 핵심 규칙

1. **`topbar`에는 페이지 제목과 총 건수만 둔다.** "+ 신규 등록" 같은 주요 액션 버튼을 `topbar-actions`에 넣지 않는다. (예외: `/management-tasks`의 "대시보드" 이동처럼 신규 생성이 아닌 화면 전환 버튼은 topbar에 둘 수 있음)
2. **주요 생성 액션("+ 신규 등록" 등)은 검색/필터 폼(`form.filters`) 안, 맨 마지막 요소로 배치한다.**
   - 클래스: `className="button primary filter-primary-action"`
   - `filter-primary-action`에는 `margin-left: auto`가 적용되어 있어 폼 안에서 자동으로 우측 끝에 정렬된다 (`app/globals.css`).
3. 폼 안의 버튼 순서: 입력 필드들 → `조회`(`button secondary`) → (있다면) `초기화`(`button ghost`) → 신규 등록(`button primary filter-primary-action`).

### 참조 구현

- `screens/RequirementListScreen.tsx`
- `screens/ManagementTaskListScreen.tsx`
- `screens/PmoDailyListScreen.tsx`
- `screens/ItemListScreen.tsx`
- `screens/AnnouncementListScreen.tsx`
- `screens/WbsListScreen.tsx` (2026-08-30에 이 표준에 맞춰 topbar → 검색 패널로 버튼 이동)

권한에 따라 버튼을 숨겨야 하면 `{isManager && <Link ... />}`처럼 조건부로 감싼다 (예: `RequirementListScreen`).

## 목록 테이블 행 클릭 → 상세 이동

목록 테이블의 각 행은 셀 안의 링크뿐 아니라 **행 전체를 클릭해도** 상세 화면으로 이동해야 한다.

- 공용 컴포넌트 `components/ClickableTableRow.tsx`를 사용한다. 직접 `onClick` 핸들러를 `<tr>`에 붙이지 않는다.
- 사용법: `<tbody>`의 `<tr>`을 `<ClickableTableRow href={...} ariaLabel={...}>`로 교체하고, 자식 `<td>`는 그대로 둔다.
  ```tsx
  <ClickableTableRow href={`/wbs/${item.id}`} ariaLabel={`${item.name} WBS 상세보기`} key={item.id}>
    <td>...</td>
  </ClickableTableRow>
  ```
- `ariaLabel`은 `"{식별자/제목} {화면명} 상세보기"` 형태로 작성한다 (예: `"${row.displayId} 업무일지 상세보기"`).
- `ClickableTableRow`는 클릭된 대상이 `a, button, input, select, textarea, label`이면 행 이동을 무시하므로, 셀 안에 있는 기존 `<Link className="table-link">`(ID/제목 컬럼)는 그대로 유지해도 충돌하지 않는다.
- 키보드 접근성(Enter/Space로 이동, `role="link"`, `tabIndex={0}`)과 포커스 스타일(`.clickable-table-row:focus-visible`)은 컴포넌트가 처리하므로 추가 작업이 필요 없다.

### 참조 구현

- `components/ClickableTableRow.tsx`
- `screens/WorkLogListScreen.tsx`
- `screens/WorkLogManagementScreen.tsx`
- `screens/WbsListScreen.tsx` (2026-08-30에 이 표준 적용)

새 목록 화면을 만들거나 기존 화면에 상세 이동 기능을 추가할 때는 새 클릭 핸들러를 작성하지 말고 항상 `ClickableTableRow`를 재사용한다.
