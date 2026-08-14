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
const GOOGLE_CLIENT_ID = "668916176652-hbb2eop8nr8g64ksh3jddbfakj1mf04m.apps.googleusercontent.com";
const ALLOWED_STATUSES = ["Pending", "Approved", "Rejected", "Suspended"];
const ALLOWED_DEPARTMENTS = ["Civil Engineering", "Electrical and Electronic Engineering", "Computer Science and Engineering"];
const DEPARTMENT_CODES = { "Civil Engineering": "CE", "Electrical and Electronic Engineering": "EEE", "Computer Science and Engineering": "CSE" };
const ALLOWED_BATCHES = ["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20"];

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
// A:ID B:FullName C:Email D:Batch E:Department F:GraduationYear G:StudentID H:Phone I:Profession J:Organization K:City L:LinkedIn M:Website N:ProfilePhoto O:Bio P:Status Q:Role R:CreatedAt S:UpdatedAt T:GoogleSub
const ALUMNI_COLS = { ID:1, FULLNAME:2, EMAIL:3, BATCH:4, DEPARTMENT:5, GRADUATION_YEAR:6, STUDENT_ID:7, PHONE:8, PROFESSION:9, ORGANIZATION:10, CITY:11, LINKEDIN:12, WEBSITE:13, PROFILE_PHOTO:14, BIO:15, STATUS:16, ROLE:17, CREATED_AT:18, UPDATED_AT:19, GOOGLE_SUB:20 };

// ============ ENTRY POINTS ============

function doGet(e) {
  try {
    const action = (e.parameter.action || "").trim();
    // Public operations only Ã¢â‚¬â€ no id_token in URL. Protected operations must use POST with id_token in body.
    const handlers = {
      getEvents: handleGetEvents,
      getAnnouncements: handleGetAnnouncements
    };
    if (handlers[action]) return handlers[action](e.parameter);
    // Protected actions called via GET are rejected Ã¢â‚¬â€ use POST
    const protectedActions = ["getUserByEmail","getApprovedAlumni","getAlumniProfile","getPendingRegistrations","getDashboardStats","isAdmin","approveAlumni","rejectAlumni","suspendAlumni","reactivateAlumni","createEvent","updateEvent","deleteEvent","createAnnouncement","updateAnnouncement","deleteAnnouncement","registerAlumni","updateAlumniProfile"];
    if (protectedActions.indexOf(action) !== -1) {
      return jsonResponse(false, "Use POST for authenticated requests. Token must not be in URL.", null, 405);
    }
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
      // Protected: id_token must be in POST body and is verified server-side
      getUserByEmail: handleGetUserByEmail,
      getApprovedAlumni: handleGetApprovedAlumni,
      getAlumniProfile: handleGetAlumniProfile,
      getPendingRegistrations: handleGetPendingRegistrations,
      getDashboardStats: handleGetDashboardStats,
      isAdmin: handleIsAdmin,
      registerAlumni: handleRegisterAlumni,
      updateAlumniProfile: handleUpdateAlumniProfile,
      approveAlumni: handleApproveAlumni,
      rejectAlumni: handleRejectAlumni,
      suspendAlumni: handleSuspendAlumni,
      reactivateAlumni: handleReactivateAlumni,
      createEvent: handleCreateEvent,
      updateEvent: handleUpdateEvent,
      deleteEvent: handleDeleteEvent,
      createAnnouncement: handleCreateAnnouncement,
      updateAnnouncement: handleUpdateAnnouncement,
      deleteAnnouncement: handleDeleteAnnouncement,
      submitContact: handleSubmitContact,
      // Public also allowed via POST for flexibility
      getEvents: handleGetEvents,
      getAnnouncements: handleGetAnnouncements
    };
    if (handlers[action]) return handlers[action](data);
    return jsonResponse(false, "Unknown action: " + action, null, 400);
  } catch (err) {
    return jsonResponse(false, "Server error: " + err.message, null, 500);
  }
}

