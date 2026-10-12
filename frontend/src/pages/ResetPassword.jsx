import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import './ResetPassword.css';

export function ResetPassword() {
  const [isRecoveryValid, setIsRecoveryValid] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pwd, setPwd] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for password recovery event or existing session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === 'PASSWORD_RECOVERY' ||
        (event === 'SIGNED_IN' && window.location.hash.includes('type=recovery')) ||
        session
      ) {
        setIsRecoveryValid(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session || window.location.hash.includes('type=recovery')) {
        setIsRecoveryValid(true);
      }
      setChecking(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isLen = pwd.length >= 8;
  let strength = 0;
  if (isLen) strength++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd)) strength++;
  if (/[^A-Za-z0-9]/.test(pwd)) strength++;

  const strengthText =
    pwd.length === 0 ? 'Weak' : strength === 1 ? 'Weak' : strength === 2 ? 'Fair' : 'Strong';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (pwd !== pwdConfirm) {
      setError('Passwords do not match.');
      return;
    }
    if (pwd.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);

    if (updateError) {
      setError(updateError.message || 'Failed to update password.');
    } else {
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
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
          <div className="forgot-panel active">
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.5rem',
                marginBottom: '8px',
                color: 'var(--text)',
              }}
            >
              Set New Password
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Please enter your new password below.
            </p>

            {checking ? (
              <p style={{ color: 'var(--text-muted)' }}>Verifying reset token...</p>
            ) : !isRecoveryValid ? (
              <div className="reset-invalid-box">
                <p style={{ color: 'var(--danger)' }}>
                  The password reset link is invalid or has expired.
                </p>
                <Link to="/login" className="auth-btn-primary" style={{ textDecoration: 'none' }}>
                  Request new link
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="auth-field">
                  <label htmlFor="reset-pwd">New Password</label>
                  <div className="auth-input-wrap">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      id="reset-pwd"
                      className="auth-input"
                      autoComplete="new-password"
                      value={pwd}
                      onChange={(e) => setPwd(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="auth-toggle-pwd"
                      tabIndex={-1}
                      aria-label="Toggle password visibility"
                      onClick={() => setShowPwd((prev) => !prev)}
                    >
                      {showPwd ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="pwd-strength">
                    <div className="pwd-strength-bar" style={{ background: strength >= 1 ? 'var(--danger)' : 'var(--border)' }} />
                    <div className="pwd-strength-bar" style={{ background: strength >= 2 ? 'var(--warning)' : 'var(--border)' }} />
                    <div className="pwd-strength-bar" style={{ background: strength >= 3 ? 'var(--success)' : 'var(--border)' }} />
                  </div>
                  <div className="pwd-strength-text">{strengthText}</div>
                  <ul className="pwd-rules">
                    <li className={isLen ? 'valid' : ''}>At least 8 characters</li>
                  </ul>
                </div>

                <div className="auth-field">
                  <label htmlFor="reset-pwd-confirm">Confirm Password</label>
                  <div className="auth-input-wrap">
                    <input
                      type="password"
                      id="reset-pwd-confirm"
                      className="auth-input"
                      autoComplete="new-password"
                      value={pwdConfirm}
                      onChange={(e) => setPwdConfirm(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="auth-error-msg active auth-text-center" role="alert">
                    {error}
                  </div>
                )}

                {success && (
                  <div style={{ color: 'var(--success)', fontSize: '0.85rem', textAlign: 'center' }} role="status">
                    Password updated successfully. Redirecting...
                  </div>
                )}

                <Button type="submit" variant="auth" disabled={!isLen} loading={loading}>
                  Update Password
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
