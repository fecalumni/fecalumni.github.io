/**
 * FEC Alumni - API Client
 * Communicates with Google Apps Script Web App.
 * Falls back to local mock when API_URL is not configured (for UI preview).
 */
const Api = (() => {
  function buildUrl(params) {
    const url = new URL(CONFIG.API_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    return url.toString();
  }

  async function request(action, data = {}, method = "GET") {
    if (!isBackendConfigured()) {
      return handleMock(action, data);
    }
    try {
      if (method === "GET") {
        const url = buildUrl({ action, ...data });
        const res = await fetch(url, { method: "GET" });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || "Request failed");
        return json;
      } else {
        // POST via text/plain to avoid CORS preflight on Apps Script
        const res = await fetch(CONFIG.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action, ...data })
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

  // Public API
  return {
    getUserByEmail: (email) => request("getUserByEmail", { email }),
    registerAlumni: (data) => request("registerAlumni", data, "POST"),
    getApprovedAlumni: (filters = {}) => request("getApprovedAlumni", filters),
    getAlumniProfile: (email) => request("getAlumniProfile", { email }),
    updateAlumniProfile: (email, data) => request("updateAlumniProfile", { email, data: JSON.stringify(data) }, "POST"),
    getEvents: () => request("getEvents", {}),
    getAnnouncements: () => request("getAnnouncements", {}),
    submitContact: (data) => request("submitContact", data, "POST"),
    // Admin
    getDashboardStats: (adminEmail) => request("getDashboardStats", { adminEmail }),
    getPendingRegistrations: (adminEmail) => request("getPendingRegistrations", { adminEmail }),
    approveAlumni: (adminEmail, id) => request("approveAlumni", { adminEmail, id }, "POST"),
    rejectAlumni: (adminEmail, id) => request("rejectAlumni", { adminEmail, id }, "POST"),
    suspendAlumni: (adminEmail, id) => request("suspendAlumni", { adminEmail, id }, "POST"),
    reactivateAlumni: (adminEmail, id) => request("reactivateAlumni", { adminEmail, id }, "POST"),
    isAdmin: (email) => request("isAdmin", { email }),
    createEvent: (adminEmail, data) => request("createEvent", { adminEmail, data: JSON.stringify(data) }, "POST"),
    deleteEvent: (adminEmail, id) => request("deleteEvent", { adminEmail, id }, "POST"),
    createAnnouncement: (adminEmail, data) => request("createAnnouncement", { adminEmail, data: JSON.stringify(data) }, "POST"),
    deleteAnnouncement: (adminEmail, id) => request("deleteAnnouncement", { adminEmail, id }, "POST"),
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
