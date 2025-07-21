// ============================================
// DATABASE CONNECTION DIAGNOSTIC AND FIX
// Add this to your backend/server.js or create a new file: backend/utils/databaseHealth.js
// ============================================

const mongoose = require('mongoose');

// Enhanced database connection with comprehensive error handling
const connectToDatabase = async () => {
  const maxRetries = 5;
  let retryCount = 0;
  
  // Get MongoDB URI from environment
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/projectmanagement';
  
  console.log('🔍 [DATABASE] Connection attempt details:');
  console.log(`   📍 URI Pattern: ${mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
  console.log(`   🌐 Connection Type: ${mongoURI.includes('mongodb+srv') ? 'MongoDB Atlas' : 'Local MongoDB'}`);
  console.log(`   🔄 Max Retries: ${maxRetries}`);
  
  while (retryCount < maxRetries) {
    try {
      console.log(`🔄 [DATABASE] Connection attempt ${retryCount + 1}/${maxRetries}...`);
      
      // Disconnect if already connected
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log('🔌 [DATABASE] Disconnected from previous connection');
      }
      
      // Connection options - different for Atlas vs Local
      const connectionOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000, // 10 seconds
        socketTimeoutMS: 45000, // 45 seconds
        bufferCommands: false,
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
      };
      
      // Additional options for Atlas
      if (mongoURI.includes('mongodb+srv')) {
        connectionOptions.retryWrites = true;
        connectionOptions.w = 'majority';
        console.log('🌩️  [DATABASE] Using MongoDB Atlas configuration');
      } else {
        connectionOptions.family = 4; // Use IPv4 for local connections
        console.log('🏠 [DATABASE] Using Local MongoDB configuration');
      }
      
      // Attempt connection
      await mongoose.connect(mongoURI, connectionOptions);
      
      // Verify connection
      const db = mongoose.connection.db;
      const adminDb = db.admin();
      const serverStatus = await adminDb.serverStatus();
      
      console.log('✅ [DATABASE] MongoDB Connected Successfully');
      console.log(`📊 [DATABASE] Database: ${mongoose.connection.name}`);
      console.log(`🌐 [DATABASE] Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
      console.log(`🔢 [DATABASE] MongoDB Version: ${serverStatus.version}`);
      console.log(`💾 [DATABASE] Storage Engine: ${serverStatus.storageEngine?.name || 'Unknown'}`);
      
      // Test database operations
      await testDatabaseOperations();
      
      // Setup connection event listeners
      setupConnectionListeners();
      
      return true;
      
    } catch (error) {
      retryCount++;
      console.error(`❌ [DATABASE] Connection attempt ${retryCount} failed:`);
      
      // Detailed error analysis
      if (error.name === 'MongoServerSelectionError') {
        console.error('   🔍 Server Selection Error - Possible causes:');
        if (mongoURI.includes('localhost')) {
          console.error('     • Local MongoDB service not running');
          console.error('     • Wrong port (default: 27017)');
          console.error('     • Firewall blocking connection');
        } else {
          console.error('     • Network connectivity issues');
          console.error('     • Incorrect MongoDB Atlas connection string');
          console.error('     • IP whitelist restrictions');
          console.error('     • Invalid credentials');
        }
      } else if (error.name === 'MongoParseError') {
        console.error('   🔍 Connection String Parse Error:');
        console.error('     • Malformed MongoDB URI');
        console.error('     • Special characters not URL encoded');
        console.error('     • Missing required parameters');
      } else if (error.code === 'ENOTFOUND') {
        console.error('   🔍 DNS Resolution Error:');
        console.error('     • Hostname not found');
        console.error('     • Network connectivity issues');
      } else if (error.code === 8000) {
        console.error('   🔍 Authentication Error:');
        console.error('     • Invalid username/password');
        console.error('     • User not authorized for database');
      }
      
      console.error(`   📝 Error Details: ${error.message}`);
      
      if (retryCount >= maxRetries) {
        console.error('🚨 [DATABASE] Max retries reached. Connection failed permanently.');
        
        // Suggest solutions based on error type
        console.error('\n💡 [DATABASE] Troubleshooting suggestions:');
        if (mongoURI.includes('localhost')) {
          console.error('   1. Start MongoDB service: mongod --dbpath /data/db');
          console.error('   2. Check if MongoDB is running: mongo --eval "db.stats()"');
          console.error('   3. Verify port 27017 is not blocked');
        } else {
          console.error('   1. Check MongoDB Atlas connection string');
          console.error('   2. Verify IP address is whitelisted (0.0.0.0/0 for testing)');
          console.error('   3. Confirm username/password are correct');
          console.error('   4. Test connection with MongoDB Compass');
        }
        
        throw new Error(`Database connection failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retry with exponential backoff
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
      console.log(`⏳ [DATABASE] Waiting ${waitTime}ms before retry ${retryCount + 1}...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// Test basic database operations
const testDatabaseOperations = async () => {
  try {
    console.log('🧪 [DATABASE] Testing database operations...');
    
    // Test 1: List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`   📁 Collections found: ${collections.length}`);
    if (collections.length > 0) {
      console.log(`   📋 Collection names: ${collections.map(c => c.name).join(', ')}`);
    }
    
    // Test 2: Check if Student collection exists and has data
    const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
    const studentCount = await Student.countDocuments();
    console.log(`   👥 Student records: ${studentCount}`);
    
    // Test 3: Simple write/read test
    const testCollection = mongoose.connection.db.collection('connection_test');
    const testDoc = { _id: 'connection_test', timestamp: new Date(), test: true };
    await testCollection.replaceOne({ _id: 'connection_test' }, testDoc, { upsert: true });
    const retrieved = await testCollection.findOne({ _id: 'connection_test' });
    
    if (retrieved) {
      console.log('   ✅ Write/Read test: PASSED');
      await testCollection.deleteOne({ _id: 'connection_test' }); // Cleanup
    } else {
      console.log('   ❌ Write/Read test: FAILED');
    }
    
    console.log('✅ [DATABASE] All database operations successful');
    
  } catch (error) {
    console.error('❌ [DATABASE] Database operation test failed:', error.message);
    throw error;
  }
};

// Setup connection event listeners
const setupConnectionListeners = () => {
  mongoose.connection.on('error', (err) => {
    console.error('❌ [DATABASE] MongoDB connection error:', err.message);
  });
  
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  [DATABASE] MongoDB disconnected');
  });
  
  mongoose.connection.on('reconnected', () => {
    console.info('🔄 [DATABASE] MongoDB reconnected');
  });
  
  mongoose.connection.on('close', () => {
    console.info('🔌 [DATABASE] MongoDB connection closed');
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      console.log('🔌 [DATABASE] MongoDB connection closed through app termination');
      process.exit(0);
    } catch (error) {
      console.error('❌ [DATABASE] Error during graceful shutdown:', error);
      process.exit(1);
    }
  });
};

// Health check endpoint
const createHealthCheckRoute = (app) => {
  app.get('/api/health/database', async (req, res) => {
    try {
      const dbState = mongoose.connection.readyState;
      const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];
      
      if (dbState === 1) {
        // Connected - perform additional checks
        const stats = await mongoose.connection.db.stats();
        const serverStatus = await mongoose.connection.db.admin().serverStatus();
        
        res.json({
          success: true,
          status: 'healthy',
          database: {
            state: stateNames[dbState] || 'unknown',
            name: mongoose.connection.name,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            version: serverStatus.version,
            collections: stats.collections,
            documents: stats.objects,
            dataSize: `${Math.round(stats.dataSize / 1024 / 1024 * 100) / 100} MB`,
            storageSize: `${Math.round(stats.storageSize / 1024 / 1024 * 100) / 100} MB`
          },
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          success: false,
          status: 'unhealthy',
          database: {
            state: stateNames[dbState] || 'unknown',
            error: 'Database not connected'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
};

// Export functions
module.exports = {
  connectToDatabase,
  testDatabaseOperations,
  setupConnectionListeners,
  createHealthCheckRoute
};