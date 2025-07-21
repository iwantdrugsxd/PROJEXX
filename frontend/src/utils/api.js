// frontend/src/utils/api.js - COMPLETE PRODUCTION LEVEL API UTILITY
// This file handles ALL API calls with comprehensive error handling and logging

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

// API Base URL with fallback
export const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// Request timeout (30 seconds)
const REQUEST_TIMEOUT = 30000;

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Enhanced logging utility
const apiLog = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [API] [${level.toUpperCase()}] ${message}`;
  
  switch (level) {
    case 'error':
      console.error(logMessage, data || '');
      break;
    case 'warn':
      console.warn(logMessage, data || '');
      break;
    case 'info':
      console.log(logMessage, data || '');
      break;
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.log(logMessage, data || '');
      }
      break;
    default:
      console.log(logMessage, data || '');
  }
};

// Network status checker
const checkNetworkStatus = () => {
  return navigator.onLine;
};

// Sleep utility for retry delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Generate unique request ID for tracking
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// HTTP CLIENT WITH ADVANCED FEATURES
// ============================================

// Enhanced fetch with timeout support
const fetchWithTimeout = async (url, options = {}, timeout = REQUEST_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

// Main API call function with comprehensive error handling
export const apiCall = async (endpoint, options = {}) => {
  const requestId = generateRequestId();
  const url = `${API_BASE}${endpoint}`;
  
  // Default configuration
  const config = {
    method: 'GET',
    credentials: 'include', // Always include cookies for authentication
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      ...options.headers,
    },
    ...options,
  };

  apiLog('info', `Starting request ${requestId}`, {
    method: config.method,
    url,
    hasBody: !!config.body
  });

  // Check network status
  if (!checkNetworkStatus()) {
    apiLog('error', `Network offline for request ${requestId}`);
    return {
      success: false,
      error: 'No internet connection. Please check your network and try again.',
      code: 'NETWORK_ERROR',
      requestId
    };
  }

  // Retry logic
  let lastError = null;
  
  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      apiLog('debug', `Attempt ${attempt}/${RETRY_CONFIG.maxRetries} for request ${requestId}`);

      const response = await fetchWithTimeout(url, config);
      const responseText = await response.text();
      
      // Try to parse as JSON, fallback to text
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        data = { message: responseText };
      }

      apiLog('info', `Response received for request ${requestId}`, {
        status: response.status,
        statusText: response.statusText,
        hasData: !!data
      });

      // Handle successful responses
      if (response.ok) {
        apiLog('info', `Request ${requestId} completed successfully`);
        return {
          success: true,
          data,
          status: response.status,
          requestId
        };
      }

      // Handle client errors (4xx) - don't retry these
      if (response.status >= 400 && response.status < 500) {
        const errorMessage = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
        
        apiLog('warn', `Client error for request ${requestId}`, {
          status: response.status,
          message: errorMessage
        });

        return {
          success: false,
          error: errorMessage,
          code: data?.code || 'CLIENT_ERROR',
          status: response.status,
          data,
          requestId
        };
      }

      // Handle server errors (5xx) - these can be retried
      if (response.status >= 500) {
        const errorMessage = data?.message || `Server error (${response.status})`;
        lastError = new Error(errorMessage);
        
        if (attempt < RETRY_CONFIG.maxRetries && RETRY_CONFIG.retryableStatuses.includes(response.status)) {
          apiLog('warn', `Server error for request ${requestId}, retrying in ${RETRY_CONFIG.retryDelay}ms`, {
            status: response.status,
            attempt,
            maxRetries: RETRY_CONFIG.maxRetries
          });
          
          await sleep(RETRY_CONFIG.retryDelay * attempt);
          continue;
        }

        apiLog('error', `Server error for request ${requestId} (no more retries)`, {
          status: response.status,
          message: errorMessage
        });

        return {
          success: false,
          error: errorMessage,
          code: 'SERVER_ERROR',
          status: response.status,
          data,
          requestId
        };
      }

    } catch (error) {
      lastError = error;
      
      // Network errors, timeouts, etc.
      if (attempt < RETRY_CONFIG.maxRetries) {
        apiLog('warn', `Network error for request ${requestId}, retrying`, {
          error: error.message,
          attempt,
          maxRetries: RETRY_CONFIG.maxRetries
        });
        
        await sleep(RETRY_CONFIG.retryDelay * attempt);
        continue;
      }

      apiLog('error', `Network error for request ${requestId} (no more retries)`, {
        error: error.message
      });

      // Determine error type
      let errorCode = 'NETWORK_ERROR';
      let userMessage = 'Network error. Please check your connection and try again.';

      if (error.message.includes('timeout')) {
        errorCode = 'TIMEOUT_ERROR';
        userMessage = 'Request timed out. Please try again.';
      } else if (error.message.includes('Failed to fetch')) {
        errorCode = 'CONNECTION_ERROR';
        userMessage = 'Unable to connect to server. Please check your internet connection.';
      }

      return {
        success: false,
        error: userMessage,
        code: errorCode,
        originalError: error.message,
        requestId
      };
    }
  }

  // If we get here, all retries failed
  apiLog('error', `All retries failed for request ${requestId}`, {
    lastError: lastError?.message
  });

  return {
    success: false,
    error: lastError?.message || 'Request failed after multiple attempts',
    code: 'RETRY_EXHAUSTED',
    requestId
  };
};

// ============================================
// AUTHENTICATION API CALLS
// ============================================

export const authAPI = {
  // ============================================
  // STUDENT AUTHENTICATION
  // ============================================
  
  studentRegister: async (userData) => {
    apiLog('info', 'Student registration request', { email: userData.email, username: userData.username });
    
    const result = await apiCall('/student/register', {
      method: 'POST',
      body: JSON.stringify({
        firstName: userData.firstName?.trim(),
        lastName: userData.lastName?.trim(),
        email: userData.email?.toLowerCase().trim(),
        username: userData.username?.trim(),
        password: userData.password,
        confirmPassword: userData.confirmPassword || userData.password,
        phone: userData.phone?.trim(),
        department: userData.department?.trim(),
        enrollmentYear: userData.enrollmentYear
      }),
    });

    if (result.success) {
      apiLog('info', 'Student registration successful');
    } else {
      apiLog('error', 'Student registration failed', { error: result.error });
    }

    return result;
  },

  studentLogin: async (credentials) => {
    apiLog('info', 'Student login request', { username: credentials.username });
    
    const result = await apiCall('/student/login', {
      method: 'POST',
      body: JSON.stringify({
        username: credentials.username?.trim(),
        password: credentials.password
      }),
    });

    if (result.success) {
      apiLog('info', 'Student login successful', { userId: result.data?.student?.id });
    } else {
      apiLog('warn', 'Student login failed', { error: result.error });
    }

    return result;
  },

  studentDashboard: async () => {
    apiLog('debug', 'Fetching student dashboard');
    
    const result = await apiCall('/student/dashboard');
    
    if (result.success) {
      apiLog('debug', 'Student dashboard loaded successfully');
    } else {
      apiLog('debug', 'Student dashboard access failed', { error: result.error });
    }

    return result;
  },

  studentProfile: async () => {
    apiLog('debug', 'Fetching student profile');
    return await apiCall('/student/profile');
  },

  updateStudentProfile: async (profileData) => {
    apiLog('info', 'Updating student profile');
    
    return await apiCall('/student/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  studentTeams: async () => {
    apiLog('debug', 'Fetching student teams');
    return await apiCall('/student/teams');
  },

  studentLogout: async () => {
    apiLog('info', 'Student logout request');
    
    const result = await apiCall('/student/logout', { method: 'POST' });
    
    if (result.success) {
      apiLog('info', 'Student logout successful');
    } else {
      apiLog('warn', 'Student logout failed', { error: result.error });
    }

    return result;
  },

  // ============================================
  // FACULTY AUTHENTICATION
  // ============================================

  facultyRegister: async (userData) => {
    apiLog('info', 'Faculty registration request', { email: userData.email, username: userData.username });
    
    const result = await apiCall('/faculty/register', {
      method: 'POST',
      body: JSON.stringify({
        firstName: userData.firstName?.trim(),
        lastName: userData.lastName?.trim(),
        email: userData.email?.toLowerCase().trim(),
        username: userData.username?.trim(),
        password: userData.password,
        confirmPassword: userData.confirmPassword || userData.password,
        department: userData.department?.trim(),
        designation: userData.designation?.trim(),
        employeeId: userData.employeeId?.trim(),
        phone: userData.phone?.trim()
      }),
    });

    if (result.success) {
      apiLog('info', 'Faculty registration successful');
    } else {
      apiLog('error', 'Faculty registration failed', { error: result.error });
    }

    return result;
  },

  facultyLogin: async (credentials) => {
    apiLog('info', 'Faculty login request', { username: credentials.username });
    
    const result = await apiCall('/faculty/login', {
      method: 'POST',
      body: JSON.stringify({
        username: credentials.username?.trim(),
        password: credentials.password
      }),
    });

    if (result.success) {
      apiLog('info', 'Faculty login successful', { userId: result.data?.faculty?.id });
    } else {
      apiLog('warn', 'Faculty login failed', { error: result.error });
    }

    return result;
  },

  facultyDashboard: async () => {
    apiLog('debug', 'Fetching faculty dashboard');
    
    const result = await apiCall('/faculty/dashboard');
    
    if (result.success) {
      apiLog('debug', 'Faculty dashboard loaded successfully');
    } else {
      apiLog('debug', 'Faculty dashboard access failed', { error: result.error });
    }

    return result;
  },

  facultyProfile: async () => {
    apiLog('debug', 'Fetching faculty profile');
    return await apiCall('/faculty/profile');
  },

  updateFacultyProfile: async (profileData) => {
    apiLog('info', 'Updating faculty profile');
    
    return await apiCall('/faculty/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  facultyLogout: async () => {
    apiLog('info', 'Faculty logout request');
    
    const result = await apiCall('/faculty/logout', { method: 'POST' });
    
    if (result.success) {
      apiLog('info', 'Faculty logout successful');
    } else {
      apiLog('warn', 'Faculty logout failed', { error: result.error });
    }

    return result;
  },

  // ============================================
  // PROJECT MANAGEMENT API CALLS
  // ============================================

  // Project Servers
  getProjectServers: async () => {
    apiLog('debug', 'Fetching project servers');
    return await apiCall('/servers');
  },

  createProjectServer: async (serverData) => {
    apiLog('info', 'Creating project server', { title: serverData.title });
    
    return await apiCall('/servers/create', {
      method: 'POST',
      body: JSON.stringify(serverData),
    });
  },

  getFacultyServers: async () => {
    apiLog('debug', 'Fetching faculty servers');
    return await apiCall('/projectServers/faculty-servers');
  },

  // Teams
  getTeams: async (serverId) => {
    apiLog('debug', 'Fetching teams', { serverId });
    return await apiCall(`/teams/server/${serverId}`);
  },

  createTeam: async (teamData) => {
    apiLog('info', 'Creating team', { name: teamData.name });
    
    return await apiCall('/teams/createTeam', {
      method: 'POST',
      body: JSON.stringify(teamData),
    });
  },

  joinTeam: async (teamId) => {
    apiLog('info', 'Joining team', { teamId });
    
    return await apiCall(`/teams/${teamId}/join`, {
      method: 'POST',
    });
  },

  // Tasks
  getTasks: async () => {
    apiLog('debug', 'Fetching tasks');
    return await apiCall('/tasks');
  },

  getStudentTasks: async () => {
    apiLog('debug', 'Fetching student tasks');
    return await apiCall('/tasks/student-tasks');
  },

  createTask: async (taskData) => {
    apiLog('info', 'Creating task', { title: taskData.title });
    
    return await apiCall('/tasks/create', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  },

  submitTask: async (taskId, submissionData) => {
    apiLog('info', 'Submitting task', { taskId });
    
    return await apiCall(`/tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify(submissionData),
    });
  },

  // ============================================
  // FILE MANAGEMENT API CALLS
  // ============================================

  uploadFiles: async (files, taskId, additionalData = {}) => {
    apiLog('info', 'Uploading files', { fileCount: files.length, taskId });

    const formData = new FormData();
    
    // Add files
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    
    // Add metadata
    if (taskId) formData.append('taskId', taskId);
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    return await apiCall('/files/upload', {
      method: 'POST',
      headers: {}, // Don't set Content-Type for FormData
      body: formData,
    });
  },

  getTaskFiles: async (taskId) => {
    apiLog('debug', 'Fetching task files', { taskId });
    return await apiCall(`/files/task/${taskId}`);
  },

  downloadFile: async (fileId) => {
    apiLog('debug', 'Downloading file', { fileId });
    
    // For file downloads, we need to handle differently
    const url = `${API_BASE}/files/download/${fileId}`;
    window.open(url, '_blank');
    
    return { success: true, message: 'Download started' };
  },

  deleteFile: async (fileId) => {
    apiLog('info', 'Deleting file', { fileId });
    
    return await apiCall(`/files/file/${fileId}`, {
      method: 'DELETE',
    });
  },

  // ============================================
  // TESTING AND DEVELOPMENT API CALLS
  // ============================================

  // Health checks
  serverHealth: async () => {
    apiLog('debug', 'Checking server health');
    return await apiCall('/health');
  },

  studentHealth: async () => {
    apiLog('debug', 'Checking student service health');
    return await apiCall('/student/health');
  },

  facultyHealth: async () => {
    apiLog('debug', 'Checking faculty service health');
    return await apiCall('/faculty/health');
  },

  // Test endpoints (development only)
  createTestUsers: async () => {
    if (process.env.NODE_ENV !== 'development') {
      return { success: false, error: 'Test endpoints only available in development' };
    }
    
    apiLog('info', 'Creating test users (development only)');
    return await apiCall('/auth-test/create-test-users', { method: 'POST' });
  },

  getUsers: async () => {
    if (process.env.NODE_ENV !== 'development') {
      return { success: false, error: 'Test endpoints only available in development' };
    }
    
    apiLog('debug', 'Fetching all users (development only)');
    return await apiCall('/auth-test/users');
  },

  quickTest: async (testData) => {
    if (process.env.NODE_ENV !== 'development') {
      return { success: false, error: 'Test endpoints only available in development' };
    }
    
    apiLog('info', 'Running quick test (development only)');
    return await apiCall('/quick-test/login', {
      method: 'POST',
      body: JSON.stringify(testData),
    });
  },

  databaseTest: async () => {
    if (process.env.NODE_ENV !== 'development') {
      return { success: false, error: 'Test endpoints only available in development' };
    }
    
    apiLog('debug', 'Testing database connection (development only)');
    return await apiCall('/quick-test/db');
  }
};

