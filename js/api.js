/**
 * FEC Alumni - API Client
 * Communicates with Google Apps Script Web App.
 * Sends verified Google ID token (id_token) over HTTPS for all protected requests.
 * Falls back to local mock when API_URL is not configured (for UI preview).
 */
const Api = (() => {
  function buildUrl(params) {
    const url = new URL(CONFIG.API_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    return url.toString();
  }

  function getIdToken() {
    try {
      if (typeof Auth !== "undefined" && Auth.getToken) return Auth.getToken() || "";
    } catch {}
    try { return sessionStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN) || ""; } catch { return ""; }
  }

  function isProdOrigin() {
    try { return location.hostname === "fecalumni.github.io" || location.hostname.endsWith(".fecalumni.github.io"); } catch { return false; }
  }

  async function request(action, data = {}, method = "GET") {
    if (!isBackendConfigured()) {
      if (isProdOrigin()) {
        throw new Error("Service not configured. Please contact the administrator.");
      }
      return handleMock(action, data);
    }
    try {
      if (method === "GET") {
        // Public GET only — never put id_token in URL
        const url = buildUrl({ action, ...data });
        const res = await fetch(url, { method: "GET" });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || "Request failed");
        return json;
      } else {
        // Protected POST — id_token in JSON body over HTTPS (never in URL). Backend verifies signature/iss/aud/exp/email_verified.
        const token = data.id_token || data.idToken || getIdToken() || "";
        const dataWithToken = { ...data };
        if (token) {
          dataWithToken.id_token = token;
          delete dataWithToken.idToken;
        }
        const res = await fetch(CONFIG.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action, ...dataWithToken })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || "Request failed");
        return json;
      }
    } catch (err) {
      console.error("[Api]", action, err);
      throw err;
    }
  }

  // Public API - id_token is injected automatically from Auth.getToken();
  // Protected operations use POST so id_token stays in body, never in URL.
  // For initial login (before token is saved), pass { id_token: googleUser.idToken } explicitly.
  return {
    getUserByEmail: (emailOrData) => {
      // Protected: POST with id_token in body
      if (typeof emailOrData === "string") return request("getUserByEmail", { email: emailOrData }, "POST");
      return request("getUserByEmail", emailOrData || {}, "POST");
    },
    registerAlumni: (data) => request("registerAlumni", data, "POST"),
    getApprovedAlumni: (filters = {}) => request("getApprovedAlumni", filters, "POST"),
    getAlumniProfile: (emailOrData) => {
      // Protected: POST
      if (typeof emailOrData === "string") return request("getAlumniProfile", { email: emailOrData }, "POST");
      if (emailOrData && typeof emailOrData === "object") return request("getAlumniProfile", emailOrData, "POST");
      return request("getAlumniProfile", {}, "POST");
    },
    updateAlumniProfile: (email, data) => request("updateAlumniProfile", { email, data: JSON.stringify(data) }, "POST"),
    // Public: GET (no auth required)
    getEvents: () => request("getEvents", {}),
    getAnnouncements: () => request("getAnnouncements", {}),
    submitContact: (data) => request("submitContact", data, "POST"),
    // Admin - admin identity is derived from verified token, no client email needed; param kept for backward compat but ignored server-side
    getDashboardStats: (adminEmail) => request("getDashboardStats", typeof adminEmail === "string" ? { adminEmail } : (adminEmail || {}), "POST"),
    getPendingRegistrations: (adminEmail) => request("getPendingRegistrations", typeof adminEmail === "string" ? { adminEmail } : (adminEmail || {}), "POST"),
    approveAlumni: (adminEmail, id) => {
      if (typeof adminEmail === "object" && id === undefined) return request("approveAlumni", adminEmail, "POST");
      return request("approveAlumni", { adminEmail, id }, "POST");
    },
    rejectAlumni: (adminEmail, id) => {
      if (typeof adminEmail === "object" && id === undefined) return request("rejectAlumni", adminEmail, "POST");
      return request("rejectAlumni", { adminEmail, id }, "POST");
    },
    suspendAlumni: (adminEmail, id) => {
      if (typeof adminEmail === "object" && id === undefined) return request("suspendAlumni", adminEmail, "POST");
      return request("suspendAlumni", { adminEmail, id }, "POST");
    },
    reactivateAlumni: (adminEmail, id) => {
      if (typeof adminEmail === "object" && id === undefined) return request("reactivateAlumni", adminEmail, "POST");
      return request("reactivateAlumni", { adminEmail, id }, "POST");
    },
    isAdmin: (emailOrData) => {
      // Protected: POST
      if (typeof emailOrData === "string") return request("isAdmin", { email: emailOrData }, "POST");
      return request("isAdmin", emailOrData || {}, "POST");
    },
    createEvent: (adminEmail, data) => {
      if (typeof adminEmail === "object" && data === undefined) return request("createEvent", adminEmail, "POST");
      return request("createEvent", { adminEmail, data: JSON.stringify(data) }, "POST");
    },
    updateEvent: (adminEmail, id, data) => {
      // Protected: POST
      if (typeof adminEmail === "object" && id === undefined) return request("updateEvent", adminEmail, "POST");
      if (data === undefined && typeof id === "object") return request("updateEvent", { id: adminEmail, data: JSON.stringify(id) }, "POST");
      return request("updateEvent", { adminEmail, id, data: JSON.stringify(data) }, "POST");
    },
    deleteEvent: (adminEmail, id) => {
      if (typeof adminEmail === "object" && id === undefined) return request("deleteEvent", adminEmail, "POST");
      return request("deleteEvent", { adminEmail, id }, "POST");
    },
    createAnnouncement: (adminEmail, data) => {
      if (typeof adminEmail === "object" && data === undefined) return request("createAnnouncement", adminEmail, "POST");
      return request("createAnnouncement", { adminEmail, data: JSON.stringify(data) }, "POST");
    },
    updateAnnouncement: (adminEmail, id, data) => {
      // Protected: POST
      if (typeof adminEmail === "object" && id === undefined) return request("updateAnnouncement", adminEmail, "POST");
      if (data === undefined && typeof id === "object") return request("updateAnnouncement", { id: adminEmail, data: JSON.stringify(id) }, "POST");
      return request("updateAnnouncement", { adminEmail, id, data: JSON.stringify(data) }, "POST");
    },
    deleteAnnouncement: (adminEmail, id) => {
      if (typeof adminEmail === "object" && id === undefined) return request("deleteAnnouncement", adminEmail, "POST");
      return request("deleteAnnouncement", { adminEmail, id }, "POST");
    },
    // Demo seed for mock
    _seedDemoData: seedDemoData
  };

  // ---- Mock fallback for UI preview when backend not configured ----
  const MOCK_ALUMNI = [
    { id: "FEC-ALU-00001", fullName: "Rahman Ahmed", batch: "2015", department: "Computer Science and Engineering", graduationYear: "2019", profession: "Software Engineer", organization: "Grameenphone", city: "Dhaka", linkedIn: "https://linkedin.com/in/example", profilePhoto: "", status: "Approved", bio: "Passionate about building impactful software." },
    { id: "FEC-ALU-00002", fullName: "Fatima Khan", batch: "2014", department: "Civil Engineering", graduationYear: "2018", profession: "Site Engineer", organization: "Bangladesh Water Development Board", city: "Faridpur", linkedIn: "", profilePhoto: "", status: "Approved", bio: "Infrastructure enthusiast." },
    { id: "FEC-ALU-00003", fullName: "Sajid Hossain", batch: "2016", department: "Electrical and Electronic Engineering", graduationYear: "2020", profession: "Electrical Engineer", organization: "DESCO", city: "Dhaka", linkedIn: "", profilePhoto: "", status: "Approved", bio: "" },
    { id: "FEC-ALU-00004", fullName: "Nusrat Jahan", batch: "2017", department: "Computer Science and Engineering", graduationYear: "2021", profession: "Data Analyst", organization: "BRAC", city: "Dhaka", linkedIn: "", profilePhoto: "", status: "Approved", bio: "" },
    { id: "FEC-ALU-00005", fullName: "Tanvir Alam", batch: "2013", department: "Mechanical Engineering", graduationYear: "2017", profession: "Mechanical Engineer", organization: "Walton", city: "Gazipur", linkedIn: "", profilePhoto: "", status: "Approved", bio: "" },
    { id: "FEC-ALU-00006", fullName: "Aisha Sultana", batch: "2018", department: "Computer Science and Engineering", graduationYear: "2022", profession: "UI/UX Designer", organization: "Brain Station 23", city: "Dhaka", linkedIn: "", profilePhoto: "", status: "Approved", bio: "" }
  ];
  const MOCK_EVENTS = [
    { id: "EVT-001", title: "Annual Alumni Reunion 2026", date: "2026-09-20", time: "10:00 AM", location: "FEC Campus, Faridpur", description: "Join us for the grand annual reunion of FEC alumni. Reconnect, reminisce, and rebuild networks.", status: "Upcoming", image: "" },
    { id: "EVT-002", title: "Career Guidance Workshop", date: "2026-08-30", time: "02:00 PM", location: "Online (Zoom)", description: "Senior alumni share career insights for recent graduates.", status: "Upcoming", image: "" },
    { id: "EVT-003", title: "FEC Alumni Cricket Tournament", date: "2026-07-12", time: "09:00 AM", location: "FEC Playground", description: "Inter-batch cricket championship.", status: "Past", image: "" }
  ];
  const MOCK_ANNOUNCEMENTS = [
    { id: "ANN-001", title: "Alumni Registration Now Open", content: "The FEC Alumni Association invites all graduates to register and become part of the official alumni network. Complete your profile to access the directory and events.", date: "2026-08-10", author: "Alumni Office" },
    { id: "ANN-002", title: "Scholarship Support Initiative", content: "The association is launching a scholarship support program for meritorious current students. Alumni contributions are welcome.", date: "2026-08-01", author: "Alumni Office" }
  ];

  function handleMock(action) {
    console.warn("[Api] Backend not configured — serving mock data for action:", action);
    switch (action) {
      case "getApprovedAlumni": return Promise.resolve({ success: true, data: MOCK_ALUMNI });
      case "getEvents": return Promise.resolve({ success: true, data: MOCK_EVENTS });
      case "getAnnouncements": return Promise.resolve({ success: true, data: MOCK_ANNOUNCEMENTS });
      case "getDashboardStats": return Promise.resolve({ success: true, data: { total: 6, pending: 2, approved: 6, rejected: 1, suspended: 0 } });
      case "getPendingRegistrations": return Promise.resolve({ success: true, data: [] });
      case "isAdmin": return Promise.resolve({ success: true, data: { isAdmin: false } });
      default: return Promise.resolve({ success: true, data: null, mock: true, message: "Mock: backend not configured. Configure CONFIG.API_URL." });
    }
  }
  function seedDemoData() { return { alumni: MOCK_ALUMNI, events: MOCK_EVENTS, announcements: MOCK_ANNOUNCEMENTS }; }
})();
