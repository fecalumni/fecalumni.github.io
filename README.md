# FEC Alumni Association Website

Official alumni association platform for **Faridpur Engineering College (FEC)**.

A production-quality website deployed on **GitHub Pages** with **Google Apps Script** and **Google Sheets** as the backend, and **Google Sign-In** for authentication.

---

## Architecture

```
GitHub Pages (Frontend)  --->  Google Apps Script Web App  --->  Google Sheets
     HTML/CSS/JS (vanilla)          (backend + authz)              (database)
                                                          Sheets:
                                                          Alumni, Admins,
                                                          Events, Announcements,
                                                          Contact_Messages, Settings
```

- **Frontend**: HTML5, CSS3, Vanilla JavaScript, responsive (320px – 1440px)
- **Backend**: Google Apps Script (`backend/Code.gs`)
- **Database**: Google Sheets (one spreadsheet, multiple worksheets)
- **Auth**: Google Identity Services (GIS) — email is the primary identity, no passwords stored

---

## Folder Structure

```
fec_alumna/
├── index.html
├── login.html
├── register.html
├── dashboard.html
├── alumni.html          # Alumni directory (approved only)
├── profile.html
├── events.html
├── announcements.html
├── about.html
├── contact.html
├── admin/
│   └── admin.html
├── css/
│   ├── style.css        # Design system + common components
│   ├── auth.css
│   ├── dashboard.css
│   ├── alumni.css
│   └── admin.css
├── js/
│   ├── config.js        # Central config (API_URL, Client ID)
│   ├── api.js           # API client (with mock fallback)
│   ├── auth.js          # Auth helpers + GIS integration
│   ├── utils.js         # Shared utilities + navbar
│   ├── register.js
│   ├── dashboard.js
│   ├── alumni.js
│   ├── profile.js
│   ├── events.js
│   └── contact.js
│   └── admin.js
├── backend/
│   └── Code.gs          # Google Apps Script backend
├── assets/
│   ├── campus/
│   └── images/
└── fec_logo/
    ├── fec_logo.jpeg
    └── fec_logo.jpg
```

---

## GitHub Pages Deployment

1. Push the repository to GitHub.
2. Go to **Settings > Pages**.
3. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Save. The site will be available at `https://<username>.github.io/<repo>/`.
5. All asset paths are **relative** and case-sensitive safe.

No build step required. No server-side runtime.

---

## Google Sheets Setup

1. Create a new Google Spreadsheet.
2. Note its **Spreadsheet ID** from the URL: `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`
3. Create worksheets (tabs) with these exact names:
   - `Alumni`
   - `Admins`
   - `Events`
   - `Announcements`
   - `Contact_Messages`
   - `Settings`
4. Add header rows (the Apps Script will auto-create them if missing):

**Alumni**: `ID | FullName | Email | Batch | Department | GraduationYear | StudentID | Phone | Profession | Organization | City | LinkedIn | Website | ProfilePhoto | Bio | Status | Role | CreatedAt | UpdatedAt`

**Admins**: `Email | Name | Role | Status` — e.g., `your.email@gmail.com | Your Name | SuperAdmin | Active`

**Events**: `ID | Title | Date | Time | Location | Description | Image | RegistrationUrl | Status | CreatedAt`

**Announcements**: `ID | Title | Content | Date | Author | Image | Status | CreatedAt`

**Contact_Messages**: `ID | Name | Email | Subject | Message | CreatedAt | Status`

Do **not** share the spreadsheet publicly.

---

## Google Apps Script Setup

1. In the spreadsheet, go to **Extensions > Apps Script**.
2. Replace the default `Code.gs` with the contents of `backend/Code.gs`.
3. At the top, set:
   ```js
   const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";
   ```
4. **Deploy > New Deployment**:
   - Type: **Web App**
   - Description: `FEC Alumni API`
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the **Web App URL** (ends with `/exec`).

---

## Google Sign-In Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create a project (or use existing).
3. Enable **Google Identity Services** / **Google Sign-In**.
4. Create **OAuth 2.0 Client ID** (Web application).
5. Add **Authorized JavaScript origins**:
   - `https://<username>.github.io`
   - `http://localhost:8000` (for local testing)