// ============================================
// GENERIC API HELPERS
// ============================================

// Helper for GET requests
export const get = (endpoint) => apiCall(endpoint, { method: 'GET' });

// Helper for POST requests
export const post = (endpoint, data) => apiCall(endpoint, {
  method: 'POST',
  body: JSON.stringify(data)
});

// Helper for PUT requests
export const put = (endpoint, data) => apiCall(endpoint, {
  method: 'PUT',
  body: JSON.stringify(data)
});

// Helper for DELETE requests
export const del = (endpoint) => apiCall(endpoint, { method: 'DELETE' });

// ============================================
// ERROR HANDLING UTILITIES
// ============================================

// Check if error is a network error
export const isNetworkError = (error) => {
  const networkCodes = ['NETWORK_ERROR', 'CONNECTION_ERROR', 'TIMEOUT_ERROR'];
  return networkCodes.includes(error.code);
};

// Check if error is an authentication error
export const isAuthError = (error) => {
  return error.status === 401 || error.code === 'TOKEN_EXPIRED' || error.code === 'NO_TOKEN';
};

// Check if error is a server error
export const isServerError = (error) => {
  return error.status >= 500 || error.code === 'SERVER_ERROR';
};

// Get user-friendly error message
export const getErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  
  if (error.error) return error.error;
  if (error.message) return error.message;
  
  // Default messages for common scenarios
  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (isAuthError(error)) {
    return 'Session expired. Please log in again.';
  }
  
  if (isServerError(error)) {
    return 'Server error. Please try again later.';
  }
  
  return 'An unexpected error occurred. Please try again.';
};

// ============================================
// EXPORT CONFIGURATION
// ============================================

// Export configuration for debugging
export const apiConfig = {
  baseUrl: API_BASE,
  timeout: REQUEST_TIMEOUT,
  retryConfig: RETRY_CONFIG,
  version: '1.0.0'
};

// Export logging function for external use
export { apiLog };

// Default export
export default {
  authAPI,
  apiCall,
  get,
  post,
  put,
  del,
  isNetworkError,
  isAuthError,
  isServerError,
  getErrorMessage,
  apiConfig,
  apiLog
};