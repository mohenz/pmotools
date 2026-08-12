import React, { useState, useMemo, useCallback } from "react";
import {
  X, Clock, Building2, User, FileText, Trash2, ChevronLeft, ChevronRight,
  Search, Calendar, List, Repeat, CheckSquare, Users, LogOut, Hash, Lock,
  Phone, Plus, Check, XCircle, ToggleLeft, ToggleRight, Briefcase, KeyRound,
} from "lucide-react";

// ============================================================
// 디자인 토큰
// ============================================================
const C = {
  bg: "#F4F5F2",
  panel: "#FFFFFF",
  ink: "#1B1D22",
  muted: "#8A8D85",
  border: "#DDDFD9",
  borderLight: "#EAEBE6",
  large: "#2F6F62",
  small: "#4C5FD5",
  amber: "#C98A3B",
  danger: "#C1443C",
};

// ============================================================
// 목데이터
// ============================================================
const ROOMS_INIT = [
  { id: "r1", name: "대회의실", type: "LARGE", capacity: 20, floor: "3F", equipment: ["빔프로젝터", "화상회의"], active: true },
  { id: "r2", name: "소회의실 A", type: "SMALL", capacity: 6, floor: "3F", equipment: ["모니터"], active: true },
  { id: "r3", name: "소회의실 B", type: "SMALL", capacity: 6, floor: "3F", equipment: ["모니터"], active: true },
  { id: "r4", name: "소회의실 C", type: "SMALL", capacity: 6, floor: "4F", equipment: ["화이트보드"], active: true },
  { id: "r5", name: "소회의실 D", type: "SMALL", capacity: 6, floor: "4F", equipment: [], active: true },
  { id: "r6", name: "소회의실 E", type: "SMALL", capacity: 6, floor: "4F", equipment: ["모니터", "화상회의"], active: false },
];

// 개인정보 최소화 원칙: 이메일을 수집하지 않고, 자체 발급 로그인ID + 비밀번호로 인증한다.
// 연락처는 선택 입력이며, 회사명/이름은 예약 주체 식별을 위한 최소 필수 정보로만 사용한다.
const USERS_INIT = [
  { id: "u1", loginId: "admin", password: "admin123", name: "시스템관리자", company: "그룹PMO", contact: "", role: "ADMIN", status: "ACTIVE" },
  { id: "u2", loginId: "hyunwoo", password: "user123", name: "이현우", company: "삼정SI", contact: "010-1234-5678", role: "USER", status: "ACTIVE" },
  { id: "u3", loginId: "seoyeon", password: "user123", name: "박서연", company: "이니시스", contact: "", role: "USER", status: "ACTIVE" },
];

const DAY_START_MIN = 9 * 60, DAY_END_MIN = 19 * 60, SLOT_MIN = 30;
const SLOT_COUNT = (DAY_END_MIN - DAY_START_MIN) / SLOT_MIN;
const ROW_H = 34;
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const TIME_OPTIONS = Array.from({ length: SLOT_COUNT + 1 }, (_, i) => DAY_START_MIN + i * SLOT_MIN);
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

const RESERVATIONS_INIT = [
  { id: "a1", roomId: "r1", date: todayStr(), start: 600, end: 690, userId: "u1", purpose: "월간 운영위원회", fixed: false },
  { id: "a2", roomId: "r2", date: todayStr(), start: 570, end: 600, userId: "u3", purpose: "결제 연동 점검", fixed: false },
  { id: "a3", roomId: "r4", date: todayStr(), start: 780, end: 840, userId: "u2", purpose: "요구사항 협의", fixed: true },
];

const RECURRING_INIT = [
  {
    id: "rr1", roomId: "r2", userId: "u2", patternType: "WEEKLY", days: [1, 3, 5],
    start: 600, end: 660, periodStart: todayStr(), periodEnd: "2026-12-31",
    purpose: "주간 진척 점검 회의", status: "PENDING", rejectReason: "",
  },
];

function hasConflict(reservations, roomId, date, start, end, excludeId) {
  return reservations.some((r) => r.id !== excludeId && r.roomId === roomId && r.date === date && start < r.end && end > r.start);
}

// ============================================================
// 최상위 앱: 인증 상태에 따라 화면 스위칭
// ============================================================
export default function App() {
  const [users, setUsers] = useState(USERS_INIT);
  const [rooms, setRooms] = useState(ROOMS_INIT);
  const [reservations, setReservations] = useState(RESERVATIONS_INIT);
  const [recurring, setRecurring] = useState(RECURRING_INIT);

  const [authScreen, setAuthScreen] = useState("login"); // login | signup
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab] = useState("board");
  const [authMsg, setAuthMsg] = useState("");

  const handleLogin = (loginId, password) => {
    const u = users.find((x) => x.loginId === loginId && x.password === password);
    if (!u) return "아이디 또는 비밀번호가 일치하지 않습니다.";
    if (u.status !== "ACTIVE") return "비활성화된 계정입니다. 관리자에게 문의하세요.";
    setCurrentUser(u);
    setTab("board");
    return "";
  };

  const handleSignup = (form) => {
    if (users.some((u) => u.loginId === form.loginId)) return "이미 사용 중인 아이디입니다.";
    const nu = { id: `u${Date.now()}`, ...form, role: "USER", status: "ACTIVE" };
    setUsers((prev) => [...prev, nu]);
    setAuthScreen("login");
    setAuthMsg("가입이 완료되었습니다. 로그인해주세요.");
    return "";
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthScreen("login");
    setAuthMsg("");
  };

  if (!currentUser) {
    return authScreen === "login" ? (
      <LoginScreen onLogin={handleLogin} onGoSignup={() => { setAuthScreen("signup"); setAuthMsg(""); }} message={authMsg} />
    ) : (
      <SignupScreen onSignup={handleSignup} onGoLogin={() => { setAuthScreen("login"); setAuthMsg(""); }} />
    );
  }

  return (
    <Shell tab={tab} setTab={setTab} currentUser={currentUser} onLogout={handleLogout}>
      {tab === "board" && (
        <BoardScreen rooms={rooms} reservations={reservations} setReservations={setReservations} currentUser={currentUser} />
      )}
      {tab === "my" && (
        <MyReservationsScreen rooms={rooms} reservations={reservations} setReservations={setReservations} currentUser={currentUser} />
      )}
      {tab === "recurring" && (
        <RecurringRequestScreen rooms={rooms} recurring={recurring} setRecurring={setRecurring} currentUser={currentUser} />
      )}
      {tab === "approvals" && currentUser.role === "ADMIN" && (
        <AdminApprovalsScreen rooms={rooms} users={users} recurring={recurring} setRecurring={setRecurring} currentUser={currentUser} />
      )}
      {tab === "rooms" && currentUser.role === "ADMIN" && (
        <AdminRoomsScreen rooms={rooms} setRooms={setRooms} />
      )}
      {tab === "users" && currentUser.role === "ADMIN" && (
        <AdminUsersScreen users={users} setUsers={setUsers} currentUser={currentUser} />
      )}
    </Shell>
  );
}

