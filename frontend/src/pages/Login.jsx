import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth, SKIP_EMAIL_CONFIRM } from '../context/AuthContext';
import { supabase, GUEST_MODE_ENABLED, OTP_LENGTH } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import './Login.css';

const OTP_STORAGE_KEYS = {
  PENDING_EMAIL: 'pixabel_pending_signup_email',
  RESEND_COUNT: 'pixabel_otp_resend_count',
  WRONG_ATTEMPTS: 'pixabel_otp_wrong_attempts',
  LOCKOUT_UNTIL: 'pixabel_otp_lockout_until',
  RESEND_UNTIL: 'pixabel_otp_resend_until',
};

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (!local) return email;
  const visible = local.charAt(0);
  const asterisks = '*'.repeat(Math.max(local.length - 1, 4));
  return `${visible}${asterisks}@${domain}`;
}

function mapErrorMsg(error) {
  if (!error) return 'An unknown error occurred.';
  const msg = error.message || '';
  if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (msg.includes('User already registered') || error.code === 'user_already_exists') {
    return 'An account with this email already exists. Try signing in.';
  }
  if (
    msg.includes('Email not confirmed') ||
    msg.includes('email address is not confirmed') ||
    error.code === 'email_not_confirmed'
  ) {
    return 'Please confirm your email first.';
  }
  if (msg.includes('rate limit') || msg.includes('Too many requests') || error.status === 429) {
    return 'Too many attempts. Please wait a minute.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Connection problem. Check your internet and retry.';
  }
  return msg;
}

function mapOtpError(error) {
  if (!error) return 'An unknown error occurred.';
  const msg = (error.message || '').toLowerCase();
  const code = (error.code || '').toLowerCase();
  const status = error.status;

  if (
    status === 429 ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    code.includes('over_request_rate_limit') ||
    code.includes('over_email_send_rate_limit')
  ) {
    return 'Too many attempts. Please wait a minute.';
  }

  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('fetch failed') ||
    msg.includes('load failed')
  ) {
    return 'Connection problem. Check your internet and retry.';
  }

  if (
    msg.includes('token has expired') ||
    msg.includes('is invalid') ||
    msg.includes('invalid token') ||
    msg.includes('token expired') ||
    msg.includes('expired') ||
    msg.includes('invalid') ||
    msg.includes('incorrect') ||
    msg.includes('bad_jwt') ||
    code === 'otp_expired' ||
    code === 'bad_code' ||
    code === 'invalid_grant'
  ) {
    return 'That code is incorrect or has expired. Request a new one.';
  }

  return error.message || 'An unknown error occurred.';
}

