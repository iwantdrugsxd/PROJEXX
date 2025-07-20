// backend/routes/authRoutes.js - CREATE THIS FILE
const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// Google OAuth Configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Step 1: Get Authorization URL
router.get('/google', (req, res) => {
  console.log('📍 Initiating Google OAuth...');
  console.log('🔗 Redirect URI:', process.env.GOOGLE_REDIRECT_URI);
  
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.folder',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  console.log('🚀 Redirecting to:', authUrl);
  res.redirect(authUrl);
});

// Step 2: Handle Callback
router.get('/google/callback', async (req, res) => {
  console.log('📍 Google OAuth Callback received');
  console.log('🔗 Callback URL:', req.originalUrl);
  console.log('📝 Query params:', req.query);
  
  const { code, error } = req.query;

  if (error) {
    console.error('❌ OAuth Error:', error);
    return res.status(400).json({
      success: false,
      message: 'OAuth authorization failed',
      error: error
    });
  }

  if (!code) {
    console.error('❌ No authorization code received');
    return res.status(400).json({
      success: false,
      message: 'No authorization code received'
    });
  }

  try {
    console.log('🔄 Exchanging code for tokens...');
    
    const { tokens } = await oauth2Client.getAccessToken(code);
    console.log('✅ Tokens received:', {
      access_token: tokens.access_token ? 'Present' : 'Missing',
      refresh_token: tokens.refresh_token ? 'Present' : 'Missing',
      expires_in: tokens.expiry_date
    });

    oauth2Client.setCredentials(tokens);

    // Test Drive API access
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const response = await drive.files.list({ pageSize: 1 });
    console.log('✅ Google Drive API test successful');

    console.log('🔑 REFRESH TOKEN (store in .env):', tokens.refresh_token);

    // Return success page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>OAuth Success</title>
          <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .success { background: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50; }
              .token { background: #f5f5f5; padding: 15px; border-radius: 4px; font-family: monospace; word-break: break-all; }
          </style>
      </head>
      <body>
          <div class="success">
              <h1>🎉 OAuth Setup Successful!</h1>
              <p>✅ Google Drive API access granted and tested!</p>
              <h3>📋 Add this to your .env file:</h3>
              <div class="token">GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</div>
              <p><strong>⚠️ Keep this token secure!</strong></p>
              <p>You can close this window now.</p>
          </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ Token exchange failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to exchange authorization code',
      error: error.message
    });
  }
});

// Test endpoint to verify setup
router.get('/test-drive', async (req, res) => {
  try {
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
      return res.status(400).json({
        success: false,
        message: 'No refresh token configured. Complete OAuth setup first.',
        setupUrl: '/auth/google'
      });
    }

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const response = await drive.files.list({
      pageSize: 5,
      fields: 'files(id, name, mimeType)'
    });

    res.json({
      success: true,
      message: 'Google Drive API working correctly',
      filesFound: response.data.files.length,
      sampleFiles: response.data.files,
      driveEnabled: true
    });

  } catch (error) {
    console.error('❌ Drive API test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Google Drive API test failed',
      error: error.message,
      driveEnabled: false
    });
  }
});

module.exports = router;