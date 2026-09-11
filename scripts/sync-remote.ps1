# Session-start safe git sync: pulls new commits from origin/main into the local
# working copy without ever discarding uncommitted local work. Fast-forward only;
# any conflict or divergence is reported instead of resolved automatically.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Write-HookResult {
    param([string]$Message, [switch]$NotifyClaude)
    $obj = [ordered]@{ systemMessage = $Message }
    if ($NotifyClaude) {
        $obj.hookSpecificOutput = [ordered]@{
            hookEventName    = 'SessionStart'
            additionalContext = $Message
        }
    }
    Write-Output ($obj | ConvertTo-Json -Compress)
}

try {
    $branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
    if ($branch -ne 'main') {
        Write-HookResult "[remote-sync] 현재 브랜치가 main이 아니라(${branch}) 자동 동기화를 건너뜁니다."
        exit 0
    }

    git fetch origin main --quiet 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-HookResult "[remote-sync] git fetch 실패 - 네트워크/원격 상태 확인이 필요합니다."
        exit 0
    }

    $behind = [int](git rev-list --count HEAD..origin/main)
    if ($behind -eq 0) {
        Write-HookResult "[remote-sync] 이미 origin/main과 동일합니다."
        exit 0
    }

    $statusPorcelain = git status --porcelain
    $dirty = -not [string]::IsNullOrWhiteSpace(($statusPorcelain -join ''))
    $stashLabel = "auto-sync-$(Get-Date -Format yyyyMMdd-HHmmss)"

    if ($dirty) {
        git stash push -u -m $stashLabel *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-HookResult "[remote-sync] 로컬 변경사항 stash에 실패해 자동 동기화를 중단했습니다. 수동으로 확인해주세요." -NotifyClaude
            exit 0
        }
    }

    git pull --ff-only origin main *> $null
    $pullOk = ($LASTEXITCODE -eq 0)

    if (-not $pullOk) {
        if ($dirty) {
            git stash pop *> $null
        }
        Write-HookResult "[remote-sync] origin/main에 새 커밋 ${behind}개가 있지만 fast-forward pull이 불가능합니다(로컬이 원격과 분기됨). 자동 병합은 하지 않았습니다 - 수동 확인이 필요합니다." -NotifyClaude
        exit 0
    }

    if ($dirty) {
        git stash pop *> $null
        $popOk = ($LASTEXITCODE -eq 0)
        if ($popOk) {
            Write-HookResult "[remote-sync] origin/main의 새 커밋 ${behind}개를 자동으로 pull했습니다. 로컬 미커밋 변경사항은 그대로 유지됩니다." -NotifyClaude
        }
        else {
            git reset --hard HEAD *> $null
            Write-HookResult "[remote-sync] 새 커밋 ${behind}개는 pull했지만, 로컬 미커밋 변경사항과 충돌이 발생했습니다. 변경사항은 잃지 않고 stash에 안전하게 보관했습니다 - 'git stash pop'으로 직접 해결해주세요 (stash: $stashLabel)." -NotifyClaude
        }
    }
    else {
        Write-HookResult "[remote-sync] origin/main의 새 커밋 ${behind}개를 자동으로 pull했습니다." -NotifyClaude
    }
    exit 0
}
catch {
    Write-HookResult "[remote-sync] 스크립트 오류로 자동 동기화를 건너뛰었습니다: $($_.Exception.Message)"
    exit 0
}