export function Login() {
  const { session, signIn, signUp, verifyOtp, resend, enterGuestMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (session) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [session, navigate, location]);

  // View state: 'signin' | 'signup' | 'otp' | 'forgot'
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(OTP_STORAGE_KEYS.PENDING_EMAIL)) {
      return 'otp';
    }
    return window.location.hash === '#signup' ? 'signup' : 'signin';
  });

  // Sign in state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPwd, setSignInPwd] = useState('');
  const [showSignInPwd, setShowSignInPwd] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);

  // Sign up state
  const [signUpName, setSignUpName] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPwd, setSignUpPwd] = useState('');
  const [signUpPwdConfirm, setSignUpPwdConfirm] = useState('');
  const [showSignUpPwd, setShowSignUpPwd] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [signUpError, setSignUpError] = useState('');
  const [signUpFieldErrors, setSignUpFieldErrors] = useState({});
  const [signUpLoading, setSignUpLoading] = useState(false);

  // Password strength calculation
  const pwdLen = signUpPwd.length >= 8;
  let pwdStrength = 0;
  if (pwdLen) pwdStrength++;
  if (/[A-Z]/.test(signUpPwd) && /[a-z]/.test(signUpPwd) && /[0-9]/.test(signUpPwd)) pwdStrength++;
  if (/[^A-Za-z0-9]/.test(signUpPwd)) pwdStrength++;

  const pwdStrengthText =
    signUpPwd.length === 0 ? 'Weak' : pwdStrength === 1 ? 'Weak' : pwdStrength === 2 ? 'Fair' : 'Strong';

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // OTP state
  const [otpEmail, setOtpEmail] = useState(() => {
    return (typeof window !== 'undefined' && sessionStorage.getItem(OTP_STORAGE_KEYS.PENDING_EMAIL)) || '';
  });
  const [otpNotice, setOtpNotice] = useState('');
  const [otpDigits, setOtpDigits] = useState(() => Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const resendUntil = parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.RESEND_UNTIL) || '0', 10);
    const rem = Math.ceil((resendUntil - Date.now()) / 1000);
    return rem > 0 ? rem : 0;
  });
  const [lockoutCooldown, setLockoutCooldown] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const lockoutUntil = parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL) || '0', 10);
    const rem = Math.ceil((lockoutUntil - Date.now()) / 1000);
    return rem > 0 ? rem : 0;
  });
  const [resendStatusMsg, setResendStatusMsg] = useState('');
  const otpInputsRef = useRef([]);

  // Check timers when view changes
  useEffect(() => {
    const resendUntil = parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.RESEND_UNTIL) || '0', 10);
    const remainingResend = Math.ceil((resendUntil - Date.now()) / 1000);
    setResendCooldown((prev) => (remainingResend > 0 ? remainingResend : prev > 0 ? prev : 0));

    const lockoutUntil = parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL) || '0', 10);
    const remainingLockout = Math.ceil((lockoutUntil - Date.now()) / 1000);
    setLockoutCooldown((prev) => (remainingLockout > 0 ? remainingLockout : prev > 0 ? prev : 0));
  }, [view]);

  // Tick interval for resendCooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          sessionStorage.removeItem(OTP_STORAGE_KEYS.RESEND_UNTIL);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Tick interval for lockoutCooldown
  useEffect(() => {
    if (lockoutCooldown <= 0) return;
    const timer = setInterval(() => {
      setLockoutCooldown((prev) => {
        if (prev <= 1) {
          sessionStorage.removeItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL);
          sessionStorage.removeItem(OTP_STORAGE_KEYS.WRONG_ATTEMPTS);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutCooldown]);

  const openOtpScreen = useCallback((email, notice = '') => {
    sessionStorage.setItem(OTP_STORAGE_KEYS.PENDING_EMAIL, email);
    setOtpEmail(email);
    setOtpNotice(notice);
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setOtpError('');
    setOtpSuccess(false);
    setView('otp');
    setTimeout(() => {
      otpInputsRef.current[0]?.focus();
    }, 100);
  }, []);

  const closeOtpScreen = (returnTab = 'signup') => {
    sessionStorage.removeItem(OTP_STORAGE_KEYS.PENDING_EMAIL);
    sessionStorage.removeItem(OTP_STORAGE_KEYS.RESEND_COUNT);
    sessionStorage.removeItem(OTP_STORAGE_KEYS.WRONG_ATTEMPTS);
    sessionStorage.removeItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL);
    sessionStorage.removeItem(OTP_STORAGE_KEYS.RESEND_UNTIL);
    setView(returnTab);
  };

  // ── Handle Sign In ──────────────────────────────────────────
  const handleSignInSubmit = async (e) => {
    e.preventDefault();
    setSignInError('');
    if (!signInEmail || !signInPwd) {
      setSignInError('Please fill in all fields.');
      return;
    }

    setSignInLoading(true);
    const { error, isUnconfirmed } = await signIn({
      email: signInEmail.trim(),
      password: signInPwd,
    });
    setSignInLoading(false);

    if (error) {
      if (isUnconfirmed) {
        sessionStorage.setItem(OTP_STORAGE_KEYS.RESEND_UNTIL, (Date.now() + 60000).toString());
        setResendCooldown(60);
        openOtpScreen(signInEmail.trim(), 'Please verify your email to continue.');
        return;
      }
      setSignInError(mapErrorMsg(error));
    } else {
      navigate('/');
    }
  };

  // ── Handle Sign Up ──────────────────────────────────────────
  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setSignUpError('');
    const errors = {};

    const name = signUpName.trim();
    const username = signUpUsername.trim().toLowerCase();
    const email = signUpEmail.trim();

    if (name.length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      errors.username =
        'Username must be 3-20 characters long (lowercase letters, numbers, and underscores).';
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (signUpPwd.length < 8) {
      errors.pwd = 'Password must be at least 8 characters.';
    }
    if (signUpPwd !== signUpPwdConfirm) {
      errors.pwdConfirm = 'Passwords do not match.';
    }
    if (!agreeTerms) {
      errors.terms = 'You must agree to the Terms and Privacy Policy.';
    }

    setSignUpFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSignUpLoading(true);
    const { data, error } = await signUp({
      email,
      password: signUpPwd,
      full_name: name,
      username,
    });
    setSignUpLoading(false);

    if (error) {
      if (
        error.message?.includes('User already registered') ||
        error.code === 'user_already_exists'
      ) {
        setSignUpError('An account with this email already exists. Try signing in.');
      } else {
        setSignUpError(mapErrorMsg(error));
      }
      return;
    }

    // If auto-confirm is enabled, session exists
    if (data?.session) {
      navigate('/');
      return;
    }

    // TEST MODE: skip OTP screen entirely
    if (SKIP_EMAIL_CONFIRM) {
      navigate('/');
      return;
    }

    // Cooldown for resend starts
    sessionStorage.setItem(OTP_STORAGE_KEYS.RESEND_UNTIL, (Date.now() + 60000).toString());
    setResendCooldown(60);
    openOtpScreen(email);
  };

  // ── Handle OTP Digits ───────────────────────────────────────
  const handleOtpChange = (index, val) => {
    const cleaned = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!cleaned) {
      const nextDigits = [...otpDigits];
      nextDigits[index] = '';
      setOtpDigits(nextDigits);
      return;
    }

    // If pasted multiple chars
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, OTP_LENGTH).split('');
      const nextDigits = [...otpDigits];
      chars.forEach((c, i) => {
        nextDigits[i] = c;
      });
      setOtpDigits(nextDigits);
      const nextIdx = Math.min(chars.length, OTP_LENGTH - 1);
      otpInputsRef.current[nextIdx]?.focus();
      if (chars.length === OTP_LENGTH) {
        submitOtpWithCode(nextDigits.join(''));
      }
      return;
    }

    const nextDigits = [...otpDigits];
    nextDigits[index] = cleaned;
    setOtpDigits(nextDigits);

    if (cleaned && index < OTP_LENGTH - 1) {
      otpInputsRef.current[index + 1]?.focus();
    }

    if (nextDigits.every((d) => d.length > 0)) {
      submitOtpWithCode(nextDigits.join(''));
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        const nextDigits = [...otpDigits];
        nextDigits[index] = '';
        setOtpDigits(nextDigits);
        e.preventDefault();
      } else if (index > 0) {
        otpInputsRef.current[index - 1]?.focus();
        const nextDigits = [...otpDigits];
        nextDigits[index - 1] = '';
        setOtpDigits(nextDigits);
        e.preventDefault();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      otpInputsRef.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text') || '';
    const cleaned = pasted.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, OTP_LENGTH);
    if (!cleaned) return;

    const nextDigits = [...otpDigits];
    cleaned.split('').forEach((c, i) => {
      nextDigits[i] = c;
    });
    setOtpDigits(nextDigits);

    const nextIdx = Math.min(cleaned.length, OTP_LENGTH - 1);
    otpInputsRef.current[nextIdx]?.focus();

    if (cleaned.length === OTP_LENGTH) {
      submitOtpWithCode(nextDigits.join(''));
    }
  };

  const submitOtpWithCode = async (code) => {
    if (otpLoading || lockoutCooldown > 0) return;
    if (code.length < OTP_LENGTH) {
      setOtpError('Please enter the complete verification code.');
      return;
    }

    setOtpLoading(true);
    setOtpError('');

    const { error } = await verifyOtp({
      email: otpEmail,
      token: code,
    });

    setOtpLoading(false);

    if (error) {
      const attempts =
        parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.WRONG_ATTEMPTS) || '0', 10) + 1;
      sessionStorage.setItem(OTP_STORAGE_KEYS.WRONG_ATTEMPTS, attempts.toString());

      setOtpError(mapOtpError(error));
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      otpInputsRef.current[0]?.focus();

      if (attempts >= 5) {
        const endTime = Date.now() + 60000;
        sessionStorage.setItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL, endTime.toString());
        setLockoutCooldown(60);
      }
    } else {
      // Success! Clear session storage and redirect
      sessionStorage.removeItem(OTP_STORAGE_KEYS.PENDING_EMAIL);
      sessionStorage.removeItem(OTP_STORAGE_KEYS.RESEND_COUNT);
      sessionStorage.removeItem(OTP_STORAGE_KEYS.WRONG_ATTEMPTS);
      sessionStorage.removeItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL);
      sessionStorage.removeItem(OTP_STORAGE_KEYS.RESEND_UNTIL);
      setOtpSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 1000);
    }
  };

  // ── Handle Resend OTP ───────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || otpLoading) return;

    const count = parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.RESEND_COUNT) || '0', 10);
    if (count >= 5) {
      setResendStatusMsg('Too many requests. Please wait a few minutes.');
      return;
    }

    setResendStatusMsg('');
    const { error } = await resend({ email: otpEmail });

    if (error) {
      setResendStatusMsg(mapOtpError(error));
      return;
    }

    const newCount = count + 1;
    sessionStorage.setItem(OTP_STORAGE_KEYS.RESEND_COUNT, newCount.toString());

    setResendStatusMsg('A new code has been sent.');
    setTimeout(() => {
      setResendStatusMsg('');
    }, 3000);

    if (newCount >= 5) {
      setResendStatusMsg('Too many requests. Please wait a few minutes.');
    } else {
      sessionStorage.setItem(OTP_STORAGE_KEYS.RESEND_UNTIL, (Date.now() + 60000).toString());
      setResendCooldown(60);
    }
  };

  // ── Handle Forgot Password ──────────────────────────────────
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess(false);

    if (!forgotEmail) {
      setForgotError('Please enter your email.');
      return;
    }

    setForgotLoading(true);
    const resetUrl = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: resetUrl,
    });

    setForgotLoading(false);

    if (error && error.message?.includes('rate limit')) {
      setForgotError(mapErrorMsg(error));
    } else {
      // Neutral message to prevent guessing
      setForgotSuccess(true);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <Logo variant="stacked" size="xl" tagline="Create. Edit. Refine." />
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          {view === 'signin' || view === 'signup' ? (
            <div id="auth-main-container">
              <div className="auth-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  className={`auth-tab ${view === 'signin' ? 'active' : ''}`}
                  id="tab-signin"
                  aria-selected={view === 'signin'}
                  onClick={() => {
                    setView('signin');
                    window.location.hash = 'signin';
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`auth-tab ${view === 'signup' ? 'active' : ''}`}
                  id="tab-signup"
                  aria-selected={view === 'signup'}
                  onClick={() => {
                    setView('signup');
                    window.location.hash = 'signup';
                  }}
                >
                  Create account
                </button>
              </div>

              {/* SIGN IN FORM */}
              {view === 'signin' && (
                <form id="form-signin" className="auth-form" onSubmit={handleSignInSubmit} noValidate>
                  <div className="auth-field">
                    <label htmlFor="signin-email">Email</label>
                    <div className="auth-input-wrap">
                      <input
                        type="email"
                        id="signin-email"
                        className="auth-input"
                        autoComplete="email"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-field">
                    <label htmlFor="signin-pwd">Password</label>
                    <div className="auth-input-wrap">
                      <input
                        type={showSignInPwd ? 'text' : 'password'}
                        id="signin-pwd"
                        className="auth-input"
                        autoComplete="current-password"
                        value={signInPwd}
                        onChange={(e) => setSignInPwd(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="auth-toggle-pwd"
                        tabIndex={-1}
                        aria-label="Toggle password visibility"
                        onClick={() => setShowSignInPwd((prev) => !prev)}
                      >
                        {showSignInPwd ? (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            width="16"
                            height="16"
                          >
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
                          </svg>
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            width="16"
                            height="16"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="auth-links">
                    <div />
                    <button
                      type="button"
                      className="auth-link"
                      id="btn-forgot-pwd"
                      onClick={() => setView('forgot')}
                    >
                      Forgot password?
                    </button>
                  </div>

                  {signInError && (
                    <div
                      className="auth-error-msg active auth-text-center auth-mt-4"
                      id="signin-global-err"
                      role="alert"
                    >
                      {signInError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="auth"
                    id="btn-submit-signin"
                    loading={signInLoading}
                  >
                    Sign in
                  </Button>

                  {GUEST_MODE_ENABLED && (
                    <div id="guest-mode-container" className="auth-text-center auth-mt-4">
                      <button
                        type="button"
                        className="auth-link"
                        id="btn-guest"
                        onClick={() => {
                          enterGuestMode();
                          navigate('/');
                        }}
                      >
                        Continue as guest
                      </button>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                        Log in to save your images.
                      </p>
                    </div>
                  )}
                </form>
              )}

              {/* SIGN UP FORM */}
              {view === 'signup' && (
                <form id="form-signup" className="auth-form" onSubmit={handleSignUpSubmit} noValidate>
                  <div className="auth-field">
                    <label htmlFor="signup-name">Full name</label>
                    <div className="auth-input-wrap">
                      <input
                        type="text"
                        id="signup-name"
                        className="auth-input"
                        autoComplete="name"
                        value={signUpName}
                        onChange={(e) => setSignUpName(e.target.value)}
                        required
                      />
                    </div>
                    {signUpFieldErrors.name && (
                      <div className="auth-error-msg active" role="alert">
                        {signUpFieldErrors.name}
                      </div>
                    )}
                  </div>

                  <div className="auth-field">
                    <label htmlFor="signup-username">Username</label>
                    <div className="auth-input-wrap">
                      <input
                        type="text"
                        id="signup-username"
                        className="auth-input"
                        autoComplete="username"
                        value={signUpUsername}
                        onChange={(e) =>
                          setSignUpUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                        }
                        required
                      />
                    </div>
                    {signUpFieldErrors.username && (
                      <div className="auth-error-msg active" role="alert">
                        {signUpFieldErrors.username}
                      </div>
                    )}
                  </div>

                  <div className="auth-field">
                    <label htmlFor="signup-email">Email</label>
                    <div className="auth-input-wrap">
                      <input
                        type="email"
                        id="signup-email"
                        className="auth-input"
                        autoComplete="email"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        required
                      />
                    </div>
                    {signUpFieldErrors.email && (
                      <div className="auth-error-msg active" role="alert">
                        {signUpFieldErrors.email}
                      </div>
                    )}
                  </div>

                  <div className="auth-field">
                    <label htmlFor="signup-pwd">Password</label>
                    <div className="auth-input-wrap">
                      <input
                        type={showSignUpPwd ? 'text' : 'password'}
                        id="signup-pwd"
                        className="auth-input"
                        autoComplete="new-password"
                        value={signUpPwd}
                        onChange={(e) => setSignUpPwd(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="auth-toggle-pwd"
                        tabIndex={-1}
                        aria-label="Toggle password visibility"
                        onClick={() => setShowSignUpPwd((prev) => !prev)}
                      >
                        {showSignUpPwd ? (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            width="16"
                            height="16"
                          >
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
                          </svg>
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            width="16"
                            height="16"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <div className="pwd-strength">
                      <div
                        className="pwd-strength-bar"
                        style={{
                          background: pwdStrength >= 1 ? 'var(--danger)' : 'var(--border)',
                        }}
                      />
                      <div
                        className="pwd-strength-bar"
                        style={{
                          background: pwdStrength >= 2 ? 'var(--warning)' : 'var(--border)',
                        }}
                      />
                      <div
                        className="pwd-strength-bar"
                        style={{
                          background: pwdStrength >= 3 ? 'var(--success)' : 'var(--border)',
                        }}
                      />
                    </div>
                    <div className="pwd-strength-text">{pwdStrengthText}</div>
                    <ul className="pwd-rules">
                      <li className={pwdLen ? 'valid' : ''}>At least 8 characters</li>
                    </ul>
                    {signUpFieldErrors.pwd && (
                      <div className="auth-error-msg active" role="alert">
                        {signUpFieldErrors.pwd}
                      </div>
                    )}
                  </div>

                  <div className="auth-field">
                    <label htmlFor="signup-pwd-confirm">Confirm password</label>
                    <div className="auth-input-wrap">
                      <input
                        type="password"
                        id="signup-pwd-confirm"
                        className="auth-input"
                        autoComplete="new-password"
                        value={signUpPwdConfirm}
                        onChange={(e) => setSignUpPwdConfirm(e.target.value)}
                        required
                      />
                    </div>
                    {signUpFieldErrors.pwdConfirm && (
                      <div className="auth-error-msg active" role="alert">
                        {signUpFieldErrors.pwdConfirm}
                      </div>
                    )}
                  </div>

                  <div className="auth-checkbox-wrap">
                    <input
                      type="checkbox"
                      id="signup-terms"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      required
                    />
                    <label htmlFor="signup-terms">
                      I agree to the{' '}
                      <Link to="/terms" className="auth-link" target="_blank">
                        Terms
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" className="auth-link" target="_blank">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>
                  {signUpFieldErrors.terms && (
                    <div className="auth-error-msg active" role="alert">
                      {signUpFieldErrors.terms}
                    </div>
                  )}

                  {signUpError && (
                    <div
                      className="auth-error-msg active auth-text-center"
                      id="signup-global-err"
                      role="alert"
                    >
                      {signUpError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="auth"
                    id="btn-submit-signup"
                    disabled={!pwdLen || !agreeTerms}
                    loading={signUpLoading}
                  >
                    Create account
                  </Button>
                </form>
              )}
            </div>
          ) : view === 'otp' ? (
            /* OTP VERIFICATION VIEW */
            <div id="auth-verify-container" className="verify-panel auth-text-center" role="region">
              <div style={{ margin: '12px auto 20px', color: 'var(--gold)' }}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="48"
                  height="48"
                  aria-hidden="true"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>

              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.75rem',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: 'var(--text)',
                }}
              >
                Verify your email
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                We sent a code to{' '}
                <strong style={{ color: 'var(--text)', fontWeight: 600 }}>
                  {maskEmail(otpEmail)}
                </strong>
              </p>

              {otpNotice && (
                <div
                  className="auth-info-notice"
                  style={{
                    marginBottom: '16px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    background: 'rgba(212, 175, 55, 0.1)',
                    border: '1px solid var(--gold-soft)',
                    color: 'var(--gold-soft)',
                  }}
                  role="status"
                >
                  {otpNotice}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitOtpWithCode(otpDigits.join(''));
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                <div className="otp-inputs-wrap" onPaste={handleOtpPaste}>
                  {Array.from({ length: OTP_LENGTH }).map((_, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputsRef.current[idx] = el)}
                      type="text"
                      className="otp-digit-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[a-zA-Z0-9]*"
                      maxLength={1}
                      aria-label={`Character ${idx + 1} of ${OTP_LENGTH}`}
                      value={otpDigits[idx]}
                      disabled={otpLoading || lockoutCooldown > 0}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    />
                  ))}
                </div>

                {otpError && (
                  <div className="auth-error-msg active auth-text-center" role="alert">
                    {otpError}
                  </div>
                )}

                {lockoutCooldown > 0 && (
                  <div className="auth-error-msg active auth-text-center" role="alert">
                    Too many attempts. Please wait {lockoutCooldown}s.
                  </div>
                )}

                {otpSuccess && (
                  <div
                    style={{
                      color: 'var(--success)',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                    }}
                    role="status"
                  >
                    ✓ Email verified! Redirecting to Pixabel...
                  </div>
                )}

                {!otpSuccess && (
                  <Button
                    type="submit"
                    variant="auth"
                    disabled={lockoutCooldown > 0 || otpDigits.join('').length < OTP_LENGTH}
                    loading={otpLoading}
                  >
                    {lockoutCooldown > 0 ? `Locked (${lockoutCooldown}s)` : 'Verify'}
                  </Button>
                )}

                <div
                  className="otp-actions-wrap"
                  style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}
                >
                  <button
                    type="button"
                    className="auth-link"
                    id="btn-resend-otp"
                    disabled={resendCooldown > 0 || otpLoading}
                    onClick={handleResendOtp}
                    style={{ fontSize: '0.9rem' }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>

                  {resendStatusMsg && (
                    <div
                      className={`auth-text-center ${
                        resendStatusMsg.includes('sent') ? 'auth-success-msg' : 'auth-error-msg active'
                      }`}
                      style={{ fontSize: '0.85rem' }}
                    >
                      {resendStatusMsg}
                    </div>
                  )}

                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => closeOtpScreen('signup')}
                    style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}
                  >
                    ← Use a different email
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* FORGOT PASSWORD VIEW */
            <div id="auth-forgot-container" className="forgot-panel">
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.5rem',
                  marginBottom: '8px',
                  color: 'var(--text)',
                }}
              >
                Reset Password
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>

              <form
                onSubmit={handleForgotSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                noValidate
              >
                <div className="auth-field">
                  <label htmlFor="forgot-email">Email</label>
                  <div className="auth-input-wrap">
                    <input
                      type="email"
                      id="forgot-email"
                      className="auth-input"
                      autoComplete="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {forgotError && (
                  <div className="auth-error-msg active auth-text-center" role="alert">
                    {forgotError}
                  </div>
                )}

                {forgotSuccess && (
                  <div
                    style={{
                      color: 'var(--success)',
                      fontSize: '0.85rem',
                      textAlign: 'center',
                    }}
                    role="status"
                  >
                    If that email exists, we sent a link.
                  </div>
                )}

                <Button type="submit" variant="auth" loading={forgotLoading}>
                  Send reset link
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setView('signin')}
                  style={{ width: '100%', padding: '14px' }}
                >
                  Back to login
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
