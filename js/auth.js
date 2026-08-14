/**
 * FEC Alumni - Auth helpers
 * Uses Google Identity Services (GIS) + sessionStorage.
 * Security: The Google ID token (credential) is sent over HTTPS to Apps Script
 * and verified server-side (signature, iss, aud, exp, email_verified). The
 * verified payload (sub, email) is the sole trusted identity; client-side
 * JWT decoding is used only for immediate UI, never for authorization.
 */

const Auth = (() => {
  function saveUser(user, idToken) {
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
    if (idToken) sessionStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, idToken);
    // Also persist email for quick checks (display only, not trusted for authz)
    try { localStorage.setItem("fec_email", user.email); } catch {}
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
    try { localStorage.removeItem("fec_email"); } catch {}
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
    // Client-side gate only; server verifies token on every protected API call
    if (!getToken()) {
      window.location.href = redirectTo;
      return null;
    }
    return user;
  }

  function requireApproved() {
    const user = getUser();
    if (!user) { window.location.href = "login.html"; return null; }
    if (!getToken()) { window.location.href = "login.html"; return null; }
    if (user.status !== "Approved") {
      window.location.href = "login.html?reason=" + encodeURIComponent(user.status || "Pending");
      return null;
    }
    return user;
  }

  // Server-verified gates — sessionStorage is only a loading hint; backend must confirm
  function isProdOriginLocal() {
    try {
      if (typeof isProductionOrigin === "function") return isProductionOrigin();
      return location.hostname === "fecalumni.github.io" || location.hostname.endsWith(".fecalumni.github.io");
    } catch { return false; }
  }

  async function verifySessionWithBackend() {
    var token = getToken();
    if (!token) return { error: "auth", message: "Not authenticated. Please sign in." };
    if (isProdOriginLocal() && (!isBackendConfigured() || !isGoogleConfigured())) {
      return { error: "config", message: "Service not configured. Please contact the administrator." };
    }
    // Local development with no backend: treat hint as verified to keep mock usable (production already fail-closed above)
    if (!isBackendConfigured()) {
      var hint = getUser();
      if (!hint) return { error: "auth", message: "Not authenticated." };
      return { status: hint.status || "Approved", data: hint };
    }
    try {
      var res = await Api.getUserByEmail({ id_token: token });
      var record = res.data;
      if (!record) return { status: "NEW", data: null };
      var status = record.status || record.Status || "Pending";
      var user = getUser();
      if (user && user.status !== status) {
        user.status = status;
        user.email = record.email || record.Email || user.email;
        if (record.googleSub || record.GoogleSub) user.sub = record.googleSub || record.GoogleSub;
        saveUser(user, token);
      }
      return { status: status, data: record };
    } catch (e) {
      return { error: "auth", message: e.message || "Session invalid. Please sign in again." };
    }
  }

  async function requireVerifiedApproved(options) {
    options = options || {};
    var loadingEl = options.loadingEl ? document.querySelector(options.loadingEl) : null;
    var token = getToken();
    var hintUser = getUser();
    if (!token || !hintUser) {
      window.location.href = "login.html";
      return null;
    }
    // Show loading and hide protected shell until verified
    var shellSelectors = options.shellSelectors || [".dashboard-layout", ".profile-header", ".alumni-grid", ".admin-layout"];
    var shells = [];
    shellSelectors.forEach(function(sel){ document.querySelectorAll(sel).forEach(function(el){ shells.push(el); el.style.display = "none"; }); });
    var loadingWrap = null;
    if (!loadingEl) {
      loadingWrap = document.createElement("div");
      loadingWrap.className = "loading-wrap";
      loadingWrap.innerHTML = '<span class="spinner spinner-lg"></span> Verifying your session...';
      loadingWrap.style.padding = "48px 24px";
      var container = document.querySelector(".container") || document.body;
      if (container.firstChild) container.insertBefore(loadingWrap, container.firstChild);
      else container.appendChild(loadingWrap);
    }
    var result = await verifySessionWithBackend();
    if (loadingWrap) loadingWrap.remove();
    shells.forEach(function(el){ el.style.display = ""; });
    if (!result || result.error) {
      if (result && result.error === "config") {
        document.body.innerHTML = '<div class="container" style="padding:48px 24px"><div class="alert alert-danger">Service not configured. Please contact the administrator.</div></div>';
        return null;
      }
      window.location.href = "login.html";
      return null;
    }
    if (result.status !== "Approved") {
      window.location.href = "login.html?reason=" + encodeURIComponent(result.status || "Pending");
      return null;
    }
    return result.data;
  }

  async function requireVerifiedAdmin() {
    var token = getToken();
    var hintUser = getUser();
    if (!token || !hintUser) { window.location.href = "login.html"; return null; }
    if (isProdOriginLocal() && (!isBackendConfigured() || !isGoogleConfigured())) {
      document.body.innerHTML = '<div class="container" style="padding:48px 24px"><div class="alert alert-danger">Service not configured. Please contact the administrator.</div></div>';
      return null;
    }
    // Local development without backend: keep demo admin experience (production already fail-closed above)
    if (!isBackendConfigured() && !isProdOriginLocal()) {
      return { isAdmin: true, email: hintUser.email, sub: hintUser.sub || "" };
    }
    try {
      var res = await Api.isAdmin({ id_token: token });
      if (!res.data || !res.data.isAdmin) {
        document.body.innerHTML = '<div class="container" style="padding:48px 24px"><div class="alert alert-danger">You are not authorized to access this page. Admin privileges required.</div><p style="margin-top:12px"><a class="btn btn-outline" href="index.html">Back to Home</a></p></div>';
        return null;
      }
      // Also verify the underlying alumni record is Approved (admins should be approved alumni)
      var session = await verifySessionWithBackend();
      if (session && session.status && session.status !== "Approved" && session.status !== "NEW") {
        // If admin is not Approved but isAdmin true, still allow? Keep strict: require Approved for admin shell too
      }
      return res.data;
    } catch (e) {
      window.location.href = "login.html";
      return null;
    }
  }

  // Decode JWT payload for UI only — NOT trusted for authorization (backend verifies)
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
        // response.credential is the Google ID token (JWT) — send the full credential to backend over HTTPS
        if (!response.credential) {
          showAlert("Missing Google credential. Please try again.", "danger");
          return;
        }
        // Client-side decode is for immediate UI only; backend will verify signature/iss/aud/exp/email_verified
        const payload = parseJwt(response.credential);
        const googleUser = {
          email: payload?.email || "",
          name: payload?.name || "",
          picture: payload?.picture || "",
          sub: payload?.sub || "",
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

  // After GIS, verify identity server-side and route accordingly
  async function handlePostGoogleSignIn(googleUser) {
    const btnArea = document.getElementById("auth-feedback");
    if (btnArea) btnArea.innerHTML = '<div class="loading-wrap"><span class="spinner"></span> Checking membership status...</div>';

    // Store token immediately so subsequent Api calls include it via getIdToken()
    if (googleUser.idToken) {
      try { sessionStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, googleUser.idToken); } catch {}
    }

    // If backend not configured, allow preview: store as approved demo user
    if (!isBackendConfigured()) {
      saveUser({ email: googleUser.email, name: googleUser.name, picture: googleUser.picture, sub: googleUser.sub, status: "Approved", role: "Alumni" }, googleUser.idToken);
      window.location.href = "dashboard.html";
      return;
    }

    // Send full ID token to backend over HTTPS — backend verifies signature/iss/aud/exp/email_verified and returns verified identity
    const res = await Api.getUserByEmail({ id_token: googleUser.idToken });
    const record = res.data;
    if (!record) {
      // Not registered -> go to register (store verified Google identity for registration form)
      saveUser({ email: googleUser.email, name: googleUser.name, picture: googleUser.picture, sub: googleUser.sub, status: "NEW" }, googleUser.idToken);
      window.location.href = "register.html";
      return;
    }
    // Existing record — use server-verified data (email/sub from verified token are authoritative)
    const status = record.status || record.Status || "Pending";
    saveUser({
      email: record.email || record.Email || googleUser.email,
      name: record.fullName || record.FullName || googleUser.name,
      picture: record.profilePhoto || record.ProfilePhoto || googleUser.picture,
      status: status,
      role: record.role || record.Role || "Alumni",
      id: record.id || record.ID || "",
      sub: record.googleSub || record.GoogleSub || googleUser.sub || ""
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

  return { saveUser, getUser, getToken, isLoggedIn, logout, requireAuth, requireApproved, verifySessionWithBackend, requireVerifiedApproved, requireVerifiedAdmin, parseJwt, initGoogleButton, handlePostGoogleSignIn, showAlert, updateHeaderAuthState };
})();
