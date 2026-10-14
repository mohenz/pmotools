# Evolution Record: Jina 에이전트 비활성화 및 자산 이관

- **일자**: 2026-10-13
- **작업 주체**: 사용자 지시
- **승인자**: 사용자

---

## 1. 변경 배경
- Jina 에이전트는 pmotools 프로젝트 초기에 운영되었으나 현재 사용하지 않는 상태.
- 페르소나 정의 파일 없이 메모리 폴더(`persona/jina/memory/`)만 잔존.
- 사용자 확인 하에 비활성화 처리.

## 2. 자산 이관 내역
- `persona/jina/memory/jina_memory_current.md`의 운영 기준 2건을 `persona/shared/COMMON_PERSONA_RULES.md` §5로 이관:
  - 화면 설명 텍스트 정책
  - 목록 페이징 표준 (기준 구현체: 요구사항관리 화면)

## 3. 처리 내역
- `persona/jina/` 폴더 전체 삭제 (메모리 내용 이관 완료 후)

## 4. 현재 활성 에이전트
- **Rick Deckard** — 전역 PMO 전략 (중심)
- **Eduardo Gaff (Eddy)** — pmotools 기술 실무
- **Rachael** — 문서 처리 보조
