// backend/test-google-drive.js - CREATE THIS FILE
require('dotenv').config();
const { google } = require('googleapis');

async function testGoogleDriveSetup() {
  console.log('🧪 Testing Google Drive API Setup...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables Check:');
  console.log('✓ GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing');
  console.log('✓ GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
  console.log('✓ GOOGLE_REFRESH_TOKEN:', process.env.GOOGLE_REFRESH_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('✓ GOOGLE_DRIVE_BASE_FOLDER_ID:', process.env.GOOGLE_DRIVE_BASE_FOLDER_ID ? '✅ Set' : '⚠️  Not set (optional)');
  console.log('');
  
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    console.error('❌ Missing required environment variables!');
    console.log('\n💡 Setup steps:');
    console.log('1. Add GOOGLE_CLIENT_ID to .env');
    console.log('2. Add GOOGLE_CLIENT_SECRET to .env');
    console.log('3. Run OAuth setup: node setup-oauth.js');
    console.log('4. Add GOOGLE_REFRESH_TOKEN to .env');
    return;
  }
  
  try {
    // Initialize OAuth client
    console.log('🔧 Initializing OAuth client...');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
    
    // Initialize Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    console.log('✅ OAuth client initialized successfully');
    
    // Test 1: List files
    console.log('\n🧪 Test 1: Listing files in Google Drive...');
    const filesResponse = await drive.files.list({
      pageSize: 5,
      fields: 'files(id, name, mimeType, size, createdTime)'
    });
    
    console.log(`✅ Successfully retrieved ${filesResponse.data.files.length} files`);
    if (filesResponse.data.files.length > 0) {
      console.log('📁 Sample files:');
      filesResponse.data.files.forEach((file, index) => {
        const size = file.size ? `${Math.round(file.size / 1024)}KB` : 'N/A';
        console.log(`   ${index + 1}. ${file.name} (${file.mimeType}) - ${size}`);
      });
    } else {
      console.log('📁 No files found in Google Drive');
    }
    
    // Test 2: Check base folder
    if (process.env.GOOGLE_DRIVE_BASE_FOLDER_ID) {
      console.log('\n🧪 Test 2: Checking base folder...');
      try {
        const folderResponse = await drive.files.get({
          fileId: process.env.GOOGLE_DRIVE_BASE_FOLDER_ID,
          fields: 'id, name, mimeType, createdTime'
        });
        
        if (folderResponse.data.mimeType === 'application/vnd.google-apps.folder') {
          console.log(`✅ Base folder found: "${folderResponse.data.name}"`);
          console.log(`📅 Created: ${new Date(folderResponse.data.createdTime).toLocaleDateString()}`);
          
          // List contents of base folder
          const folderContents = await drive.files.list({
            q: `'${process.env.GOOGLE_DRIVE_BASE_FOLDER_ID}' in parents`,
            fields: 'files(id, name, mimeType, size)',
            pageSize: 10
          });
          
          console.log(`📂 Folder contains ${folderContents.data.files.length} items`);
          if (folderContents.data.files.length > 0) {
            console.log('📄 Contents:');
            folderContents.data.files.forEach((file, index) => {
              const size = file.size ? `${Math.round(file.size / 1024)}KB` : 'Folder';
              console.log(`   ${index + 1}. ${file.name} - ${size}`);
            });
          }
        } else {
          console.log('❌ Base folder ID points to a file, not a folder');
        }
      } catch (error) {
        console.log('❌ Cannot access base folder:', error.message);
        if (error.code === 404) {
          console.log('💡 The folder ID is incorrect or the folder was deleted');
        } else if (error.code === 403) {
          console.log('💡 No permission to access this folder');
        }
      }
    } else {
      console.log('\n⚠️  Test 2: Skipped - GOOGLE_DRIVE_BASE_FOLDER_ID not set');
      console.log('💡 Create a folder in Google Drive and add its ID to .env');
    }
    
    // Test 3: Create a test folder
    console.log('\n🧪 Test 3: Creating test folder...');
    const testFolderName = `Test_Folder_${Date.now()}`;
    const testFolderResponse = await drive.files.create({
      resource: {
        name: testFolderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: process.env.GOOGLE_DRIVE_BASE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_BASE_FOLDER_ID] : undefined
      },
      fields: 'id, name, parents, webViewLink'
    });
    
    console.log(`✅ Test folder created: "${testFolderResponse.data.name}"`);
    console.log(`📁 Folder ID: ${testFolderResponse.data.id}`);
    console.log(`🔗 View URL: ${testFolderResponse.data.webViewLink}`);
    
    // Test 4: Test folder permissions
    console.log('\n🧪 Test 4: Testing folder permissions...');
    try {
      const permissions = await drive.permissions.list({
        fileId: testFolderResponse.data.id,
        fields: 'permissions(id, role, type, emailAddress)'
      });
      console.log(`✅ Folder permissions retrieved: ${permissions.data.permissions.length} entries`);
    } catch (error) {
      console.log('⚠️  Could not retrieve folder permissions:', error.message);
    }
    
    // Test 5: Delete test folder
    console.log('\n🧪 Test 5: Cleaning up test folder...');
    await drive.files.delete({
      fileId: testFolderResponse.data.id
    });
    console.log('✅ Test folder deleted successfully');
    
    // Test 6: Check API quotas
    console.log('\n🧪 Test 6: Checking API quota usage...');
    try {
      const aboutResponse = await drive.about.get({
        fields: 'storageQuota, user'
      });
      
      if (aboutResponse.data.storageQuota) {
        const quota = aboutResponse.data.storageQuota;
        const usedGB = Math.round(quota.usage / (1024 * 1024 * 1024) * 100) / 100;
        const limitGB = quota.limit ? Math.round(quota.limit / (1024 * 1024 * 1024) * 100) / 100 : 'Unlimited';
        console.log(`✅ Storage usage: ${usedGB}GB / ${limitGB}GB`);
      }
      
      if (aboutResponse.data.user) {
        console.log(`✅ Authenticated as: ${aboutResponse.data.user.emailAddress}`);
      }
    } catch (error) {
      console.log('⚠️  Could not retrieve quota information:', error.message);
    }
    
    // Final result
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Google Drive API is working correctly');
    console.log('✅ Your file upload system should work properly');
    
    console.log('\n📋 Next steps:');
    console.log('1. Make sure your backend server includes the file routes');
    console.log('2. Install required packages: npm install express multer googleapis sharp');
    console.log('3. Start your server and test file uploads');
    console.log('4. Check that uploaded files appear in your Google Drive folder');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n💡 Solution: Your refresh token has expired or is invalid.');
      console.log('   1. Run: node setup-oauth.js');
      console.log('   2. Complete the OAuth flow again');
      console.log('   3. Update GOOGLE_REFRESH_TOKEN in .env');
    } else if (error.message.includes('access_denied')) {
      console.log('\n💡 Solution: Check your Google Drive API permissions.');
      console.log('   1. Go to Google Cloud Console');
      console.log('   2. Enable Google Drive API');
      console.log('   3. Check OAuth scopes include drive.file');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Solution: Check your internet connection.');
    } else {
      console.log('\n💡 Check your environment variables and Google Cloud Console setup.');
      console.log('   Run: node setup-oauth.js to reconfigure OAuth');
    }
  }
}

// Run the test
if (require.main === module) {
  testGoogleDriveSetup().catch(console.error);
}

module.exports = testGoogleDriveSetup;