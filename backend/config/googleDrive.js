const { google } = require('googleapis');
const path = require('path');

class GoogleDriveConfig {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.init();
  }

  init() {
    // Using your OAuth credentials
  this.auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID, // ✅ From environment
  process.env.GOOGLE_CLIENT_SECRET, // ✅ From environment
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
);
    // Set refresh token (you'll need to implement OAuth flow)
    this.auth.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  getDriveInstance() {
    return this.drive;
  }

  getAuth() {
    return this.auth;
  }
}

module.exports = new GoogleDriveConfig();