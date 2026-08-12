-- ============================================================
-- 회의실 예약 시스템 - PostgreSQL DDL
-- 대상: Supabase (PostgreSQL 15+)
-- ============================================================

-- 시간대 범위 중복(EXCLUDE) 제약을 위해 필요
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 1. rooms : 회의실 마스터
-- ------------------------------------------------------------
CREATE TYPE room_type_enum AS ENUM ('LARGE', 'SMALL');

CREATE TABLE rooms (
    room_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         VARCHAR(50) NOT NULL UNIQUE,
    room_type    room_type_enum NOT NULL,
    capacity     INT NOT NULL CHECK (capacity > 0),
    floor        VARCHAR(20),
    equipment    TEXT[] DEFAULT '{}',
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE rooms IS '회의실 마스터 (대회의실 1 + 소회의실 5)';

-- 초기 데이터
INSERT INTO rooms (name, room_type, capacity, floor) VALUES
    ('대회의실',   'LARGE', 20, '3F'),
    ('소회의실 A', 'SMALL', 6,  '3F'),
    ('소회의실 B', 'SMALL', 6,  '3F'),
    ('소회의실 C', 'SMALL', 6,  '4F'),
    ('소회의실 D', 'SMALL', 6,  '4F'),
    ('소회의실 E', 'SMALL', 6,  '4F');

-- ------------------------------------------------------------
-- 2. users : 회원 (일반 사용자 + 관리자 통합, 가입/로그인 기반)
-- ------------------------------------------------------------
CREATE TYPE user_role_enum AS ENUM ('USER', 'ADMIN');
CREATE TYPE user_status_enum AS ENUM ('ACTIVE', 'INACTIVE');

-- 개인정보 최소화 원칙:
--  - 이메일은 수집하지 않는다 (인증은 자체 발급 login_id + 비밀번호로 처리).
--  - contact(연락처)는 선택 입력이며, 필수 식별 정보로 사용하지 않는다.
--  - 비밀번호 분실 시 이메일 기반 재설정 대신, 관리자가 users.password_hash를 초기화하는 절차로 대체한다.
CREATE TABLE users (
    user_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    login_id       VARCHAR(50) NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    company_name   VARCHAR(100) NOT NULL,
    name           VARCHAR(50) NOT NULL,
    contact        VARCHAR(30),                 -- NULL 허용 (선택 입력)
    role           user_role_enum NOT NULL DEFAULT 'USER',
    status         user_status_enum NOT NULL DEFAULT 'ACTIVE',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS '가입 회원. role=ADMIN 인 사용자만 고정예약 승인/마스터데이터 관리 권한을 가짐. 이메일 미수집.';

-- login_id 형식 검증 (프론트엔드 검증과 동일 규칙을 DB에도 이중 적용):
--  (A) 영문+숫자 조합, 6자 이상   예: hyunwoo01
--  (B) 숫자로만 구성된 6자리      예: 012345 (사번 등, VARCHAR라 앞자리 0도 보존됨)
ALTER TABLE users
ADD CONSTRAINT login_id_format CHECK (
    login_id ~ '^[0-9]{6}$'
    OR (
        login_id ~ '^[A-Za-z0-9]{6,}$' AND
        login_id ~ '[A-Za-z]' AND
        login_id ~ '[0-9]'
    )
);

-- 초기 관리자 계정 (비밀번호는 애플리케이션에서 해시 후 저장)
-- INSERT INTO users (login_id, password_hash, company_name, name, role)
-- VALUES ('admin', '<bcrypt-hash>', '그룹PMO', '시스템관리자', 'ADMIN');

-- ------------------------------------------------------------
-- 3. recurring_reservations : 고정(정기) 예약 신청
-- ------------------------------------------------------------
CREATE TYPE recurring_pattern_enum AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE approval_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE recurring_reservations (
    recurring_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id            UUID NOT NULL REFERENCES rooms(room_id),
    pattern_type       recurring_pattern_enum NOT NULL,
    pattern_detail     JSONB NOT NULL,          -- 예: {"days_of_week":[1,3,5]} 또는 {"day_of_month":15}
    start_time         TIME NOT NULL,
    end_time           TIME NOT NULL CHECK (end_time > start_time),
    period_start       DATE NOT NULL,
    period_end         DATE NOT NULL CHECK (period_end >= period_start),
    purpose            TEXT NOT NULL,
    applicant_id       UUID NOT NULL REFERENCES users(user_id),  -- 신청자 (company/name은 users 테이블에서 조인)
    approval_status    approval_status_enum NOT NULL DEFAULT 'PENDING',
    approved_by        UUID REFERENCES users(user_id),           -- 승인 처리한 관리자
    approved_at        TIMESTAMPTZ,
    reject_reason      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE recurring_reservations IS '고정예약 신청 원본 (승인 시 reservations에 개별 인스턴스 생성)';

-- ------------------------------------------------------------
-- 4. reservations : 개별 예약 (단건 + 고정예약 파생 인스턴스)
-- ------------------------------------------------------------
CREATE TYPE reservation_status_enum AS ENUM ('CONFIRMED', 'CANCELLED');

CREATE TABLE reservations (
    reservation_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id          UUID NOT NULL REFERENCES rooms(room_id),
    start_datetime   TIMESTAMPTZ NOT NULL,
    end_datetime     TIMESTAMPTZ NOT NULL CHECK (end_datetime > start_datetime),
    user_id          UUID NOT NULL REFERENCES users(user_id),   -- 예약자 (company/name은 users에서 조인)
    purpose          TEXT NOT NULL,
    status           reservation_status_enum NOT NULL DEFAULT 'CONFIRMED',
    recurring_id     UUID REFERENCES recurring_reservations(recurring_id), -- NULL이면 단건 예약
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 핵심: 동일 회의실 + 시간 중복 방지 (CONFIRMED 상태만 대상)
ALTER TABLE reservations
ADD CONSTRAINT no_overlapping_reservations
EXCLUDE USING GIST (
    room_id WITH =,
    tstzrange(start_datetime, end_datetime) WITH &&
) WHERE (status = 'CONFIRMED');

CREATE INDEX idx_reservations_room_date
    ON reservations (room_id, start_datetime)
    WHERE status = 'CONFIRMED';

CREATE INDEX idx_reservations_recurring
    ON reservations (recurring_id);

-- ------------------------------------------------------------
-- 5. reservation_change_logs : 변경 이력 (취소/연장/단축)
-- ------------------------------------------------------------
CREATE TYPE change_action_enum AS ENUM ('CREATE', 'CANCEL', 'EXTEND', 'SHORTEN');

CREATE TABLE reservation_change_logs (
    log_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id   UUID NOT NULL REFERENCES reservations(reservation_id),
    action           change_action_enum NOT NULL,
    before_start     TIMESTAMPTZ,
    before_end       TIMESTAMPTZ,
    after_start      TIMESTAMPTZ,
    after_end        TIMESTAMPTZ,
    actor_name       VARCHAR(50),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 6. updated_at 자동 갱신 트리거
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservations_updated_at
BEFORE UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 7. 예시 조회 쿼리
-- ------------------------------------------------------------

-- 특정 날짜의 전체 회의실 예약현황
-- SELECT r.name, res.start_datetime, res.end_datetime, res.company_name, res.user_name, res.purpose
-- FROM reservations res
-- JOIN rooms r ON r.room_id = res.room_id
-- WHERE res.status = 'CONFIRMED'
--   AND res.start_datetime::date = '2026-08-12'
-- ORDER BY r.name, res.start_datetime;

-- 고정예약 승인 시, 인스턴스 생성 예시 (애플리케이션 레이어에서 반복 처리)
-- INSERT INTO reservations (room_id, start_datetime, end_datetime, company_name, user_name, purpose, recurring_id)
-- SELECT rr.room_id, d + rr.start_time, d + rr.end_time, rr.applicant_company, rr.applicant_name, rr.purpose, rr.recurring_id
-- FROM recurring_reservations rr, generate_series(rr.period_start, rr.period_end, interval '1 day') d
-- WHERE rr.recurring_id = :recurring_id
--   AND extract(dow from d) = ANY (SELECT jsonb_array_elements_text(rr.pattern_detail->'days_of_week')::int);
