/**
 * FEC Alumni Association - Google Apps Script Backend
 *
 * Setup:
 * 1. Create a new Google Spreadsheet with sheets: Alumni, Admins, Events, Announcements, Contact_Messages, Settings
 * 2. Copy this file into the Apps Script editor (Extensions > Apps Script)
 * 3. Set SPREADSHEET_ID below to your spreadsheet ID
 * 4. Deploy as Web App: Execute as "Me", Who has access: "Anyone"
 * 5. Copy the Web App URL into js/config.js as CONFIG.API_URL
 * 6. Add at least one admin email to the Admins sheet:
 *    Email | Name | Role | Status   ->  your.email@gmail.com | Your Name | SuperAdmin | Active
 */

// ============ CONFIGURATION ============
const SPREADSHEET_ID = "1f66phpCYj2l62SHsc6jAAcCW4_kyDjlW3ISQxSDct2A";
const ALLOWED_STATUSES = ["Pending", "Approved", "Rejected", "Suspended"];

// Sheet names
const SHEETS = {
  ALUMNI: "Alumni",
  ADMINS: "Admins",
  EVENTS: "Events",
  ANNOUNCEMENTS: "Announcements",
  CONTACT: "Contact_Messages",
  SETTINGS: "Settings"
};

// Column maps (1-indexed) for Alumni sheet
// A:ID B:FullName C:Email D:Batch E:Department F:GraduationYear G:StudentID H:Phone I:Profession J:Organization K:City L:LinkedIn M:Website N:ProfilePhoto O:Bio P:Status Q:Role R:CreatedAt S:UpdatedAt
const ALUMNI_COLS = { ID:1, FULLNAME:2, EMAIL:3, BATCH:4, DEPARTMENT:5, GRADUATION_YEAR:6, STUDENT_ID:7, PHONE:8, PROFESSION:9, ORGANIZATION:10, CITY:11, LINKEDIN:12, WEBSITE:13, PROFILE_PHOTO:14, BIO:15, STATUS:16, ROLE:17, CREATED_AT:18, UPDATED_AT:19 };

// ============ ENTRY POINTS ============

function doGet(e) {
  try {
    const action = (e.parameter.action || "").trim();
    const handlers = {
      getUserByEmail: handleGetUserByEmail,
      getApprovedAlumni: handleGetApprovedAlumni,
      getAlumniProfile: handleGetAlumniProfile,
      getEvents: handleGetEvents,
      getAnnouncements: handleGetAnnouncements,
      getPendingRegistrations: handleGetPendingRegistrations,
      getDashboardStats: handleGetDashboardStats,
      isAdmin: handleIsAdmin
    };
    if (handlers[action]) return handlers[action](e.parameter);
    return jsonResponse(false, "Unknown action: " + action, null, 400);
  } catch (err) {
    return jsonResponse(false, "Server error: " + err.message, null, 500);
  }
}

function doPost(e) {
  try {
    let data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    const action = (data.action || "").trim();
    const handlers = {
      registerAlumni: handleRegisterAlumni,
      updateAlumniProfile: handleUpdateAlumniProfile,
      approveAlumni: handleApproveAlumni,
      rejectAlumni: handleRejectAlumni,
      suspendAlumni: handleSuspendAlumni,
      reactivateAlumni: handleReactivateAlumni,
      createEvent: handleCreateEvent,
      deleteEvent: handleDeleteEvent,
      createAnnouncement: handleCreateAnnouncement,
      deleteAnnouncement: handleDeleteAnnouncement,
      submitContact: handleSubmitContact
    };
    if (handlers[action]) return handlers[action](data);
    return jsonResponse(false, "Unknown action: " + action, null, 400);
  } catch (err) {
    return jsonResponse(false, "Server error: " + err.message, null, 500);
  }
}

// ============ HELPERS ============

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheetHeaders(sheet, name);
  }
  return sheet;
}