// ============ ID TOKEN VERIFICATION (Google-recommended) ============

/**
 * Verifies a Google ID token using Google's tokeninfo endpoint.
 * Checks signature (via Google), iss, aud, exp, email_verified.
 * Uses short-lived CacheService keyed by SHA-256 hash of token, TTL bound to exp.
 * Returns verified payload (sub, email, etc.) or throws.
 */
function verifyIdToken(idToken) {
  if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
    throw new Error("Missing ID token. Please sign in again.");
  }
  var token = idToken.trim();
  // Basic JWT structure check
  if (token.split(".").length !== 3) throw new Error("Invalid ID token format.");

  // Try CacheService (hash key, never raw token)
  var cache = null;
  var cacheKey = null;
  try {
    cache = CacheService.getScriptCache();
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8);
    var hashB64 = Utilities.base64Encode(digest);
    // Safe key: prefix + URL-safe base64 without padding, truncated
    cacheKey = "tok_v1_" + hashB64.replace(/[^A-Za-z0-9]/g, "").substring(0, 44);
  } catch (e) { cache = null; cacheKey = null; }

  if (cache && cacheKey) {
    try {
      var cached = cache.get(cacheKey);
      if (cached) {
        var cachedPayload = JSON.parse(cached);
        var nowSec = Math.floor(new Date().getTime() / 1000);
        var expSec = parseInt(cachedPayload.exp, 10);
        // Re-validate critical claims on cache hit and ensure not beyond exp
        if (cachedPayload && expSec && expSec > nowSec &&
            cachedPayload.aud === GOOGLE_CLIENT_ID &&
            (cachedPayload.iss === "accounts.google.com" || cachedPayload.iss === "https://accounts.google.com") &&
            (cachedPayload.email_verified === "true" || cachedPayload.email_verified === true) &&
            cachedPayload.email && cachedPayload.sub) {
          return cachedPayload;
        } else {
          try { cache.remove(cacheKey); } catch (e2) {}
        }
      }
    } catch (e) { /* cache miss or parse error */ }
  }

  var url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token);
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  var code = resp.getResponseCode();
  var body = resp.getContentText();
  if (code !== 200) {
    throw new Error("Token verification failed (HTTP " + code + "). Please sign in again.");
  }
  var payload;
  try { payload = JSON.parse(body); } catch (err) { throw new Error("Invalid token response."); }
  if (payload.error_description || payload.error) {
    throw new Error("Token verification failed: " + (payload.error_description || payload.error));
  }
  // Verify aud
  if (payload.aud !== GOOGLE_CLIENT_ID) throw new Error("Token audience mismatch.");
  // Verify iss
  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") {
    throw new Error("Token issuer mismatch.");
  }
  // Verify exp
  var now = Math.floor(new Date().getTime() / 1000);
  var exp = parseInt(payload.exp, 10);
  if (!exp || exp <= now) throw new Error("Token expired. Please sign in again.");
  // Verify email_verified
  if (payload.email_verified !== "true" && payload.email_verified !== true) {
    throw new Error("Email not verified by Google.");
  }
  if (!payload.email || !payload.sub) throw new Error("Token missing required claims.");

  // Cache validated payload until exp (never beyond exp), TTL capped at 1 hour and 6h max
  if (cache && cacheKey) {
    try {
      var ttl = exp - Math.floor(new Date().getTime() / 1000) - 5; // 5s safety margin
      if (ttl > 0) {
        if (ttl > 21600) ttl = 21600;
        // Tokens are ~1h, cap at 3600 for safety
        if (ttl > 3600) ttl = 3600;
        cache.put(cacheKey, JSON.stringify(payload), ttl);
      }
    } catch (e) { /* cache put failure is non-fatal */ }
  }

  return payload; // contains sub, email, email_verified, aud, iss, exp, name, picture etc.
}

/**
 * Extracts and verifies ID token from GET params or POST body.
 * Looks for id_token or idToken field.
 */
