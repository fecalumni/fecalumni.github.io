/**
 * Alumni directory logic - server-verified, no token in URL
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof isProductionOrigin === "function" && isProductionOrigin() && (!isBackendConfigured() || !isGoogleConfigured())) {
    document.body.innerHTML = '<div class="container" style="padding:48px 24px"><div class="alert alert-danger">Service not configured. Please contact the administrator.</div></div>';
    return;
  }
  const verified = await Auth.requireVerifiedApproved();
  if (!verified) return;
  const user = Auth.getUser();
  if (!user) return;
  const grid = document.getElementById("alumni-grid");
  const searchInput = document.getElementById("alumni-search");
  const deptFilter = document.getElementById("filter-department");
  const batchFilter = document.getElementById("filter-batch");
  const cityFilter = document.getElementById("filter-city");
  const countEl = document.getElementById("alumni-count");
  const paginationEl = document.getElementById("alumni-pagination");

  // Populate department filter
  CONFIG.DEPARTMENTS.forEach(d => { const o=document.createElement("option"); o.value=d; o.textContent=d; deptFilter?.appendChild(o); });

  let allData = [];
  let filtered = [];
  let currentPage = 1;
  const pageSize = CONFIG.PAGE_SIZE;

  async function load() {
    grid.innerHTML = '<div class="loading-wrap" style="grid-column:1/-1"><span class="spinner spinner-lg"></span> Loading alumni...</div>';
    try {
      const res = await Api.getApprovedAlumni();
      allData = (res.data || []).map(normalizeAlumni);
      populateBatchFilter(allData);
      populateCityFilter(allData);
      applyFilters();
    } catch (err) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>Unable to load alumni</h3><p>${escapeHtml(err.message||"Please try again later.")}</p></div>`;
    }
  }

  function normalizeAlumni(r) {
    return {
      id: r.id || r.ID || "",
      fullName: r.fullName || r.FullName || "",
      batch: String(r.batch || r.Batch || ""),
      department: r.department || r.Department || "",
      graduationYear: String(r.graduationYear || r.GraduationYear || ""),
      profession: r.profession || r.Profession || "",
      organization: r.organization || r.Organization || "",
      city: r.city || r.City || "",
      linkedIn: r.linkedIn || r.LinkedIn || "",
      profilePhoto: r.profilePhoto || r.ProfilePhoto || "",
      bio: r.bio || r.Bio || ""
    };
  }

  function populateBatchFilter(data) {
    if (!batchFilter) return;
    const batches = [...new Set(data.map(d=>d.batch).filter(Boolean))].sort();
    batches.forEach(b => { const o=document.createElement("option"); o.value=b; o.textContent="Batch "+b; batchFilter.appendChild(o); });
  }
  function populateCityFilter(data) {
    if (!cityFilter) return;
    const cities = [...new Set(data.map(d=>d.city).filter(Boolean))].sort();
    cities.forEach(c => { const o=document.createElement("option"); o.value=c; o.textContent=c; cityFilter.appendChild(o); });
  }

  function applyFilters() {
    const q = (searchInput?.value || "").toLowerCase().trim();
    const dept = deptFilter?.value || "";
    const batch = batchFilter?.value || "";
    const city = cityFilter?.value || "";
    filtered = allData.filter(a => {
      if (dept && a.department !== dept) return false;
      if (batch && a.batch !== batch) return false;
      if (city && a.city !== city) return false;
      if (q) {
        const hay = [a.fullName,a.batch,a.department,a.profession,a.organization,a.city].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    currentPage = 1;
    render();
  }

  function render() {
    if (countEl) countEl.textContent = `${filtered.length} ${filtered.length===1?"member":"members"} found`;
    if (!filtered.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>No members found</h3><p>Try adjusting your search or filters.</p></div>';
      if (paginationEl) paginationEl.innerHTML = "";
      return;
    }
    const totalPages = Math.ceil(filtered.length / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage-1)*pageSize;
    const pageItems = filtered.slice(start, start+pageSize);
    grid.innerHTML = pageItems.map(cardHtml).join("");
    renderPagination(totalPages);
  }

  function cardHtml(a) {
    const hasPhoto = isSafeHttpsUrl(a.profilePhoto);
    const avatar = hasPhoto ? `<img src="${escapeHtml(a.profilePhoto)}" alt="${escapeHtml(a.fullName)}" loading="lazy">` : escapeHtml(initials(a.fullName));
    const linkedInBtn = isSafeHttpsUrl(a.linkedIn) ? `<a class="btn btn-outline btn-sm" href="${escapeHtml(a.linkedIn)}" target="_blank" rel="noopener">View LinkedIn</a>` : "";
    return `
      <div class="alumni-card">
        <div class="alumni-card-top">
          <div class="alumni-avatar">${avatar}</div>
          <div style="min-width:0">
            <div class="alumni-name">${escapeHtml(a.fullName)}</div>
            <div class="alumni-meta">${escapeHtml(a.department)} · Batch ${escapeHtml(a.batch)} · ${escapeHtml(a.graduationYear)}</div>
            <div class="alumni-badges"><span class="badge badge-neutral">${escapeHtml(a.batch)}</span><span class="badge badge-info">${escapeHtml(a.department)}</span></div>
          </div>
        </div>
        <div class="alumni-card-body">
          <div class="alumni-detail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg> ${escapeHtml(a.profession || "—")}</div>
          <div class="alumni-detail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v2"/></svg> ${escapeHtml(a.organization || "—")}</div>
          <div class="alumni-detail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg> ${escapeHtml(a.city || "—")}</div>
          ${a.bio ? `<p style="font-size:13px;color:var(--color-text-muted);margin-top:8px;line-height:1.6">${escapeHtml(a.bio.slice(0,120))}</p>` : ""}
        </div>
        <div class="alumni-card-foot">${linkedInBtn}</div>
      </div>`;
  }

  function renderPagination(totalPages) {
    if (!paginationEl || totalPages <= 1) { if (paginationEl) paginationEl.innerHTML=""; return; }
    let html = `<button ${currentPage===1?"disabled":""} data-page="${currentPage-1}">Prev</button>`;
    for (let i=1;i<=totalPages;i++) {
      if (i===1 || i===totalPages || Math.abs(i-currentPage)<=1) html += `<button class="${i===currentPage?"active":""}" data-page="${i}">${i}</button>`;
      else if (Math.abs(i-currentPage)===2) html += `<span style="padding:0 4px;color:var(--color-text-light)">…</span>`;
    }
    html += `<button ${currentPage===totalPages?"disabled":""} data-page="${currentPage+1}">Next</button>`;
    paginationEl.innerHTML = html;
    paginationEl.querySelectorAll("button[data-page]").forEach(b => b.addEventListener("click", () => { currentPage = +b.dataset.page; render(); grid.scrollIntoView({behavior:"smooth", block:"start"}); }));
  }

  searchInput?.addEventListener("input", debounce(applyFilters, 300));
  deptFilter?.addEventListener("change", applyFilters);
  batchFilter?.addEventListener("change", applyFilters);
  cityFilter?.addEventListener("change", applyFilters);

  load();
});