function initSheetHeaders(sheet, name) {
  const headers = {
    Alumni: ["ID","FullName","Email","Batch","Department","GraduationYear","StudentID","Phone","Profession","Organization","City","LinkedIn","Website","ProfilePhoto","Bio","Status","Role","CreatedAt","UpdatedAt"],
    Admins: ["Email","Name","Role","Status"],
    Events: ["ID","Title","Date","Time","Location","Description","Image","RegistrationUrl","Status","CreatedAt"],
    Announcements: ["ID","Title","Content","Date","Author","Image","Status","CreatedAt"],
    Contact_Messages: ["ID","Name","Email","Subject","Message","CreatedAt","Status"],
    Settings: ["Key","Value"]
  };
  const h = headers[name];
  if (h) sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold").setBackground("#1a3a5c").setFontColor("#ffffff");
}

function jsonResponse(success, message, data, code) {
  const payload = JSON.stringify({ success: success, message: message || "", data: data || null });
  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}

function sanitize(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url) {
  if (!url) return true; // optional fields
  return /^https?:\/\/.+/.test(url);
}

function generateId(prefix) {
  const n = Utilities.getUuid().slice(0, 8).toUpperCase();
  if (prefix === "ALU") return "FEC-ALU-" + n;
  if (prefix === "EVT") return "EVT-" + n;
  if (prefix === "ANN") return "ANN-" + n;
  if (prefix === "MSG") return "MSG-" + n;
  return prefix + "-" + n;
}

function rowToAlumni(row) {
  // Row is array from getValues(), 0-indexed; row[0]=ID etc.
  return {
    id: row[0] || "",
    fullName: row[1] || "",
    email: row[2] || "",
    batch: String(row[3] || ""),
    department: row[4] || "",
    graduationYear: String(row[5] || ""),
    studentId: row[6] || "",
    phone: row[7] || "",
    profession: row[8] || "",
    organization: row[9] || "",
    city: row[10] || "",
    linkedIn: row[11] || "",
    website: row[12] || "",
    profilePhoto: row[13] || "",
    bio: row[14] || "",
    status: row[15] || "Pending",
    role: row[16] || "Alumni",
    createdAt: row[17] || "",
    updatedAt: row[18] || ""
  };
}

function publicAlumniFields(a) {
  // Only expose safe fields for directory
  return {
    id: a.id,
    fullName: a.fullName,
    batch: a.batch,
    department: a.department,
    graduationYear: a.graduationYear,
    profession: a.profession,
    organization: a.organization,
    city: a.city,
    linkedIn: a.linkedIn,
    profilePhoto: a.profilePhoto,
    bio: a.bio
  };
}

function checkIsAdmin(email) {
  if (!email || !isValidEmail(email)) return false;
  const sheet = getSheet(SHEETS.ADMINS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase().trim() === email.toLowerCase().trim() && String(values[i][3]).toLowerCase().trim() === "active") {
      return true;
    }
  }
  return false;
}

function findAlumniRowByEmail(email) {
  const sheet = getSheet(SHEETS.ALUMNI);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][ALUMNI_COLS.EMAIL - 1]).toLowerCase().trim() === email.toLowerCase().trim()) {
      return { index: i + 1, row: values[i] }; // 1-indexed row number
    }
  }
  return null;
}

function findAlumniRowById(id) {
  const sheet = getSheet(SHEETS.ALUMNI);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][ALUMNI_COLS.ID - 1]).trim() === String(id).trim()) {
      return { index: i + 1, row: values[i] };
    }
  }
  return null;
}

// ============ HANDLERS: GET ============

function handleGetUserByEmail(params) {
  const email = sanitize(params.email);
  if (!email || !isValidEmail(email)) return jsonResponse(false, "Valid email is required.", null);
  const found = findAlumniRowByEmail(email);
  if (!found) return jsonResponse(true, "Not found", null);
  const a = rowToAlumni(found.row);
  return jsonResponse(true, "Found", a);
}

function handleGetApprovedAlumni(params) {
  const sheet = getSheet(SHEETS.ALUMNI);
  const values = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < values.length; i++) {
    const a = rowToAlumni(values[i]);
    if (a.status === "Approved") result.push(publicAlumniFields(a));
  }
  return jsonResponse(true, "OK", result);
}

function handleGetAlumniProfile(params) {
  const email = sanitize(params.email);
  if (!email || !isValidEmail(email)) return jsonResponse(false, "Valid email is required.", null);
  const found = findAlumniRowByEmail(email);
  if (!found) return jsonResponse(false, "Profile not found.", null);
  const a = rowToAlumni(found.row);
  return jsonResponse(true, "OK", a);
}

