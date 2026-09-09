# Gemini CLI Git Agent 워크플로우

Gemini CLI(`@google/gemini-cli`)가 이 저장소의 git `pull → 작업 → commit → push`를
대신 수행하도록 만든 GitHub Actions 워크플로우입니다.
정의 파일: `.github/workflows/gemini-git-agent.yml`

## 동작 방식

1. `base_branch`(기본값 `main`)를 checkout하고 `git pull --ff-only`로 최신화합니다.
2. `gemini/agent-run-<run_id>` 라는 전용 작업 브랜치를 새로 만듭니다.
3. Gemini CLI를 `--yolo`(승인 프롬프트 없는 비대화형 모드)로 실행해 `task` 입력값에
   적힌 작업을 수행시킵니다. 이 단계에서는 코드/문서 수정만 하고 git 명령은 실행하지
   않도록 프롬프트로 명시합니다.
4. 변경 사항이 있으면 `git add -A` 후, staged diff를 Gemini CLI에 다시 넘겨
   Conventional Commits 형식의 커밋 메시지를 생성하고 커밋합니다.
5. 작업 브랜치를 push하고, `base_branch`로 향하는 PR을 자동 생성합니다.
6. 변경 사항이 없으면 커밋/푸시/PR 생성을 모두 건너뜁니다.

## 권한 정책 (중요)

- **보호 브랜치(main 등)에는 절대 직접 push하지 않습니다.** 항상 `gemini/*` 브랜치에서
  작업 후 PR을 통해서만 반영되며, 병합은 사람이 리뷰 후 수행합니다.
- 워크플로우 `permissions`는 `contents: write`, `pull-requests: write`로 최소화했고,
  기본 `GITHUB_TOKEN`만 사용합니다(별도 PAT 불필요).
- `workflow_dispatch`는 저장소에 write 권한이 있는 사람만 실행할 수 있습니다(GitHub 기본 정책).
- main 브랜치에 브랜치 보호 규칙(PR 필수, 리뷰 승인 필수)이 걸려 있다면 이 워크플로우가
  생성한 PR도 동일하게 적용됩니다.

## 사전 준비

리포지토리 Settings → Secrets and variables → Actions에 다음을 등록하세요.

| Secret | 설명 |
| --- | --- |
| `GEMINI_API_KEY` | Google AI Studio에서 발급한 Gemini API 키 |

## 실행 방법

1. GitHub 저장소 → Actions 탭 → `Gemini CLI Git Agent` 워크플로우 선택
2. `Run workflow` 클릭
3. `task`에 수행할 작업을 자연어로 입력 (예: "README의 오탈자를 찾아 수정해줘")
4. `base_branch`는 필요 시 변경 (기본 `main`)
5. 실행 완료 후 생성된 PR(`gemini/agent-run-<run_id>` → base_branch)을 리뷰 후 머지

## 제한 사항 / 향후 개선 여지

- 현재는 `workflow_dispatch` 수동 트리거만 지원합니다. 이슈 코멘트(`/gemini ...`)나
  스케줄 트리거로 확장하려면 별도 `on:` 조건과 코멘트 파싱 스텝이 필요합니다.
- Gemini CLI가 생성한 커밋 메시지는 자동 파싱하므로, 모델 출력 형식이 크게 바뀌면
  fallback 메시지(`chore: gemini cli automated change (run <id>)`)로 대체됩니다.
- 대규모 변경이나 민감한 파일(스키마 마이그레이션, 인증 로직 등)에는 사용을 권장하지
  않습니다. 사람이 직접 diff를 확인하기 전까지는 머지하지 마세요.
