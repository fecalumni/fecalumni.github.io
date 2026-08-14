/**
 * Profile page logic
 */
document.addEventListener("DOMContentLoaded", async () => {
  const user = Auth.requireAuth();
  if (!user) return;

  const viewMode = document.getElementById("profile-view");
  const editMode = document.getElementById("profile-edit");
  const feedback = document.getElementById("profile-feedback");

  let profile = null;

  async function loadProfile() {
    try {
      if (!isBackendConfigured()) {
        profile = { fullName: user.name || user.email, email: user.email, batch: "2015", department: "Computer Science and Engineering", graduationYear: "2019", phone: "+8801XXXXXXXXX", profession: "Software Engineer", organization: "Example Corp", city: "Dhaka", linkedIn: "", website: "", profilePhoto: user.picture || "", bio: "FEC alumnus. (Demo data — configure backend for real profile.)", status: user.status };
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
    const hasPhoto = p.profilePhoto && /^https?:\/\//.test(p.profilePhoto);
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
            ${p.linkedIn ? `<div class="info-row"><dt>LinkedIn</dt><dd><a href="${escapeHtml(p.linkedIn)}" target="_blank" rel="noopener">Open</a></dd></div>` : ""}
            ${p.website ? `<div class="info-row"><dt>Website</dt><dd><a href="${escapeHtml(p.website)}" target="_blank" rel="noopener">Open</a></dd></div>` : ""}
          </dl>
        </div>
        <div class="info-box">
          <h3>About</h3>
          <p style="font-size:14px;color:var(--color-text-muted);line-height:1.7">${p.bio ? escapeHtml(p.bio) : '<span style="color:var(--color-text-light)">No bio added yet.</span>'}</p>
        </div>
      </div>`;
    document.getElementById("btn-edit-profile")?.addEventListener("click", () => openEdit(p));
  }

  function openEdit(p) {
    viewMode.classList.add("hidden");
    editMode.classList.remove("hidden");
    // Populate form
    const form = document.getElementById("profile-form");
    if (!form) return;
    // Departments
    const deptSel = form.querySelector('[name="department"]');
    if (deptSel && !deptSel.dataset.filled) {
      CONFIG.DEPARTMENTS.forEach(d => { const o=document.createElement("option"); o.value=d; o.textContent=d; deptSel.appendChild(o); });
      deptSel.dataset.filled="1";
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
    // Basic validation
    if (!data.fullName || data.fullName.length < 3) { feedback.innerHTML='<div class="alert alert-danger">Full name is required.</div>'; return; }
    if (data.linkedIn && !/^https?:\/\//.test(data.linkedIn)) { feedback.innerHTML='<div class="alert alert-danger">LinkedIn must be a valid URL.</div>'; return; }
    if (data.website && !/^https?:\/\//.test(data.website)) { feedback.innerHTML='<div class="alert alert-danger">Website must be a valid URL.</div>'; return; }
    if (data.profilePhoto && !/^https?:\/\//.test(data.profilePhoto)) { feedback.innerHTML='<div class="alert alert-danger">Profile photo must be a valid URL.</div>'; return; }

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
