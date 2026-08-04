"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type Screen = "login" | "signup" | "otp" | "recovery" | "security";
type SessionItem = {
  id: number;
  device: string;
  detail: string;
  location: string;
  time: string;
  current?: boolean;
  suspicious?: boolean;
};

const screenLabels: { id: Screen; label: string }[] = [
  { id: "login", label: "로그인" },
  { id: "signup", label: "회원가입" },
  { id: "otp", label: "이메일 OTP" },
  { id: "recovery", label: "계정 복구" },
  { id: "security", label: "보안 활동" },
];

const initialSessions: SessionItem[] = [
  {
    id: 1,
    device: "내 기기 (현재)",
    detail: "Chrome · Windows",
    location: "대한민국 · 서울",
    time: "현재 사용 중",
    current: true,
  },
  {
    id: 2,
    device: "iPhone 14 Pro",
    detail: "Safari · iOS",
    location: "대한민국 · 서울",
    time: "3시간 전",
  },
  {
    id: 3,
    device: "MacBook Air",
    detail: "Safari · macOS",
    location: "대한민국 · 부산",
    time: "1일 전",
  },
  {
    id: 4,
    device: "알 수 없는 기기",
    detail: "Chrome · Windows",
    location: "미국 · 뉴욕",
    time: "2일 전",
    suspicious: true,
  },
];

function TrustPanel() {
  return (
    <aside className="trust-panel" aria-label="서비스 보안 안내">
      <div className="trust-heading">
        <span className="eyebrow eyebrow-dark">SECURE BY DESIGN</span>
        <h2>안전한 로그인을 위한<br />보안 기능</h2>
        <p>불필요한 복잡함 없이 계정을 안전하게 지켜드려요.</p>
      </div>
      <div className="trust-list">
        <div className="trust-item">
          <span className="trust-icon">✓</span>
          <div><strong>안심 로그인</strong><p>의심스러운 시도를 감지하고 즉시 알려드려요.</p></div>
        </div>
        <div className="trust-item">
          <span className="trust-icon">◇</span>
          <div><strong>기기 관리</strong><p>신뢰할 수 있는 기기만 남기고 언제든 정리해요.</p></div>
        </div>
        <div className="trust-item">
          <span className="trust-icon">●</span>
          <div><strong>보안 알림</strong><p>중요한 계정 활동은 이메일로 안내해 드려요.</p></div>
        </div>
      </div>
      <div className="privacy-note">
        <span>✓</span>
        <div><strong>개인정보는 안전하게 보호됩니다.</strong><p>이 목업은 실제 정보를 저장하거나 전송하지 않아요.</p></div>
      </div>
    </aside>
  );
}