function getVerifiedPayload(source) {
  var token = null;
  if (source) {
    token = source.id_token || source.idToken || source.id_token_ || source.token || null;
  }
  return verifyIdToken(token);
}

function withSheetLock(fn) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(10000);
    locked = true;
    return fn();
  } catch (e) {
    if (e && e.message && e.message.indexOf("Server busy") !== -1) throw e;
    throw new Error("Server busy. Please try again.");
  } finally {
    if (locked) try { lock.releaseLock(); } catch (e2) {}
  }
}

// ============ HELPERS ============

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheetHeaders(sheet, name);
  } else if (name === SHEETS.ALUMNI) {
    ensureAlumniSheetMigration(sheet);
  }
  return sheet;
}

function initSheetHeaders(sheet, name) {
  const headers = {
    Alumni: ["ID","FullName","Email","Batch","Department","GraduationYear","StudentID","Phone","Profession","Organization","City","LinkedIn","Website","ProfilePhoto","Bio","Status","Role","CreatedAt","UpdatedAt","GoogleSub"],
    Admins: ["Email","Name","Role","Status"],
    Events: ["ID","Title","Date","Time","Location","Description","Image","RegistrationUrl","Status","CreatedAt"],
    Announcements: ["ID","Title","Content","Date","Author","Image","Status","CreatedAt"],
    Contact_Messages: ["ID","Name","Email","Subject","Message","CreatedAt","Status"],
    Settings: ["Key","Value"]
  };
  const h = headers[name];
  if (h) sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold").setBackground("#1a3a5c").setFontColor("#ffffff");
}

/**
 * Migrates existing Alumni sheet to include GoogleSub column if missing.
 * Existing rows keep their data; header row is extended.
 */
function ensureAlumniSheetMigration(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var hasGoogleSub = false;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).toLowerCase() === "googlesub") { hasGoogleSub = true; break; }
  }
  if (!hasGoogleSub) {
    // Extend header row to include GoogleSub as column T (20)
    // If lastCol < 20, pad and set
    if (lastCol < ALUMNI_COLS.GOOGLE_SUB) {
      sheet.getRange(1, ALUMNI_COLS.GOOGLE_SUB).setValue("GoogleSub").setFontWeight("bold").setBackground("#1a3a5c").setFontColor("#ffffff");
    } else {
      // Header exists but named differently - ensure correct name
      sheet.getRange(1, ALUMNI_COLS.GOOGLE_SUB).setValue("GoogleSub").setFontWeight("bold").setBackground("#1a3a5c").setFontColor("#ffffff");
    }
  }
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
function isSafeUrlForSheet(url) {
  if (!url || typeof url !== "string") return false;
  var s = url.trim();
  if (!s) return false;
  var lower = s.toLowerCase();
  if (lower.indexOf("javascript:") === 0 || lower.indexOf("data:") === 0 || lower.indexOf("vbscript:") === 0) return false;
  if (!/^https:\/\//i.test(s)) return false;
  if (/\s/.test(s)) return false;
  return true;
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
    updatedAt: row[18] || "",
    googleSub: row[19] || ""
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

function findAlumniRowBySub(sub) {
  if (!sub) return null;
  const sheet = getSheet(SHEETS.ALUMNI);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][ALUMNI_COLS.GOOGLE_SUB - 1]).trim() === String(sub).trim()) {
      return { index: i + 1, row: values[i] };
    }
  }
  return null;
}