6. Copy the **Client ID** (ends with `.apps.googleusercontent.com`).

---

## Frontend Configuration

Edit `js/config.js`:

```js
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/YOUR_ID/exec",
  GOOGLE_CLIENT_ID: "YOUR_CLIENT_ID.apps.googleusercontent.com",
  // ...
};
```

Only these two values need to change for production. No secrets are exposed beyond the Web App URL and OAuth Client ID (both are public by design).

To preview without backend, leave placeholders — the site runs in **demo mode** with mock alumni/events and local session storage.

---

## Admin Account

1. Add your Google account email to the `Admins` sheet:
   ```
   Email: your.email@gmail.com | Name: Your Name | Role: SuperAdmin | Status: Active
   ```
2. Sign in via Google on the live site. The backend verifies `isAdmin(email)` server-side.
3. Access `admin/admin.html` — you will see pending applications and member management.

Admin operations (`approveAlumni`, `rejectAlumni`, etc.) all verify `adminEmail` server-side via `checkIsAdmin()` — frontend checks are not trusted.

---

## Connecting Frontend to Apps Script

After deploying the Web App and updating `js/config.js`, hard-refresh the site. Registration, directory, and admin calls will hit the live Web App. Check the browser console for `[Api]` logs if requests fail — most commonly a deployment permission issue (re-deploy as "Anyone").

CORS: the backend uses `ContentService` JSON responses and the frontend uses `text/plain` POST to avoid preflight issues on Apps Script.

---

## Testing Registration Flow

1. Open `login.html`, sign in with Google.
2. If email not in `Alumni` sheet, you are redirected to `register.html`.
3. Fill the form (email is locked to the Google account).
4. Submit — row is appended to `Alumni` with `Status=Pending`.
5. Login again shows "awaiting approval".
6. Admin approves in `admin/admin.html` — status becomes `Approved`.
7. User can now access `dashboard.html` and `alumni.html`.

Duplicate email is rejected server-side.

---

## Approving an Alumni (Admin)

1. Login as an admin email.
2. Open `admin/admin.html`.
3. Under **Pending Applications**, click **Approve** or **Reject**.
4. Stats and member tables refresh automatically.

Suspend/reactivate is available in **All Members**.

---

## Deploying to GitHub Pages (Checklist)

- [ ] Push all files to `main` branch
- [ ] Enable Pages from `main` / root
- [ ] Set `CONFIG.API_URL` and `CONFIG.GOOGLE_CLIENT_ID`
- [ ] Verify logo loads at `fec_logo/fec_logo.jpeg` (and `.jpg` fallback)
- [ ] Test on mobile (320px) and desktop

---

## Security Considerations

- No passwords are stored anywhere.
- The spreadsheet is **not** shared publicly.
- No API keys or sheet IDs in frontend beyond the Web App URL.
- Every admin action is verified server-side (`checkIsAdmin`).
- Profile updates only allow the authenticated user's own row (email match).
- Directory only returns `Approved` members and only public fields (no email/phone).
- Inputs are validated both client and server side; URLs and emails are sanitized.
- Alumni IDs (`FEC-ALU-...`) are internal; email is the lookup key.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| Google button does not appear | `GOOGLE_CLIENT_ID` not set, or origin not in OAuth allowlist |
| `Failed to fetch` on API calls | Web App not deployed as "Anyone", or `API_URL` incorrect |
| Always shows demo data | `API_URL` still placeholder — configure it |
| Admin page says Unauthorized | Email not in `Admins` sheet with `Status=Active` |
| Registration says already registered | Email exists in sheet — check `Alumni` tab |
| Logo not loading | Ensure `fec_logo/fec_logo.jpeg` exists (both `.jpg` and `.jpeg` are supported) |
| Campus image missing | Place image at `assets/campus/campus-hero.jpg` (SVG placeholder is fallback) |

---

## Local Preview

```bash
# From the fec_alumna folder
python -m http.server 8000
# or
npx serve .
```
Open `http://localhost:8000`.

Without backend config, the site runs in demo mode — useful for UI review.

---

## License

For use by Faridpur Engineering College and its alumni association.
