/**
 * FEC Alumni - Auth helpers
 * Uses Google Identity Services (GIS) + sessionStorage.
 */

const Auth = (() => {
  function saveUser(user, idToken) {
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
    if (idToken) sessionStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, idToken);
    // Also persist email for quick checks
    localStorage.setItem("fec_email", user.email);
  }

  function getUser() {
    try { return JSON.parse(sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER) || "null"); }
    catch { return null; }
  }

  function getToken() { return sessionStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN) || ""; }

  function isLoggedIn() { return !!getUser(); }

  function logout() {
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    // Revoke GIS if available
    try { google.accounts.id.disableAutoSelect(); } catch {}
    window.location.href = "index.html";
  }

  function requireAuth(redirectTo = "login.html") {
    const user = getUser();
    if (!user) {
      window.location.href = redirectTo;
      return null;
    }
    return user;
  }

  function requireApproved() {
    const user = getUser();
    if (!user) { window.location.href = "login.html"; return null; }
    if (user.status !== "Approved") {
      window.location.href = "login.html?reason=" + encodeURIComponent(user.status || "Pending");
      return null;
    }
    return user;
  }

  // Decode JWT payload (GIS id_token)
  function parseJwt(token) {
    try {
      const base = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(base));
    } catch { return null; }
  }

  // Initialize GIS button in a container element
  function initGoogleButton(containerId, onSuccess) {
    if (!isGoogleConfigured()) {
      const el = document.getElementById(containerId);
      if (el) el.innerHTML = '<div class="alert alert-warning">Google Sign-In is not configured yet. Please contact the administrator. Configure <code>GOOGLE_CLIENT_ID</code> in <code>js/config.js</code>.</div>';
      return;
    }
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: async (response) => {
        const payload = parseJwt(response.credential);
        if (!payload || !payload.email) {
          showAlert("Unable to read Google account email. Please try again.", "danger");
          return;
        }
        const googleUser = {
          email: payload.email,
          name: payload.name || "",
          picture: payload.picture || "",
          idToken: response.credential
        };
        try {
          if (onSuccess) await onSuccess(googleUser);
        } catch (e) {
          showAlert(e.message || "Sign-in failed.", "danger");
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true
    });
    const container = document.getElementById(containerId);
    if (container) {
      google.accounts.id.renderButton(container, { theme: "outline", size: "large", width: 320, text: "signin_with", shape: "rectangular" });
    }
  }

  // After GIS, check user status via backend and route accordingly
  async function handlePostGoogleSignIn(googleUser) {
    const btnArea = document.getElementById("auth-feedback");
    if (btnArea) btnArea.innerHTML = '<div class="loading-wrap"><span class="spinner"></span> Checking membership status...</div>';

    // If backend not configured, allow preview: store as approved demo user
    if (!isBackendConfigured()) {
      saveUser({ email: googleUser.email, name: googleUser.name, picture: googleUser.picture, status: "Approved", role: "Alumni" }, googleUser.idToken);
      window.location.href = "dashboard.html";
      return;
    }

    const res = await Api.getUserByEmail(googleUser.email);
    const record = res.data;
    if (!record) {
      // Not registered -> go to register
      saveUser({ email: googleUser.email, name: googleUser.name, picture: googleUser.picture, status: "NEW" }, googleUser.idToken);
      window.location.href = "register.html";
      return;
    }
    // Existing record
    const status = record.status || record.Status || "Pending";
    saveUser({
      email: record.email || record.Email || googleUser.email,
      name: record.fullName || record.FullName || googleUser.name,
      picture: record.profilePhoto || record.ProfilePhoto || googleUser.picture,
      status: status,
      role: record.role || record.Role || "Alumni",
      id: record.id || record.ID || ""
    }, googleUser.idToken);

    if (status === "Approved") window.location.href = "dashboard.html";
    else if (status === "Pending") window.location.href = "login.html?reason=Pending";
    else if (status === "Rejected") window.location.href = "login.html?reason=Rejected";
    else if (status === "Suspended") window.location.href = "login.html?reason=Suspended";
    else window.location.href = "login.html?reason=" + encodeURIComponent(status);
  }

  function showAlert(message, type = "info") {
    const el = document.getElementById("auth-feedback");
    if (!el) return;
    el.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function updateHeaderAuthState() {
    const user = getUser();
    document.querySelectorAll("[data-auth]").forEach(el => {
      const state = el.getAttribute("data-auth");
      if (state === "logged-in") el.classList.toggle("hidden", !user);
      if (state === "logged-out") el.classList.toggle("hidden", !!user);
      if (state === "approved-only") el.classList.toggle("hidden", !user || user.status !== "Approved");
    });
    const nameEl = document.getElementById("header-user-name");
    if (nameEl && user) nameEl.textContent = user.name || user.email;
  }

  return { saveUser, getUser, getToken, isLoggedIn, logout, requireAuth, requireApproved, parseJwt, initGoogleButton, handlePostGoogleSignIn, showAlert, updateHeaderAuthState };
})();