function handleGetEvents(/* params */) {
  const sheet = getSheet(SHEETS.EVENTS);
  const values = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0]) continue;
    result.push({ id: r[0], title: r[1], date: r[2], time: r[3], location: r[4], description: r[5], image: r[6], registrationUrl: r[7], status: r[8] || "Upcoming", createdAt: r[9] || "" });
  }
  // Sort upcoming first, then by date desc
  result.sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); });
  return jsonResponse(true, "OK", result);
}

function handleGetAnnouncements(/* params */) {
  const sheet = getSheet(SHEETS.ANNOUNCEMENTS);
  const values = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0]) continue;
    result.push({ id: r[0], title: r[1], content: r[2], date: r[3], author: r[4], image: r[5], status: r[6] || "Published", createdAt: r[7] || "" });
  }
  result.sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); });
  return jsonResponse(true, "OK", result);
}

function handleGetPendingRegistrations(params) {
  const adminEmail = sanitize(params.adminEmail);
  if (!checkIsAdmin(adminEmail)) return jsonResponse(false, "Unauthorized. Admin privileges required.", null, 403);
  const sheet = getSheet(SHEETS.ALUMNI);
  const values = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < values.length; i++) {
    const a = rowToAlumni(values[i]);
    if (a.status === "Pending") result.push(a);
  }
  return jsonResponse(true, "OK", result);
}

function handleGetDashboardStats(params) {
  const adminEmail = sanitize(params.adminEmail);
  if (!checkIsAdmin(adminEmail)) return jsonResponse(false, "Unauthorized.", null, 403);
  const sheet = getSheet(SHEETS.ALUMNI);
  const values = sheet.getDataRange().getValues();
  let total = 0, pending = 0, approved = 0, rejected = 0, suspended = 0;
  for (let i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    total++;
    const s = String(values[i][ALUMNI_COLS.STATUS - 1]).trim();
    if (s === "Pending") pending++;
    else if (s === "Approved") approved++;
    else if (s === "Rejected") rejected++;
    else if (s === "Suspended") suspended++;
  }
  return jsonResponse(true, "OK", { total: total, pending: pending, approved: approved, rejected: rejected, suspended: suspended });
}

function handleIsAdmin(params) {
  const email = sanitize(params.email);
  const isAdmin = checkIsAdmin(email);
  return jsonResponse(true, "OK", { isAdmin: isAdmin });
}

// ============ HANDLERS: POST ============

function handleRegisterAlumni(data) {
  const email = sanitize(data.email);
  const fullName = sanitize(data.fullName);
  const batch = sanitize(data.batch);
  const department = sanitize(data.department);
  const graduationYear = sanitize(data.graduationYear);
  const phone = sanitize(data.phone);
  const profession = sanitize(data.profession);
  const organization = sanitize(data.organization);
  const city = sanitize(data.city);

  // Required validation
  if (!email || !isValidEmail(email)) return jsonResponse(false, "Valid email is required.", null);
  if (!fullName || fullName.length < 3) return jsonResponse(false, "Full name is required.", null);
  if (!batch || !/^\d{4}$/.test(batch)) return jsonResponse(false, "Valid batch is required.", null);
  if (!department) return jsonResponse(false, "Department is required.", null);
  if (!graduationYear || !/^\d{4}$/.test(graduationYear)) return jsonResponse(false, "Valid graduation year is required.", null);
  if (!phone || !/^\+?[0-9\s\-()]{8,20}$/.test(phone)) return jsonResponse(false, "Valid phone number is required.", null);
  if (!profession) return jsonResponse(false, "Profession is required.", null);
  if (!organization) return jsonResponse(false, "Organization is required.", null);
  if (!city) return jsonResponse(false, "City is required.", null);

  // Optional URL validation
  if (data.linkedIn && sanitize(data.linkedIn) && !isValidUrl(sanitize(data.linkedIn))) return jsonResponse(false, "LinkedIn must be a valid URL.", null);
  if (data.website && sanitize(data.website) && !isValidUrl(sanitize(data.website))) return jsonResponse(false, "Website must be a valid URL.", null);
  if (data.profilePhoto && sanitize(data.profilePhoto) && !isValidUrl(sanitize(data.profilePhoto))) return jsonResponse(false, "Profile photo must be a valid URL.", null);

  // Duplicate check
  if (findAlumniRowByEmail(email)) return jsonResponse(false, "This email is already registered.", null);

  const sheet = getSheet(SHEETS.ALUMNI);
  const id = generateId("ALU");
  const now = new Date().toISOString();
  const row = [
    id,
    fullName,
    email,
    batch,
    department,
    graduationYear,
    sanitize(data.studentId),
    phone,
    profession,
    organization,
    city,
    sanitize(data.linkedIn),
    sanitize(data.website),
    sanitize(data.profilePhoto),
    sanitize(data.bio),
    "Pending",
    "Alumni",
    now,
    now
  ];
  sheet.appendRow(row);
  return jsonResponse(true, "Registration submitted successfully. Awaiting administrator approval.", { id: id, status: "Pending" });
}

