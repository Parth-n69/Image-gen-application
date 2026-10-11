(() => {
  "use strict";

  // ── SUPABASE INIT ─────────────────────────────────────────
  if (typeof supabase === 'undefined' && typeof window.supabase === 'undefined') {
    console.error("Supabase script not loaded.");
    return;
  }
  
  // Use config values
  const supabaseUrl = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
  const supabaseKey = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : (typeof SUPABASE_KEY !== 'undefined' ? SUPABASE_KEY : '');

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase configuration missing in config.js");
  }

  const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

  // ── ROUTING / INIT ────────────────────────────────────────
  const isLoginPage = window.location.pathname.endsWith('login.html');
  const isResetPage = window.location.pathname.endsWith('reset-password.html');

  // Supabase Email OTP length setting from config (default 8, or configure in Supabase dashboard)
  const otpLength = (typeof OTP_LENGTH !== 'undefined' && OTP_LENGTH) ? parseInt(OTP_LENGTH, 10) : 8;

  // SessionStorage keys for OTP flow (only email and numerical timers/counts, NEVER passwords or tokens)
  const OTP_STORAGE_KEYS = {
    PENDING_EMAIL: 'pixabel_pending_signup_email',
    RESEND_COUNT: 'pixabel_otp_resend_count',
    WRONG_ATTEMPTS: 'pixabel_otp_wrong_attempts',
    LOCKOUT_UNTIL: 'pixabel_otp_lockout_until',
    RESEND_UNTIL: 'pixabel_otp_resend_until'
  };

  // Helper: Mask email (e.g. "parth@gmail.com" -> "p****@gmail.com")
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

  // Helper to map generic auth error messages
  function mapErrorMsg(error) {
    if (!error) return "An unknown error occurred.";
    const msg = error.message || "";
    if (msg.includes("Invalid login credentials")) return "Incorrect email or password.";
    if (msg.includes("User already registered") || error.code === "user_already_exists") {
      return "An account with this email already exists. Try signing in.";
    }
    if (msg.includes("Email not confirmed") || msg.includes("email address is not confirmed") || error.code === "email_not_confirmed") {
      return "Please confirm your email first.";
    }
    if (msg.includes("rate limit") || msg.includes("Too many requests") || error.status === 429) {
      return "Too many attempts. Please wait a minute.";
    }
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return "Connection problem. Check your internet and retry.";
    }
    return msg;
  }

  // Helper to map OTP verification & resend error messages
  function mapOtpError(error) {
    if (!error) return "An unknown error occurred.";
    const msg = (error.message || "").toLowerCase();
    const code = (error.code || "").toLowerCase();
    const status = error.status;

    if (
      status === 429 ||
      msg.includes("rate limit") ||
      msg.includes("too many requests") ||
      code.includes("over_request_rate_limit") ||
      code.includes("over_email_send_rate_limit")
    ) {
      return "Too many attempts. Please wait a minute.";
    }

    if (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network error") ||
      msg.includes("fetch failed") ||
      msg.includes("load failed")
    ) {
      return "Connection problem. Check your internet and retry.";
    }

    if (
      msg.includes("token has expired") ||
      msg.includes("is invalid") ||
      msg.includes("invalid token") ||
      msg.includes("token expired") ||
      msg.includes("expired") ||
      msg.includes("invalid") ||
      msg.includes("incorrect") ||
      msg.includes("bad_jwt") ||
      code === "otp_expired" ||
      code === "bad_code" ||
      code === "invalid_grant"
    ) {
      return "That code is incorrect or has expired. Request a new one.";
    }

    return error.message || "An unknown error occurred.";
  }

  if (isLoginPage) {
    initLoginPage();
  } else if (isResetPage) {
    initResetPage();
  }

  // ── LOGIN PAGE LOGIC ──────────────────────────────────────
  function initLoginPage() {
    // Session check - redirect if already logged in
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.replace("index.html");
      }
    });

    // Check Guest mode
    const btnGuest = document.getElementById("btn-guest");
    const guestContainer = document.getElementById("guest-mode-container");
    if (typeof GUEST_MODE !== 'undefined' && GUEST_MODE === true) {
      if (guestContainer) guestContainer.style.display = 'block';
    }
    if (btnGuest) {
      btnGuest.addEventListener("click", () => {
        sessionStorage.setItem("guest_mode", "true");
        window.location.href = "index.html";
      });
    }

    // Tabs & Panels
    const tabSignin = document.getElementById("tab-signin");
    const tabSignup = document.getElementById("tab-signup");
    const formSignin = document.getElementById("form-signin");
    const formSignup = document.getElementById("form-signup");
    const authMain = document.getElementById("auth-main-container");
    const forgotContainer = document.getElementById("auth-forgot-container");
    const verifyContainer = document.getElementById("auth-verify-container");
    const verifySubtitle = document.getElementById("verify-subtitle");
    const verifyEmailDisplay = document.getElementById("verify-email-display");
    const verifyInfoNotice = document.getElementById("verify-info-notice");
    const otpInputsContainer = document.getElementById("otp-inputs-container");
    const otpGlobalErr = document.getElementById("otp-global-err");
    const otpSuccessMsg = document.getElementById("otp-success-msg");
    const btnVerifyOtp = document.getElementById("btn-verify-otp");
    const btnVerifyText = document.getElementById("btn-verify-text");
    const spinnerVerify = document.getElementById("spinner-verify");
    const btnResendOtp = document.getElementById("btn-resend-otp");
    const otpResendStatus = document.getElementById("otp-resend-status");
    const btnDifferentEmail = document.getElementById("btn-different-email");
    const formVerifyOtp = document.getElementById("form-verify-otp");

    let resendInterval = null;
    let lockoutInterval = null;
    let isVerifying = false;

    function switchTab(tab) {
      if (tab === "signup") {
        tabSignin?.classList.remove("active");
        tabSignup?.classList.add("active");
        formSignin?.classList.remove("active");
        formSignup?.classList.add("active");
        window.location.hash = "signup";
      } else {
        tabSignup?.classList.remove("active");
        tabSignin?.classList.add("active");
        formSignup?.classList.remove("active");
        formSignin?.classList.add("active");
        window.location.hash = "signin";
      }
      if (authMain) authMain.style.display = "block";
      if (forgotContainer) forgotContainer.classList.remove("active");
      if (verifyContainer) {
        verifyContainer.classList.remove("active");
        verifyContainer.style.display = "none";
      }
    }

    if (window.location.hash === "#signup") switchTab("signup");
    
    tabSignin?.addEventListener("click", () => switchTab("signin"));
    tabSignup?.addEventListener("click", () => switchTab("signup"));

    // Toggle Password Visibility
    document.querySelectorAll(".auth-toggle-pwd").forEach(btn => {
      btn.addEventListener("click", function() {
        const input = this.previousElementSibling;
        const type = input.getAttribute("type") === "password" ? "text" : "password";
        input.setAttribute("type", type);
        
        if (type === "text") {
          this.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>`;
        } else {
          this.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        }
      });
    });

    // Password Strength & Signup Validation
    const signupName = document.getElementById("signup-name");
    const signupUsername = document.getElementById("signup-username");
    const signupEmail = document.getElementById("signup-email");
    const signupPwd = document.getElementById("signup-pwd");
    const signupPwdConfirm = document.getElementById("signup-pwd-confirm");
    const pwdBar1 = document.getElementById("pwd-bar-1");
    const pwdBar2 = document.getElementById("pwd-bar-2");
    const pwdBar3 = document.getElementById("pwd-bar-3");
    const pwdStrText = document.getElementById("pwd-str-text");
    const ruleLen = document.getElementById("rule-len");
    const btnSubmitSignup = document.getElementById("btn-submit-signup");
    const signupTerms = document.getElementById("signup-terms");

    signupUsername?.addEventListener("input", function() {
      this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      validateSignupForm();
    });
    
    function validateSignupForm() {
      const p = signupPwd ? signupPwd.value : "";
      const isLen = p.length >= 8;
      const hasTerms = signupTerms ? signupTerms.checked : false;
      
      if (ruleLen) {
        if (isLen) ruleLen.classList.add("valid");
        else ruleLen.classList.remove("valid");
      }
      
      let strength = 0;
      if (isLen) strength++;
      if (/[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p)) strength++;
      if (/[^A-Za-z0-9]/.test(p)) strength++;
      
      if (pwdBar1) pwdBar1.style.background = strength >= 1 ? "var(--danger)" : "var(--border)";
      if (pwdBar2) pwdBar2.style.background = strength >= 2 ? "var(--warning)" : "var(--border)";
      if (pwdBar3) pwdBar3.style.background = strength >= 3 ? "var(--success)" : "var(--border)";
      
      if (pwdStrText) {
        if (p.length === 0) pwdStrText.textContent = "Weak";
        else if (strength === 1) pwdStrText.textContent = "Weak";
        else if (strength === 2) pwdStrText.textContent = "Fair";
        else if (strength === 3) pwdStrText.textContent = "Strong";
      }

      if (btnSubmitSignup) {
        btnSubmitSignup.disabled = !(isLen && hasTerms);
      }
    }

    signupPwd?.addEventListener("input", validateSignupForm);
    signupTerms?.addEventListener("change", validateSignupForm);

    // ── OTP VERIFICATION LOGIC ────────────────────────────────

    function renderOtpBoxes() {
      if (!otpInputsContainer) return;
      otpInputsContainer.innerHTML = "";
      for (let i = 0; i < otpLength; i++) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "otp-digit-input";
        input.inputMode = "numeric";
        input.autocomplete = "one-time-code";
        input.pattern = "[a-zA-Z0-9]*";
        input.maxLength = 1;
        input.setAttribute("aria-label", `Character ${i + 1} of ${otpLength}`);
        input.setAttribute("data-index", i.toString());
        input.id = `otp-digit-${i}`;
        input.required = true;
        otpInputsContainer.appendChild(input);
      }
      bindOtpBoxEvents();
    }

    function getCode() {
      if (!otpInputsContainer) return "";
      const boxes = otpInputsContainer.querySelectorAll(".otp-digit-input");
      let code = "";
      boxes.forEach(b => { code += b.value.trim(); });
      return code;
    }

    function clearCodeBoxes() {
      if (!otpInputsContainer) return;
      const boxes = otpInputsContainer.querySelectorAll(".otp-digit-input");
      boxes.forEach(b => {
        b.value = "";
        b.classList.add("has-error");
      });
      setTimeout(() => {
        boxes.forEach(b => b.classList.remove("has-error"));
      }, 400);
      boxes[0]?.focus();
    }

    function isLockedOut() {
      const until = parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL) || "0", 10);
      return Date.now() < until;
    }

    function checkAndResumeLockout() {
      const until = parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL) || "0", 10);
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining > 0) {
        startLockoutTimer(remaining);
      } else {
        sessionStorage.removeItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL);
        sessionStorage.removeItem(OTP_STORAGE_KEYS.WRONG_ATTEMPTS);
        if (btnVerifyOtp) btnVerifyOtp.disabled = false;
        if (btnVerifyText) btnVerifyText.textContent = "Verify";
      }
    }

    function startLockoutTimer(durationSeconds) {
      clearInterval(lockoutInterval);
      if (btnVerifyOtp) btnVerifyOtp.disabled = true;
      if (otpInputsContainer) {
        otpInputsContainer.querySelectorAll(".otp-digit-input").forEach(b => { b.disabled = true; });
      }

      const endTime = Date.now() + durationSeconds * 1000;
      sessionStorage.setItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL, endTime.toString());

      const updateLockout = () => {
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
        if (remaining > 0) {
          if (btnVerifyText) btnVerifyText.textContent = `Locked (${remaining}s)`;
          if (otpGlobalErr) {
            otpGlobalErr.textContent = "Too many attempts. Please wait a minute.";
            otpGlobalErr.classList.add("active");
          }
        } else {
          clearInterval(lockoutInterval);
          sessionStorage.removeItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL);
          sessionStorage.removeItem(OTP_STORAGE_KEYS.WRONG_ATTEMPTS);
          if (btnVerifyOtp) btnVerifyOtp.disabled = false;
          if (btnVerifyText) btnVerifyText.textContent = "Verify";
          if (otpGlobalErr) {
            otpGlobalErr.textContent = "";
            otpGlobalErr.classList.remove("active");
          }
          if (otpInputsContainer) {
            otpInputsContainer.querySelectorAll(".otp-digit-input").forEach(b => { b.disabled = false; });
            otpInputsContainer.querySelector(".otp-digit-input")?.focus();
          }
        }
      };

      updateLockout();
      lockoutInterval = setInterval(updateLockout, 1000);
    }

    function checkAndResumeResend() {
      const until = parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.RESEND_UNTIL) || "0", 10);
      const resendCount = parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.RESEND_COUNT) || "0", 10);

      if (resendCount >= 5) {
        if (btnResendOtp) {
          btnResendOtp.disabled = true;
          btnResendOtp.textContent = "Resend code";
        }
        if (otpResendStatus) {
          otpResendStatus.textContent = "Too many requests. Please wait a few minutes.";
          otpResendStatus.classList.add("active");
        }
        return;
      }

      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining > 0) {
        startResendTimer(remaining);
      } else {
        sessionStorage.removeItem(OTP_STORAGE_KEYS.RESEND_UNTIL);
        if (btnResendOtp) {
          btnResendOtp.disabled = false;
          btnResendOtp.textContent = "Resend code";
        }
      }
    }

    function startResendTimer(durationSeconds) {
      clearInterval(resendInterval);
      if (btnResendOtp) btnResendOtp.disabled = true;

      const endTime = Date.now() + durationSeconds * 1000;
      sessionStorage.setItem(OTP_STORAGE_KEYS.RESEND_UNTIL, endTime.toString());

      const updateResend = () => {
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
        if (remaining > 0) {
          if (btnResendOtp) btnResendOtp.textContent = `Resend in ${remaining}s`;
        } else {
          clearInterval(resendInterval);
          sessionStorage.removeItem(OTP_STORAGE_KEYS.RESEND_UNTIL);
          const count = parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.RESEND_COUNT) || "0", 10);
          if (count >= 5) {
            if (btnResendOtp) {
              btnResendOtp.disabled = true;
              btnResendOtp.textContent = "Resend code";
            }
            if (otpResendStatus) {
              otpResendStatus.textContent = "Too many requests. Please wait a few minutes.";
              otpResendStatus.classList.add("active");
            }
          } else {
            if (btnResendOtp) {
              btnResendOtp.disabled = false;
              btnResendOtp.textContent = "Resend code";
            }
          }
        }
      };

      updateResend();
      resendInterval = setInterval(updateResend, 1000);
    }

    function bindOtpBoxEvents() {
      if (!otpInputsContainer) return;
      const boxes = otpInputsContainer.querySelectorAll(".otp-digit-input");
      boxes.forEach((box, index) => {
        box.addEventListener("focus", () => {
          box.select();
        });

        box.addEventListener("input", () => {
          const val = box.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
          if (val.length > 1) {
            // Pasted or autofilled into single input
            const chars = val.slice(0, otpLength);
            boxes.forEach((b, idx) => {
              b.value = chars[idx] || "";
            });
            const nextIdx = Math.min(chars.length, otpLength - 1);
            boxes[nextIdx]?.focus();
            if (getCode().length === otpLength) {
              submitOtp();
            }
            return;
          }

          box.value = val;
          if (val && index < otpLength - 1) {
            boxes[index + 1]?.focus();
          }

          if (getCode().length === otpLength) {
            submitOtp();
          }
        });

        box.addEventListener("keydown", (e) => {
          if (e.key === "Backspace") {
            if (box.value) {
              box.value = "";
              e.preventDefault();
            } else if (index > 0) {
              boxes[index - 1].focus();
              boxes[index - 1].value = "";
              e.preventDefault();
            }
          } else if (e.key === "ArrowLeft") {
            if (index > 0) {
              boxes[index - 1].focus();
              e.preventDefault();
            }
          } else if (e.key === "ArrowRight") {
            if (index < otpLength - 1) {
              boxes[index + 1].focus();
              e.preventDefault();
            }
          } else if (e.key === "Delete") {
            box.value = "";
          }
        });

        box.addEventListener("paste", (e) => {
          e.preventDefault();
          const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || "";
          const chars = pasted.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, otpLength);
          if (!chars) return;
          boxes.forEach((b, idx) => {
            b.value = chars[idx] || "";
          });
          const nextIdx = Math.min(chars.length, otpLength - 1);
          boxes[nextIdx]?.focus();
          if (chars.length === otpLength) {
            submitOtp();
          }
        });
      });
    }

    async function submitOtp() {
      if (isVerifying || isLockedOut()) return;

      const token = getCode();
      if (token.length < otpLength) {
        if (otpGlobalErr) {
          otpGlobalErr.textContent = "Please enter the complete verification code.";
          otpGlobalErr.classList.add("active");
        }
        return;
      }

      const email = sessionStorage.getItem(OTP_STORAGE_KEYS.PENDING_EMAIL);
      if (!email) {
        closeOtpScreen("signup");
        return;
      }

      isVerifying = true;
      if (btnVerifyOtp) btnVerifyOtp.disabled = true;
      if (spinnerVerify) spinnerVerify.classList.add("active");
      if (otpGlobalErr) {
        otpGlobalErr.textContent = "";
        otpGlobalErr.classList.remove("active");
      }
      if (otpInputsContainer) {
        otpInputsContainer.querySelectorAll(".otp-digit-input").forEach(b => { b.disabled = true; });
      }

      const { data, error } = await supabaseClient.auth.verifyOtp({
        email,
        token,
        type: 'signup'
      });

      isVerifying = false;
      if (spinnerVerify) spinnerVerify.classList.remove("active");
      if (otpInputsContainer) {
        otpInputsContainer.querySelectorAll(".otp-digit-input").forEach(b => { b.disabled = false; });
      }

      if (error) {
        let wrongAttempts = parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.WRONG_ATTEMPTS) || "0", 10) + 1;
        sessionStorage.setItem(OTP_STORAGE_KEYS.WRONG_ATTEMPTS, wrongAttempts.toString());

        if (otpGlobalErr) {
          otpGlobalErr.textContent = mapOtpError(error);
          otpGlobalErr.classList.add("active");
        }

        clearCodeBoxes();

        if (wrongAttempts >= 5) {
          startLockoutTimer(60);
        } else {
          if (btnVerifyOtp) btnVerifyOtp.disabled = false;
        }
      } else {
        // Success! User has a valid session. Clear OTP pending state & redirect
        sessionStorage.removeItem(OTP_STORAGE_KEYS.PENDING_EMAIL);
        sessionStorage.removeItem(OTP_STORAGE_KEYS.RESEND_COUNT);
        sessionStorage.removeItem(OTP_STORAGE_KEYS.WRONG_ATTEMPTS);
        sessionStorage.removeItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL);
        sessionStorage.removeItem(OTP_STORAGE_KEYS.RESEND_UNTIL);
        sessionStorage.removeItem("guest_mode");

        if (otpSuccessMsg) otpSuccessMsg.style.display = "block";
        if (btnVerifyOtp) btnVerifyOtp.style.display = "none";
        if (otpInputsContainer) {
          otpInputsContainer.style.opacity = "0.4";
          otpInputsContainer.querySelectorAll(".otp-digit-input").forEach(b => { b.disabled = true; });
        }

        setTimeout(() => {
          window.location.replace("index.html");
        }, 1000);
      }
    }

    formVerifyOtp?.addEventListener("submit", (e) => {
      e.preventDefault();
      submitOtp();
    });

    btnResendOtp?.addEventListener("click", async () => {
      if (btnResendOtp.disabled) return;
      const count = parseInt(sessionStorage.getItem(OTP_STORAGE_KEYS.RESEND_COUNT) || "0", 10);
      if (count >= 5) {
        btnResendOtp.disabled = true;
        if (otpResendStatus) {
          otpResendStatus.textContent = "Too many requests. Please wait a few minutes.";
          otpResendStatus.classList.add("active");
        }
        return;
      }

      const email = sessionStorage.getItem(OTP_STORAGE_KEYS.PENDING_EMAIL);
      if (!email) {
        closeOtpScreen("signup");
        return;
      }

      btnResendOtp.disabled = true;
      if (otpResendStatus) {
        otpResendStatus.textContent = "";
        otpResendStatus.classList.remove("active");
      }

      const { error } = await supabaseClient.auth.resend({
        type: 'signup',
        email
      });

      if (error) {
        if (otpResendStatus) {
          otpResendStatus.textContent = mapOtpError(error);
          otpResendStatus.classList.add("active");
        }
        btnResendOtp.disabled = false;
        return;
      }

      const newCount = count + 1;
      sessionStorage.setItem(OTP_STORAGE_KEYS.RESEND_COUNT, newCount.toString());

      if (otpResendStatus) {
        otpResendStatus.textContent = "A new code has been sent.";
        otpResendStatus.classList.add("active");
        setTimeout(() => {
          if (otpResendStatus.textContent === "A new code has been sent.") {
            otpResendStatus.textContent = "";
            otpResendStatus.classList.remove("active");
          }
        }, 3000);
      }

      if (newCount >= 5) {
        btnResendOtp.disabled = true;
        btnResendOtp.textContent = "Resend code";
        if (otpResendStatus) {
          otpResendStatus.textContent = "Too many requests. Please wait a few minutes.";
          otpResendStatus.classList.add("active");
        }
      } else {
        startResendTimer(60);
      }
    });

    btnDifferentEmail?.addEventListener("click", () => {
      closeOtpScreen("signup");
    });

    function openOtpScreen(email, infoMessage = "") {
      sessionStorage.setItem(OTP_STORAGE_KEYS.PENDING_EMAIL, email);
      if (verifyEmailDisplay) verifyEmailDisplay.textContent = maskEmail(email);

      if (verifyInfoNotice) {
        if (infoMessage) {
          verifyInfoNotice.textContent = infoMessage;
          verifyInfoNotice.style.display = "block";
        } else {
          verifyInfoNotice.style.display = "none";
        }
      }

      if (authMain) authMain.style.display = "none";
      if (forgotContainer) forgotContainer.classList.remove("active");
      if (verifyContainer) {
        verifyContainer.classList.add("active");
        verifyContainer.style.display = "flex";
      }

      if (otpGlobalErr) {
        otpGlobalErr.textContent = "";
        otpGlobalErr.classList.remove("active");
      }
      if (otpResendStatus) {
        otpResendStatus.textContent = "";
        otpResendStatus.classList.remove("active");
      }
      if (otpSuccessMsg) otpSuccessMsg.style.display = "none";
      if (btnVerifyOtp) btnVerifyOtp.style.display = "flex";
      if (otpInputsContainer) otpInputsContainer.style.opacity = "1";

      renderOtpBoxes();
      checkAndResumeLockout();
      checkAndResumeResend();
      otpInputsContainer?.querySelector(".otp-digit-input")?.focus();
    }

    function closeOtpScreen(returnToTab = "signup") {
      clearInterval(resendInterval);
      clearInterval(lockoutInterval);
      sessionStorage.removeItem(OTP_STORAGE_KEYS.PENDING_EMAIL);
      sessionStorage.removeItem(OTP_STORAGE_KEYS.RESEND_COUNT);
      sessionStorage.removeItem(OTP_STORAGE_KEYS.WRONG_ATTEMPTS);
      sessionStorage.removeItem(OTP_STORAGE_KEYS.LOCKOUT_UNTIL);
      sessionStorage.removeItem(OTP_STORAGE_KEYS.RESEND_UNTIL);

      if (verifyContainer) {
        verifyContainer.classList.remove("active");
        verifyContainer.style.display = "none";
      }
      switchTab(returnToTab);
    }

    // Check on page load if user refreshed on OTP screen
    const existingPendingEmail = sessionStorage.getItem(OTP_STORAGE_KEYS.PENDING_EMAIL);
    if (existingPendingEmail) {
      openOtpScreen(existingPendingEmail);
    }

    // ── FORM SUBMISSIONS ──────────────────────────────────────
    
    // SIGN IN
    formSignin?.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const email = document.getElementById("signin-email").value.trim();
      const pwd = document.getElementById("signin-pwd").value;
      const globalErr = document.getElementById("signin-global-err");
      const btn = document.getElementById("btn-submit-signin");
      const spinner = document.getElementById("spinner-signin");
      
      globalErr.textContent = "";
      globalErr.classList.remove("active");
      
      if (!email || !pwd) {
        globalErr.textContent = "Please fill in all fields.";
        globalErr.classList.add("active");
        return;
      }
      
      btn.disabled = true;
      spinner.classList.add("active");
      
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password: pwd
      });
      
      if (error) {
        const isUnconfirmed =
          error.code === 'email_not_confirmed' ||
          error.message?.toLowerCase().includes("email not confirmed") ||
          error.message?.toLowerCase().includes("email address is not confirmed");

        if (isUnconfirmed) {
          try {
            await supabaseClient.auth.resend({ type: 'signup', email });
          } catch (_) {}

          const pwdInput = document.getElementById("signin-pwd");
          if (pwdInput) pwdInput.value = "";
          btn.disabled = false;
          spinner.classList.remove("active");

          sessionStorage.setItem(OTP_STORAGE_KEYS.RESEND_UNTIL, (Date.now() + 60000).toString());
          openOtpScreen(email, "Please verify your email to continue.");
          return;
        }

        globalErr.textContent = mapErrorMsg(error);
        globalErr.classList.add("active");
        btn.disabled = false;
        spinner.classList.remove("active");
      } else {
        sessionStorage.removeItem("guest_mode");
        window.location.replace("index.html");
      }
    });

    // SIGN UP
    formSignup?.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const name = signupName ? signupName.value.trim() : "";
      const username = signupUsername ? signupUsername.value.trim().toLowerCase() : "";
      const email = signupEmail ? signupEmail.value.trim() : "";
      const pwd = signupPwd ? signupPwd.value : "";
      const pwdConfirm = signupPwdConfirm ? signupPwdConfirm.value : "";
      const globalErr = document.getElementById("signup-global-err");
      const nameErr = document.getElementById("signup-name-err");
      const usernameErr = document.getElementById("signup-username-err");
      const emailErr = document.getElementById("signup-email-err");
      const pwdErr = document.getElementById("signup-pwd-err");
      const pwdConfirmErr = document.getElementById("signup-pwd-confirm-err");
      const termsErr = document.getElementById("signup-terms-err");
      
      const btn = btnSubmitSignup;
      const spinner = document.getElementById("spinner-signup");
      
      [globalErr, nameErr, usernameErr, emailErr, pwdErr, pwdConfirmErr, termsErr].forEach(el => {
        if (el) { el.textContent = ""; el.classList.remove("active"); }
      });

      let hasError = false;

      if (name.length < 2) {
        if (nameErr) {
          nameErr.textContent = "Full name must be at least 2 characters.";
          nameErr.classList.add("active");
        }
        hasError = true;
      }

      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        if (usernameErr) {
          usernameErr.textContent = "Username must be 3-20 characters long (lowercase letters, numbers, and underscores).";
          usernameErr.classList.add("active");
        }
        hasError = true;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (emailErr) {
          emailErr.textContent = "Please enter a valid email address.";
          emailErr.classList.add("active");
        }
        hasError = true;
      }

      if (pwd.length < 8) {
        if (pwdErr) {
          pwdErr.textContent = "Password must be at least 8 characters.";
          pwdErr.classList.add("active");
        }
        hasError = true;
      }

      if (pwd !== pwdConfirm) {
        if (pwdConfirmErr) {
          pwdConfirmErr.textContent = "Passwords do not match.";
          pwdConfirmErr.classList.add("active");
        }
        hasError = true;
      }

      if (signupTerms && !signupTerms.checked) {
        if (termsErr) {
          termsErr.textContent = "You must agree to the Terms and Privacy Policy.";
          termsErr.classList.add("active");
        }
        hasError = true;
      }

      if (hasError) return;
      
      btn.disabled = true;
      spinner.classList.add("active");
      
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password: pwd,
        options: {
          data: {
            full_name: name,
            username: username
          }
        }
      });
      
      btn.disabled = false;
      spinner.classList.remove("active");

      if (error) {
        if (error.message?.includes("User already registered") || error.code === "user_already_exists") {
          globalErr.textContent = "An account with this email already exists. Try signing in.";
        } else {
          globalErr.textContent = mapErrorMsg(error);
        }
        globalErr.classList.add("active");
        return;
      }

      // Check for existing user with empty identities array (Supabase email confirmation behavior)
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        globalErr.textContent = "An account with this email already exists. Try signing in.";
        globalErr.classList.add("active");
        return;
      }

      // If auto-confirm is enabled, session will exist. Otherwise, proceed to OTP screen
      if (data?.session) {
        sessionStorage.removeItem("guest_mode");
        window.location.replace("index.html");
        return;
      }

      // Cooldown for resend starts because initial code was just sent
      sessionStorage.setItem(OTP_STORAGE_KEYS.RESEND_UNTIL, (Date.now() + 60000).toString());
      openOtpScreen(email);
    });

    // FORGOT PASSWORD
    const btnForgot = document.getElementById("btn-forgot-pwd");
    const btnBackLogin = document.getElementById("btn-back-login");
    
    function closeForgotPanel() {
      forgotContainer.classList.remove("active");
      authMain.style.display = "block";
    }

    btnForgot?.addEventListener("click", () => {
      authMain.style.display = "none";
      forgotContainer.classList.add("active");
    });
    
    btnBackLogin?.addEventListener("click", closeForgotPanel);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && forgotContainer.classList.contains("active")) {
        closeForgotPanel();
      }
    });

    const formForgot = document.getElementById("form-forgot");
    formForgot?.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const email = document.getElementById("forgot-email").value.trim();
      const globalErr = document.getElementById("forgot-global-err");
      const successMsg = document.getElementById("forgot-success-msg");
      const btn = document.getElementById("btn-submit-forgot");
      const spinner = document.getElementById("spinner-forgot");
      
      globalErr.textContent = "";
      successMsg.style.display = "none";
      
      if (!email) {
        globalErr.textContent = "Please enter your email.";
        return;
      }
      
      btn.disabled = true;
      spinner.classList.add("active");
      
      const resetUrl = window.location.origin + window.location.pathname.replace("login.html", "reset-password.html");
      
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      });
      
      btn.disabled = false;
      spinner.classList.remove("active");
      
      if (error) {
        // Always show the same neutral message as requested, even on error, to prevent guessing.
        // Wait, the prompt says: "Always show the same neutral message ("If that email exists, we sent a link") so accounts cannot be guessed". 
        // We will just show the success message regardless of error (unless it's a rate limit).
        if (error.message.includes("rate limit")) {
          globalErr.textContent = mapErrorMsg(error);
        } else {
          successMsg.style.display = "block";
        }
      } else {
        successMsg.style.display = "block";
      }
    });

    // Input Validation Styles
    document.querySelectorAll(".auth-input").forEach(input => {
      input.addEventListener("input", function() {
        if (this.validity.valid) {
          this.removeAttribute("aria-invalid");
          const errBox = document.getElementById(`${this.id}-err`);
          if (errBox) errBox.classList.remove("active");
        }
      });
      input.addEventListener("invalid", function(e) {
        e.preventDefault();
        this.setAttribute("aria-invalid", "true");
        const errBox = document.getElementById(`${this.id}-err`);
        if (errBox) {
          errBox.textContent = this.validationMessage;
          errBox.classList.add("active");
        }
      });
    });
  }

  // ── RESET PASSWORD PAGE LOGIC ─────────────────────────────
  function initResetPage() {
    const invalidMsg = document.getElementById("reset-invalid-msg");
    const formReset = document.getElementById("form-reset");

    // Listen for auth state change to verify the recovery token
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && window.location.hash.includes('type=recovery'))) {
        invalidMsg.style.display = "none";
        formReset.style.display = "flex";
      }
    });

    // Also check on load, if session exists it means we might be ready to update
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        invalidMsg.style.display = "none";
        formReset.style.display = "flex";
      }
    });

    // Toggle Password Visibility
    document.querySelectorAll(".auth-toggle-pwd").forEach(btn => {
      btn.addEventListener("click", function() {
        const input = this.previousElementSibling;
        const type = input.getAttribute("type") === "password" ? "text" : "password";
        input.setAttribute("type", type);
        if (type === "text") {
          this.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>`;
        } else {
          this.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        }
      });
    });

    // Password Strength Logic
    const resetPwd = document.getElementById("reset-pwd");
    const pwdBar1 = document.getElementById("pwd-bar-1");
    const pwdBar2 = document.getElementById("pwd-bar-2");
    const pwdBar3 = document.getElementById("pwd-bar-3");
    const pwdStrText = document.getElementById("pwd-str-text");
    const ruleLen = document.getElementById("rule-len");
    const btnSubmitReset = document.getElementById("btn-submit-reset");

    function validateResetForm() {
      const p = resetPwd ? resetPwd.value : "";
      const isLen = p.length >= 8;
      
      if (ruleLen) {
        if (isLen) ruleLen.classList.add("valid");
        else ruleLen.classList.remove("valid");
      }
      
      let strength = 0;
      if (isLen) strength++;
      if (/[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p)) strength++;
      if (/[^A-Za-z0-9]/.test(p)) strength++;
      
      if (pwdBar1) pwdBar1.style.background = strength >= 1 ? "var(--danger)" : "var(--border)";
      if (pwdBar2) pwdBar2.style.background = strength >= 2 ? "var(--warning)" : "var(--border)";
      if (pwdBar3) pwdBar3.style.background = strength >= 3 ? "var(--success)" : "var(--border)";
      
      if (pwdStrText) {
        if (p.length === 0) pwdStrText.textContent = "Weak";
        else if (strength === 1) pwdStrText.textContent = "Weak";
        else if (strength === 2) pwdStrText.textContent = "Fair";
        else if (strength === 3) pwdStrText.textContent = "Strong";
      }

      if (btnSubmitReset) {
        btnSubmitReset.disabled = !isLen;
      }
    }

    resetPwd?.addEventListener("input", validateResetForm);

    formReset?.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const pwd = document.getElementById("reset-pwd").value;
      const pwdConfirm = document.getElementById("reset-pwd-confirm").value;
      const globalErr = document.getElementById("reset-global-err");
      const successMsg = document.getElementById("reset-success-msg");
      const btn = document.getElementById("btn-submit-reset");
      const spinner = document.getElementById("spinner-reset");
      const pwdConfirmErr = document.getElementById("reset-pwd-confirm-err");
      
      globalErr.textContent = "";
      pwdConfirmErr.textContent = "";
      pwdConfirmErr.classList.remove("active");
      
      if (pwd !== pwdConfirm) {
        pwdConfirmErr.textContent = "Passwords do not match.";
        pwdConfirmErr.classList.add("active");
        return;
      }
      
      btn.disabled = true;
      spinner.classList.add("active");
      
      const { error } = await supabaseClient.auth.updateUser({ password: pwd });
      
      spinner.classList.remove("active");
      
      if (error) {
        globalErr.textContent = mapErrorMsg(error);
        btn.disabled = false;
      } else {
        successMsg.style.display = "block";
        setTimeout(() => {
          window.location.replace("login.html");
        }, 2000);
      }
    });

    // Input Validation Styles
    document.querySelectorAll(".auth-input").forEach(input => {
      input.addEventListener("input", function() {
        if (this.validity.valid) {
          this.removeAttribute("aria-invalid");
          const errBox = document.getElementById(`${this.id}-err`);
          if (errBox) errBox.classList.remove("active");
        }
      });
      input.addEventListener("invalid", function(e) {
        e.preventDefault();
        this.setAttribute("aria-invalid", "true");
        const errBox = document.getElementById(`${this.id}-err`);
        if (errBox) {
          errBox.textContent = this.validationMessage;
          errBox.classList.add("active");
        }
      });
    });
  }

})();
