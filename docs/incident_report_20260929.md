# Incident Report & Preventative Measures (2026-09-29)

## 1. 개요 (Overview)
- **발생 일시**: 2026-09-29
- **장애 내용**: `pmotools` 로컬 개발 서버(`npm run dev`) 구동 실패 및 PostgreSQL 미기동.
- **영향도 (Impact)**: 개발 환경 진입 불가로 인한 생산성 저하 (Cost of Delay).

## 2. 근본 원인 분석 (Root Cause)
1. **의존성(Dependencies) 유실**:
   - `node_modules` 내 실행 가능한 바이너리(`next` 등)가 존재하지 않거나 손상됨.
   - 구동 스크립트(`start.cmd`)에 무결성 검증 로직이 부재하여, 환경 훼손 상태에서도 무조건 서비스 기동을 시도함.
2. **DB 사전 기동 검증 미흡**:
   - 로컬 DB 프로세스 기동 실패에 대한 명시적 오류 알림이 부족함.

## 3. 조치 내역 (Actions Taken)
1. `npm install` 실행을 통해 패키지 의존성 및 Prisma Client(`prisma generate`) 정상 복구 완료.
2. `npm run db:local:start` 수동 기동을 통해 55432 포트 바인딩 확보.
3. `npm run dev` 구동 확인 (포트 3020 정상 바인딩).

## 4. 재발 방지 대책 (Preventative Measures)
1. **`start.cmd` 스크립트 통제 강화**:
   - 서비스 구동 전 `node_modules` 폴더의 존재 유무를 확인하도록 검증(Validation) 로직 추가.
   - 유실 감지 시, `call npm install`을 통한 **자동 복구(Auto-recovery)** 기능 내장.
   - 이를 통해 개발자가 개별적으로 의존성을 관리하지 않아도 일관된 환경 보장.

## 5. 결론 (Conclusion)
시스템 아키텍처나 코드 결함이 아닌, 로컬 환경 구성 요소의 손실에 기인한 장애입니다. 구동 스크립트 수준의 방어 로직(Defensive Scripting)을 적용하여 동종 장애의 재발 가능성을 차단했습니다.
