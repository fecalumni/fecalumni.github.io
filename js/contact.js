/**
 * Contact form
 */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const feedback = document.getElementById("contact-feedback");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    Object.keys(data).forEach(k=>data[k]=String(data[k]||"").trim());
    if (!data.name || data.name.length<2) { feedback.innerHTML='<div class="alert alert-danger">Name is required.</div>'; return; }
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { feedback.innerHTML='<div class="alert alert-danger">Valid email is required.</div>'; return; }
    if (!data.subject || data.subject.length<3) { feedback.innerHTML='<div class="alert alert-danger">Subject is required.</div>'; return; }
    if (!data.message || data.message.length<10) { feedback.innerHTML='<div class="alert alert-danger">Message must be at least 10 characters.</div>'; return; }
    const btn = form.querySelector('button[type="submit"]'); const orig=btn.textContent; btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Sending...';
    try {
      if (!isBackendConfigured()) { await new Promise(r=>setTimeout(r,700)); feedback.innerHTML='<div class="alert alert-success">Thank you for your message. We will get back to you soon. (Demo mode — backend not configured.)</div>'; form.reset(); return; }
      await Api.submitContact(data);
      feedback.innerHTML='<div class="alert alert-success">Thank you for your message. We will get back to you soon.</div>';
      form.reset();
    } catch(err){ feedback.innerHTML=`<div class="alert alert-danger">${escapeHtml(err.message||"Unable to send message.")}</div>`; }
    finally{ btn.disabled=false; btn.textContent=orig; }
  });
});
