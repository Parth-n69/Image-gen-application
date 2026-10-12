(() => {
  "use strict";

  let supabaseClient = null;
  let currentUser = null;

  if (typeof window.supabase !== 'undefined' && typeof SUPABASE_URL !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    window.location.replace('login.html');
    return;
  }

  // ── UI ELEMENTS ───────────────────────────────────────────
  const navItems = document.querySelectorAll('.nav-item');
  const tabs = document.querySelectorAll('.profile-tab');
  const skeletonLoader = document.getElementById('skeleton-loader');
  
  const toastEl = document.getElementById('toast');
  function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.style.display = 'block';
    toastEl.style.borderColor = type === 'error' ? '#ef4444' : 'var(--gold)';
    toastEl.classList.remove('hidden');
    setTimeout(() => {
      toastEl.classList.add('hidden');
      setTimeout(() => { toastEl.style.display = 'none'; }, 300);
    }, 3000);
  }

  // ── ROUTING ───────────────────────────────────────────────
  function switchTab(hash) {
    if (!hash) hash = '#overview';
    const targetId = 'tab-' + hash.substring(1);
    
    let found = false;
    tabs.forEach(tab => {
      if (tab.id === targetId) {
        tab.classList.remove('hidden');
        found = true;
      } else {
        tab.classList.add('hidden');
      }
    });

    if (!found) {
      document.getElementById('tab-overview').classList.remove('hidden');
      hash = '#overview';
    }

    navItems.forEach(item => {
      if (item.getAttribute('href') === hash) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  window.addEventListener('hashchange', () => switchTab(window.location.hash));

  // ── DATA LOADING ──────────────────────────────────────────
  async function loadProfile() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        window.location.replace('login.html');
        return;
      }
      currentUser = session.user;
    } catch (err) {
      console.error('Session error', err);
      window.location.replace('login.html');
      return;
    }
    
    // Fill Account Tab
    try {
      const fullNameInput = document.getElementById('full_name');
      const usernameInput = document.getElementById('username');
      const emailInput = document.getElementById('email');
      
      fullNameInput.value = currentUser.user_metadata?.full_name || '';
      usernameInput.value = currentUser.user_metadata?.username || '';
      emailInput.value = currentUser.email || '';
    } catch (err) { console.error('Account tab init error', err); }
    
    // Fill Overview Tab
    try {
      document.getElementById('display-name').textContent = currentUser.user_metadata?.full_name || 'User';
      document.getElementById('display-email').textContent = currentUser.email || '';
      
      if (currentUser.email_confirmed_at) {
        document.getElementById('email-verified-badge').classList.remove('hidden');
      }
      
      if (currentUser.created_at) {
        const date = new Date(currentUser.created_at);
        document.getElementById('member-since').textContent = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      
      if (currentUser.last_sign_in_at) {
        const date = new Date(currentUser.last_sign_in_at);
        document.getElementById('last-signin').textContent = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch (err) { console.error('Overview tab init error', err); }
    
    // Avatar
    try {
      const initials = (currentUser.user_metadata?.full_name || 'U').substring(0, 2).toUpperCase();
      const avatar = document.getElementById('profile-avatar');
      avatar.textContent = initials;
      avatar.style.background = getDeterministicGradient(currentUser.id || currentUser.email || 'user');
    } catch (err) { console.error('Avatar init error', err); }
    
    // Fill Preferences Tab
    try {
      const prefs = currentUser.user_metadata?.preferences || {};
      document.getElementById('pref-theme').value = localStorage.getItem('theme') || 'system';
      document.getElementById('pref-model').value = prefs.model || 'flux-schnell';
      document.getElementById('pref-style').value = prefs.style || 'none';
      document.getElementById('pref-aspect').value = prefs.aspect || '1024x1024';
    } catch (err) { console.error('Preferences tab init error', err); }

    try {
      await loadStats();
    } catch (err) { console.error('Stats load error', err); }

    skeletonLoader.classList.add('hidden');
    switchTab(window.location.hash);
  }
  
  function getDeterministicGradient(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash) % 360;
    const h2 = (h1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${h1}, 60%, 40%), hsl(${h2}, 60%, 20%))`;
  }

  async function loadStats() {
    if (typeof Storage === 'undefined') return;
    
    const records = await Storage.getAllGenerations();
    if (records.length === 0) {
      document.getElementById('stats-grid').classList.add('hidden');
      document.getElementById('empty-state').classList.remove('hidden');
      return;
    }
    
    const total = records.length;
    let favorites = 0;
    let edits = 0;
    const models = {};
    const styles = {};
    
    records.forEach(r => {
      if (r.favorite) favorites++;
      if (r.type === 'edit') edits++;
      
      const m = r.model || 'unknown';
      models[m] = (models[m] || 0) + 1;
      
      const s = r.style || 'none';
      styles[s] = (styles[s] || 0) + 1;
    });
    
    const mostUsedModel = Object.keys(models).sort((a,b) => models[b] - models[a])[0];
    const mostUsedStyle = Object.keys(styles).sort((a,b) => styles[b] - styles[a])[0];
    const lastGen = new Date(records[0].createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    
    const MODEL_LABELS = {
      "flux-schnell": "FLUX Schnell",
      "flux-dev": "FLUX Dev",
      "sd3.5": "Stable Diffusion 3.5",
      "sdxl": "Stable Diffusion XL"
    };

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-favorites').textContent = favorites;
    document.getElementById('stat-edits').textContent = edits;
    document.getElementById('stat-model').textContent = MODEL_LABELS[mostUsedModel] || mostUsedModel;
    document.getElementById('stat-style').textContent = mostUsedStyle === 'none' ? 'None' : mostUsedStyle;
    document.getElementById('stat-last').textContent = lastGen;
  }

  // ── ACCOUNT FORM ──────────────────────────────────────────
  const accountForm = document.getElementById('account-form');
  const saveAccountBtn = document.getElementById('save-account-btn');
  const fullNameInput = document.getElementById('full_name');
  const usernameInput = document.getElementById('username');

  function checkAccountChanges() {
    const fn = fullNameInput.value.trim();
    const un = usernameInput.value.trim();
    const origFn = currentUser?.user_metadata?.full_name || '';
    const origUn = currentUser?.user_metadata?.username || '';
    
    if (fn !== origFn || un !== origUn) {
      saveAccountBtn.removeAttribute('disabled');
    } else {
      saveAccountBtn.setAttribute('disabled', 'true');
    }
  }

  fullNameInput.addEventListener('input', checkAccountChanges);
  usernameInput.addEventListener('input', checkAccountChanges);

  accountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fn = fullNameInput.value.trim();
    const un = usernameInput.value.trim();
    
    const errorDiv = document.getElementById('account-error');
    if (fn.length < 2 || fn.length > 50) {
      errorDiv.textContent = 'Full name must be between 2 and 50 characters.';
      errorDiv.style.display = 'block';
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(un)) {
      errorDiv.textContent = 'Username must be 3-20 characters long, and contain only lowercase letters, numbers, and underscores.';
      errorDiv.style.display = 'block';
      return;
    }
    errorDiv.style.display = 'none';

    saveAccountBtn.setAttribute('disabled', 'true');
    saveAccountBtn.textContent = 'Saving...';
    
    const { data, error } = await supabaseClient.auth.updateUser({
      data: { full_name: fn, username: un }
    });
    
    saveAccountBtn.textContent = 'Save Changes';
    
    if (error) {
      showToast(error.message, 'error');
      saveAccountBtn.removeAttribute('disabled');
    } else {
      showToast('Account updated successfully');
      currentUser = data.user;
      document.getElementById('display-name').textContent = fn;
      const initials = fn.substring(0, 2).toUpperCase();
      document.getElementById('profile-avatar').textContent = initials;
      // Note: Header syncs automatically via onAuthStateChange in main app if needed
    }
  });

  // ── SECURITY FORM ─────────────────────────────────────────
  const passwordForm = document.getElementById('password-form');
  const pwdInput = document.getElementById('new_password');
  const meterFill = document.getElementById('pwd-meter');
  const reqLength = document.getElementById('req-length');
  const reqUpper = document.getElementById('req-upper');
  const reqLower = document.getElementById('req-lower');
  const reqNumber = document.getElementById('req-number');

  pwdInput.addEventListener('input', () => {
    const v = pwdInput.value;
    let score = 0;

    const hasLen = v.length >= 8;
    const hasUp = /[A-Z]/.test(v);
    const hasLow = /[a-z]/.test(v);
    const hasNum = /[0-9\W]/.test(v);

    if (hasLen) score++;
    if (hasUp) score++;
    if (hasLow) score++;
    if (hasNum) score++;

    reqLength.className = hasLen ? 'valid' : '';
    reqUpper.className = hasUp ? 'valid' : '';
    reqLower.className = hasLow ? 'valid' : '';
    reqNumber.className = hasNum ? 'valid' : '';

    meterFill.style.width = (score * 25) + '%';
    if (score < 2) meterFill.style.background = '#ef4444';
    else if (score < 4) meterFill.style.background = '#eab308';
    else meterFill.style.background = '#22c55e';
  });

  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = document.getElementById('current_password').value;
    const newPwd = pwdInput.value;
    const confirm = document.getElementById('confirm_password').value;
    
    if (newPwd !== confirm) {
      showToast('New passwords do not match', 'error');
      return;
    }
    
    if (document.querySelectorAll('#pwd-reqs .valid').length < 4) {
      showToast('Please meet all password requirements', 'error');
      return;
    }
    
    const btn = document.getElementById('save-pwd-btn');
    btn.setAttribute('disabled', 'true');
    btn.textContent = 'Updating...';
    
    // Verify current password first
    const { error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: currentUser.email,
      password: current
    });
    
    if (signInError) {
      showToast('Current password is incorrect', 'error');
      btn.removeAttribute('disabled');
      btn.textContent = 'Update Password';
      return;
    }
    
    // Update password
    const { error: updateError } = await supabaseClient.auth.updateUser({ password: newPwd });
    
    btn.removeAttribute('disabled');
    btn.textContent = 'Update Password';
    
    if (updateError) {
      showToast(updateError.message, 'error');
    } else {
      showToast('Password updated successfully');
      passwordForm.reset();
      meterFill.style.width = '0';
      document.querySelectorAll('#pwd-reqs li').forEach(li => li.className = '');
    }
  });

  document.getElementById('btn-signout-all').addEventListener('click', async () => {
    if (confirm('Are you sure you want to sign out of all devices?')) {
      await supabaseClient.auth.signOut({ scope: 'global' });
      window.location.replace('login.html');
    }
  });

  document.getElementById('btn-delete-local').addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all local history? This cannot be undone.')) {
      if (confirm('Also delete your favorites?')) {
        await Storage.clearAll(true);
      } else {
        await Storage.clearAll(false);
      }
      showToast('Local data deleted');
      await loadStats();
    }
  });

  // ── PREFERENCES FORM ──────────────────────────────────────
  document.getElementById('preferences-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-pref-btn');
    btn.setAttribute('disabled', 'true');
    btn.textContent = 'Saving...';
    
    const theme = document.getElementById('pref-theme').value;
    const model = document.getElementById('pref-model').value;
    const style = document.getElementById('pref-style').value;
    const aspect = document.getElementById('pref-aspect').value;
    
    // Apply theme
    if (theme === 'system') {
      const sysTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', sysTheme);
      localStorage.removeItem('theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    }
    
    // Save defaults to localStorage for quick access by main app
    localStorage.setItem('default_model', model);
    localStorage.setItem('default_style', style);
    localStorage.setItem('default_aspect', aspect);
    
    // Save to user metadata
    const { error } = await supabaseClient.auth.updateUser({
      data: { preferences: { model, style, aspect } }
    });
    
    btn.removeAttribute('disabled');
    btn.textContent = 'Save Preferences';
    
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Preferences saved');
    }
  });

  document.getElementById('btn-signout').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.replace('login.html');
  });

  // Apply theme initially
  (function() {
    var saved = localStorage.getItem('theme');
    if (!saved) {
      saved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', saved);
    
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const sunIcon = themeToggleBtn.querySelector(".sun-icon");
    const moonIcon = themeToggleBtn.querySelector(".moon-icon");
    
    function updateIcon(t) {
      if (t === 'light') {
        sunIcon.style.display = "block";
        moonIcon.style.display = "none";
      } else {
        sunIcon.style.display = "none";
        moonIcon.style.display = "block";
      }
    }
    
    updateIcon(saved);
    
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      document.getElementById('pref-theme').value = next;
      updateIcon(next);
    });
  })();

  loadProfile();

})();