function findAlumniRowByVerifiedPayload(payload) {
  // Prefer stable Google sub, fallback to email for migration
  var bySub = findAlumniRowBySub(payload.sub);
  if (bySub) return bySub;
  return findAlumniRowByEmail(payload.email);
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

function ensureGoogleSubStored(found, payload) {
  if (!found || !payload || !payload.sub) return;
  var currentSub = String(found.row[ALUMNI_COLS.GOOGLE_SUB - 1] || "").trim();
  if (!currentSub) {
    // Use lock for this migration write to avoid concurrent overwrite
    try {
      withSheetLock(function() {
        // Re-read to avoid stale found.row if another request already wrote
        var sheet = getSheet(SHEETS.ALUMNI);
        var fresh = sheet.getRange(found.index, ALUMNI_COLS.GOOGLE_SUB).getValue();
        if (!String(fresh || "").trim()) {
          sheet.getRange(found.index, ALUMNI_COLS.GOOGLE_SUB).setValue(payload.sub);
          sheet.getRange(found.index, ALUMNI_COLS.UPDATED_AT).setValue(new Date().toISOString());
        }
        found.row[ALUMNI_COLS.GOOGLE_SUB - 1] = payload.sub;
        return true;
      });
    } catch (e) {
      // Fallback: direct write if lock fails (best effort, same value)
      try {
        var sheet2 = getSheet(SHEETS.ALUMNI);
        sheet2.getRange(found.index, ALUMNI_COLS.GOOGLE_SUB).setValue(payload.sub);
        sheet2.getRange(found.index, ALUMNI_COLS.UPDATED_AT).setValue(new Date().toISOString());
        found.row[ALUMNI_COLS.GOOGLE_SUB - 1] = payload.sub;
      } catch (e2) {}
    }
  }
}

// ============ HANDLERS: GET ============

function handleGetUserByEmail(params) {
  var payload;
  try { payload = getVerifiedPayload(params); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  var found = findAlumniRowByVerifiedPayload(payload);
  if (!found) return jsonResponse(true, "Not found", null);
  ensureGoogleSubStored(found, payload);
  var a = rowToAlumni(found.row);
  return jsonResponse(true, "Found", a);
}

function handleGetApprovedAlumni(params) {
  var payload;
  try { payload = getVerifiedPayload(params); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  var requester = findAlumniRowByVerifiedPayload(payload);
  if (!requester) return jsonResponse(false, "No alumni record found for this account. Please register first.", null, 403);
  var requesterData = rowToAlumni(requester.row);
  if (requesterData.status !== "Approved") return jsonResponse(false, "Access denied. Your membership status is: " + requesterData.status, null, 403);
  ensureGoogleSubStored(requester, payload);
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
  var payload;
  try { payload = getVerifiedPayload(params); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  var found = findAlumniRowByVerifiedPayload(payload);
  if (!found) return jsonResponse(false, "Profile not found.", null, 404);
  ensureGoogleSubStored(found, payload);
  var a = rowToAlumni(found.row);
  return jsonResponse(true, "OK", a);
}

function handleGetEvents(params) {
  // Public - no auth required
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

function handleGetAnnouncements(params) {
  // Public - no auth required
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
  var payload;
  try { payload = getVerifiedPayload(params); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  if (!checkIsAdmin(payload.email)) return jsonResponse(false, "Unauthorized. Admin privileges required.", null, 403);
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
  var payload;
  try { payload = getVerifiedPayload(params); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  if (!checkIsAdmin(payload.email)) return jsonResponse(false, "Unauthorized.", null, 403);
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
  var payload;
  try { payload = getVerifiedPayload(params); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  var isAdmin = checkIsAdmin(payload.email);
  return jsonResponse(true, "OK", { isAdmin: isAdmin, email: payload.email, sub: payload.sub });
}

// ============ HANDLERS: POST ============

function handleRegisterAlumni(data) {
  var payload;
  try { payload = getVerifiedPayload(data); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  // Use verified identity, not client-supplied email
  const email = payload.email;
  const googleSub = payload.sub;
  const fullName = sanitize(data.fullName);
  const batch = sanitize(data.batch);
  const department = sanitize(data.department);
  const graduationYear = sanitize(data.graduationYear);
  const phone = sanitize(data.phone);
  const profession = sanitize(data.profession);
  const organization = sanitize(data.organization);
  const city = sanitize(data.city);

  // Required validation - Batch is 01-20, Department without Mechanical, GraduationYear is year, StudentID optional but must match DEPT-BATCH-XXXX
  if (!fullName || fullName.length < 3) return jsonResponse(false, "Full name is required.", null);
  if (!batch || ALLOWED_BATCHES.indexOf(batch) === -1) return jsonResponse(false, "Valid batch is required. Select batch 01-20.", null);
  if (!department || ALLOWED_DEPARTMENTS.indexOf(department) === -1) return jsonResponse(false, "Valid department is required.", null);
  if (!graduationYear || !/^\d{4}$/.test(graduationYear)) return jsonResponse(false, "Valid graduation year is required.", null);
  if (parseInt(graduationYear, 10) < 2000 || parseInt(graduationYear, 10) > 2035) return jsonResponse(false, "Enter a valid graduation year.", null);
  if (!phone || !/^\+?[0-9\s\-()]{8,20}$/.test(phone)) return jsonResponse(false, "Valid phone number is required.", null);
  if (!profession) return jsonResponse(false, "Profession is required.", null);
  if (!organization) return jsonResponse(false, "Organization is required.", null);
  if (!city) return jsonResponse(false, "City is required.", null);

  // Optional URL validation - only HTTPS
  if (data.linkedIn && sanitize(data.linkedIn)) {
    var li = sanitize(data.linkedIn);
    if (!isSafeUrlForSheet(li)) return jsonResponse(false, "LinkedIn must be a valid HTTPS URL.", null);
  }
  if (data.website && sanitize(data.website)) {
    var ws = sanitize(data.website);
    if (!isSafeUrlForSheet(ws)) return jsonResponse(false, "Website must be a valid HTTPS URL.", null);
  }
  if (data.profilePhoto && sanitize(data.profilePhoto)) {
    var pp = sanitize(data.profilePhoto);
    if (!isSafeUrlForSheet(pp)) return jsonResponse(false, "Profile photo must be a valid HTTPS URL.", null);
  }
  // Student ID validation - optional, but if provided must be DEPTCODE-BATCH-XXXX and batch must match selected batch, dept code must match department
  if (data.studentId && sanitize(data.studentId)) {
    var sid = sanitize(data.studentId);
    var deptCode = DEPARTMENT_CODES[department];
    if (!deptCode) return jsonResponse(false, "Student ID must match the selected department and batch.", null);
    var sidPattern = new RegExp("^" + deptCode + "-(0[1-9]|1[0-9]|20)-\\d{4}$");
    var expectedPrefix = deptCode + "-" + batch + "-";
    if (!sidPattern.test(sid) || sid.indexOf(expectedPrefix) !== 0) {
      return jsonResponse(false, "Student ID must match the selected department and batch.", null);
    }
  }

  // Duplicate check by verified email or sub Ã¢â‚¬â€ atomic with append
  return withSheetLock(function() {
    if (findAlumniRowByEmail(email) || findAlumniRowBySub(googleSub)) return jsonResponse(false, "This Google account is already registered.", null);
    var sheet = getSheet(SHEETS.ALUMNI);
    var id = generateId("ALU");
    var now = new Date().toISOString();
    var row = [
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
      now,
      googleSub
    ];
    sheet.appendRow(row);
    return jsonResponse(true, "Registration submitted successfully. Awaiting administrator approval.", { id: id, status: "Pending" });
  });
}

function handleUpdateAlumniProfile(data) {
  var payload;
  try { payload = getVerifiedPayload(data); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  let updates = {};
  try { updates = typeof data.data === "string" ? JSON.parse(data.data) : (data.data || {}); } catch (e) { return jsonResponse(false, "Invalid data format.", null); }

  // Validate URLs and academic fields before acquiring lock (fail fast, minimize lock time)
  if (updates.linkedIn && !isSafeUrlForSheet(sanitize(updates.linkedIn))) return jsonResponse(false, "LinkedIn must be a valid HTTPS URL.", null);
  if (updates.website && !isSafeUrlForSheet(sanitize(updates.website))) return jsonResponse(false, "Website must be a valid HTTPS URL.", null);
  if (updates.profilePhoto && !isSafeUrlForSheet(sanitize(updates.profilePhoto))) return jsonResponse(false, "Profile photo must be a valid HTTPS URL.", null);
  if (updates.batch !== undefined) {
    var b = sanitize(updates.batch);
    if (b && ALLOWED_BATCHES.indexOf(b) === -1) return jsonResponse(false, "Valid batch is required. Select batch 01-20.", null);
  }
  if (updates.department !== undefined) {
    var dpt = sanitize(updates.department);
    if (dpt && ALLOWED_DEPARTMENTS.indexOf(dpt) === -1) return jsonResponse(false, "Valid department is required.", null);
  }
  if (updates.studentId !== undefined && sanitize(updates.studentId)) {
    var sid2 = sanitize(updates.studentId);
    // Need to determine effective department/batch for validation (use updated values if provided, else existing)
    var effDept = updates.department !== undefined ? sanitize(updates.department) : null;
    var effBatch = updates.batch !== undefined ? sanitize(updates.batch) : null;
    // If not in updates, use existing row values - will be checked inside lock with fresh read; for now do basic format check
    var sidPat = /^(CE|EEE|CSE)-(0[1-9]|1[0-9]|20)-\d{4}$/;
    if (!sidPat.test(sid2)) return jsonResponse(false, "Student ID must match the selected department and batch.", null);
    // If both dept and batch are being updated, check prefix match immediately
    if (effDept && effBatch) {
      var codeTmp = DEPARTMENT_CODES[effDept];
      if (!codeTmp || sid2.indexOf(codeTmp + "-" + effBatch + "-") !== 0) return jsonResponse(false, "Student ID must match the selected department and batch.", null);
    }
  }

  return withSheetLock(function() {
    var found = findAlumniRowByVerifiedPayload(payload);
    if (!found) return jsonResponse(false, "Profile not found.", null);
    // Backfill GoogleSub atomically inside lock
    var curSub = String(found.row[ALUMNI_COLS.GOOGLE_SUB - 1] || "").trim();
    if (!curSub && payload.sub) {
      found.row[ALUMNI_COLS.GOOGLE_SUB - 1] = payload.sub;
    }

    var sheet = getSheet(SHEETS.ALUMNI);
    var rowIdx = found.index;
    var now = new Date().toISOString();
    var values = sheet.getRange(rowIdx, 1, 1, ALUMNI_COLS.GOOGLE_SUB).getValues()[0];

    // Re-validate Student ID against effective department/batch (including existing values if not being updated)
    if (updates.studentId !== undefined && sanitize(updates.studentId)) {
      var sidFinal = sanitize(updates.studentId);
      var effDeptFinal = updates.department !== undefined ? sanitize(updates.department) : String(values[ALUMNI_COLS.DEPARTMENT - 1] || "").trim();
      var effBatchFinal = updates.batch !== undefined ? sanitize(updates.batch) : String(values[ALUMNI_COLS.BATCH - 1] || "").trim();
      var codeFinal = DEPARTMENT_CODES[effDeptFinal];
      if (!codeFinal) return jsonResponse(false, "Student ID must match the selected department and batch.", null);
      var patFinal = new RegExp("^" + codeFinal + "-(0[1-9]|1[0-9]|20)-\\d{4}$");
      var expPrefFinal = codeFinal + "-" + effBatchFinal + "-";
      if (!patFinal.test(sidFinal) || sidFinal.indexOf(expPrefFinal) !== 0) {
        return jsonResponse(false, "Student ID must match the selected department and batch.", null);
      }
    }
    // Also ensure if batch/department are updated, existing studentId (if any) still matches new values
    if ((updates.batch !== undefined || updates.department !== undefined) && !updates.studentId && !updates.studentId) {
      var existingSid2 = String(values[ALUMNI_COLS.STUDENT_ID - 1] || "").trim();
      if (existingSid2) {
        var effDept2 = updates.department !== undefined ? sanitize(updates.department) : String(values[ALUMNI_COLS.DEPARTMENT - 1] || "").trim();
        var effBatch2 = updates.batch !== undefined ? sanitize(updates.batch) : String(values[ALUMNI_COLS.BATCH - 1] || "").trim();
        var code2 = DEPARTMENT_CODES[effDept2];
        if (code2) {
          var pat2 = new RegExp("^" + code2 + "-(0[1-9]|1[0-9]|20)-\\d{4}$");
          var pref2 = code2 + "-" + effBatch2 + "-";
          if (!pat2.test(existingSid2) || existingSid2.indexOf(pref2) !== 0) {
            return jsonResponse(false, "Existing Student ID does not match the new department/batch. Please update Student ID accordingly.", null);
          }
        }
      }
    }

    var allowed = {
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
    var values2 = values;
    Object.keys(allowed).forEach(function(key) {
      if (updates[key] !== undefined) values2[allowed[key] - 1] = sanitize(updates[key]);
    });
    values2[ALUMNI_COLS.UPDATED_AT - 1] = now;
    if (!values2[ALUMNI_COLS.GOOGLE_SUB - 1]) values2[ALUMNI_COLS.GOOGLE_SUB - 1] = payload.sub;
    sheet.getRange(rowIdx, 1, 1, values2.length).setValues([values2]);

    return jsonResponse(true, "Profile updated successfully.", null);
  });
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
  var payload;
  try { payload = getVerifiedPayload(data); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  if (!checkIsAdmin(payload.email)) return jsonResponse(false, "Unauthorized. Admin privileges required.", null, 403);
  var id = sanitize(data.id);
  if (!id) return jsonResponse(false, "Member ID is required.", null);
  return withSheetLock(function() {
    var found = findAlumniRowById(id);
    if (!found) return jsonResponse(false, "Member not found.", null);
    var sheet = getSheet(SHEETS.ALUMNI);
    sheet.getRange(found.index, ALUMNI_COLS.STATUS).setValue(newStatus);
    sheet.getRange(found.index, ALUMNI_COLS.UPDATED_AT).setValue(new Date().toISOString());
    return jsonResponse(true, "Status updated to " + newStatus + ".", null);
  });
}

function handleCreateEvent(data) {
  var payload;
  try { payload = getVerifiedPayload(data); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  if (!checkIsAdmin(payload.email)) return jsonResponse(false, "Unauthorized.", null, 403);
  var content = {};
  try { content = typeof data.data === "string" ? JSON.parse(data.data) : (data.data || {}); } catch (e) { return jsonResponse(false, "Invalid data.", null); }
  if (!sanitize(content.title)) return jsonResponse(false, "Event title is required.", null);
  if (!sanitize(content.date)) return jsonResponse(false, "Event date is required.", null);
  return withSheetLock(function() {
    var sheet = getSheet(SHEETS.EVENTS);
    var id = generateId("EVT");
    var now = new Date().toISOString();
    sheet.appendRow([id, sanitize(content.title), sanitize(content.date), sanitize(content.time), sanitize(content.location), sanitize(content.description), sanitize(content.image), sanitize(content.registrationUrl), sanitize(content.status) || "Upcoming", now]);
    return jsonResponse(true, "Event created.", { id: id });
  });
}

function handleUpdateEvent(data) {
  var payload;
  try { payload = getVerifiedPayload(data); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  if (!checkIsAdmin(payload.email)) return jsonResponse(false, "Unauthorized.", null, 403);
  var id = sanitize(data.id);
  if (!id) return jsonResponse(false, "Event ID is required.", null);
  var content = {};
  try { content = typeof data.data === "string" ? JSON.parse(data.data) : (data.data || {}); } catch (e) { return jsonResponse(false, "Invalid data.", null); }
  return withSheetLock(function() {
    var sheet = getSheet(SHEETS.EVENTS);
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === id) {
        var row = values[i];
        if (content.title !== undefined) row[1] = sanitize(content.title);
        if (content.date !== undefined) row[2] = sanitize(content.date);
        if (content.time !== undefined) row[3] = sanitize(content.time);
        if (content.location !== undefined) row[4] = sanitize(content.location);
        if (content.description !== undefined) row[5] = sanitize(content.description);
        if (content.image !== undefined) row[6] = sanitize(content.image);
        if (content.registrationUrl !== undefined) row[7] = sanitize(content.registrationUrl);
        if (content.status !== undefined) row[8] = sanitize(content.status);
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return jsonResponse(true, "Event updated.", null);
      }
    }
    return jsonResponse(false, "Event not found.", null);
  });
}

function handleDeleteEvent(data) {
  var payload;
  try { payload = getVerifiedPayload(data); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  if (!checkIsAdmin(payload.email)) return jsonResponse(false, "Unauthorized.", null, 403);
  var id = sanitize(data.id);
  return withSheetLock(function() {
    var sheet = getSheet(SHEETS.EVENTS);
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === id) { sheet.deleteRow(i + 1); return jsonResponse(true, "Event deleted.", null); }
    }
    return jsonResponse(false, "Event not found.", null);
  });
}

function handleCreateAnnouncement(data) {
  var payload;
  try { payload = getVerifiedPayload(data); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  if (!checkIsAdmin(payload.email)) return jsonResponse(false, "Unauthorized.", null, 403);
  var content = {};
  try { content = typeof data.data === "string" ? JSON.parse(data.data) : (data.data || {}); } catch (e) { return jsonResponse(false, "Invalid data.", null); }
  if (!sanitize(content.title)) return jsonResponse(false, "Title is required.", null);
  if (!sanitize(content.content)) return jsonResponse(false, "Content is required.", null);
  return withSheetLock(function() {
    var sheet = getSheet(SHEETS.ANNOUNCEMENTS);
    var id = generateId("ANN");
    var now = new Date().toISOString();
    sheet.appendRow([id, sanitize(content.title), sanitize(content.content), sanitize(content.date) || now.slice(0,10), sanitize(content.author) || "Alumni Office", sanitize(content.image), "Published", now]);
    return jsonResponse(true, "Announcement created.", { id: id });
  });
}

function handleUpdateAnnouncement(data) {
  var payload;
  try { payload = getVerifiedPayload(data); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  if (!checkIsAdmin(payload.email)) return jsonResponse(false, "Unauthorized.", null, 403);
  var id = sanitize(data.id);
  if (!id) return jsonResponse(false, "Announcement ID is required.", null);
  var content = {};
  try { content = typeof data.data === "string" ? JSON.parse(data.data) : (data.data || {}); } catch (e) { return jsonResponse(false, "Invalid data.", null); }
  return withSheetLock(function() {
    var sheet = getSheet(SHEETS.ANNOUNCEMENTS);
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === id) {
        var row = values[i];
        if (content.title !== undefined) row[1] = sanitize(content.title);
        if (content.content !== undefined) row[2] = sanitize(content.content);
        if (content.date !== undefined) row[3] = sanitize(content.date);
        if (content.author !== undefined) row[4] = sanitize(content.author);
        if (content.image !== undefined) row[5] = sanitize(content.image);
        if (content.status !== undefined) row[6] = sanitize(content.status);
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return jsonResponse(true, "Announcement updated.", null);
      }
    }
    return jsonResponse(false, "Announcement not found.", null);
  });
}

function handleDeleteAnnouncement(data) {
  var payload;
  try { payload = getVerifiedPayload(data); } catch (e) { return jsonResponse(false, e.message, null, 401); }
  if (!checkIsAdmin(payload.email)) return jsonResponse(false, "Unauthorized.", null, 403);
  var id = sanitize(data.id);
  return withSheetLock(function() {
    var sheet = getSheet(SHEETS.ANNOUNCEMENTS);
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === id) { sheet.deleteRow(i + 1); return jsonResponse(true, "Announcement deleted.", null); }
    }
    return jsonResponse(false, "Announcement not found.", null);
  });
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
