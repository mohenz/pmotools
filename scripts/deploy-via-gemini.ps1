<#
  배포 워크플로우: git commit/push/pull 은 Gemini CLI 에이전트에 위임하고,
  사전검증과 사후검증은 이 스크립트가 직접(위임 없이) 수행한다.

  사용법:
    npm run deploy -- -Message "feat: ..."
    powershell -ExecutionPolicy Bypass -File scripts/deploy-via-gemini.ps1 -Message "fix: ..." -PullOnly
#>
param(
  [string]$Message,
  [string]$Branch = 'main',
  [switch]$PullOnly,
  [switch]$SkipHealth,
  [int]$HealthTimeoutSec = 240,
  [string]$HealthUrl = 'https://pmotools.vercel.app/api/health'
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Step($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Fail($t) { Write-Host "`nDEPLOY ABORT: $t" -ForegroundColor Red; exit 1 }
function Ok($t)   { Write-Host "  OK   $t" -ForegroundColor Green }

if (-not $PullOnly -and -not $Message) { Fail '-Message (커밋 메시지) 필요. pull 만 하려면 -PullOnly.' }

# ---------- 1. 사전검증 (스크립트 직접 수행) ----------
Step '1. 사전검증'
$branchNow = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branchNow -ne $Branch) { Fail "현재 브랜치 '$branchNow' 가 배포 브랜치 '$Branch' 와 다름" }
git fetch origin $Branch --quiet
if (-not $?) { Fail 'git fetch 실패 (원격/네트워크 확인)' }

$headBefore   = (git rev-parse HEAD).Trim()
$remoteBefore = (git rev-parse "origin/$Branch").Trim()
$dirty        = @(git status --porcelain)
$counts       = ((git rev-list --left-right --count "origin/$Branch...HEAD").Trim() -split '\s+')
$behind       = [int]$counts[0]
$ahead        = [int]$counts[1]

Write-Host "  branch=$branchNow  HEAD=$($headBefore.Substring(0,7))  ahead=$ahead  behind=$behind  dirty=$($dirty.Count)"
if ($dirty.Count -gt 0) { $dirty | ForEach-Object { Write-Host "    $_" } }
if (-not $PullOnly -and $dirty.Count -eq 0 -and $ahead -eq 0 -and $behind -eq 0) {
  Write-Host '커밋/푸시/풀 할 것이 없음. 종료.' -ForegroundColor Yellow; exit 0
}

# ---------- 2. Gemini 에이전트에 git 작업 지시 ----------
Step '2. Gemini CLI 에 git 작업 위임'
$task = if ($PullOnly) { "origin/$Branch 를 로컬로 가져오는 것만 수행한다. commit/push 는 하지 않는다." }
        else { "작업트리의 모든 변경을 커밋하고 origin/$Branch 로 push 한다." }

$prompt = @"
너는 이 저장소($((Get-Location).Path))의 git 작업만 담당하는 에이전트다. 아래를 정확히 순서대로 수행하라.

목표: $task
커밋 메시지(있다면 정확히 이 문자열을 그대로 사용): $Message

수행 절차:
1) git status --porcelain 으로 현재 상태를 확인한다.
2) (PullOnly=$PullOnly 가 False 이고 변경이 있는 경우에만) git add -A 후 위 커밋 메시지로 git commit 한다.
3) git pull --rebase origin $Branch 를 실행한다. 충돌이 나면 즉시 중단하고 충돌 파일 목록을 보고한다. 충돌을 임의로 해결하지 마라.
4) (PullOnly=$PullOnly 가 False 인 경우에만) git push origin $Branch 를 실행한다.
5) 마지막에 git status --porcelain, git log --oneline -3, git rev-parse HEAD origin/$Branch 결과를 그대로 출력한다.

절대 금지:
- git push --force / --force-with-lease, git reset --hard, git rebase -i, 브랜치 변경/생성/삭제, 태그 조작
- 커밋 메시지 임의 변경, 소스 파일 수정, .env 등 비밀 파일을 새로 stage 하는 행위
- 실패한 명령을 원인 분석 없이 반복 실행
오류가 나면 그 자리에서 멈추고 원본 오류 메시지를 그대로 보고하라.
"@

gemini --approval-mode yolo --skip-trust -o text -p $prompt | Tee-Object -Variable geminiOut
$geminiExit = $LASTEXITCODE
Write-Host "  (gemini exit code: $geminiExit)"

# ---------- 3. 사후검증 (Gemini 보고를 신뢰하지 않고 직접 확인) ----------
Step '3. 사후검증 (독립 확인)'
git fetch origin $Branch --quiet
$headAfter   = (git rev-parse HEAD).Trim()
$remoteAfter = (git rev-parse "origin/$Branch").Trim()
$dirtyAfter  = @(git status --porcelain)
$countsAfter = ((git rev-list --left-right --count "origin/$Branch...HEAD").Trim() -split '\s+')

git merge-base --is-ancestor $remoteBefore $remoteAfter
if ($LASTEXITCODE -ne 0) { Fail "원격 히스토리가 재작성됨(force push 의심): $($remoteBefore.Substring(0,7)) -> $($remoteAfter.Substring(0,7))" }
Ok '원격 히스토리 선형 유지 (force push 없음)'

if ($dirtyAfter.Count -ne 0) {
  $dirtyAfter | ForEach-Object { Write-Host "    $_" }
  Fail "작업트리가 깨끗하지 않음 (미커밋 $($dirtyAfter.Count)건)"
}
Ok '작업트리 clean'

if ([int]$countsAfter[0] -ne 0 -or [int]$countsAfter[1] -ne 0) {
  Fail "로컬/원격 불일치 (behind=$($countsAfter[0]), ahead=$($countsAfter[1]))"
}
Ok "로컬 $Branch == origin/$Branch ($($headAfter.Substring(0,7)))"

if (-not $PullOnly) {
  if ($headAfter -eq $headBefore -and $ahead -eq 0) { Fail '새 커밋이 만들어지지 않음 (Gemini 위임 실패)' }
  $subject = (git log -1 --pretty=%s).Trim()
  if ($Message -and $subject -ne $Message.Split("`n")[0].Trim()) {
    Write-Host "  WARN 커밋 제목이 지시와 다름: '$subject'" -ForegroundColor Yellow
  } else { Ok "커밋 메시지 일치: $subject" }
}
git log --oneline "$headBefore..$headAfter" | ForEach-Object { Write-Host "    $_" }

# ---------- 4. 운영 확인 (Vercel 자동배포) ----------
if (-not $PullOnly -and -not $SkipHealth) {
  Step "4. 운영 헬스체크 ($HealthUrl)"
  $deadline = (Get-Date).AddSeconds($HealthTimeoutSec)
  $healthy = $false
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri "$HealthUrl?t=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" -UseBasicParsing -TimeoutSec 15
      if ($r.StatusCode -eq 200) { $healthy = $true; break }
    } catch { }
    Start-Sleep -Seconds 15
  }
  if (-not $healthy) { Fail "헬스체크 200 미확인 (${HealthTimeoutSec}s). Vercel 배포 로그 확인 필요 — 배포 완료로 보고하지 말 것." }
  Ok '운영 /api/health 200'
}

Write-Host "`nDEPLOY OK  $($headBefore.Substring(0,7)) -> $($headAfter.Substring(0,7))" -ForegroundColor Green
