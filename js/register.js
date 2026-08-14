/**
 * Register page logic - Batch as 01-20, Department without Mechanical, Student ID as DEPT-BATCH-SERIAL
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

  // Populate departments (Mechanical removed)
  const deptSel = document.getElementById("reg-department");
  if (deptSel && CONFIG.DEPARTMENTS) {
    CONFIG.DEPARTMENTS.forEach(d => {
      const o = document.createElement("option"); o.value = d; o.textContent = d; deptSel.appendChild(o);
    });
  }
  // Populate batch as 01-20
  const batchSel = document.getElementById("reg-batch");
  if (batchSel) {
    var batches = CONFIG.BATCHES || ["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20"];
    batches.forEach(b => {
      const o = document.createElement("option"); o.value = b; o.textContent = b; batchSel.appendChild(o);
    });
  }
  // Graduation year (year, separate from batch)
  const gradSel = document.getElementById("reg-graduationYear");
  if (gradSel) {
    for (let y = CONFIG.BATCH_MAX + 2; y >= CONFIG.BATCH_MIN; y--) {
      const o = document.createElement("option"); o.value = String(y); o.textContent = String(y); gradSel.appendChild(o);
    }
  }

  // Auto-update Student ID placeholder based on Department + Batch
  const studentIdInput = document.getElementById("reg-studentId");
  function getDeptCode(dept) {
    if (CONFIG.DEPARTMENT_CODES && CONFIG.DEPARTMENT_CODES[dept]) return CONFIG.DEPARTMENT_CODES[dept];
    var map = { "Civil Engineering": "CE", "Electrical and Electronic Engineering": "EEE", "Computer Science and Engineering": "CSE" };
    return map[dept] || "XXX";
  }
  function updateStudentIdPlaceholder() {
    if (!studentIdInput) return;
    var dept = deptSel ? deptSel.value : "";
    var batch = batchSel ? batchSel.value : "";
    if (dept && batch && /^(0[1-9]|1[0-9]|20)$/.test(batch)) {
      var code = getDeptCode(dept);
      studentIdInput.placeholder = "e.g., " + code + "-" + batch + "-1001";
    } else if (dept && /^(0[1-9]|1[0-9]|20)$/.test(batch) === false && dept) {
      var code2 = getDeptCode(dept);
      studentIdInput.placeholder = "e.g., " + code2 + "-01-1001";
    } else {
      studentIdInput.placeholder = "e.g., EEE-01-1001";
    }
  }
  if (deptSel) deptSel.addEventListener("change", updateStudentIdPlaceholder);
  if (batchSel) batchSel.addEventListener("change", updateStudentIdPlaceholder);
  updateStudentIdPlaceholder();

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
    data.studentId = data.studentId?.trim();

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

function getDeptCodeForValidation(dept) {
  if (typeof CONFIG !== "undefined" && CONFIG.DEPARTMENT_CODES && CONFIG.DEPARTMENT_CODES[dept]) return CONFIG.DEPARTMENT_CODES[dept];
  var map = { "Civil Engineering": "CE", "Electrical and Electronic Engineering": "EEE", "Computer Science and Engineering": "CSE" };
  return map[dept] || null;
}

function validateRegistration(d) {
  const e = {};
  if (!d.fullName || d.fullName.length < 3) e.fullName = "Full name is required (at least 3 characters).";
  // Batch must be 01-20 zero-padded
  var validBatches = (typeof CONFIG !== "undefined" && CONFIG.BATCHES) ? CONFIG.BATCHES : ["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20"];
  if (!d.batch || !validBatches.includes(d.batch)) e.batch = "Batch is required. Select a valid batch (01-20).";
  // Department must be one of allowed (Mechanical removed)
  var allowedDepts = (typeof CONFIG !== "undefined" && CONFIG.DEPARTMENTS) ? CONFIG.DEPARTMENTS : ["Civil Engineering","Electrical and Electronic Engineering","Computer Science and Engineering"];
  if (!d.department || !allowedDepts.includes(d.department)) e.department = "Department is required. Select a valid department.";
  if (!d.graduationYear || !/^\d{4}$/.test(d.graduationYear)) e.graduationYear = "Graduation year is required.";
  else if (+d.graduationYear < CONFIG.BATCH_MIN || +d.graduationYear > CONFIG.BATCH_MAX + 4) e.graduationYear = "Enter a valid graduation year.";
  if (!d.phone || !/^\+?[0-9\s\-()]{8,20}$/.test(d.phone)) e.phone = "Enter a valid phone number.";
  if (!d.profession || d.profession.length < 2) e.profession = "Profession is required.";
  if (!d.organization || d.organization.length < 2) e.organization = "Organization is required.";
  if (!d.city || d.city.length < 2) e.city = "City is required.";
  if (d.linkedIn && d.linkedIn.trim() && !isSafeHttpsUrl(d.linkedIn.trim())) e.linkedIn = "LinkedIn must be a valid HTTPS URL (https://).";
  if (d.website && d.website.trim() && !isSafeHttpsUrl(d.website.trim())) e.website = "Website must be a valid HTTPS URL (https://).";
  if (d.profilePhoto && d.profilePhoto.trim() && !isSafeHttpsUrl(d.profilePhoto.trim())) e.profilePhoto = "Profile photo must be a valid HTTPS URL (https://).";
  // Student ID optional, but if provided must match DEPT-BATCH-XXXX and batch must equal selected batch
  if (d.studentId && d.studentId.trim()) {
    var sid = d.studentId.trim();
    var deptCode = getDeptCodeForValidation(d.department);
    if (!deptCode) {
      e.studentId = "Student ID must match the selected department and batch.";
    } else {
      var expectedPrefix = deptCode + "-" + d.batch + "-";
      var pattern = new RegExp("^" + deptCode + "-(0[1-9]|1[0-9]|20)-\\d{4}$");
      if (!pattern.test(sid)) {
        e.studentId = "Student ID must match the selected department and batch.";
      } else if (!sid.startsWith(expectedPrefix)) {
        e.studentId = "Student ID must match the selected department and batch.";
      }
    }
  }
  return e;
}
