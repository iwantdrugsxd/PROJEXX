const mongoose = require('mongoose');

console.log("🔧 [DATABASE_CONFIG] Loading database configuration...");

// Database configuration with all optimizations
const databaseConfig = {
  // Connection string with fallback
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/projectmanagement',
  
  // Optimized connection options
  options: {
    // Connection management
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,
    maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME) || 30000,
    
    // Timeout settings
    serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 10000,
    socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
    connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000,
    
    // Buffering and retry settings
    bufferCommands: false,
    bufferMaxEntries: 0,
    
    // Network settings
    family: 4, // Use IPv4
    keepAlive: true,
    keepAliveInitialDelay: 300000,
    
    // Write concern for data safety
    w: 'majority',
    wtimeoutMS: 10000,
    
    // Read preference
    readPreference: 'primary',
    
    // Compression
    compressors: ['zlib'],
    
    // Authentication (if needed)
    authSource: process.env.DB_AUTH_SOURCE || 'admin',
    
    // SSL/TLS (for production)
    ssl: process.env.NODE_ENV === 'production' && process.env.DB_SSL === 'true',
    sslValidate: process.env.NODE_ENV === 'production'
  },
  
  // Retry configuration
  retry: {
    maxAttempts: parseInt(process.env.DB_MAX_RETRY_ATTEMPTS) || 5,
    initialDelay: parseInt(process.env.DB_INITIAL_RETRY_DELAY) || 2000,
    maxDelay: parseInt(process.env.DB_MAX_RETRY_DELAY) || 30000,
    backoffFactor: parseFloat(process.env.DB_BACKOFF_FACTOR) || 2
  }
};

// Validate database URI
const validateDatabaseUri = (uri) => {
  if (!uri) {
    throw new Error('Database URI is required');
  }
  
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('Invalid MongoDB URI format');
  }
  
  return true;
};

// Connection function with retry logic
const connectToDatabase = async () => {
  const { uri, options, retry } = databaseConfig;
  
  validateDatabaseUri(uri);
  
  let attempt = 0;
  let delay = retry.initialDelay;
  
  while (attempt < retry.maxAttempts) {
    try {
      attempt++;
      console.log(`🔄 [DATABASE] Connection attempt ${attempt}/${retry.maxAttempts}...`);
      
      await mongoose.connect(uri, options);
      
      console.log('✅ [DATABASE] MongoDB Connected Successfully');
      console.log(`📊 [DATABASE] Database: ${mongoose.connection.name}`);
      console.log(`🌐 [DATABASE] Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
      console.log(`🔧 [DATABASE] Ready State: ${mongoose.connection.readyState}`);
      
      return mongoose.connection;
      
    } catch (error) {
      console.error(`❌ [DATABASE] Connection attempt ${attempt} failed:`, error.message);
      
      if (attempt >= retry.maxAttempts) {
        console.error('🚨 [DATABASE] Max connection attempts reached. Exiting...');
        throw new Error(`Failed to connect to database after ${retry.maxAttempts} attempts: ${error.message}`);
      }
      
      console.log(`⏳ [DATABASE] Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff with jitter
      delay = Math.min(delay * retry.backoffFactor + Math.random() * 1000, retry.maxDelay);
    }
  }
};

// Connection event handlers
const setupConnectionHandlers = () => {
  const connection = mongoose.connection;
  
  connection.on('error', (err) => {
    console.error('❌ [DATABASE] MongoDB connection error:', err.message);
  });
  
  connection.on('disconnected', () => {
    console.warn('⚠️  [DATABASE] MongoDB disconnected');
  });
  
  connection.on('reconnected', () => {
    console.log('🔄 [DATABASE] MongoDB reconnected');
  });
  
  connection.on('close', () => {
    console.log('🔌 [DATABASE] MongoDB connection closed');
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    try {
      await connection.close();
      console.log('🛑 [DATABASE] MongoDB connection closed through app termination');
      process.exit(0);
    } catch (err) {
      console.error('❌ [DATABASE] Error during graceful shutdown:', err.message);
      process.exit(1);
    }
  });
};

// Database health check
const checkDatabaseHealth = async () => {
  try {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency: `${latency}ms`,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      database: mongoose.connection.name
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      readyState: mongoose.connection.readyState
    };
  }
};

console.log('✅ [DATABASE_CONFIG] Database configuration loaded');
console.log(`📋 [DATABASE_CONFIG] Target URI: ${databaseConfig.uri.replace(/\/\/.*@/, '//*****@')}`);
console.log(`📋 [DATABASE_CONFIG] Max pool size: ${databaseConfig.options.maxPoolSize}`);
console.log(`📋 [DATABASE_CONFIG] Connection timeout: ${databaseConfig.options.connectTimeoutMS}ms`);

module.exports = {
  databaseConfig,
  connectToDatabase,
  setupConnectionHandlers,
  checkDatabaseHealth
};