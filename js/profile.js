/**
 * Profile page logic - Batch 01-20, Department without Mechanical, Student ID DEPT-BATCH-SERIAL
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof isProductionOrigin === "function" && isProductionOrigin() && (!isBackendConfigured() || !isGoogleConfigured())) {
    document.body.innerHTML = '<div class="container" style="padding:48px 24px"><div class="alert alert-danger">Service not configured. Please contact the administrator.</div></div>';
    return;
  }
  const token = Auth.getToken();
  const hintUser = Auth.getUser();
  if (!token || !hintUser) { window.location.href = "login.html"; return; }

  const viewMode = document.getElementById("profile-view");
  const editMode = document.getElementById("profile-edit");
  const feedback = document.getElementById("profile-feedback");

  // Treat sessionStorage as loading hint only — verify with backend before rendering shell
  viewMode.innerHTML = '<div class="loading-wrap"><span class="spinner spinner-lg"></span> Verifying your session...</div>';
  var session = await Auth.verifySessionWithBackend();
  if (!session || session.error) {
    if (session && session.error === "config") {
      document.body.innerHTML = '<div class="container" style="padding:48px 24px"><div class="alert alert-danger">Service not configured. Please contact the administrator.</div></div>';
      return;
    }
    window.location.href = "login.html";
    return;
  }
  if (session.status === "NEW") { window.location.href = "register.html"; return; }
  // For Pending/Rejected/Suspended, still allow viewing own profile but with badge; do not redirect away
  const user = Auth.getUser();
  if (!user) { window.location.href = "login.html"; return; }

  let profile = null;

  async function loadProfile() {
    try {
      if (!isBackendConfigured()) {
        profile = { fullName: user.name || user.email, email: user.email, batch: "08", department: "Computer Science and Engineering", graduationYear: "2019", phone: "+8801XXXXXXXXX", profession: "Software Engineer", organization: "Example Corp", city: "Dhaka", linkedIn: "", website: "", profilePhoto: user.picture || "", bio: "FEC alumnus. (Demo data — configure backend for real profile.)", status: user.status };
        renderView(profile);
        return;
      }
      const res = await Api.getAlumniProfile(user.email);
      profile = res.data;
      if (!profile) throw new Error("Profile not found");
      // Normalize keys
      profile = normalize(profile);
      renderView(profile);
    } catch (err) {
      viewMode.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message||"Unable to load profile.")}</div>`;
    }
  }

  function normalize(r){
    return {
      id: r.id||r.ID||"",
      fullName: r.fullName||r.FullName||"",
      email: r.email||r.Email||"",
      batch: String(r.batch||r.Batch||""),
      department: r.department||r.Department||"",
      graduationYear: String(r.graduationYear||r.GraduationYear||""),
      studentId: r.studentId||r.StudentID||"",
      phone: r.phone||r.Phone||"",
      profession: r.profession||r.Profession||"",
      organization: r.organization||r.Organization||"",
      city: r.city||r.City||"",
      linkedIn: r.linkedIn||r.LinkedIn||"",
      website: r.website||r.Website||"",
      profilePhoto: r.profilePhoto||r.ProfilePhoto||"",
      bio: r.bio||r.Bio||"",
      status: r.status||r.Status||""
    };
  }

  function renderView(p) {
    const hasPhoto = isSafeHttpsUrl(p.profilePhoto);
    const avatarInner = hasPhoto ? `<img src="${escapeHtml(p.profilePhoto)}" alt="${escapeHtml(p.fullName)}">` : escapeHtml(initials(p.fullName));
    viewMode.innerHTML = `
      <div class="profile-header">
        <div class="profile-cover"></div>
        <div class="profile-head-main">
          <div class="profile-avatar-lg">${avatarInner}</div>
          <div class="profile-head-text" style="flex:1;min-width:200px">
            <h1>${escapeHtml(p.fullName)}</h1>
            <p>${escapeHtml(p.department)} · Batch ${escapeHtml(p.batch)} · Class of ${escapeHtml(p.graduationYear)}</p>
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
              <span class="badge badge-success">${escapeHtml(p.status||"Approved")}</span>
              <span class="badge badge-neutral">${escapeHtml(p.city||"")}</span>
            </div>
          </div>
          <button class="btn btn-outline" id="btn-edit-profile">Edit Profile</button>
        </div>
      </div>
      <div class="profile-grid">
        <div class="info-box">
          <h3>Contact and Professional Info</h3>
          <dl>
            <div class="info-row"><dt>Profession</dt><dd>${escapeHtml(p.profession||"—")}</dd></div>
            <div class="info-row"><dt>Organization</dt><dd>${escapeHtml(p.organization||"—")}</dd></div>
            <div class="info-row"><dt>City</dt><dd>${escapeHtml(p.city||"—")}</dd></div>
            <div class="info-row"><dt>Phone</dt><dd>${escapeHtml(p.phone||"—")}</dd></div>
            <div class="info-row"><dt>Email</dt><dd>${escapeHtml(p.email||"—")}</dd></div>
            <div class="info-row"><dt>Student ID</dt><dd>${escapeHtml(p.studentId||"—")}</dd></div>
            ${isSafeHttpsUrl(p.linkedIn) ? `<div class="info-row"><dt>LinkedIn</dt><dd><a href="${escapeHtml(p.linkedIn)}" target="_blank" rel="noopener">Open</a></dd></div>` : ""}
            ${isSafeHttpsUrl(p.website) ? `<div class="info-row"><dt>Website</dt><dd><a href="${escapeHtml(p.website)}" target="_blank" rel="noopener">Open</a></dd></div>` : ""}
          </dl>
        </div>
        <div class="info-box">
          <h3>About</h3>
          <p style="font-size:14px;color:var(--color-text-muted);line-height:1.7">${p.bio ? escapeHtml(p.bio) : '<span style="color:var(--color-text-light)">No bio added yet.</span>'}</p>
        </div>
      </div>`;
    document.getElementById("btn-edit-profile")?.addEventListener("click", () => openEdit(p));
  }

  function getDeptCode(dept) {
    if (typeof CONFIG !== "undefined" && CONFIG.DEPARTMENT_CODES && CONFIG.DEPARTMENT_CODES[dept]) return CONFIG.DEPARTMENT_CODES[dept];
    var map = { "Civil Engineering": "CE", "Electrical and Electronic Engineering": "EEE", "Computer Science and Engineering": "CSE" };
    return map[dept] || null;
  }

  function openEdit(p) {
    viewMode.classList.add("hidden");
    editMode.classList.remove("hidden");
    // Populate form
    const form = document.getElementById("profile-form");
    if (!form) return;
    // Departments (without Mechanical)
    const deptSel = form.querySelector('[name="department"]');
    if (deptSel) {
      // Repopulate if not already or if contains Mechanical
      var hasMechanical = Array.from(deptSel.options).some(o => o.value === "Mechanical Engineering");
      if (!deptSel.dataset.filled || hasMechanical) {
        deptSel.innerHTML = '<option value="">Select department</option>';
        CONFIG.DEPARTMENTS.forEach(d => { const o=document.createElement("option"); o.value=d; o.textContent=d; deptSel.appendChild(o); });
        deptSel.dataset.filled="1";
      }
    }
    // Batch 01-20
    const batchSel = form.querySelector('[name="batch"]');
    if (batchSel) {
      if (!batchSel.dataset.filled) {
        batchSel.innerHTML = '<option value="">Select batch</option>';
        var batches = (typeof CONFIG !== "undefined" && CONFIG.BATCHES) ? CONFIG.BATCHES : ["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20"];
        batches.forEach(b => { const o=document.createElement("option"); o.value=b; o.textContent=b; batchSel.appendChild(o); });
        batchSel.dataset.filled="1";
      }
    }
    // Graduation Year
    const gradSel = form.querySelector('[name="graduationYear"]');
    if (gradSel && !gradSel.dataset.filled) {
      gradSel.innerHTML = '<option value="">Select year</option>';
      for (let y = CONFIG.BATCH_MAX + 2; y >= CONFIG.BATCH_MIN; y--) {
        const o=document.createElement("option"); o.value=String(y); o.textContent=String(y); gradSel.appendChild(o);
      }
      gradSel.dataset.filled="1";
    }
    form.querySelector('[name="fullName"]').value = p.fullName || "";
    form.querySelector('[name="batch"]').value = p.batch || "";
    form.querySelector('[name="department"]').value = p.department || "";
    form.querySelector('[name="graduationYear"]').value = p.graduationYear || "";
    form.querySelector('[name="studentId"]').value = p.studentId || "";
    form.querySelector('[name="phone"]').value = p.phone || "";
    form.querySelector('[name="profession"]').value = p.profession || "";
    form.querySelector('[name="organization"]').value = p.organization || "";
    form.querySelector('[name="city"]').value = p.city || "";
    form.querySelector('[name="linkedIn"]').value = p.linkedIn || "";
    form.querySelector('[name="website"]').value = p.website || "";
    form.querySelector('[name="profilePhoto"]').value = p.profilePhoto || "";
    form.querySelector('[name="bio"]').value = p.bio || "";
    feedback.innerHTML = "";

    // Update Student ID placeholder based on current dept/batch
    var studentIdInput = form.querySelector('[name="studentId"]');
    function updatePlaceholder() {
      var d = deptSel ? deptSel.value : "";
      var b = batchSel ? batchSel.value : "";
      if (d && b && /^(0[1-9]|1[0-9]|20)$/.test(b)) {
        var code = getDeptCode(d);
        if (code) studentIdInput.placeholder = "e.g., " + code + "-" + b + "-1001";
      } else if (d) {
        var code2 = getDeptCode(d);
        if (code2) studentIdInput.placeholder = "e.g., " + code2 + "-01-1001";
      }
    }
    if (deptSel) deptSel.addEventListener("change", updatePlaceholder);
    if (batchSel) batchSel.addEventListener("change", updatePlaceholder);
    updatePlaceholder();
  }

  document.getElementById("btn-cancel-edit")?.addEventListener("click", () => {
    editMode.classList.add("hidden");
    viewMode.classList.remove("hidden");
  });

  document.getElementById("profile-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());
    Object.keys(data).forEach(k => data[k] = String(data[k]||"").trim());
    feedback.innerHTML = "";
    // Validation - Batch 01-20, Department without Mechanical, Student ID DEPT-BATCH-XXXX
    var validBatches = (typeof CONFIG !== "undefined" && CONFIG.BATCHES) ? CONFIG.BATCHES : ["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20"];
    var allowedDepts = (typeof CONFIG !== "undefined" && CONFIG.DEPARTMENTS) ? CONFIG.DEPARTMENTS : ["Civil Engineering","Electrical and Electronic Engineering","Computer Science and Engineering"];
    if (!data.fullName || data.fullName.length < 3) { feedback.innerHTML='<div class="alert alert-danger">Full name is required.</div>'; return; }
    if (!data.batch || !validBatches.includes(data.batch)) { feedback.innerHTML='<div class="alert alert-danger">Batch is required. Select a valid batch (01-20).</div>'; return; }
    if (!data.department || !allowedDepts.includes(data.department)) { feedback.innerHTML='<div class="alert alert-danger">Department is required. Select a valid department.</div>'; return; }
    if (!data.graduationYear || !/^\d{4}$/.test(data.graduationYear)) { feedback.innerHTML='<div class="alert alert-danger">Graduation year is required.</div>'; return; }
    if (data.linkedIn && !isSafeHttpsUrl(data.linkedIn)) { feedback.innerHTML='<div class="alert alert-danger">LinkedIn must be a valid HTTPS URL.</div>'; return; }
    if (data.website && !isSafeHttpsUrl(data.website)) { feedback.innerHTML='<div class="alert alert-danger">Website must be a valid HTTPS URL.</div>'; return; }
    if (data.profilePhoto && !isSafeHttpsUrl(data.profilePhoto)) { feedback.innerHTML='<div class="alert alert-danger">Profile photo must be a valid HTTPS URL.</div>'; return; }
    if (data.studentId && data.studentId.trim()) {
      var sid = data.studentId.trim();
      var deptCode = getDeptCode(data.department);
      if (!deptCode) { feedback.innerHTML='<div class="alert alert-danger">Student ID must match the selected department and batch.</div>'; return; }
      var pattern = new RegExp("^" + deptCode + "-(0[1-9]|1[0-9]|20)-\\d{4}$");
      var expectedPrefix = deptCode + "-" + data.batch + "-";
      if (!pattern.test(sid) || !sid.startsWith(expectedPrefix)) {
        feedback.innerHTML='<div class="alert alert-danger">Student ID must match the selected department and batch.</div>'; return;
      }
    }

    const btn = form.querySelector('button[type="submit"]');
    const orig = btn.textContent; btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Saving...';
    try {
      if (!isBackendConfigured()) {
        await new Promise(r=>setTimeout(r,700));
        showToast("Profile updated (demo mode). Configure backend for persistence.", "success");
        // Update local view
        Object.assign(profile, data);
        editMode.classList.add("hidden"); viewMode.classList.remove("hidden");
        renderView(profile);
        return;
      }
      await Api.updateAlumniProfile(user.email, data);
      showToast("Profile updated successfully.", "success");
      // Reload
      const res = await Api.getAlumniProfile(user.email);
      profile = normalize(res.data);
      editMode.classList.add("hidden"); viewMode.classList.remove("hidden");
      renderView(profile);
    } catch (err) {
      feedback.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message||"Unable to save profile.")}</div>`;
    } finally { btn.disabled=false; btn.textContent=orig; }
  });

  loadProfile();
});
