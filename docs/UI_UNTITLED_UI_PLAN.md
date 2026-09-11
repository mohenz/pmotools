# Untitled UI React 분석 → PMOTOOLS 반영 계획

원본 분석: `.tmp/untitled-ui-analysis.md` (세션 종료 시 사라질 수 있는 임시 위치이므로, 이 문서에 실행 가능한 형태로 요약·정리했다. 자세한 근거·수치는 원본 분석 참고).

**전제**: Untitled UI React(`github.com/untitleduico/react`, MIT)는 Tailwind CSS v4 + React Aria 기반이라 우리 스택(순수 CSS 커스텀 프로퍼티 + 서버 컴포넌트, Tailwind/React Aria 없음)과 호환되지 않는다. **코드를 그대로 옮기지 않는다** — 디자인 패턴·수치만 분석해 우리 방식(`app/globals.css`의 CSS 변수·클래스)으로 번역해서 반영한다. 실행 시 각 항목은 `docs/UI_CONVENTIONS.md`에도 규칙으로 남긴다.

## 적용 우선순위 (효과 대비 작업량 순)

### Phase 1 — 즉시 적용 (저위험, 전역 효과)

1. **버튼 `data-loading` 상태로 레이아웃 흔들림 제거**
   - 문제: 지금은 `disabled={pending===...}` + 버튼 텍스트를 "저장 중…"으로 바꿔치기 → 버튼 너비가 클릭 순간 바뀜.
   - 작업: `.button[data-loading]` CSS 추가 — 내부 텍스트는 `visibility:hidden`(공간은 유지), `::after`로 중앙에 스피너, `pointer-events:none`. 앱 전역에서 "처리 중…" 텍스트 스왑하던 곳들을 점진적으로 `data-loading` 속성으로 교체(전면 일괄 교체는 아니고, 새 화면부터 우선 적용해도 됨).
   - 대상 파일: `app/globals.css`(신규 규칙), 이후 각 스크린의 버튼 로딩 처리 코드(선택적, 점진 적용).

2. **타이포그래피 스케일을 CSS 변수로 문서화**
   - 지금은 화면마다 `font-size`를 임의로 지정 — 공식 스케일이 없음.
   - 작업: `:root`에 `--text-xs(12/18) --text-sm(14/20) --text-md(16/24) --text-lg(18/28) --text-xl(20/30) --display-xs(24/32)` 추가(값은 size/line-height). `docs/UI_CONVENTIONS.md`에 표로 남기고, 기존 `.topbar h1`(≈display-xs) `.panel-head h2`(≈text-xl) 매핑을 확인해 필요하면 정렬.
   - 대상 파일: `app/globals.css`, `docs/UI_CONVENTIONS.md`.

3. **Shadow(elevation) 스케일 도입**
   - 지금은 모달·카드마다 `box-shadow` 값을 개별로 작성.
   - 작업: `--shadow-xs/sm/md/lg` 4단계 추가(라이트), `[data-theme="dark"]`에서 opacity 2배 가량 상향(이미 `.kpi,.panel`이 다크에서 하던 방식과 동일한 접근). `xs`는 입력/카드, `md`는 드롭다운/팝오버, `lg`는 모달(`.alert-dialog`)에 적용.
   - 대상 파일: `app/globals.css`.

### Phase 2 — 컴포넌트 사이즈/변형 확장

4. **버튼 `.sm`/`.lg` 사이즈 + `.tertiary` 변형 추가**
   - 지금 버튼은 사이즈가 하나뿐이고 `.primary/.secondary/.ghost/.danger`만 있음. `.tertiary`(텍스트만, hover 시 배경)는 행 단위 보조 액션("취소" 등)에 유용.
   - 패딩 기준: sm 12/8px·text-sm, lg 16/10px·text-md(모두 radius 8px 유지, xl 사이즈는 불필요해 도입 안 함).
   - `.button.danger`는 이미 있는 "secondary-destructive" 형태 그대로 두고, 필요 시 완전 삭제 등 강한 액션용 `.button.danger.solid`(채워진 빨강)만 추가 검토.
   - 대상 파일: `app/globals.css`, `docs/UI_CONVENTIONS.md`.

