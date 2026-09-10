# 배포 워크플로우 — git 작업 Gemini CLI 위임

git `pull` / `commit` / `push` 는 Gemini CLI 에이전트가 수행하고,
사전검증·사후검증은 `scripts/deploy-via-gemini.ps1` 이 직접 수행한다.
**Gemini 의 "성공했습니다" 보고는 판정 근거로 쓰지 않는다.**

## 실행

```powershell
npm run deploy -- -Message "feat: 배포 메시지"
npm run deploy -- -PullOnly                 # 원격만 당겨오기
npm run deploy -- -Message "..." -SkipHealth # 운영 헬스체크 생략
```

## 단계

| 단계 | 수행 주체 | 내용 |
|---|---|---|
| 1. 사전검증 | 스크립트 | 브랜치 확인(main), `git fetch`, HEAD/ahead/behind/dirty 스냅샷. 변경 없으면 종료 |
| 2. git 작업 | **Gemini CLI** | `gemini --approval-mode yolo -p <지시문>` — add -A → commit → pull --rebase → push |
| 3. 사후검증 | 스크립트 | force push 여부, 작업트리 clean, `local main == origin/main`, 새 커밋 생성 및 메시지 일치 |
| 4. 운영 확인 | 스크립트 | Vercel 자동배포 후 `https://pmotools.vercel.app/api/health` 200 폴링(최대 240s) |

어느 단계든 실패하면 `DEPLOY ABORT` 로 즉시 중단하고 exit 1. 같은 명령을 반복하지 않는다.

## Gemini 에게 금지시킨 것

force push, `reset --hard`, 브랜치/태그 조작, 커밋 메시지 임의 변경, 소스 파일 수정,
`.env` 신규 stage, 실패 명령 반복. 3단계 검증이 위반을 사후에 잡아낸다.

## 전제

- `gemini` CLI 설치·로그인 완료 (`gemini --version`)
- 배포 대상: GitHub `mohenz/pmotools` main → Vercel `mohenzs-projects/pmotools`
- 배포 전 검증(`npm run lint` / `test` / `build`)은 이 스크립트에 포함되지 않는다. 별도로 먼저 돌린다.
