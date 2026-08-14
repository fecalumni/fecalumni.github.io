/**
 * Events + Announcements for public pages
 */
async function loadEventsPage() {
  const upcomingWrap = document.getElementById("events-upcoming");
  const pastWrap = document.getElementById("events-past");
  if (!upcomingWrap && !pastWrap) return;
  const showLoading = (el) => { if(el) el.innerHTML='<div class="loading-wrap"><span class="spinner"></span> Loading events...</div>'; };
  showLoading(upcomingWrap); showLoading(pastWrap);
  try {
    const res = await Api.getEvents();
    const events = (res.data||[]).map(r=>({
      id: r.id||r.ID||"", title: r.title||r.Title||"", date: r.date||r.Date||"", time: r.time||r.Time||"",
      location: r.location||r.Location||"", description: r.description||r.Description||"", image: r.image||r.Image||"", status: r.status||r.Status||"Upcoming", registrationUrl: r.registrationUrl||r.RegistrationUrl||""
    }));
    const upcoming = events.filter(e=>e.status==="Upcoming");
    const past = events.filter(e=>e.status==="Past");
    renderEventList(upcomingWrap, upcoming, "No upcoming events at the moment.");
    renderEventList(pastWrap, past, "No past events to show.");
  } catch (err) {
    if (upcomingWrap) upcomingWrap.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message||"Unable to load events.")}</div>`;
  }
}
function renderEventList(container, items, emptyMsg) {
  if (!container) return;
  if (!items.length) { container.innerHTML = `<div class="empty-state"><p>${escapeHtml(emptyMsg)}</p></div>`; return; }
  container.innerHTML = items.map(ev => `
    <div class="event-card">
      <div class="event-card-img">${isSafeHttpsUrl(ev.image) ? `<img src="${escapeHtml(ev.image)}" alt="${escapeHtml(ev.title)}" loading="lazy">` : `<span style="font-size:13px">No image</span>`}</div>
      <div class="event-card-body">
        <div class="event-meta">
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> ${escapeHtml(ev.date)}</span>
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 12l3-2"/><path d="M12 8v4"/></svg> ${escapeHtml(ev.time)}</span>
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg> ${escapeHtml(ev.location)}</span>
        </div>
        <h3 style="font-size:15px;font-weight:700;margin-bottom:6px">${escapeHtml(ev.title)}</h3>
        <p style="font-size:13px;color:var(--color-text-muted);line-height:1.6">${escapeHtml(ev.description)}</p>
        ${isSafeHttpsUrl(ev.registrationUrl) ? `<div style="margin-top:12px"><a class="btn btn-primary btn-sm" href="${escapeHtml(ev.registrationUrl)}" target="_blank" rel="noopener">Register</a></div>` : ""}
      </div>
    </div>`).join("");
}

async function loadAnnouncementsPage() {
  const wrap = document.getElementById("announcements-list");
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><span class="spinner"></span> Loading announcements...</div>';
  try {
    const res = await Api.getAnnouncements();
    const items = (res.data||[]).map(r=>({ id:r.id||r.ID||"", title:r.title||r.Title||"", content:r.content||r.Content||r.description||"", date:r.date||r.Date||"", author:r.author||r.Author||"", image:r.image||r.Image||"" }));
    if (!items.length) { wrap.innerHTML = '<div class="empty-state"><p>No announcements yet.</p></div>'; return; }
    wrap.innerHTML = items.map(a => `
      <div class="announcement-card">
        ${isSafeHttpsUrl(a.image) ? `<div class="event-card-img"><img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.title)}" loading="lazy"></div>` : ""}
        <div class="announcement-card-body">
          <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:6px">${escapeHtml(a.date)} · ${escapeHtml(a.author)}</div>
          <h3 style="font-size:16px;font-weight:700;margin-bottom:8px">${escapeHtml(a.title)}</h3>
          <p style="font-size:14px;color:var(--color-text-muted);line-height:1.7">${escapeHtml(a.content)}</p>
        </div>
      </div>`).join("");
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message||"Unable to load announcements.")}</div>`;
  }
}

// Auto-load when DOM ready based on page markers
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("events-upcoming") || document.getElementById("events-past")) loadEventsPage();
  if (document.getElementById("announcements-list")) loadAnnouncementsPage();
  // Home page latest
  const homeEvents = document.getElementById("home-events");
  if (homeEvents) {
    Api.getEvents().then(res=>{
      const items=(res.data||[]).filter(e=>(e.status||e.Status)==="Upcoming").slice(0,3);
      if(!items.length){ homeEvents.innerHTML='<p class="text-muted">No upcoming events.</p>'; return; }
      homeEvents.innerHTML = items.map(ev=>`
        <div class="card" style="padding:18px">
          <div style="font-size:12px;font-weight:600;color:var(--color-accent-dark)">${escapeHtml(ev.date||ev.Date||"")} · ${escapeHtml(ev.location||ev.Location||"")}</div>
          <h3 style="font-size:15px;margin:6px 0">${escapeHtml(ev.title||ev.Title||"")}</h3>
          <p style="font-size:13px;color:var(--color-text-muted)">${escapeHtml((ev.description||ev.Description||"").slice(0,110))}</p>
        </div>`).join("");
    }).catch(()=>{ homeEvents.innerHTML='<p class="text-muted">Unable to load events.</p>'; });
  }
  const homeAnn = document.getElementById("home-announcements");
  if (homeAnn) {
    Api.getAnnouncements().then(res=>{
      const items=(res.data||[]).slice(0,3);
      if(!items.length){ homeAnn.innerHTML='<p class="text-muted">No announcements yet.</p>'; return; }
      homeAnn.innerHTML = items.map(a=>`
        <div class="card" style="padding:18px">
          <div style="font-size:12px;color:var(--color-text-muted)">${escapeHtml(a.date||a.Date||"")} · ${escapeHtml(a.author||a.Author||"")}</div>
          <h3 style="font-size:15px;margin:6px 0">${escapeHtml(a.title||a.Title||"")}</h3>
          <p style="font-size:13px;color:var(--color-text-muted)">${escapeHtml((a.content||a.Content||"").slice(0,110))}</p>
        </div>`).join("");
    }).catch(()=>{ homeAnn.innerHTML='<p class="text-muted">Unable to load announcements.</p>'; });
  }
});
