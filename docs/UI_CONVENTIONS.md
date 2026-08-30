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

## 타이포그래피 스케일

`app/globals.css`의 `:root`에 정의된 텍스트 스케일 변수(값은 `size/line-height`, `font` 축약형에 그대로 사용 가능):

| 변수 | 값 | 용도 |
| --- | --- | --- |
| `--text-xs` | 12px/18px | 캡션, 보조 라벨 |
| `--text-sm` | 14px/20px | 본문 보조, 버튼(sm) |
| `--text-md` | 16px/24px | 본문 기본, `panel-head h2` |
| `--text-lg` | 18px/28px | 소제목 |
| `--text-xl` | 20px/30px | 섹션 제목 |
| `--display-xs` | 24px/32px | 페이지 타이틀(`topbar h1`) |

사용 예: `font: 600 var(--text-md) var(--font-sans);`

## Shadow(elevation) 스케일

`--shadow-xs/sm/md/lg` 4단계가 `:root`(라이트)와 `[data-theme="dark"]`(다크, opacity 상향)에 각각 정의되어 있다.

- `--shadow-xs`: 카드/패널(`.panel`, `.kpi`)
- `--shadow-md`: 드롭다운/팝오버(`.attendee-suggestions` 등)
- `--shadow-lg`: 모달(`.alert-dialog`)

새 카드·드롭다운·모달 컴포넌트를 추가할 때 `box-shadow` 값을 새로 만들지 말고 이 변수 중 하나를 사용한다.

## 버튼

- 기본 변형: `.primary` / `.secondary` / `.ghost` / `.danger` / `.tertiary`(텍스트 위주, hover 시 `--accent` 배경 — 행 단위 보조 액션에 사용).
- 크기: 기본 크기 외에 `.sm`(padding 8px 12px, 14px) / `.lg`(padding 10px 16px, 16px)를 조합해 사용한다. 예: `className="button secondary sm"`.
- 로딩 상태: 버튼 텍스트를 "저장 중…" 등으로 바꿔치기하지 않는다. 대신 `data-loading` 속성을 붙이면 텍스트가 `visibility` 유지된 채 숨겨지고 중앙에 스피너가 표시되어 버튼 너비가 흔들리지 않는다. 새 화면부터 우선 적용하고, 기존 화면은 점진적으로 교체한다.
  ```tsx
  <button className="button primary" data-loading={pending || undefined}>저장</button>
  ```

## 뱃지

기본 크기 외에 `.sm`(padding 2px 8px, 12px) / `.lg`(padding 4px 12px, 14px)를 조합해 사용한다.

## 폼 에러 텍스트

`.form-error`에 `min-height: 16px`가 적용되어 있어, 에러 메시지 엘리먼트를 조건부로 마운트/언마운트하는 대신 **항상 DOM에 유지하고 빈 문자열/텍스트만 바꾸는 방식**을 쓰면 에러가 나타나도 아래 레이아웃이 밀리지 않는다. 신규 폼에서는 이 패턴을 우선 적용하고, 기존 폼은 점진적으로 전환한다.
