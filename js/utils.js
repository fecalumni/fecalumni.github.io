/**
 * Shared utilities
 */
function escapeHtml(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function showToast(message, type = "info") {
  let c = document.getElementById("toast-container");
  if (!c) { c = document.createElement("div"); c.id = "toast-container"; c.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:300;display:flex;flex-direction:column;gap:10px;max-width:360px;"; document.body.appendChild(c); }
  const el = document.createElement("div");
  el.className = "alert alert-" + type;
  el.style.boxShadow = "var(--shadow-lg)";
  el.textContent = message;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
function formatDate(iso) {
  if (!iso) return "";
  try { const d = new Date(iso); return d.toLocaleDateString("en-GB", { year:"numeric", month:"short", day:"numeric" }); }
  catch { return iso; }
}
function initials(name) {
  return String(name||"").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("") || "?";
}
function debounce(fn, ms) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

// Navbar toggle
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("nav-toggle");
  const menu = document.getElementById("nav-mobile");
  if (btn && menu) {
    btn.addEventListener("click", () => {
      const open = menu.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  // Active link
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-desktop a, .nav-mobile a").forEach(a => {
    if (a.getAttribute("href") === path) a.classList.add("active");
  });
  // Auth header state
  try { if (typeof Auth !== "undefined") Auth.updateHeaderAuthState(); } catch {}
});