function handleUpdateAlumniProfile(data) {
  const email = sanitize(data.email);
  let updates = {};
  try { updates = typeof data.data === "string" ? JSON.parse(data.data) : (data.data || {}); } catch (e) { return jsonResponse(false, "Invalid data format.", null); }

  if (!email || !isValidEmail(email)) return jsonResponse(false, "Valid email is required.", null);

  const found = findAlumniRowByEmail(email);
  if (!found) return jsonResponse(false, "Profile not found.", null);

  // Validate URLs if provided
  if (updates.linkedIn && !isValidUrl(sanitize(updates.linkedIn))) return jsonResponse(false, "LinkedIn must be a valid URL.", null);
  if (updates.website && !isValidUrl(sanitize(updates.website))) return jsonResponse(false, "Website must be a valid URL.", null);
  if (updates.profilePhoto && !isValidUrl(sanitize(updates.profilePhoto))) return jsonResponse(false, "Profile photo must be a valid URL.", null);

  const sheet = getSheet(SHEETS.ALUMNI);
  const rowIdx = found.index;
  const now = new Date().toISOString();

  // Map updates to columns - only allow safe fields
  const allowed = {
    fullName: ALUMNI_COLS.FULLNAME,
    batch: ALUMNI_COLS.BATCH,
    department: ALUMNI_COLS.DEPARTMENT,
    graduationYear: ALUMNI_COLS.GRADUATION_YEAR,
    studentId: ALUMNI_COLS.STUDENT_ID,
    phone: ALUMNI_COLS.PHONE,
    profession: ALUMNI_COLS.PROFESSION,
    organization: ALUMNI_COLS.ORGANIZATION,
    city: ALUMNI_COLS.CITY,
    linkedIn: ALUMNI_COLS.LINKEDIN,
    website: ALUMNI_COLS.WEBSITE,
    profilePhoto: ALUMNI_COLS.PROFILE_PHOTO,
    bio: ALUMNI_COLS.BIO
  };
  const values = sheet.getRange(rowIdx, 1, 1, ALUMNI_COLS.UPDATED_AT).getValues()[0];
  Object.keys(allowed).forEach(function(key) {
    if (updates[key] !== undefined) values[allowed[key] - 1] = sanitize(updates[key]);
  });
  values[ALUMNI_COLS.UPDATED_AT - 1] = now;
  sheet.getRange(rowIdx, 1, 1, values.length).setValues([values]);

  return jsonResponse(true, "Profile updated successfully.", null);
}

function handleApproveAlumni(data) {
  return updateAlumniStatus(data, "Approved");
}
function handleRejectAlumni(data) {
  return updateAlumniStatus(data, "Rejected");
}
function handleSuspendAlumni(data) {
  return updateAlumniStatus(data, "Suspended");
}
function handleReactivateAlumni(data) {
  return updateAlumniStatus(data, "Approved");
}

function updateAlumniStatus(data, newStatus) {
  const adminEmail = sanitize(data.adminEmail);
  const id = sanitize(data.id);
  if (!checkIsAdmin(adminEmail)) return jsonResponse(false, "Unauthorized. Admin privileges required.", null, 403);
  if (!id) return jsonResponse(false, "Member ID is required.", null);
  const found = findAlumniRowById(id);
  if (!found) return jsonResponse(false, "Member not found.", null);
  const sheet = getSheet(SHEETS.ALUMNI);
  sheet.getRange(found.index, ALUMNI_COLS.STATUS).setValue(newStatus);
  sheet.getRange(found.index, ALUMNI_COLS.UPDATED_AT).setValue(new Date().toISOString());
  return jsonResponse(true, "Status updated to " + newStatus + ".", null);
}