5. **뱃지 `.sm`/`.lg` 사이즈 추가**
   - 패딩 기준: sm 2/8px·text-xs, lg 4/12px·text-sm. pill/사각형 구분은 지금 화면에서 안 쓰이므로 도입하지 않음(YAGNI).
   - 대상 파일: `app/globals.css`.

### Phase 3 — 폼 폴리시(작은 다듬기)

6. **폼 에러 텍스트 자리 예약으로 레이아웃 시프트 방지**
   - 지금 `.form-error`는 조건부 렌더링이라 나타날 때 아래 내용을 밀어냄.
   - 작업: 에러 텍스트가 들어갈 자리에 `min-height`(예: 16px) 예약, 또는 hint/error 텍스트를 같은 DOM 위치에서 색만 바꾸는 방식으로 전환.
   - 대상 파일: `app/globals.css`, 폼이 있는 개별 스크린(선택적).

7. **`text-tertiary`/placeholder 전용 색상 한 단계 추가**
   - `--muted-foreground` 다음 단계(placeholder, 타임스탬프 등 더 옅은 텍스트)가 없음.
   - **선행 조건**: 구체적으로 필요한 화면이 나올 때 추가 — 지금 당장 선제적으로 넣지 않는다(원본 분석의 명시적 권고).

### Phase 4 — 필요 시에만 (지금은 스킵)

8. **탭(Tabs) `.underline` 컴포넌트** — 지금은 탭이 전혀 없음(사이드바 서브내비/`.view-toggle`로 대체 중). WBS 상세의 "기본정보/역할별진척/이력"처럼 실제로 탭이 필요한 화면이 나오면 그때 아래 스켈레톤으로 시작:
   ```css
   .tabs { display: flex; gap: 12px; border-bottom: 1px solid var(--border); }
   .tabs a { padding: 0 2px 10px; border-bottom: 2px solid transparent; color: var(--muted-foreground); font-size: 14px; font-weight: 600; }
   .tabs a.active { border-color: var(--primary); color: var(--foreground); }
   ```
9. **툴팁 컴포넌트** — 필요 화면 나오기 전까지 스킵.
10. **정렬 가능한 테이블 헤더, dot/line 페이지네이션** — 지금 화면 어디에도 해당 없음, 선제 구현 안 함.

## 변경 없이 확인만 하고 넘어간 항목 (원본 분석에서 "이미 충분함"으로 결론)

- 인풋 포커스/에러 링 처리(border+shadow 방식) — 기능적으로 동등, 리팩터링 불필요.
- 테이블/페이지네이션 전체 구조(`.panel`+`.panel-head`, `.pagination`) — 이미 동등한 패턴.
- 모달 구조(`.alert-dialog`) — 이미 동등, radius/shadow만 Phase 1의 `--shadow-lg`로 다듬으면 충분.
- 라벨 위치, required 표기 방식 — 이미 동일한 컨벤션 사용 중.

## 실행 체크리스트

- [x] Phase 1-1: `.button[data-loading]` CSS 추가 (2026-08-30, `app/globals.css`)
- [x] Phase 1-2: 타이포그래피 스케일 변수 + 문서화 (`.topbar h1`→`--display-xs`, `.panel-head h2`→`--text-md`로 정렬)
- [x] Phase 1-3: Shadow 스케일 변수 + 다크모드 대응 + `.panel`/`.kpi`(xs)·`.attendee-suggestions`(md)·`.alert-dialog`(lg) 적용
- [x] Phase 2-4: 버튼 sm/lg + tertiary
- [x] Phase 2-5: 뱃지 sm/lg
- [x] Phase 3-6: 폼 에러 텍스트 레이아웃 시프트 방지 (`.form-error { min-height: 16px }`)
- [ ] Phase 3-7: (필요 화면 생길 때) text-tertiary 색상 단계 — 아직 필요 화면 없음, 보류 유지
- [x] `docs/UI_CONVENTIONS.md`에 최종 반영된 항목 반영
- [ ] 적용 후 `tsc --noEmit` + Vitest/Jest/Playwright + 브라우저 라이트·다크 모드 확인 — 이번 변경은 순수 스타일(CSS)만이라 governance 규칙상 3단계 검증 면제 대상. 브레이스 균형만 스크립트로 확인함(정상). 실제 화면에서 라이트/다크 모드 육안 확인은 아직 미실시.
