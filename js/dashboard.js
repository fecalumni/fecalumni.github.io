/**
 * Dashboard logic - server-verified session, loading hint only until backend confirms
 */
document.addEventListener("DOMContentLoaded", async () => {
  // Fail-closed on production if config missing
  if (typeof isProductionOrigin === "function" && isProductionOrigin() && (!isBackendConfigured() || !isGoogleConfigured())) {
    document.body.innerHTML = '<div class="container" style="padding:48px 24px"><div class="alert alert-danger">Service not configured. Please contact the administrator.</div></div>';
    return;
  }

  // Treat sessionStorage as loading hint only — backend must confirm Approved
  const verifiedData = await Auth.requireVerifiedApproved();
  if (!verifiedData) return;
  const user = Auth.getUser();
  if (!user) return;

  // Welcome
  const nameEl = document.getElementById("dash-welcome-name");
  if (nameEl) nameEl.textContent = user.name || user.email;
  const emailEl = document.getElementById("dash-email");
  if (emailEl) emailEl.textContent = user.email;
  const statusEl = document.getElementById("dash-status");
  if (statusEl) statusEl.textContent = user.status || "Approved";

  // Try to load full profile for completion
  let profile = null;
  try {
    if (isBackendConfigured()) {
      const res = await Api.getAlumniProfile(user.email);
      profile = res.data;
    }
  } catch {}
  const pct = computeCompletion(profile || user);
  const ring = document.getElementById("completion-ring");
  if (ring) {
    ring.style.setProperty("--pct", pct + "%");
    ring.querySelector("span").textContent = pct + "%";
  }

  // Info box
  if (profile) fillInfo(profile);

  // Latest events / announcements on dashboard
  loadDashEvents();
  loadDashAnnouncements();

  // Logout
  document.getElementById("btn-logout")?.addEventListener("click", () => Auth.logout());
});

function computeCompletion(p) {
  const fields = ["fullName","batch","department","graduationYear","phone","profession","organization","city","linkedIn","bio","profilePhoto"];
  let filled = 0;
  fields.forEach(f => { const v = p[f] ?? p[capitalize(f)] ?? ""; if (String(v).trim()) filled++; });
  return Math.round((filled / fields.length) * 100);
}
function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function fillInfo(p) {
  const map = {
    "Full Name": p.fullName || p.FullName || "-",
    "Batch": p.batch || p.Batch || "-",
    "Department": p.department || p.Department || "-",
    "Graduation Year": p.graduationYear || p.GraduationYear || "-",
    "Profession": p.profession || p.Profession || "-",
    "Organization": p.organization || p.Organization || "-",
    "City": p.city || p.City || "-"
  };
  const dl = document.getElementById("dash-info");
  if (!dl) return;
  dl.innerHTML = Object.entries(map).map(([k,v]) => `<div class="info-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd></div>`).join("");
}

async function loadDashEvents() {
  const wrap = document.getElementById("dash-events");
  if (!wrap) return;
  try {
    const res = await Api.getEvents();
    const items = (res.data || []).filter(e => (e.status||e.Status)==="Upcoming").slice(0,2);
    if (!items.length) { wrap.innerHTML = '<p class="text-muted" style="font-size:14px">No upcoming events.</p>'; return; }
    wrap.innerHTML = items.map(ev => `
      <div class="card" style="padding:16px">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--color-accent-dark)">${escapeHtml(ev.date||ev.Date||"")} ${escapeHtml(ev.time||ev.Time||"")}</div>
        <div style="font-weight:700;margin:4px 0">${escapeHtml(ev.title||ev.Title||"")}</div>
        <div style="font-size:13px;color:var(--color-text-muted)">${escapeHtml((ev.description||ev.Description||"").slice(0,120))}</div>
      </div>`).join("");
  } catch { wrap.innerHTML = '<p class="text-muted" style="font-size:14px">Unable to load events.</p>'; }
}
async function loadDashAnnouncements() {
  const wrap = document.getElementById("dash-announcements");
  if (!wrap) return;
  try {
    const res = await Api.getAnnouncements();
    const items = (res.data||[]).slice(0,2);
    if (!items.length) { wrap.innerHTML = '<p class="text-muted" style="font-size:14px">No announcements yet.</p>'; return; }
    wrap.innerHTML = items.map(a => `
      <div class="card" style="padding:16px">
        <div style="font-size:12px;color:var(--color-text-muted)">${escapeHtml(a.date||a.Date||"")} · ${escapeHtml(a.author||a.Author||"")}</div>
        <div style="font-weight:700;margin:4px 0">${escapeHtml(a.title||a.Title||"")}</div>
        <div style="font-size:13px;color:var(--color-text-muted)">${escapeHtml((a.content||a.Content||a.description||"").slice(0,130))}</div>
      </div>`).join("");
  } catch { wrap.innerHTML = '<p class="text-muted" style="font-size:14px">Unable to load announcements.</p>'; }
}
