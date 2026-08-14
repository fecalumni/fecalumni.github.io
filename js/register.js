/**
 * Register page logic
 */
document.addEventListener("DOMContentLoaded", () => {
  const user = Auth.getUser();
  const form = document.getElementById("register-form");
  const emailInput = document.getElementById("reg-email");
  const nameInput = document.getElementById("reg-name");
  const feedback = document.getElementById("register-feedback");

  if (!user || !user.email) {
    if (feedback) feedback.innerHTML = '<div class="alert alert-warning">Please sign in with Google first. <a href="login.html">Go to Login</a></div>';
    if (form) form.style.display = "none";
    return;
  }
  if (user.status && user.status !== "NEW") {
    if (feedback) feedback.innerHTML = `<div class="alert alert-info">Your account status is <strong>${escapeHtml(user.status)}</strong>. <a href="login.html">Go to Login</a></div>`;
    if (form) form.style.display = "none";
    return;
  }

  if (emailInput) { emailInput.value = user.email; emailInput.readOnly = true; }
  if (nameInput && user.name && !nameInput.value) nameInput.value = user.name;

  // Populate departments
  const deptSel = document.getElementById("reg-department");
  if (deptSel && CONFIG.DEPARTMENTS) {
    CONFIG.DEPARTMENTS.forEach(d => {
      const o = document.createElement("option"); o.value = d; o.textContent = d; deptSel.appendChild(o);
    });
  }
  // Graduation year
  const gradSel = document.getElementById("reg-graduationYear");
  if (gradSel) {
    for (let y = CONFIG.BATCH_MAX + 2; y >= CONFIG.BATCH_MIN; y--) {
      const o = document.createElement("option"); o.value = String(y); o.textContent = String(y); gradSel.appendChild(o);
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    feedback.innerHTML = "";
    const data = Object.fromEntries(new FormData(form).entries());
    // Normalize
    data.email = user.email;
    data.fullName = data.fullName?.trim();
    data.batch = data.batch?.trim();
    data.department = data.department?.trim();
    data.graduationYear = data.graduationYear?.trim();
    data.phone = data.phone?.trim();
    data.profession = data.profession?.trim();
    data.organization = data.organization?.trim();
    data.city = data.city?.trim();

    const errors = validateRegistration(data);
    // Render errors
    form.querySelectorAll(".form-error").forEach(el => el.textContent = "");
    form.querySelectorAll(".is-error").forEach(el => el.classList.remove("is-error"));
    if (Object.keys(errors).length) {
      Object.entries(errors).forEach(([field, msg]) => {
        const input = form.querySelector(`[name="${field}"]`);
        const errEl = document.getElementById(`err-${field}`);
        if (input) input.classList.add("is-error");
        if (errEl) errEl.textContent = msg;
      });
      feedback.innerHTML = '<div class="alert alert-danger">Please correct the highlighted fields.</div>';
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Submitting...';

    try {
      if (!isBackendConfigured()) {
        // Demo mode: simulate success
        await new Promise(r => setTimeout(r, 900));
        Auth.saveUser({ email: user.email, name: data.fullName, picture: user.picture || "", status: "Pending", role: "Alumni" }, user.idToken || "");
        feedback.innerHTML = '<div class="alert alert-success">Your alumni registration has been submitted successfully. Your account is currently awaiting administrator approval. (Demo mode — backend not configured.)</div>';
        form.reset();
        if (emailInput) emailInput.value = user.email;
        setTimeout(() => window.location.href = "login.html?reason=Pending", 1800);
        return;
      }
      const res = await Api.registerAlumni(data);
      // Save as pending locally
      Auth.saveUser({ email: user.email, name: data.fullName, picture: user.picture || "", status: "Pending", role: "Alumni" }, user.idToken || "");
      feedback.innerHTML = '<div class="alert alert-success">Your alumni registration has been submitted successfully. Your account is currently awaiting administrator approval.</div>';
      form.reset();
      if (emailInput) emailInput.value = user.email;
      setTimeout(() => window.location.href = "login.html?reason=Pending", 1800);
    } catch (err) {
      feedback.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message || "Registration could not be completed. Please try again.")}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  });
});

function validateRegistration(d) {
  const e = {};
  if (!d.fullName || d.fullName.length < 3) e.fullName = "Full name is required (at least 3 characters).";
  if (!d.batch || !/^\d{4}$/.test(d.batch)) e.batch = "Batch is required (e.g., 2015).";
  else if (+d.batch < CONFIG.BATCH_MIN || +d.batch > CONFIG.BATCH_MAX + 2) e.batch = `Batch must be between ${CONFIG.BATCH_MIN} and ${CONFIG.BATCH_MAX + 2}.`;
  if (!d.department) e.department = "Department is required.";
  if (!d.graduationYear || !/^\d{4}$/.test(d.graduationYear)) e.graduationYear = "Graduation year is required.";
  else if (+d.graduationYear < CONFIG.BATCH_MIN || +d.graduationYear > CONFIG.BATCH_MAX + 4) e.graduationYear = "Enter a valid graduation year.";
  if (!d.phone || !/^\+?[0-9\s\-()]{8,20}$/.test(d.phone)) e.phone = "Enter a valid phone number.";
  if (!d.profession || d.profession.length < 2) e.profession = "Profession is required.";
  if (!d.organization || d.organization.length < 2) e.organization = "Organization is required.";
  if (!d.city || d.city.length < 2) e.city = "City is required.";
  if (d.linkedIn && d.linkedIn.trim() && !isSafeHttpsUrl(d.linkedIn.trim())) e.linkedIn = "LinkedIn must be a valid HTTPS URL (https://).";
  if (d.website && d.website.trim() && !isSafeHttpsUrl(d.website.trim())) e.website = "Website must be a valid HTTPS URL (https://).";
  if (d.profilePhoto && d.profilePhoto.trim() && !isSafeHttpsUrl(d.profilePhoto.trim())) e.profilePhoto = "Profile photo must be a valid HTTPS URL (https://).";
  return e;
}
