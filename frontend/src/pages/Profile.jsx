import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/Toast';
import { Header } from '../components/Header';
import { ConfirmDialog, MODEL_LABELS } from '../components/Modal';
import { supabase } from '../lib/supabase';
import { Storage } from '../lib/storage';
import './Profile.css';

function getDeterministicGradient(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 60%, 40%), hsl(${h2}, 60%, 20%))`;
}

export function Profile() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Active Tab state
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return ['overview', 'account', 'security', 'preferences'].includes(hash)
      ? hash
      : 'overview';
  });

  // Sync hash with active tab
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (['overview', 'account', 'security', 'preferences'].includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const switchTab = (tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Local generation stats state
  const [stats, setStats] = useState({
    total: 0,
    favorites: 0,
    edits: 0,
    topModel: '-',
    topStyle: '-',
    lastGenerated: '-',
  });

  const loadStats = useCallback(async () => {
    try {
      const records = await Storage.getAllGenerations();
      if (!records || records.length === 0) {
        setStats({
          total: 0,
          favorites: 0,
          edits: 0,
          topModel: '-',
          topStyle: '-',
          lastGenerated: '-',
        });
        return;
      }

      let favCount = 0;
      let editCount = 0;
      const modelCounts = {};
      const styleCounts = {};

      records.forEach((r) => {
        if (r.favorite) favCount++;
        if (r.type === 'edit') editCount++;

        const m = r.model || 'unknown';
        modelCounts[m] = (modelCounts[m] || 0) + 1;

        const s = r.style || 'none';
        styleCounts[s] = (styleCounts[s] || 0) + 1;
      });

      const topModelKey = Object.keys(modelCounts).sort(
        (a, b) => modelCounts[b] - modelCounts[a]
      )[0];
      const topStyleKey = Object.keys(styleCounts).sort(
        (a, b) => styleCounts[b] - styleCounts[a]
      )[0];

      const lastDate = records[0]?.createdAt
        ? new Date(records[0].createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '-';

      setStats({
        total: records.length,
        favorites: favCount,
        edits: editCount,
        topModel: MODEL_LABELS[topModelKey] || topModelKey || '-',
        topStyle: topStyleKey === 'none' ? 'None' : topStyleKey || '-',
        lastGenerated: lastDate,
      });
    } catch (err) {
      console.warn('Failed to compute stats:', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Storage.getAllGenerations().then((records) => {
      if (!active) return;
      if (!records || records.length === 0) {
        setStats({
          total: 0,
          favorites: 0,
          edits: 0,
          topModel: '-',
          topStyle: '-',
          lastGenerated: '-',
        });
        return;
      }

      let favCount = 0;
      let editCount = 0;
      const modelCounts = {};
      const styleCounts = {};

      records.forEach((r) => {
        if (r.favorite) favCount++;
        if (r.type === 'edit') editCount++;

        const m = r.model || 'unknown';
        modelCounts[m] = (modelCounts[m] || 0) + 1;

        const s = r.style || 'none';
        styleCounts[s] = (styleCounts[s] || 0) + 1;
      });

      const topModelKey = Object.keys(modelCounts).sort(
        (a, b) => modelCounts[b] - modelCounts[a]
      )[0];
      const topStyleKey = Object.keys(styleCounts).sort(
        (a, b) => styleCounts[b] - styleCounts[a]
      )[0];

      const lastDate = records[0]?.createdAt
        ? new Date(records[0].createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '-';

      setStats({
        total: records.length,
        favorites: favCount,
        edits: editCount,
        topModel: MODEL_LABELS[topModelKey] || topModelKey || '-',
        topStyle: topStyleKey === 'none' ? 'None' : topStyleKey || '-',
        lastGenerated: lastDate,
      });
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // ── Account Tab State ──
  const [fullName, setFullName] = useState(() => user?.user_metadata?.full_name || '');
  const [username, setUsername] = useState(() => user?.user_metadata?.username || '');
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');

  const hasAccountChanges = useMemo(() => {
    const origName = user?.user_metadata?.full_name || '';
    const origUser = user?.user_metadata?.username || '';
    return fullName.trim() !== origName || username.trim() !== origUser;
  }, [fullName, username, user]);

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    const fn = fullName.trim();
    const un = username.trim();

    if (fn.length < 2 || fn.length > 50) {
      setAccountError('Full name must be between 2 and 50 characters.');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(un)) {
      setAccountError(
        'Username must be 3-20 characters long, and contain only lowercase letters, numbers, and underscores.'
      );
      return;
    }
    setAccountError('');
    setAccountSaving(true);

    const { error } = await supabase.auth.updateUser({
      data: { full_name: fn, username: un },
    });

    setAccountSaving(false);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Account updated successfully');
    }
  };

  // ── Security Tab State ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdUpdating, setPwdUpdating] = useState(false);

  // Danger Zone Modals
  const [isSignoutAllOpen, setIsSignoutAllOpen] = useState(false);
  const [isDeleteLocalOpen, setIsDeleteLocalOpen] = useState(false);
  const [deleteIncludeFavs, setDeleteIncludeFavs] = useState(false);

  // Password requirements calculation
  const pwdReqs = useMemo(() => {
    return {
      length: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      number: /[0-9\W]/.test(newPassword),
    };
  }, [newPassword]);

  const pwdScore = useMemo(() => {
    let score = 0;
    if (pwdReqs.length) score++;
    if (pwdReqs.upper) score++;
    if (pwdReqs.lower) score++;
    if (pwdReqs.number) score++;
    return score;
  }, [pwdReqs]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (pwdScore < 4) {
      showToast('Please satisfy all password requirements', 'error');
      return;
    }

    setPwdUpdating(true);

    // Verify current password first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email,
      password: currentPassword,
    });

    if (signInError) {
      showToast('Current password is incorrect', 'error');
      setPwdUpdating(false);
      return;
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setPwdUpdating(false);
    if (updateError) {
      showToast(updateError.message, 'error');
    } else {
      showToast('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleConfirmSignoutAll = async () => {
    setIsSignoutAllOpen(false);
    await signOut({ scope: 'global' });
    navigate('/login');
  };

  const handleConfirmDeleteLocal = async () => {
    await Storage.clearAll(deleteIncludeFavs);
    setIsDeleteLocalOpen(false);
    showToast('Local generation history deleted');
    await loadStats();
  };

  // ── Preferences Tab State ──
  const [prefTheme, setPrefTheme] = useState(() => theme || 'system');
  const [prefModel, setPrefModel] = useState(() => {
    return (
      user?.user_metadata?.preferences?.model ||
      localStorage.getItem('default_model') ||
      'flux-schnell'
    );
  });
  const [prefStyle, setPrefStyle] = useState(() => {
    return (
      user?.user_metadata?.preferences?.style ||
      localStorage.getItem('default_style') ||
      'none'
    );
  });
  const [prefAspect, setPrefAspect] = useState(() => {
    return (
      user?.user_metadata?.preferences?.aspect ||
      localStorage.getItem('default_aspect') ||
      '1024x1024'
    );
  });
  const [prefSaving, setPrefSaving] = useState(false);

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setPrefSaving(true);

    // Update ThemeContext
    setTheme(prefTheme);

    // Save to localStorage for generate tab
    localStorage.setItem('default_model', prefModel);
    localStorage.setItem('default_style', prefStyle);
    localStorage.setItem('default_aspect', prefAspect);

    // Save to user metadata
    const { error } = await supabase.auth.updateUser({
      data: {
        preferences: {
          model: prefModel,
          style: prefStyle,
          aspect: prefAspect,
        },
      },
    });

    setPrefSaving(false);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Preferences saved successfully');
    }
  };

  // User meta helpers
  const initials = (user?.user_metadata?.full_name || user?.email || 'U')
    .slice(0, 2)
    .toUpperCase();
  const avatarGradient = getDeterministicGradient(user?.id || user?.email || 'user');

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '-';

  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '-';

  return (
    <div className="profile-page">
      <Header showTabs={false} backToApp={true} />

      <div className="profile-layout">
        {/* Navigation Sidebar */}
        <nav className="profile-nav" aria-label="Profile navigation">
          <button
            type="button"
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => switchTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => switchTab('account')}
          >
            Account
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => switchTab('security')}
          >
            Security
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => switchTab('preferences')}
          >
            Preferences
          </button>
        </nav>

        {/* Content Tabs */}
        <main className="profile-content">
          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div>
              <h2 className="profile-tab-title">Overview</h2>

              <div className="overview-header">
                <div
                  className="avatar-circle"
                  style={{ background: avatarGradient }}
                  aria-hidden="true"
                >
                  {initials}
                </div>

                <div className="overview-info">
                  <h3>{user?.user_metadata?.full_name || 'User'}</h3>
                  <div className="overview-email-row">
                    <span>{user?.email}</span>
                    {user?.email_confirmed_at && (
                      <span className="verified-badge">Verified</span>
                    )}
                  </div>
                  <div className="overview-meta">
                    Member since: {memberSince}
                    <br />
                    Last sign-in: {lastSignIn}
                  </div>
                </div>
              </div>

              <h4 className="section-subtitle">
                Generation Stats <span>(Device statistics)</span>
              </h4>

              {stats.total === 0 ? (
                <div className="profile-empty-state">
                  <p>You haven't generated any images yet.</p>
                  <Link
                    to="/?tab=generate"
                    className="btn-primary"
                    style={{ textDecoration: 'none', display: 'inline-block' }}
                  >
                    Start Generating
                  </Link>
                </div>
              ) : (
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total Images</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.favorites}</div>
                    <div className="stat-label">Favorites</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.edits}</div>
                    <div className="stat-label">Edited Images</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value text-sm">{stats.topModel}</div>
                    <div className="stat-label">Most Used Model</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value text-sm">{stats.topStyle}</div>
                    <div className="stat-label">Most Used Style</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value text-sm">{stats.lastGenerated}</div>
                    <div className="stat-label">Last Generated</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ACCOUNT TAB ── */}
          {activeTab === 'account' && (
            <div>
              <h2 className="profile-tab-title">Account Details</h2>

              <form className="profile-form" onSubmit={handleSaveAccount}>
                {accountError && <div className="profile-error-msg">{accountError}</div>}

                <div className="profile-input-group">
                  <label htmlFor="full_name">Full Name</label>
                  <input
                    id="full_name"
                    type="text"
                    className="profile-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    minLength={2}
                    maxLength={50}
                    required
                  />
                </div>

                <div className="profile-input-group">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    className="profile-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    pattern="[a-z0-9_]{3,20}"
                    title="3-20 characters, lowercase letters, numbers, underscore only"
                    required
                  />
                  <span className="profile-hint">
                    3-20 characters, lowercase letters, numbers, and underscores only.
                  </span>
                </div>

                <div className="profile-input-group">
                  <label htmlFor="account-email">Email</label>
                  <input
                    id="account-email"
                    type="email"
                    className="profile-input"
                    value={user?.email || ''}
                    disabled
                  />
                  <span className="profile-hint">Email changes are not available yet.</span>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start' }}
                  disabled={!hasAccountChanges || accountSaving}
                >
                  {accountSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {/* ── SECURITY TAB ── */}
          {activeTab === 'security' && (
            <div>
              <h2 className="profile-tab-title">Security</h2>

              <div className="settings-card">
                <h3>Change Password</h3>
                <form className="profile-form" onSubmit={handleUpdatePassword}>
                  <div className="profile-input-group">
                    <label htmlFor="current_password">Current Password</label>
                    <input
                      id="current_password"
                      type="password"
                      className="profile-input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="profile-input-group">
                    <label htmlFor="new_password">New Password</label>
                    <input
                      id="new_password"
                      type="password"
                      className="profile-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />

                    {/* Password Strength Meter */}
                    <div
                      style={{
                        height: '4px',
                        background: 'var(--border)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginTop: '6px',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pwdScore * 25}%`,
                          background:
                            pwdScore < 2 ? 'var(--danger)' : pwdScore < 4 ? '#eab308' : 'var(--success)',
                          transition: 'width 0.3s ease, background 0.3s ease',
                        }}
                      />
                    </div>

                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: '10px 0 0 0',
                        fontSize: '0.78rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <li style={{ color: pwdReqs.length ? 'var(--success)' : 'var(--text-muted)' }}>
                        {pwdReqs.length ? '✓' : '○'} At least 8 characters
                      </li>
                      <li style={{ color: pwdReqs.upper ? 'var(--success)' : 'var(--text-muted)' }}>
                        {pwdReqs.upper ? '✓' : '○'} One uppercase letter
                      </li>
                      <li style={{ color: pwdReqs.lower ? 'var(--success)' : 'var(--text-muted)' }}>
                        {pwdReqs.lower ? '✓' : '○'} One lowercase letter
                      </li>
                      <li style={{ color: pwdReqs.number ? 'var(--success)' : 'var(--text-muted)' }}>
                        {pwdReqs.number ? '✓' : '○'} One number or special character
                      </li>
                    </ul>
                  </div>

                  <div className="profile-input-group">
                    <label htmlFor="confirm_password">Confirm New Password</label>
                    <input
                      id="confirm_password"
                      type="password"
                      className="profile-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ alignSelf: 'flex-start' }}
                    disabled={pwdUpdating || !currentPassword || !newPassword}
                  >
                    {pwdUpdating ? 'Updating…' : 'Update Password'}
                  </button>
                </form>
              </div>

              {/* Danger Zone */}
              <div className="settings-card danger-zone">
                <h3>Danger Zone</h3>

                <div className="danger-zone-item">
                  <p>Sign out of all active sessions across all devices.</p>
                  <button
                    type="button"
                    className="btn-danger-outline"
                    onClick={() => setIsSignoutAllOpen(true)}
                  >
                    Sign out of all devices
                  </button>
                </div>

                <div className="danger-zone-item">
                  <p>Clear all local generation history and saved images in this browser.</p>
                  <button
                    type="button"
                    className="btn-danger-outline"
                    onClick={() => setIsDeleteLocalOpen(true)}
                  >
                    Delete local data
                  </button>
                </div>

                <div className="danger-zone-item">
                  <p style={{ opacity: 0.5 }}>Account deletion is coming soon.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── PREFERENCES TAB ── */}
          {activeTab === 'preferences' && (
            <div>
              <h2 className="profile-tab-title">Preferences</h2>

              <form className="profile-form" onSubmit={handleSavePreferences}>
                <div className="profile-input-group">
                  <label htmlFor="pref-theme">Theme</label>
                  <select
                    id="pref-theme"
                    className="profile-input"
                    value={prefTheme}
                    onChange={(e) => setPrefTheme(e.target.value)}
                  >
                    <option value="system">System Default</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>

                <div className="profile-input-group">
                  <label htmlFor="pref-model">Default Model</label>
                  <select
                    id="pref-model"
                    className="profile-input"
                    value={prefModel}
                    onChange={(e) => setPrefModel(e.target.value)}
                  >
                    <option value="flux-schnell">FLUX Schnell</option>
                    <option value="flux-dev">FLUX Dev</option>
                    <option value="sd3.5">Stable Diffusion 3.5</option>
                    <option value="sdxl">Stable Diffusion XL</option>
                  </select>
                </div>

                <div className="profile-input-group">
                  <label htmlFor="pref-style">Default Style Preset</label>
                  <select
                    id="pref-style"
                    className="profile-input"
                    value={prefStyle}
                    onChange={(e) => setPrefStyle(e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="Realistic Photo">Realistic Photo</option>
                    <option value="Anime">Anime</option>
                    <option value="3D Render">3D Render</option>
                    <option value="Digital Art">Digital Art</option>
                    <option value="Oil Painting">Oil Painting</option>
                  </select>
                </div>

                <div className="profile-input-group">
                  <label htmlFor="pref-aspect">Default Aspect Ratio</label>
                  <select
                    id="pref-aspect"
                    className="profile-input"
                    value={prefAspect}
                    onChange={(e) => setPrefAspect(e.target.value)}
                  >
                    <option value="1024x1024">Square (1:1)</option>
                    <option value="1024x1536">Portrait (2:3)</option>
                    <option value="1536x1024">Landscape (3:2)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start' }}
                  disabled={prefSaving}
                >
                  {prefSaving ? 'Saving…' : 'Save Preferences'}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Global Sign Out Modal */}
      <ConfirmDialog
        isOpen={isSignoutAllOpen}
        onClose={() => setIsSignoutAllOpen(false)}
        onConfirm={handleConfirmSignoutAll}
        title="Sign Out Everywhere"
        message="Are you sure you want to sign out of all devices? This will invalidate all your sessions."
        confirmText="Sign Out All"
        isDanger={true}
      />

      {/* Delete Local Data Modal */}
      <ConfirmDialog
        isOpen={isDeleteLocalOpen}
        onClose={() => {
          setIsDeleteLocalOpen(false);
          setDeleteIncludeFavs(false);
        }}
        onConfirm={handleConfirmDeleteLocal}
        title="Delete Local Data"
        message="Are you sure you want to delete your local history? This cannot be undone."
        confirmText="Delete History"
        isDanger={true}
      >
        <label className="confirm-checkbox-label">
          <input
            type="checkbox"
            checked={deleteIncludeFavs}
            onChange={(e) => setDeleteIncludeFavs(e.target.checked)}
          />
          <span>Also delete favorited images</span>
        </label>
      </ConfirmDialog>
    </div>
  );
}
