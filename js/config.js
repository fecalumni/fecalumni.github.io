/**
 * FEC Alumni - Frontend Configuration
 * Replace placeholder values before production deployment.
 * This file is loaded first on every page.
 */
const CONFIG = {
  // Replace with your deployed Google Apps Script Web App URL
  // Example: "https://script.google.com/macros/s/AKfycbx.../exec"
  API_URL: "https://script.google.com/macros/s/AKfycbzJRhV51I010u8_GVWfQ8bK-X4yOgFO5iEu-3TgEMjwhjL1rH-o77-nZshBrNecE6vqGw/exec",

  // Google OAuth Client ID for Google Identity Services (GIS)
  // Create at: https://console.cloud.google.com/apis/credentials
  GOOGLE_CLIENT_ID: "668916176652-hbb2eop8nr8g64ksh3jddbfakj1mf04m.apps.googleusercontent.com",

  // Storage keys
  STORAGE_KEYS: {
    USER: "fec_user",
    TOKEN: "fec_id_token"
  },

  // Departments offered at FEC (Mechanical Engineering removed per alumni requirements)
  DEPARTMENTS: [
    "Civil Engineering",
    "Electrical and Electronic Engineering",
    "Computer Science and Engineering"
  ],

  DEPARTMENT_CODES: {
    "Civil Engineering": "CE",
    "Electrical and Electronic Engineering": "EEE",
    "Computer Science and Engineering": "CSE"
  },

  // Alumni batch numbers (zero-padded string, not year)
  BATCHES: ["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20"],

  // Graduation year range
  BATCH_MIN: 2010,
  BATCH_MAX: 2026,

  // Pagination
  PAGE_SIZE: 12
};

// Helper to detect if backend is configured
function isBackendConfigured() {
  return CONFIG.API_URL && !CONFIG.API_URL.includes("YOUR_GOOGLE");
}
function isGoogleConfigured() {
  return CONFIG.GOOGLE_CLIENT_ID && !CONFIG.GOOGLE_CLIENT_ID.includes("YOUR_GOOGLE");
}