// ============================================================
// 인증 화면: 로그인
// ============================================================
function LoginScreen({ onLogin, onGoSignup, message }) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const err = onLogin(loginId, password);
    setError(err);
  };

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold mb-1">로그인</h1>
      <p className="text-sm mb-6" style={{ color: C.muted }}>회의실 예약 시스템에 오신 것을 환영합니다</p>

      {message && <div className="text-xs mb-4 px-3 py-2 rounded" style={{ background: `${C.large}14`, color: C.large }}>{message}</div>}

      <form onSubmit={submit}>
        <AuthField icon={<Hash size={14} />} label="로그인 ID">
          <input value={loginId} onChange={(e) => setLoginId(e.target.value)} required
            className="w-full text-sm px-3 py-2 rounded border outline-none" style={{ borderColor: C.border }} placeholder="아이디 입력" />
        </AuthField>
        <AuthField icon={<Lock size={14} />} label="비밀번호">
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
            className="w-full text-sm px-3 py-2 rounded border outline-none" style={{ borderColor: C.border }} placeholder="••••••••" />
        </AuthField>

        {error && <div className="text-xs mb-3" style={{ color: C.danger }}>{error}</div>}

        <button type="submit" className="w-full text-sm py-2.5 rounded font-medium" style={{ background: C.ink, color: C.bg }}>
          로그인
        </button>
      </form>

      <div className="text-xs mt-3 px-3 py-2 rounded" style={{ background: C.borderLight, color: C.muted }}>
        데모 계정 — 관리자: admin / admin123 · 일반: hyunwoo / user123
      </div>

      <div className="text-sm mt-5 text-center" style={{ color: C.muted }}>
        계정이 없으신가요?{" "}
        <button onClick={onGoSignup} className="font-medium underline" style={{ color: C.ink }}>회원가입</button>
      </div>
    </AuthShell>
  );
}

// ============================================================
// 인증 화면: 회원가입
// ============================================================
function SignupScreen({ onSignup, onGoLogin }) {
  const [form, setForm] = useState({ loginId: "", password: "", passwordCheck: "", company: "", name: "", contact: "" });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const idPatternMixed = /^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{6,}$/; // 영문+숫자 조합, 6자 이상
    const idPatternDigits6 = /^[0-9]{6}$/;                                // 숫자만 6자리 (예: 012345)
    if (!(idPatternMixed.test(form.loginId) || idPatternDigits6.test(form.loginId))) {
      return setError("아이디는 영문+숫자 조합 6자 이상이거나, 숫자 6자리(예: 012345)여야 합니다.");
    }
    if (form.password.length < 6) return setError("비밀번호는 6자 이상이어야 합니다.");
    if (form.password !== form.passwordCheck) return setError("비밀번호가 일치하지 않습니다.");
    if (!form.company || !form.name) return setError("회사명과 이름을 입력해주세요.");
    const { passwordCheck, ...payload } = form;
    const err = onSignup(payload);
    if (err) setError(err);
  };

  return (
    <AuthShell wide>
      <h1 className="text-xl font-semibold mb-1">회원가입</h1>
      <p className="text-sm mb-6" style={{ color: C.muted }}>이메일 없이, 예약 확인에 필요한 최소 정보만 입력합니다</p>

      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <AuthField icon={<Hash size={14} />} label="로그인 ID">
            <input value={form.loginId} onChange={set("loginId")} required inputMode="text" className="w-full text-sm px-3 py-2 rounded border outline-none" style={{ borderColor: C.border }} placeholder="영문+숫자 조합 6자 이상 또는 숫자 6자리" />
            <div className="text-[11px] mt-1" style={{ color: C.muted }}>예: hyunwoo01 또는 012345 (숫자만 6자리도 가능)</div>
          </AuthField>
          <AuthField icon={<Briefcase size={14} />} label="회사명">
            <input value={form.company} onChange={set("company")} required className="w-full text-sm px-3 py-2 rounded border outline-none" style={{ borderColor: C.border }} placeholder="예: 삼정SI" />
          </AuthField>
          <AuthField icon={<Lock size={14} />} label="비밀번호">
            <input value={form.password} onChange={set("password")} type="password" required className="w-full text-sm px-3 py-2 rounded border outline-none" style={{ borderColor: C.border }} />
          </AuthField>
          <AuthField icon={<Lock size={14} />} label="비밀번호 확인">
            <input value={form.passwordCheck} onChange={set("passwordCheck")} type="password" required className="w-full text-sm px-3 py-2 rounded border outline-none" style={{ borderColor: C.border }} />
          </AuthField>
          <AuthField icon={<User size={14} />} label="이름">
            <input value={form.name} onChange={set("name")} required className="w-full text-sm px-3 py-2 rounded border outline-none" style={{ borderColor: C.border }} placeholder="예: 이현우" />
          </AuthField>
          <AuthField icon={<Phone size={14} />} label="연락처 (선택)">
            <input value={form.contact} onChange={set("contact")} className="w-full text-sm px-3 py-2 rounded border outline-none" style={{ borderColor: C.border }} placeholder="비상 연락용, 입력하지 않아도 됩니다" />
          </AuthField>
        </div>

        {error && <div className="text-xs mb-3 mt-1" style={{ color: C.danger }}>{error}</div>}

        <div className="text-xs mt-1 mb-3 px-3 py-2 rounded" style={{ background: C.borderLight, color: C.muted }}>
          이메일은 수집하지 않으며, 비밀번호를 잊은 경우 관리자에게 초기화를 요청해야 합니다.
        </div>

        <button type="submit" className="w-full text-sm py-2.5 rounded font-medium mt-2" style={{ background: C.ink, color: C.bg }}>
          가입하기
        </button>
      </form>

      <div className="text-sm mt-5 text-center" style={{ color: C.muted }}>
        이미 계정이 있으신가요?{" "}
        <button onClick={onGoLogin} className="font-medium underline" style={{ color: C.ink }}>로그인</button>
      </div>
    </AuthShell>
  );
}

