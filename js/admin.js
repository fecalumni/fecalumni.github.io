/**
 * Admin dashboard logic
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof isProductionOrigin === "function" && isProductionOrigin() && (!isBackendConfigured() || !isGoogleConfigured())) {
    document.body.innerHTML = '<div class="container" style="padding:48px 24px"><div class="alert alert-danger">Service not configured. Please contact the administrator.</div></div>';
    return;
  }
  const token = Auth.getToken();
  const hintUser = Auth.getUser();
  if (!token || !hintUser) { window.location.href = "login.html"; return; }

  const feedback = document.getElementById("admin-feedback");
  const statsWrap = document.getElementById("admin-stats");
  const pendingWrap = document.getElementById("admin-pending");
  const alumniWrap = document.getElementById("admin-alumni-table");

  // Hide admin shell until server confirms, show loading
  var adminShell = document.querySelector(".admin-layout");
  var loadingWrap = null;
  if (adminShell) {
    adminShell.style.display = "none";
    loadingWrap = document.createElement("div");
    loadingWrap.className = "loading-wrap";
    loadingWrap.innerHTML = '<span class="spinner spinner-lg"></span> Verifying administrator access...';
    loadingWrap.style.padding = "48px 24px";
    adminShell.parentNode.insertBefore(loadingWrap, adminShell);
  }

  // Server-verified admin check — never trusts client adminEmail
  var adminOk = await Auth.requireVerifiedAdmin();
  if (!adminOk) {
    if (loadingWrap) loadingWrap.remove();
    return;
  }
  if (loadingWrap) loadingWrap.remove();
  if (adminShell) adminShell.style.display = "";

  const user = hintUser;

  // Show warning only on local dev when backend not configured (production already fail-closed above)
  if (!isBackendConfigured() && !isProductionOrigin()) {
    feedback.innerHTML = '<div class="alert alert-warning">Admin backend not configured. Showing demo data. Configure <code>CONFIG.API_URL</code> and the <code>Admins</code> sheet to enable real administration.</div>';
  }

  loadStats();
  loadPending();
  loadAlumniTable();

  async function loadStats() {
    if (!statsWrap) return;
    try {
      const res = await Api.getDashboardStats(user.email);
      const s = res.data || {};
      statsWrap.innerHTML = `
        <div class="admin-stat"><div class="admin-stat-label">Total Members</div><div class="admin-stat-value">${s.total ?? "-"}</div></div>
        <div class="admin-stat pending"><div class="admin-stat-label">Pending</div><div class="admin-stat-value">${s.pending ?? "-"}</div></div>
        <div class="admin-stat approved"><div class="admin-stat-label">Approved</div><div class="admin-stat-value">${s.approved ?? "-"}</div></div>
        <div class="admin-stat rejected"><div class="admin-stat-label">Rejected</div><div class="admin-stat-value">${s.rejected ?? "-"}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Suspended</div><div class="admin-stat-value">${s.suspended ?? "-"}</div></div>`;
    } catch (err) { statsWrap.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`; }
  }

  async function loadPending() {
    if (!pendingWrap) return;
    pendingWrap.innerHTML = '<div class="loading-wrap"><span class="spinner"></span> Loading pending applications...</div>';
    try {
      const res = await Api.getPendingRegistrations(user.email);
      const items = (res.data||[]).map(normalizeRow);
      if (!items.length) { pendingWrap.innerHTML = '<div class="empty-state"><p>No pending applications.</p></div>'; return; }
      pendingWrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Batch</th><th>Department</th><th>Year</th><th>Actions</th></tr></thead><tbody>` +
        items.map(r=>`<tr>
          <td><strong>${escapeHtml(r.fullName)}</strong><br><span style="font-size:12px;color:var(--color-text-muted)">${escapeHtml(r.profession)} · ${escapeHtml(r.city)}</span></td>
          <td style="font-size:13px">${escapeHtml(r.email)}</td>
          <td>${escapeHtml(r.batch)}</td>
          <td style="font-size:13px">${escapeHtml(r.department)}</td>
          <td>${escapeHtml(r.graduationYear)}</td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm btn-approve" data-approve="${escapeHtml(r.id)}">Approve</button>
            <button class="btn btn-sm btn-reject" data-reject="${escapeHtml(r.id)}">Reject</button>
          </div></td>
        </tr>`).join("") + `</tbody></table></div>`;
      pendingWrap.querySelectorAll("[data-approve]").forEach(b=>b.addEventListener("click", async ()=>{
        if(!confirm("Approve this application?")) return;
        b.disabled=true; b.textContent="...";
        try{ await Api.approveAlumni(user.email, b.dataset.approve); showToast("Approved successfully.","success"); loadPending(); loadStats(); loadAlumniTable(); }
        catch(e){ showToast(e.message||"Approve failed","danger"); b.disabled=false; b.textContent="Approve"; }
      }));
      pendingWrap.querySelectorAll("[data-reject]").forEach(b=>b.addEventListener("click", async ()=>{
        if(!confirm("Reject this application?")) return;
        b.disabled=true; b.textContent="...";
        try{ await Api.rejectAlumni(user.email, b.dataset.reject); showToast("Rejected.","success"); loadPending(); loadStats(); loadAlumniTable(); }
        catch(e){ showToast(e.message||"Reject failed","danger"); b.disabled=false; b.textContent="Reject"; }
      }));
    } catch(err){ pendingWrap.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`; }
  }

  async function loadAlumniTable() {
    if (!alumniWrap) return;
    alumniWrap.innerHTML = '<div class="loading-wrap"><span class="spinner"></span> Loading members...</div>';
    try {
      const res = await Api.getApprovedAlumni();
      // In admin we want all statuses; mock only has approved — show them
      const items = (res.data||[]).map(normalizeRow);
      const pendingRes = isBackendConfigured() ? await Api.getPendingRegistrations(user.email).catch(()=>({data:[]})) : {data:[]};
      const all = [...items, ...(pendingRes.data||[]).map(normalizeRow)];
      if (!all.length) { alumniWrap.innerHTML='<div class="empty-state"><p>No members yet.</p></div>'; return; }
      // Search
      alumniWrap.innerHTML = `
        <div style="display:flex;gap:10px;margin-bottom:12px"><input id="admin-search" class="form-input" placeholder="Search by name, email, batch..." style="flex:1"><select id="admin-status-filter" class="form-select" style="width:160px"><option value="">All Statuses</option><option>Approved</option><option>Pending</option><option>Rejected</option><option>Suspended</option></select></div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Batch</th><th>Status</th><th>Actions</th></tr></thead><tbody id="admin-tbody"></tbody></table></div>`;
      const tbody = document.getElementById("admin-tbody");
      const search = document.getElementById("admin-search");
      const statusFilter = document.getElementById("admin-status-filter");
      function render() {
        const q=(search.value||"").toLowerCase();
        const sf=statusFilter.value;
        const filtered = all.filter(r=>{
          if(sf && (r.status||r.Status)!==sf) return false;
          if(q && ![r.fullName,r.email,r.batch,r.department].join(" ").toLowerCase().includes(q)) return false;
          return true;
        });
        tbody.innerHTML = filtered.map(r=>`<tr>
          <td><strong>${escapeHtml(r.fullName)}</strong><br><span style="font-size:12px;color:var(--color-text-muted)">${escapeHtml(r.department)} · ${escapeHtml(r.city||"")}</span></td>
          <td style="font-size:13px">${escapeHtml(r.email)}</td>
          <td>${escapeHtml(r.batch)}</td>
          <td><span class="badge ${badgeClass(r.status)}">${escapeHtml(r.status||"—")}</span></td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap">
            ${r.status==="Pending" ? `<button class="btn btn-sm btn-approve" data-approve="${r.id}">Approve</button><button class="btn btn-sm btn-reject" data-reject="${r.id}">Reject</button>` : ""}
            ${r.status==="Approved" ? `<button class="btn btn-sm btn-outline" data-suspend="${r.id}">Suspend</button>` : ""}
            ${r.status==="Suspended" ? `<button class="btn btn-sm btn-approve" data-reactivate="${r.id}">Reactivate</button>` : ""}
          </div></td>
        </tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted)">No results</td></tr>`;
        tbody.querySelectorAll("[data-approve]").forEach(b=>b.addEventListener("click", async()=>{ if(!confirm("Approve?"))return; try{await Api.approveAlumni(user.email,b.dataset.approve); showToast("Approved","success"); loadPending(); loadStats(); loadAlumniTable();}catch(e){showToast(e.message,"danger");}}));
        tbody.querySelectorAll("[data-reject]").forEach(b=>b.addEventListener("click", async()=>{ if(!confirm("Reject?"))return; try{await Api.rejectAlumni(user.email,b.dataset.reject); showToast("Rejected","success"); loadPending(); loadStats(); loadAlumniTable();}catch(e){showToast(e.message,"danger");}}));
        tbody.querySelectorAll("[data-suspend]").forEach(b=>b.addEventListener("click", async()=>{ if(!confirm("Suspend this member?"))return; try{await Api.suspendAlumni(user.email,b.dataset.suspend); showToast("Suspended","success"); loadStats(); loadAlumniTable();}catch(e){showToast(e.message,"danger");}}));
        tbody.querySelectorAll("[data-reactivate]").forEach(b=>b.addEventListener("click", async()=>{ try{await Api.reactivateAlumni(user.email,b.dataset.reactivate); showToast("Reactivated","success"); loadStats(); loadAlumniTable();}catch(e){showToast(e.message,"danger");}}));
      }
      search.addEventListener("input", debounce(render,250));
      statusFilter.addEventListener("change", render);
      render();
    } catch(err){ alumniWrap.innerHTML=`<div class="alert alert-danger">${escapeHtml(err.message)}</div>`; }
  }

  function normalizeRow(r){ return { id:r.id||r.ID||"", fullName:r.fullName||r.FullName||"", email:r.email||r.Email||"", batch:String(r.batch||r.Batch||""), department:r.department||r.Department||"", graduationYear:String(r.graduationYear||r.GraduationYear||""), profession:r.profession||r.Profession||"", city:r.city||r.City||"", status:r.status||r.Status||"Approved" }; }
  function badgeClass(s){ if(s==="Approved")return"badge-success"; if(s==="Pending")return"badge-warning"; if(s==="Rejected")return"badge-danger"; if(s==="Suspended")return"badge-danger"; return"badge-neutral"; }

  // Event management (simple)
  const eventForm = document.getElementById("admin-event-form");
  eventForm?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(eventForm).entries());
    Object.keys(data).forEach(k=>data[k]=String(data[k]||"").trim());
    if(!data.title||!data.date){ showToast("Title and date are required","danger"); return; }
    const btn=eventForm.querySelector('button[type="submit"]'); const orig=btn.textContent; btn.disabled=true; btn.textContent="Saving...";
    try{ if(!isBackendConfigured()){ showToast("Event saved (demo mode)","success"); eventForm.reset(); return; } await Api.createEvent(user.email,data); showToast("Event created","success"); eventForm.reset(); }
    catch(err){ showToast(err.message||"Failed","danger"); } finally{ btn.disabled=false; btn.textContent=orig; }
  });
  const annForm = document.getElementById("admin-announcement-form");
  annForm?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(annForm).entries());
    Object.keys(data).forEach(k=>data[k]=String(data[k]||"").trim());
    if(!data.title||!data.content){ showToast("Title and content required","danger"); return; }
    const btn=annForm.querySelector('button[type="submit"]'); const orig=btn.textContent; btn.disabled=true; btn.textContent="Saving...";
    try{ if(!isBackendConfigured()){ showToast("Announcement saved (demo mode)","success"); annForm.reset(); return; } await Api.createAnnouncement(user.email,data); showToast("Announcement created","success"); annForm.reset(); }
    catch(err){ showToast(err.message||"Failed","danger"); } finally{ btn.disabled=false; btn.textContent=orig; }
  });
});