function Brand() {
  return (
    <div className="brand" aria-label="안심 로그인 목업">
      <span className="brand-mark">✓</span>
      <span>안심 로그인</span>
      <span className="demo-pill">HTML MOCK</span>
    </div>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [signupError, setSignupError] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(45);
  const [sessions, setSessions] = useState(initialSessions);
  const [confirmAll, setConfirmAll] = useState(false);
  const [toast, setToast] = useState("");
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (screen !== "otp" || countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen, countdown]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = (next: Screen) => {
    setScreen(next);
    setLoginError("");
    setSignupError("");
    if (next !== "recovery") setRecoverySent(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!data.get("email") || !data.get("password")) {
      setLoginError("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }
    setLoginError("");
    setOtp(["", "", "", "", "", ""]);
    setCountdown(45);
    navigate("otp");
    window.setTimeout(() => otpRefs.current[0]?.focus(), 120);
  };

  const submitSignup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!data.get("email") || !data.get("password") || !data.get("passwordConfirm")) {
      setSignupError("필수 정보를 모두 입력해 주세요.");
      return;
    }
    if (data.get("password") !== data.get("passwordConfirm")) {
      setSignupError("비밀번호가 서로 일치하지 않아요.");
      return;
    }
    if (!data.get("terms")) {
      setSignupError("필수 약관에 동의해 주세요.");
      return;
    }
    setSignupError("");
    setOtp(["", "", "", "", "", ""]);
    setCountdown(45);
    navigate("otp");
  };

  const updateOtp = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKey = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const verifyOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otp.some((digit) => !digit)) {
      setToast("6자리 인증 코드를 모두 입력해 주세요.");
      return;
    }
    setToast("인증이 완료되었습니다.");
    window.setTimeout(() => navigate("security"), 500);
  };

  const resendOtp = () => {
    if (countdown > 0) return;
    setOtp(["", "", "", "", "", ""]);
    setCountdown(45);
    setToast("새 인증 코드를 보냈습니다.");
    otpRefs.current[0]?.focus();
  };

  const removeSession = (id: number) => {
    const target = sessions.find((item) => item.id === id);
    setSessions((current) => current.filter((item) => item.id !== id));
    setToast(`${target?.device ?? "기기"}에서 로그아웃했습니다.`);
  };

  const logoutAll = () => {
    setSessions((current) => current.filter((item) => item.current));
    setConfirmAll(false);
    setToast("현재 기기를 제외한 모든 세션을 종료했습니다.");
  };

  return (
    <main className="site-shell">
      <header className="topbar">
        <Brand />
        <nav className="screen-nav" aria-label="목업 화면 선택">
          {screenLabels.map((item) => (
            <button
              key={item.id}
              type="button"
              className={screen === item.id ? "nav-button active" : "nav-button"}
              aria-current={screen === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <span className="prototype-label">클릭형 프로토타입</span>
      </header>

      <section className={screen === "security" ? "stage stage-wide" : "stage"}>
        {screen === "login" && (
          <div className="auth-card">
            <section className="form-panel">
              <div className="form-copy">
                <span className="eyebrow">WELCOME BACK</span>
                <h1>다시 오신 것을<br />환영해요</h1>
                <p>계정에 로그인하고 안전하게 서비스를 이용하세요.</p>
              </div>
              <form onSubmit={submitLogin} noValidate>
                <label className="field-label" htmlFor="login-email">이메일</label>
                <input id="login-email" name="email" type="email" placeholder="user@example.com" autoComplete="email" />
                <label className="field-label" htmlFor="login-password">비밀번호</label>
                <div className="password-field">
                  <input id="login-password" name="password" type={showPassword ? "text" : "password"} placeholder="비밀번호를 입력하세요" autoComplete="current-password" />
                  <button type="button" className="field-action" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>{showPassword ? "숨김" : "보기"}</button>
                </div>
                <div className="form-options">
                  <label className="check-label"><input type="checkbox" defaultChecked /> 로그인 상태 유지</label>
                  <button type="button" className="text-button" onClick={() => navigate("recovery")}>비밀번호를 잊으셨나요?</button>
                </div>
                {loginError && <p className="form-error" role="alert">{loginError}</p>}
                <button className="primary-button" type="submit">로그인</button>
                <div className="divider"><span>또는</span></div>
                <button className="secondary-button" type="button" onClick={() => setToast("소셜 로그인 연결 화면 예시입니다.")}><span className="button-icon">◇</span>소셜 계정으로 계속</button>
                <button className="secondary-button" type="button" onClick={() => setToast("다른 계정 공급자 화면 예시입니다.")}><span className="button-icon">○</span>다른 계정으로 계속</button>
              </form>
              <p className="switch-copy">계정이 없으신가요? <button type="button" onClick={() => navigate("signup")}>계정 만들기</button></p>
            </section>
            <TrustPanel />
          </div>
        )}

        {screen === "signup" && (
          <div className="auth-card">
            <section className="form-panel compact-panel">
              <div className="form-copy">
                <span className="eyebrow">CREATE ACCOUNT</span>
                <h1>계정 만들기</h1>
                <p>필수 정보만 입력하면 바로 시작할 수 있어요.</p>
              </div>
              <form onSubmit={submitSignup} noValidate>
                <label className="field-label" htmlFor="signup-email">이메일</label>
                <input id="signup-email" name="email" type="email" placeholder="이메일 주소를 입력하세요" autoComplete="email" />
                <label className="field-label" htmlFor="signup-password">비밀번호</label>
                <input id="signup-password" name="password" type="password" placeholder="영문, 숫자, 특수문자 포함 8자 이상" autoComplete="new-password" />
                <div className="strength"><span className="on" /><span className="on" /><span /><span /><small>보통</small></div>
                <label className="field-label" htmlFor="signup-password-confirm">비밀번호 확인</label>
                <input id="signup-password-confirm" name="passwordConfirm" type="password" placeholder="비밀번호를 다시 입력하세요" autoComplete="new-password" />
                <label className="terms-label"><input type="checkbox" name="terms" /> <span><strong>이용약관 및 개인정보 처리방침</strong>에 동의합니다. <em>필수</em></span></label>
                <label className="terms-label"><input type="checkbox" /> <span>새로운 소식과 혜택을 이메일로 받습니다. <i>선택</i></span></label>
                {signupError && <p className="form-error" role="alert">{signupError}</p>}
                <button className="primary-button" type="submit">계정 만들기</button>
              </form>
              <p className="switch-copy">이미 계정이 있으신가요? <button type="button" onClick={() => navigate("login")}>로그인</button></p>
            </section>
            <TrustPanel />
          </div>
        )}

        {screen === "otp" && (
          <div className="phone-stage">
            <section className="phone-card" aria-labelledby="otp-title">
              <button type="button" className="back-button" onClick={() => navigate("login")} aria-label="로그인으로 돌아가기">←</button>
              <div className="phone-progress"><span /><span className="active" /></div>
              <div className="phone-icon">✉</div>
              <span className="eyebrow">EMAIL VERIFICATION</span>
              <h1 id="otp-title">인증 코드를<br />확인해 주세요</h1>
              <p><strong>user@example.com</strong>으로<br />6자리 인증 코드를 보냈어요.</p>
              <form onSubmit={verifyOtp}>
                <div className="otp-group" aria-label="6자리 인증 코드">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => { otpRefs.current[index] = element; }}
                      value={digit}
                      onChange={(event) => updateOtp(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKey(index, event)}
                      inputMode="numeric"
                      aria-label={`${index + 1}번째 숫자`}
                      maxLength={1}
                    />
                  ))}
                </div>
                <div className="resend-row">
                  <span>코드를 받지 못하셨나요?</span>
                  <button type="button" disabled={countdown > 0} onClick={resendOtp}>{countdown > 0 ? `재전송 00:${String(countdown).padStart(2, "0")}` : "코드 재전송"}</button>
                </div>
                <button type="submit" className="primary-button">확인</button>
              </form>
              <button type="button" className="text-button centered" onClick={() => navigate("recovery")}>다른 방법으로 복구하기</button>
            </section>
          </div>
        )}

        {screen === "recovery" && (
          <div className="phone-stage">
            <section className="phone-card" aria-labelledby="recovery-title">
              <button type="button" className="back-button" onClick={() => navigate("login")} aria-label="로그인으로 돌아가기">←</button>
              <div className={recoverySent ? "phone-icon success" : "phone-icon"}>{recoverySent ? "✓" : "↺"}</div>
              <span className="eyebrow">ACCOUNT RECOVERY</span>
              <h1 id="recovery-title">{recoverySent ? <>이메일을<br />확인해 주세요</> : <>계정 복구를<br />시작할게요</>}</h1>
              <p>{recoverySent ? <>입력하신 이메일이 가입된 계정이라면<br />복구 링크를 보내드렸어요.</> : <>가입 시 사용한 이메일을 입력하면<br />계정 복구 방법을 안내해 드려요.</>}</p>
              {!recoverySent ? (
                <form onSubmit={(event) => { event.preventDefault(); setRecoverySent(true); }}>
                  <label className="field-label" htmlFor="recovery-email">이메일</label>
                  <input id="recovery-email" name="email" type="email" required placeholder="이메일 주소를 입력하세요" autoComplete="email" />
                  <button className="primary-button" type="submit">복구 링크 받기</button>
                </form>
              ) : (
                <div className="recovery-result">
                  <div className="info-box"><span>i</span><p>보안을 위해 가입 여부와 관계없이 동일한 안내를 보여드려요.</p></div>
                  <button className="primary-button" type="button" onClick={() => navigate("login")}>로그인으로 돌아가기</button>
                  <button className="secondary-button" type="button" onClick={() => setRecoverySent(false)}>이메일 다시 입력</button>
                </div>
              )}
            </section>
          </div>
        )}

        {screen === "security" && (
          <section className="security-page" aria-labelledby="security-title">
            <header className="security-header">
              <div>
                <span className="eyebrow">ACCOUNT SECURITY</span>
                <h1 id="security-title">보안 활동</h1>
                <p>로그인된 기기와 최근 계정 활동을 확인하고 관리하세요.</p>
              </div>
              <button className="outline-danger" type="button" onClick={() => setConfirmAll(true)}>다른 모든 기기에서 로그아웃</button>
            </header>
            <div className="security-grid">
              <div className="session-column">
                <div className="section-title"><div><h2>로그인된 기기</h2><p>총 {sessions.length}개의 활성 세션</p></div><span className="status-chip">보호됨</span></div>
                <div className="session-list">
                  {sessions.map((item) => (
                    <article key={item.id} className={item.suspicious ? "session-item suspicious" : "session-item"}>
                      <span className="device-icon">{item.suspicious ? "!" : item.current ? "▣" : "▯"}</span>
                      <div className="session-info">
                        <div className="session-name"><h3>{item.device}</h3>{item.current && <span>현재 사용 중</span>}{item.suspicious && <span className="warning-chip">확인 필요</span>}</div>
                        <p>{item.detail} · {item.location}</p>
                      </div>
                      <div className="session-actions"><time>{item.time}</time>{!item.current && <button type="button" onClick={() => removeSession(item.id)}>로그아웃</button>}</div>
                    </article>
                  ))}
                </div>
              </div>
              <aside className="activity-column">
                <div className="security-score">
                  <div className="score-ring"><span>92</span><small>/100</small></div>
                  <div><span className="eyebrow eyebrow-dark">SECURITY SCORE</span><h2>계정이 안전해요</h2><p>현재 적용된 보안 설정을 유지해 주세요.</p></div>
                </div>
                <div className="activity-card">
                  <h2>최근 활동</h2>
                  <ul className="timeline">
                    <li><span className="timeline-dot success" /><div><strong>이메일 인증 완료</strong><p>오늘 오후 2:31 · 서울</p></div></li>
                    <li><span className="timeline-dot" /><div><strong>새 로그인 성공</strong><p>오늘 오후 2:30 · Chrome</p></div></li>
                    <li><span className="timeline-dot warning" /><div><strong>의심스러운 로그인 차단</strong><p>2일 전 · 미국 뉴욕</p></div></li>
                  </ul>
                </div>
                <div className="mfa-card"><span>✓</span><div><strong>2단계 인증이 켜져 있어요</strong><p>이메일 OTP로 계정을 한 번 더 보호합니다.</p></div></div>
              </aside>
            </div>
          </section>
        )}
      </section>

      <footer className="footer"><span>로그인 시스템 화면 목업 v1</span><span>실제 개인정보를 입력하지 마세요.</span></footer>

      {toast && <div className="toast" role="status" aria-live="polite"><span>✓</span>{toast}</div>}

      {confirmAll && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirmAll(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="modal-icon">!</span>
            <h2 id="modal-title">다른 모든 기기에서 로그아웃할까요?</h2>
            <p>현재 기기를 제외한 {Math.max(sessions.length - 1, 0)}개의 세션이 즉시 종료됩니다.</p>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setConfirmAll(false)}>취소</button><button type="button" className="danger-button" onClick={logoutAll}>모두 로그아웃</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