function AuthShell({ children, wide }) {
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: C.bg, fontFamily: "Inter, system-ui, sans-serif", color: C.ink, minHeight: 560 }}>
      <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"} rounded-lg p-7`} style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-6">
          <span className="w-2 h-6 rounded-sm" style={{ background: C.large }} />
          <span className="text-sm font-semibold">회의실 예약 시스템</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function AuthField({ icon, label, children }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: C.muted }}>{icon}{label}</div>
      {children}
    </div>
  );
}

// ============================================================
// 로그인 후 공통 셸 (사이드바 네비게이션)
// ============================================================
function Shell({ tab, setTab, currentUser, onLogout, children }) {
  const isAdmin = currentUser.role === "ADMIN";
  const nav = [
    { id: "board", label: "예약현황", icon: <Calendar size={16} /> },
    { id: "my", label: "내 예약", icon: <List size={16} /> },
    { id: "recurring", label: "고정예약 신청", icon: <Repeat size={16} /> },
  ];
  const adminNav = [
    { id: "approvals", label: "고정예약 승인", icon: <CheckSquare size={16} /> },
    { id: "rooms", label: "회의실 관리", icon: <Building2 size={16} /> },
    { id: "users", label: "사용자 관리", icon: <Users size={16} /> },
  ];

  return (
    <div className="w-full h-full flex" style={{ background: C.bg, fontFamily: "Inter, system-ui, sans-serif", color: C.ink, minHeight: 640 }}>
      <aside className="flex flex-col justify-between shrink-0" style={{ width: 208, borderRight: `1px solid ${C.border}` }}>
        <div>
          <div className="flex items-center gap-2 px-4 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
            <span className="w-2 h-6 rounded-sm" style={{ background: C.large }} />
            <span className="text-sm font-semibold">예약 시스템</span>
          </div>
          <nav className="p-2">
            {nav.map((n) => <NavItem key={n.id} {...n} active={tab === n.id} onClick={() => setTab(n.id)} />)}
            {isAdmin && (
              <>
                <div className="text-[11px] font-medium px-3 pt-4 pb-1" style={{ color: C.muted }}>관리자</div>
                {adminNav.map((n) => <NavItem key={n.id} {...n} active={tab === n.id} onClick={() => setTab(n.id)} />)}
              </>
            )}
          </nav>
        </div>
        <div className="p-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 px-2 py-2 rounded mb-1" style={{ background: C.borderLight }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: isAdmin ? C.large : C.small, color: "#fff" }}>
              {currentUser.name[0]}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{currentUser.name}</div>
              <div className="text-[11px] truncate" style={{ color: C.muted }}>{currentUser.company}</div>
            </div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-1.5 text-xs px-2 py-2 rounded hover:bg-black/5" style={{ color: C.muted }}>
            <LogOut size={13} /> 로그아웃
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavItem({ label, icon, active, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 text-sm px-3 py-2 rounded mb-0.5 text-left transition-colors"
      style={{ background: active ? C.ink : "transparent", color: active ? C.bg : C.ink }}>
      {icon}{label}
    </button>
  );
}

// ============================================================
// 화면 1: 예약현황 타임테이블
// ============================================================
function BoardScreen({ rooms, reservations, setReservations, currentUser }) {
  const [date, setDate] = useState(todayStr());
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");

  const activeRooms = rooms.filter((r) => r.active);
  const visibleRooms = useMemo(() => activeRooms.filter((r) => (filter === "ALL" || r.type === filter) && (!search || r.name.toLowerCase().includes(search.toLowerCase()))), [activeRooms, filter, search]);

  const shiftDate = (d) => { const dt = new Date(date); dt.setDate(dt.getDate() + d); setDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`); };
  const dayRes = useMemo(() => reservations.filter((r) => r.date === date), [reservations, date]);
  const getResAt = useCallback((roomId, slot) => dayRes.find((r) => r.roomId === roomId && r.start === slot), [dayRes]);
  const isOccupied = useCallback((roomId, slot) => dayRes.some((r) => r.roomId === roomId && slot >= r.start && slot < r.end), [dayRes]);

  const submitCreate = (form) => {
    if (form.start >= form.end) return setError("종료 시간은 시작 시간보다 늦어야 합니다.");
    if (hasConflict(reservations, form.roomId, date, form.start, form.end)) return setError("선택한 시간에 이미 예약이 존재합니다.");
    setReservations((prev) => [...prev, { id: `res_${Date.now()}`, roomId: form.roomId, date, start: form.start, end: form.end, userId: currentUser.id, purpose: form.purpose, fixed: false }]);
    setModal(null); setError("");
  };

  return (
    <div>
      <TopBar title="예약현황">
        <DateNav date={date} shiftDate={shiftDate} setDate={setDate} />
        <FilterPills filter={filter} setFilter={setFilter} />
        <SearchBox search={search} setSearch={setSearch} placeholder="회의실명 검색" />
      </TopBar>
      <Legend />
      <div className="px-5 pb-6 overflow-auto">
        <div className="min-w-[720px]" style={{ display: "grid", gridTemplateColumns: `64px repeat(${visibleRooms.length}, minmax(120px, 1fr))` }}>
          <div className="sticky top-0 z-10" style={{ background: C.bg }} />
          {visibleRooms.map((room) => (
            <div key={room.id} className="sticky top-0 z-10 px-3 py-2 text-sm font-semibold border-b border-l" style={{ background: C.bg, borderColor: C.border }}>
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: room.type === "LARGE" ? C.large : C.small }} />{room.name}</div>
              <div className="text-[11px] font-normal mt-0.5" style={{ color: C.muted, fontFamily: "ui-monospace, monospace" }}>정원 {room.capacity}명</div>
            </div>
          ))}
          {Array.from({ length: SLOT_COUNT }, (_, i) => DAY_START_MIN + i * SLOT_MIN).map((slot) => (
            <React.Fragment key={slot}>
              <div className="text-right pr-2 border-b text-[11px]" style={{ height: ROW_H, borderColor: C.borderLight, color: slot % 60 === 0 ? C.ink : "#B7BAB2", fontFamily: "ui-monospace, monospace", fontWeight: slot % 60 === 0 ? 600 : 400 }}>
                {slot % 60 === 0 ? toHHMM(slot) : ""}
              </div>
              {visibleRooms.map((room) => {
                const res = getResAt(room.id, slot);
                if (res) {
                  const span = (res.end - res.start) / SLOT_MIN;
                  const isLarge = room.type === "LARGE";
                  const accent = isLarge ? C.large : C.small;
                  return (
                    <div key={room.id} onClick={() => setModal({ mode: "view", reservation: res })}
                      className="border-l border-b cursor-pointer px-2 py-1 text-[11px] leading-tight overflow-hidden hover:brightness-95 transition"
                      style={{ height: ROW_H * span - 2, gridRow: `span ${span}`, margin: 1, borderRadius: 4, borderColor: C.border, borderLeft: `3px solid ${accent}`,
                        background: res.fixed ? `repeating-linear-gradient(45deg, ${accent}22, ${accent}22 4px, ${accent}33 4px, ${accent}33 8px)` : `${accent}1F` }}>
                      <div className="font-semibold truncate">{res.purpose}</div>
                      <div className="truncate" style={{ color: "#5B5E56" }}>{toHHMM(res.start)}–{toHHMM(res.end)}</div>
                    </div>
                  );
                }
                if (isOccupied(room.id, slot)) return null;
                return <div key={room.id} onClick={() => setModal({ mode: "create", roomId: room.id, start: slot, end: Math.min(slot + 60, DAY_END_MIN) })} className="border-l border-b cursor-pointer hover:bg-black/[0.03] transition" style={{ height: ROW_H, borderColor: C.borderLight }} />;
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {modal?.mode === "create" && (
        <CreateModal roomName={rooms.find((r) => r.id === modal.roomId)?.name} initialStart={modal.start} initialEnd={modal.end} currentUser={currentUser} error={error}
          onClose={() => { setModal(null); setError(""); }} onSubmit={(f) => submitCreate({ ...f, roomId: modal.roomId })} />
      )}
      {modal?.mode === "view" && (
        <ReservationDetailModal reservation={modal.reservation} rooms={rooms} currentUser={currentUser} reservations={reservations} setReservations={setReservations}
          onClose={() => { setModal(null); setError(""); }} />
      )}
    </div>
  );
}

function CreateModal({ roomName, initialStart, initialEnd, currentUser, error, onClose, onSubmit }) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [purpose, setPurpose] = useState("");
  return (
    <ModalShell onClose={onClose} title="회의실 예약" accent={C.large}>
      <Field icon={<Building2 size={14} />} label="회의실"><div className="text-sm font-medium py-1.5">{roomName}</div></Field>
      <Field icon={<Clock size={14} />} label="사용 시간">
        <div className="flex items-center gap-2"><TimeSelect value={start} onChange={setStart} /><span style={{ color: C.muted }}>–</span><TimeSelect value={end} onChange={setEnd} /></div>
      </Field>
      <Field icon={<User size={14} />} label="예약자">
        <div className="text-sm py-1.5" style={{ color: C.muted }}>{currentUser.company} · {currentUser.name} (로그인 계정 기준 자동 입력)</div>
      </Field>
      <Field icon={<FileText size={14} />} label="사용 목적">
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full text-sm px-3 py-2 rounded border outline-none" style={{ borderColor: C.border }} placeholder="예: 요구사항 협의" />
      </Field>
      {error && <div className="text-xs mt-1" style={{ color: C.danger }}>{error}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded border" style={{ borderColor: C.border }}>취소</button>
        <button onClick={() => onSubmit({ start, end, purpose })} disabled={!purpose} className="text-sm px-4 py-2 rounded disabled:opacity-40" style={{ background: C.ink, color: C.bg }}>예약 확정</button>
      </div>
    </ModalShell>
  );
}

function ReservationDetailModal({ reservation, rooms, currentUser, reservations, setReservations, onClose }) {
  const [start, setStart] = useState(reservation.start);
  const [end, setEnd] = useState(reservation.end);
  const [error, setError] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const isOwner = reservation.userId === currentUser.id || currentUser.role === "ADMIN";
  const timeChanged = start !== reservation.start || end !== reservation.end;

  const save = () => {
    if (start >= end) return setError("종료 시간은 시작 시간보다 늦어야 합니다.");
    if (hasConflict(reservations, reservation.roomId, reservation.date, start, end, reservation.id)) return setError("변경하려는 시간에 다른 예약과 충돌합니다.");
    setReservations((prev) => prev.map((r) => (r.id === reservation.id ? { ...r, start, end } : r)));
    onClose();
  };
  const cancel = () => { setReservations((prev) => prev.filter((r) => r.id !== reservation.id)); onClose(); };

  return (
    <ModalShell onClose={onClose} title="예약 상세" accent={C.small}>
      <Field icon={<Building2 size={14} />} label="회의실"><div className="text-sm font-medium py-1.5">{rooms.find((r) => r.id === reservation.roomId)?.name}</div></Field>
      <Field icon={<FileText size={14} />} label="사용 목적"><div className="text-sm py-1.5">{reservation.purpose}</div></Field>
      <Field icon={<Clock size={14} />} label="사용 시간 (단축/연장)">
        <div className="flex items-center gap-2">
          <TimeSelect value={start} onChange={setStart} disabled={!isOwner} />
          <span style={{ color: C.muted }}>–</span>
          <TimeSelect value={end} onChange={setEnd} disabled={!isOwner} />
        </div>
      </Field>
      {!isOwner && <div className="text-xs mb-2" style={{ color: C.muted }}>본인 예약만 취소/변경할 수 있습니다.</div>}
      {error && <div className="text-xs mt-1" style={{ color: C.danger }}>{error}</div>}
      {isOwner && (
        <div className="flex items-center justify-between mt-5">
          {!confirmingCancel ? (
            <button onClick={() => setConfirmingCancel(true)} className="text-sm px-3 py-2 rounded flex items-center gap-1.5" style={{ color: C.danger }}><Trash2 size={14} /> 예약 취소</button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: C.danger }}>정말 취소할까요?</span>
              <button onClick={cancel} className="text-xs px-3 py-1.5 rounded" style={{ background: C.danger, color: "#fff" }}>확인</button>
              <button onClick={() => setConfirmingCancel(false)} className="text-xs px-3 py-1.5 rounded border" style={{ borderColor: C.border }}>아니요</button>
            </div>
          )}
          <button onClick={save} disabled={!timeChanged} className="text-sm px-4 py-2 rounded disabled:opacity-40" style={{ background: C.ink, color: C.bg }}>시간 변경 저장</button>
        </div>
      )}
    </ModalShell>
  );
}

// ============================================================
// 화면 2: 내 예약
// ============================================================
function MyReservationsScreen({ rooms, reservations, setReservations, currentUser }) {
  const [modal, setModal] = useState(null);
  const mine = reservations.filter((r) => r.userId === currentUser.id).sort((a, b) => (a.date + a.start) > (b.date + b.start) ? 1 : -1);

  return (
    <div>
      <TopBar title="내 예약" />
      <div className="px-5 pb-6">
        {mine.length === 0 && <EmptyState text="예약 내역이 없습니다. 예약현황 화면에서 회의실을 예약해보세요." />}
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          {mine.map((r, i) => (
            <div key={r.id} onClick={() => setModal(r)} className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-black/[0.02]" style={{ borderTop: i ? `1px solid ${C.borderLight}` : "none" }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: rooms.find((x) => x.id === r.roomId)?.type === "LARGE" ? C.large : C.small }} />
              <div className="w-28 text-sm font-medium shrink-0">{rooms.find((x) => x.id === r.roomId)?.name}</div>
              <div className="w-24 text-xs shrink-0" style={{ color: C.muted, fontFamily: "ui-monospace, monospace" }}>{r.date}</div>
              <div className="w-28 text-xs shrink-0" style={{ color: C.muted, fontFamily: "ui-monospace, monospace" }}>{toHHMM(r.start)}–{toHHMM(r.end)}</div>
              <div className="text-sm truncate flex-1">{r.purpose}</div>
              {r.fixed && <Badge color={C.amber}>고정예약</Badge>}
            </div>
          ))}
        </div>
      </div>
      {modal && <ReservationDetailModal reservation={modal} rooms={rooms} currentUser={currentUser} reservations={reservations} setReservations={setReservations} onClose={() => setModal(null)} />}
    </div>
  );
}

// ============================================================
// 화면 3: 고정예약 신청
// ============================================================
function RecurringRequestScreen({ rooms, recurring, setRecurring, currentUser }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id);
  const [days, setDays] = useState([1]);
  const [start, setStart] = useState(600);
  const [end, setEnd] = useState(660);
  const [periodStart, setPeriodStart] = useState(todayStr());
  const [periodEnd, setPeriodEnd] = useState(todayStr());
  const [purpose, setPurpose] = useState("");
  const [msg, setMsg] = useState("");

  const toggleDay = (d) => setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());

  const submit = () => {
    if (!purpose || days.length === 0) { setMsg("사용 목적과 요일을 확인해주세요."); return; }
    if (start >= end) { setMsg("종료 시간은 시작 시간보다 늦어야 합니다."); return; }
    setRecurring((prev) => [...prev, { id: `rr_${Date.now()}`, roomId, userId: currentUser.id, patternType: "WEEKLY", days, start, end, periodStart, periodEnd, purpose, status: "PENDING", rejectReason: "" }]);
    setMsg("신청이 접수되었습니다. 관리자 승인 후 확정됩니다."); setPurpose("");
  };

  const mine = recurring.filter((r) => r.userId === currentUser.id);

  return (
    <div>
      <TopBar title="고정예약 신청" />
      <div className="px-5 pb-6 grid grid-cols-2 gap-6 items-start">
        <Panel title="신규 신청">
          <Field icon={<Building2 size={14} />} label="회의실">
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full text-sm px-3 py-2 rounded border outline-none" style={{ borderColor: C.border }}>
              {rooms.filter((r) => r.active).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field icon={<Repeat size={14} />} label="반복 요일">
            <div className="flex gap-1.5">
              {DOW.map((d, i) => (
                <button key={i} onClick={() => toggleDay(i)} className="w-8 h-8 rounded text-xs font-medium"
                  style={{ background: days.includes(i) ? C.ink : C.borderLight, color: days.includes(i) ? C.bg : C.ink }}>{d}</button>
              ))}
            </div>
          </Field>
          <Field icon={<Clock size={14} />} label="사용 시간">
            <div className="flex items-center gap-2"><TimeSelect value={start} onChange={setStart} /><span style={{ color: C.muted }}>–</span><TimeSelect value={end} onChange={setEnd} /></div>
          </Field>
          <Field icon={<Calendar size={14} />} label="적용 기간">
            <div className="flex items-center gap-2">
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="text-sm px-2 py-1.5 rounded border outline-none" style={{ borderColor: C.border }} />
              <span style={{ color: C.muted }}>–</span>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="text-sm px-2 py-1.5 rounded border outline-none" style={{ borderColor: C.border }} />
            </div>
          </Field>
          <Field icon={<FileText size={14} />} label="사용 목적">
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full text-sm px-3 py-2 rounded border outline-none" style={{ borderColor: C.border }} placeholder="예: 주간 진척 점검 회의" />
          </Field>
          {msg && <div className="text-xs mb-2" style={{ color: msg.includes("접수") ? C.large : C.danger }}>{msg}</div>}
          <button onClick={submit} className="text-sm px-4 py-2 rounded font-medium" style={{ background: C.ink, color: C.bg }}>신청하기</button>
        </Panel>

        <Panel title="내 신청 내역">
          {mine.length === 0 && <EmptyState text="신청 내역이 없습니다." />}
          <div className="flex flex-col gap-2">
            {mine.map((r) => (
              <div key={r.id} className="rounded p-3" style={{ border: `1px solid ${C.borderLight}` }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{rooms.find((x) => x.id === r.roomId)?.name}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-xs" style={{ color: C.muted }}>
                  매주 {r.days.map((d) => DOW[d]).join(",")} {toHHMM(r.start)}–{toHHMM(r.end)} · {r.periodStart} ~ {r.periodEnd}
                </div>
                <div className="text-xs mt-1">{r.purpose}</div>
                {r.status === "REJECTED" && r.rejectReason && <div className="text-xs mt-1" style={{ color: C.danger }}>반려 사유: {r.rejectReason}</div>}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ============================================================
// 화면 4 (관리자): 고정예약 승인
// ============================================================
function AdminApprovalsScreen({ rooms, users, recurring, setRecurring, currentUser }) {
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");
  const pending = recurring.filter((r) => r.status === "PENDING");
  const history = recurring.filter((r) => r.status !== "PENDING");

  const approve = (id) => setRecurring((prev) => prev.map((r) => r.id === id ? { ...r, status: "APPROVED", approvedBy: currentUser.name } : r));
  const reject = (id) => { setRecurring((prev) => prev.map((r) => r.id === id ? { ...r, status: "REJECTED", rejectReason: reason || "사유 미기재" } : r)); setRejectingId(null); setReason(""); };

  return (
    <div>
      <TopBar title="고정예약 승인 관리" />
      <div className="px-5 pb-6">
        <Panel title={`승인 대기 (${pending.length})`}>
          {pending.length === 0 && <EmptyState text="대기 중인 신청이 없습니다." />}
          <div className="flex flex-col gap-2">
            {pending.map((r) => {
              const applicant = users.find((u) => u.id === r.userId);
              return (
                <div key={r.id} className="rounded p-3" style={{ border: `1px solid ${C.borderLight}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{rooms.find((x) => x.id === r.roomId)?.name}</span>
                    <span className="text-xs" style={{ color: C.muted }}>{applicant?.company} · {applicant?.name}</span>
                  </div>
                  <div className="text-xs" style={{ color: C.muted }}>매주 {r.days.map((d) => DOW[d]).join(",")} {toHHMM(r.start)}–{toHHMM(r.end)} · {r.periodStart} ~ {r.periodEnd}</div>
                  <div className="text-xs mt-1 mb-2">{r.purpose}</div>
                  {rejectingId === r.id ? (
                    <div className="flex items-center gap-2">
                      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="반려 사유" className="flex-1 text-xs px-2 py-1.5 rounded border outline-none" style={{ borderColor: C.border }} />
                      <button onClick={() => reject(r.id)} className="text-xs px-3 py-1.5 rounded" style={{ background: C.danger, color: "#fff" }}>반려 확정</button>
                      <button onClick={() => setRejectingId(null)} className="text-xs px-3 py-1.5 rounded border" style={{ borderColor: C.border }}>취소</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => approve(r.id)} className="text-xs px-3 py-1.5 rounded flex items-center gap-1" style={{ background: C.large, color: "#fff" }}><Check size={12} /> 승인</button>
                      <button onClick={() => setRejectingId(r.id)} className="text-xs px-3 py-1.5 rounded flex items-center gap-1 border" style={{ borderColor: C.border, color: C.danger }}><XCircle size={12} /> 반려</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="처리 이력">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs" style={{ color: C.muted }}>
              <th className="py-2">회의실</th><th>신청자</th><th>기간</th><th>상태</th>
            </tr></thead>
            <tbody>
              {history.map((r) => {
                const applicant = users.find((u) => u.id === r.userId);
                return (
                  <tr key={r.id} style={{ borderTop: `1px solid ${C.borderLight}` }}>
                    <td className="py-2">{rooms.find((x) => x.id === r.roomId)?.name}</td>
                    <td>{applicant?.company} · {applicant?.name}</td>
                    <td className="text-xs" style={{ color: C.muted }}>{r.periodStart} ~ {r.periodEnd}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

// ============================================================
// 화면 5 (관리자): 회의실 관리
// ============================================================
function AdminRoomsScreen({ rooms, setRooms }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", type: "SMALL", capacity: 6, floor: "" });

  const toggleActive = (id) => setRooms((prev) => prev.map((r) => r.id === id ? { ...r, active: !r.active } : r));
  const addRoom = () => {
    if (!form.name) return;
    setRooms((prev) => [...prev, { id: `r_${Date.now()}`, ...form, capacity: Number(form.capacity), equipment: [], active: true }]);
    setForm({ name: "", type: "SMALL", capacity: 6, floor: "" }); setAdding(false);
  };

  return (
    <div>
      <TopBar title="회의실 관리">
        <button onClick={() => setAdding((v) => !v)} className="text-xs px-3 py-1.5 rounded flex items-center gap-1 ml-auto" style={{ background: C.ink, color: C.bg }}>
          <Plus size={13} /> 회의실 추가
        </button>
      </TopBar>
      <div className="px-5 pb-6">
        {adding && (
          <Panel title="새 회의실">
            <div className="grid grid-cols-4 gap-2 items-end">
              <div><div className="text-xs mb-1" style={{ color: C.muted }}>이름</div><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full text-sm px-2 py-1.5 rounded border outline-none" style={{ borderColor: C.border }} /></div>
              <div><div className="text-xs mb-1" style={{ color: C.muted }}>유형</div>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="w-full text-sm px-2 py-1.5 rounded border outline-none" style={{ borderColor: C.border }}>
                  <option value="LARGE">대회의실</option><option value="SMALL">소회의실</option>
                </select>
              </div>
              <div><div className="text-xs mb-1" style={{ color: C.muted }}>정원</div><input type="number" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} className="w-full text-sm px-2 py-1.5 rounded border outline-none" style={{ borderColor: C.border }} /></div>
              <div><div className="text-xs mb-1" style={{ color: C.muted }}>위치</div><input value={form.floor} onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))} placeholder="예: 3F" className="w-full text-sm px-2 py-1.5 rounded border outline-none" style={{ borderColor: C.border }} /></div>
            </div>
            <button onClick={addRoom} className="text-sm px-4 py-2 rounded mt-3" style={{ background: C.ink, color: C.bg }}>추가</button>
          </Panel>
        )}
        <Panel title={`전체 회의실 (${rooms.length})`}>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs" style={{ color: C.muted }}>
              <th className="py-2">이름</th><th>유형</th><th>정원</th><th>위치</th><th>장비</th><th>상태</th><th></th>
            </tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.borderLight}` }}>
                  <td className="py-2 font-medium">{r.name}</td>
                  <td><Badge color={r.type === "LARGE" ? C.large : C.small}>{r.type === "LARGE" ? "대회의실" : "소회의실"}</Badge></td>
                  <td>{r.capacity}명</td>
                  <td className="text-xs" style={{ color: C.muted }}>{r.floor}</td>
                  <td className="text-xs" style={{ color: C.muted }}>{r.equipment.join(", ") || "-"}</td>
                  <td><Badge color={r.active ? C.large : C.muted}>{r.active ? "사용가능" : "비활성화"}</Badge></td>
                  <td>
                    <button onClick={() => toggleActive(r.id)} className="flex items-center gap-1 text-xs" style={{ color: C.muted }}>
                      {r.active ? <ToggleRight size={20} style={{ color: C.large }} /> : <ToggleLeft size={20} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

// ============================================================
// 화면 6 (관리자): 사용자 관리
// ============================================================
function AdminUsersScreen({ users, setUsers, currentUser }) {
  const [search, setSearch] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const filtered = users.filter((u) => !search || u.name.includes(search) || u.company.includes(search) || u.loginId.includes(search));

  const toggleRole = (id) => setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: u.role === "ADMIN" ? "USER" : "ADMIN" } : u));
  const toggleStatus = (id) => setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } : u));
  const resetPassword = (u) => {
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, password: "temp1234" } : x));
    setResetMsg(`${u.name}(${u.loginId}) 계정의 비밀번호가 임시 비밀번호로 초기화되었습니다: temp1234 (로그인 후 즉시 변경 안내 필요)`);
  };

  return (
    <div>
      <TopBar title="사용자 관리">
        <SearchBox search={search} setSearch={setSearch} placeholder="이름·회사·로그인ID 검색" />
      </TopBar>
      <div className="px-5 pb-6">
        <div className="text-xs mb-3" style={{ color: C.muted }}>
          이메일을 수집하지 않는 구조이므로, 비밀번호 분실 시 본인 확인 후 관리자가 초기화합니다.
        </div>
        {resetMsg && <div className="text-xs mb-3 px-3 py-2 rounded" style={{ background: `${C.large}14`, color: C.large }}>{resetMsg}</div>}
        <Panel title={`전체 사용자 (${users.length})`}>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs" style={{ color: C.muted }}>
              <th className="py-2">이름</th><th>회사</th><th>로그인ID</th><th>연락처</th><th>권한</th><th>상태</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} style={{ borderTop: `1px solid ${C.borderLight}` }}>
                  <td className="py-2 font-medium">{u.name}</td>
                  <td>{u.company}</td>
                  <td className="text-xs" style={{ color: C.muted, fontFamily: "ui-monospace, monospace" }}>{u.loginId}</td>
                  <td className="text-xs" style={{ color: C.muted, fontFamily: "ui-monospace, monospace" }}>{u.contact || "-"}</td>
                  <td><Badge color={u.role === "ADMIN" ? C.amber : C.small}>{u.role === "ADMIN" ? "관리자" : "일반"}</Badge></td>
                  <td><Badge color={u.status === "ACTIVE" ? C.large : C.danger}>{u.status === "ACTIVE" ? "활성" : "정지"}</Badge></td>
                  <td>
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleRole(u.id)} disabled={u.id === currentUser.id} className="text-xs underline disabled:opacity-30" style={{ color: C.ink }}>권한변경</button>
                      <button onClick={() => toggleStatus(u.id)} disabled={u.id === currentUser.id} className="text-xs underline disabled:opacity-30" style={{ color: C.danger }}>
                        {u.status === "ACTIVE" ? "정지" : "해제"}
                      </button>
                      <button onClick={() => resetPassword(u)} className="text-xs underline flex items-center gap-1" style={{ color: C.small }}>
                        <KeyRound size={11} /> 비밀번호 초기화
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

// ============================================================
// 공통 UI 조각
// ============================================================
function TopBar({ title, children }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b" style={{ borderColor: C.border }}>
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}
function DateNav({ date, shiftDate, setDate }) {
  return (
    <div className="flex items-center gap-1 ml-2">
      <button onClick={() => shiftDate(-1)} className="p-1.5 rounded hover:bg-black/5"><ChevronLeft size={16} /></button>
      <span className="px-3 py-1 rounded text-sm font-medium" style={{ background: C.borderLight, fontVariantNumeric: "tabular-nums" }}>{date}</span>
      <button onClick={() => shiftDate(1)} className="p-1.5 rounded hover:bg-black/5"><ChevronRight size={16} /></button>
      <button onClick={() => setDate(todayStr())} className="text-xs px-2 py-1 rounded ml-1" style={{ background: C.ink, color: C.bg }}>오늘</button>
    </div>
  );
}
function FilterPills({ filter, setFilter }) {
  return (
    <div className="flex items-center gap-1">
      {[["ALL", "전체"], ["LARGE", "대회의실"], ["SMALL", "소회의실"]].map(([v, l]) => (
        <button key={v} onClick={() => setFilter(v)} className="text-xs px-3 py-1.5 rounded-full border" style={{ borderColor: filter === v ? C.large : C.border, background: filter === v ? C.large : "transparent", color: filter === v ? "#fff" : C.ink }}>{l}</button>
      ))}
    </div>
  );
}
function SearchBox({ search, setSearch, placeholder }) {
  return (
    <div className="relative ml-auto">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} className="text-sm pl-8 pr-3 py-1.5 rounded border outline-none w-52" style={{ borderColor: C.border, background: "#fff" }} />
    </div>
  );
}
function Legend() {
  return (
    <div className="flex items-center gap-4 px-5 py-2 text-xs" style={{ color: C.muted }}>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: C.large }} /> 대회의실</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: C.small }} /> 소회의실</span>
      <span className="ml-2" style={{ color: "#B7BAB2" }}>빈 슬롯을 클릭해 예약을 생성하세요</span>
    </div>
  );
}
function Panel({ title, children }) {
  return (
    <div className="rounded-lg p-4 mb-5" style={{ border: `1px solid ${C.border}`, background: C.panel }}>
      <div className="text-sm font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}
function EmptyState({ text }) {
  return <div className="text-sm py-6 text-center rounded" style={{ color: C.muted, background: C.borderLight }}>{text}</div>;
}
function Badge({ color, children }) {
  return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}1A`, color }}>{children}</span>;
}
function StatusBadge({ status }) {
  const map = { PENDING: [C.amber, "승인대기"], APPROVED: [C.large, "승인완료"], REJECTED: [C.danger, "반려"] };
  const [color, label] = map[status] || [C.muted, status];
  return <Badge color={color}>{label}</Badge>;
}
function ModalShell({ title, accent, onClose, children }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "#1B1D2299" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg p-5" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><span className="w-2 h-5 rounded-sm" style={{ background: accent }} /><h2 className="text-base font-semibold">{title}</h2></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/5"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ icon, label, children }) {
  return <div className="mb-3"><div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: C.muted }}>{icon}{label}</div>{children}</div>;
}
function TimeSelect({ value, onChange, disabled }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} className="text-sm px-2 py-1.5 rounded border outline-none disabled:opacity-50" style={{ borderColor: C.border, fontFamily: "ui-monospace, monospace" }}>
      {TIME_OPTIONS.map((t) => <option key={t} value={t}>{toHHMM(t)}</option>)}
    </select>
  );
}
