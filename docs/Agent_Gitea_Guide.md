# 외부 에이전트(AI)용 원격 Gitea 연동 및 배포 가이드

본 문서는 다른 PC 환경에서 구동 중인 AI 에이전트(예: OpenCode, Antigravity 등)가 본 통합 서버의 Gitea에 접속하여 소스를 Clone하고 개발/운영 환경으로 자동 배포(Push)하기 위한 지침서입니다.

---

## 1. 사전 준비 (Prerequisites)

외부 에이전트가 동작 중인 환경(Windows/Linux)에는 반드시 `git` 클라이언트가 설치되어 있어야 하며, 시스템 `PATH`에 등록되어 있어야 합니다.

### Git 클라이언트 설치 가이드 (Client-side)
외부 환경에 Git이 설치되어 있지 않은 경우, 아래 명령어를 통해 설치할 수 있습니다.

- **Windows (PowerShell)**
  ```powershell
  # Winget을 이용한 설치 (권장)
  winget install --id Git.Git -e --source winget
  ```
- **Linux (Ubuntu/Debian)**
  ```bash
  sudo apt-get update
  sudo apt-get install -y git
  ```
- **Linux (CentOS/RHEL)**
  ```bash
  sudo yum install -y git
  ```
### Gitea 서버 접속 정보
- **저장소 URL**: `http://10.147.147.145:3000/PMO/pmotools.git`
  - *(참고: IP 주소는 인트라넷 IP를 사용하거나, 사내 DNS가 할당된 도메인을 사용하십시오.)*
- **접속 계정 (Agent 전용)**: `pmoadmin` / `adminadmin`
  - *(보안 상 Agent 전용 계정 발급이 필요할 경우, Gitea 관리자 페이지에서 신규 계정을 생성 후 사용)*

---

## 2. Agent 작업 워크플로우 (Workflow)

외부 에이전트가 코드를 수정하고 배포하는 표준 절차입니다.
명령어 실행 시, 인증 프롬프트 대기(Hanging)를 방지하기 위해 URL에 직접 자격 증명(Credentials)을 포함시키는 방식을 권장합니다.

### Step 1. 저장소 클론 (Clone)
```bash
git clone http://pmoadmin:adminadmin@10.147.147.145:3000/PMO/pmotools.git
cd pmotools
```

### Step 2. 브랜치 전환 및 로컬 작업 (Checkout & Edit)
> [!IMPORTANT]
> - 신규 기능 개발이나 테스트 배포 목적일 경우 반드시 `develop` 브랜치를 사용하십시오.
> - 운영 환경 실 배포 목적일 경우에만 `master` 브랜치를 사용하십시오.

```bash
# 개발 서버로 배포할 경우
git checkout develop

# 운영 서버로 실 배포할 경우
git checkout master
```
(이후 에이전트의 내부 도구를 활용하여 소스 코드 수정, 파일 추가 등 수행)

### Step 3. 커밋 및 푸시 (Commit & Push)
```bash
git add .
git commit -m "Agent: 로그인 모듈 인증 로직 수정"
git push origin develop   # (또는 master)
```

---

## 3. 브랜치 푸시 결과 (CI/CD 자동 반영)

외부 에이전트가 `git push`를 성공적으로 마치면, 이 서버(중앙 서버) 내부의 Gitea `post-receive` 훅이 트리거되어 아래와 같이 동작합니다. 에이전트는 푸시 완료 후 별도의 서버 재시작 명령을 내릴 필요가 없습니다.

1. **`push origin develop` 실행 시**:
   - 중앙 서버의 `d:\workspace\pmotools` 폴더로 코드가 덮어씌워짐.
   - 개발 서버 구동 스크립트(`start.cmd`)가 백그라운드 재시작 됨 (포트 3020 갱신).
2. **`push origin master` 실행 시**:
   - 중앙 서버의 `d:\product\pmotools` 폴더로 코드가 덮어씌워짐.
   - 의존성 설치(`npm install`) 및 프로덕션 빌드(`npm run build`) 수행.
   - 운영 서버 프로세스 재가동 (`start-prod.cmd` 호출, 포트 8080 갱신).

> [!TIP]
> 에이전트가 `git push`를 실행했을 때 터미널 출력(STDOUT/STDERR)에 `remote: DEV Deployment Triggered Successfully.` 혹은 `PROD Deployment Completed Successfully.` 메시지가 나타나는지 파싱하여 배포 성공 여부를 자가 검증할 수 있습니다.