function handleCreateEvent(data) {
  const adminEmail = sanitize(data.adminEmail);
  if (!checkIsAdmin(adminEmail)) return jsonResponse(false, "Unauthorized.", null, 403);
  let payload = {};
  try { payload = typeof data.data === "string" ? JSON.parse(data.data) : (data.data || {}); } catch (e) { return jsonResponse(false, "Invalid data.", null); }
  if (!sanitize(payload.title)) return jsonResponse(false, "Event title is required.", null);
  if (!sanitize(payload.date)) return jsonResponse(false, "Event date is required.", null);
  const sheet = getSheet(SHEETS.EVENTS);
  const id = generateId("EVT");
  const now = new Date().toISOString();
  sheet.appendRow([id, sanitize(payload.title), sanitize(payload.date), sanitize(payload.time), sanitize(payload.location), sanitize(payload.description), sanitize(payload.image), sanitize(payload.registrationUrl), sanitize(payload.status) || "Upcoming", now]);
  return jsonResponse(true, "Event created.", { id: id });
}

function handleDeleteEvent(data) {
  const adminEmail = sanitize(data.adminEmail);
  if (!checkIsAdmin(adminEmail)) return jsonResponse(false, "Unauthorized.", null, 403);
  const id = sanitize(data.id);
  const sheet = getSheet(SHEETS.EVENTS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === id) { sheet.deleteRow(i + 1); return jsonResponse(true, "Event deleted.", null); }
  }
  return jsonResponse(false, "Event not found.", null);
}

function handleCreateAnnouncement(data) {
  const adminEmail = sanitize(data.adminEmail);
  if (!checkIsAdmin(adminEmail)) return jsonResponse(false, "Unauthorized.", null, 403);
  let payload = {};
  try { payload = typeof data.data === "string" ? JSON.parse(data.data) : (data.data || {}); } catch (e) { return jsonResponse(false, "Invalid data.", null); }
  if (!sanitize(payload.title)) return jsonResponse(false, "Title is required.", null);
  if (!sanitize(payload.content)) return jsonResponse(false, "Content is required.", null);
  const sheet = getSheet(SHEETS.ANNOUNCEMENTS);
  const id = generateId("ANN");
  const now = new Date().toISOString();
  sheet.appendRow([id, sanitize(payload.title), sanitize(payload.content), sanitize(payload.date) || now.slice(0,10), sanitize(payload.author) || "Alumni Office", sanitize(payload.image), "Published", now]);
  return jsonResponse(true, "Announcement created.", { id: id });
}

function handleDeleteAnnouncement(data) {
  const adminEmail = sanitize(data.adminEmail);
  if (!checkIsAdmin(adminEmail)) return jsonResponse(false, "Unauthorized.", null, 403);
  const id = sanitize(data.id);
  const sheet = getSheet(SHEETS.ANNOUNCEMENTS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === id) { sheet.deleteRow(i + 1); return jsonResponse(true, "Announcement deleted.", null); }
  }
  return jsonResponse(false, "Announcement not found.", null);
}

function handleSubmitContact(data) {
  const name = sanitize(data.name);
  const email = sanitize(data.email);
  const subject = sanitize(data.subject);
  const message = sanitize(data.message);
  if (!name || name.length < 2) return jsonResponse(false, "Name is required.", null);
  if (!email || !isValidEmail(email)) return jsonResponse(false, "Valid email is required.", null);
  if (!subject || subject.length < 3) return jsonResponse(false, "Subject is required.", null);
  if (!message || message.length < 10) return jsonResponse(false, "Message must be at least 10 characters.", null);
  const sheet = getSheet(SHEETS.CONTACT);
  const id = generateId("MSG");
  const now = new Date().toISOString();
  sheet.appendRow([id, name, email, subject, message, now, "New"]);
  return jsonResponse(true, "Message received. We will get back to you soon.", null);
}
