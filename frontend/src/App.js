// frontend/src/App.js - COMPLETE FIXED VERSION
import React, { useState, useEffect, createContext } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import StudentDashboard from './components/StudentDashboard';
import FacultyDashboard from './components/FacultyDashboard';
import { authAPI } from './utils/api.js';

// Create context for global state management
export const AuthContext = createContext();

// API base URL configuration
export const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

function App() {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('landing');
  const [userType, setUserType] = useState('student');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================
  useEffect(() => {
    console.log('🚀 App component mounted - checking authentication status');
    checkAuthStatus();
  }, []);

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔍 App state changed:', {
      currentView,
      userType,
      hasUser: !!user,
      loading,
      error
    });
  }, [currentView, userType, user, loading, error]);

  // ============================================
  // AUTHENTICATION FUNCTIONS
  // ============================================

  // Enhanced authentication status check
  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Checking authentication status...');
      setLoading(true);
      setError('');
      
      // Check faculty authentication first
      console.log('👨‍🏫 Checking faculty authentication...');
      const facultyResult = await authAPI.facultyDashboard();
      
      if (facultyResult.success) {
        console.log('✅ Faculty authentication successful:', facultyResult.data);
        const facultyUser = {
          ...facultyResult.data.faculty,
          role: 'faculty',
          dashboardData: facultyResult.data
        };
        setUser(facultyUser);
        setCurrentView('dashboard');
        setUserType('faculty');
        setLoading(false);
        return;
      } else {
        console.log('❌ Faculty authentication failed:', facultyResult.error);
      }
      
      // Check student authentication
      console.log('👨‍🎓 Checking student authentication...');
      const studentResult = await authAPI.studentDashboard();
      
      if (studentResult.success) {
        console.log('✅ Student authentication successful:', studentResult.data);
        const studentUser = {
          ...studentResult.data.student,
          role: 'student',
          dashboardData: studentResult.data
        };
        setUser(studentUser);
        setCurrentView('dashboard');
        setUserType('student');
        setLoading(false);
        return;
      } else {
        console.log('❌ Student authentication failed:', studentResult.error);
      }
      
      // No active session found
      console.log('ℹ️ No active session found - user needs to login');
      setUser(null);
      setCurrentView('landing');
      setLoading(false);
      
    } catch (error) {
      console.error('❌ Authentication check failed:', error);
      setError('Failed to check authentication status');
      setUser(null);
      setCurrentView('landing');
      setLoading(false);
    }
  };

  // Enhanced login handler
  const handleLogin = async (userData) => {
    try {
      console.log('✅ Login successful - processing user data:', userData);
      
      // Determine user role and structure data correctly
      const role = userData.role || userType;
      const userInfo = userData.student || userData.faculty || userData;
      
      const processedUser = {
        ...userInfo,
        role: role,
        dashboardData: userData
      };
      
      console.log('📝 Setting user data:', processedUser);
      
      setUser(processedUser);
      setCurrentView('dashboard');
      setUserType(role);
      setError('');
      
      // Show success message
      console.log(`🎉 Welcome ${processedUser.firstName || processedUser.username}!`);
      
    } catch (error) {
      console.error('❌ Login handler error:', error);
      setError('Failed to process login data');
    }
  };

  // Enhanced logout handler
  const handleLogout = async () => {
    try {
      console.log(`🔓 Logging out ${user?.role || 'unknown'} user...`);
      
      // Call appropriate logout API
      const logoutResult = user?.role === 'faculty' 
        ? await authAPI.facultyLogout()
        : await authAPI.studentLogout();
      
      if (logoutResult.success) {
        console.log('✅ Logout API call successful');
      } else {
        console.warn('⚠️ Logout API call failed, but proceeding with frontend logout');
      }
      
    } catch (error) {
      console.error('❌ Logout API failed:', error);
    } finally {
      // Always clear client-side state regardless of API response
      console.log('🧹 Clearing client-side state...');
      
      setUser(null);
      setCurrentView('landing');
      setUserType('student');
      setError('');
      
      // Clear any stored tokens/data
      try {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');
        
        // Clear cookies (frontend side)
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
      } catch (storageError) {
        console.warn('⚠️ Error clearing storage:', storageError);
      }
      
      console.log('✅ User logged out successfully');
    }
  };

  // ============================================
  // NAVIGATION HANDLERS
  // ============================================
  
  const navigateToLogin = () => {
    console.log('🔑 Navigating to login page');
    setCurrentView('login');
    setError('');
  };

  const navigateToRegister = () => {
    console.log('📝 Navigating to register page');
    setCurrentView('register');
    setError('');
  };

  const navigateToLanding = () => {
    console.log('🏠 Navigating to landing page');
    setCurrentView('landing');
    setError('');
  };

  // ============================================
  // LOADING SCREEN
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading ProjectFlow</h2>
          <p className="text-gray-500">Please wait while we set up your workspace...</p>
          
          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 text-xs text-gray-400">
              <p>Current View: {currentView}</p>
              <p>User Type: {userType}</p>
              <p>Has User: {user ? 'Yes' : 'No'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // ERROR SCREEN
  // ============================================
  if (error && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-white text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-red-700 mb-2">Connection Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => {
              setError('');
              checkAuthStatus();
            }}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN APPLICATION RENDER
  // ============================================
  return (
    <AuthContext.Provider value={{ 
      // User state
      user, 
      setUser, 
      userType, 
      setUserType, 
      
      // Navigation state
      currentView, 
      setCurrentView,
      
      // Loading and error state
      loading,
      error,
      setError,
      
      // Action handlers
      handleLogin,
      handleLogout,
      checkAuthStatus,
      
      // Navigation helpers
      navigateToLogin,
      navigateToRegister,
      navigateToLanding,
      
      // API configuration
      API_BASE
    }}>
      <div className="min-h-screen bg-white">
        
        {/* Development Debug Panel */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed top-0 right-0 bg-black bg-opacity-75 text-white p-2 text-xs z-50 max-w-xs">
            <div>View: {currentView}</div>
            <div>Type: {userType}</div>
            <div>User: {user ? `${user.firstName || user.username}` : 'None'}</div>
            <div>Loading: {loading ? 'Yes' : 'No'}</div>
            {error && <div className="text-red-300">Error: {error}</div>}
          </div>
        )}

        {/* ============================================ */}
        {/* LANDING PAGE */}
        {/* ============================================ */}
        {currentView === 'landing' && (
          <div>
            {console.log('🏠 Rendering LandingPage')}
            <LandingPage 
              onLogin={navigateToLogin}
              onRegister={navigateToRegister}
            />
          </div>
        )}

        {/* ============================================ */}
        {/* LOGIN PAGE */}
        {/* ============================================ */}
        {currentView === 'login' && (
          <div>
            {console.log('🔑 Rendering LoginPage')}
            <LoginPage 
              onLogin={handleLogin}
              onBack={navigateToLanding}
              onRegister={navigateToRegister}
              userType={userType}
              setUserType={setUserType}
              error={error}
              setError={setError}
            />
          </div>
        )}

        {/* ============================================ */}
        {/* REGISTER PAGE */}
        {/* ============================================ */}
        {currentView === 'register' && (
          <div>
            {console.log('📝 Rendering RegisterPage')}
            <RegisterPage 
              onRegister={handleLogin}
              onBack={navigateToLanding}
              onLogin={navigateToLogin}
              userType={userType}
              setUserType={setUserType}
              error={error}
              setError={setError}
            />
          </div>
        )}

        {/* ============================================ */}
        {/* STUDENT DASHBOARD */}
        {/* ============================================ */}
        {currentView === 'dashboard' && userType === 'student' && user && (
          <div>
            {console.log('🎓 Rendering StudentDashboard for:', user.username)}
            <StudentDashboard 
              user={user} 
              onLogout={handleLogout}
              dashboardData={user.dashboardData}
            />
          </div>
        )}

        {/* ============================================ */}
        {/* FACULTY DASHBOARD */}
        {/* ============================================ */}
        {currentView === 'dashboard' && userType === 'faculty' && user && (
          <div>
            {console.log('👨‍🏫 Rendering FacultyDashboard for:', user.username)}
            <FacultyDashboard 
              user={user} 
              onLogout={handleLogout}
              dashboardData={user.dashboardData}
            />
          </div>
        )}

        {/* ============================================ */}
        {/* DASHBOARD WITHOUT USER (ERROR STATE) */}
        {/* ============================================ */}
        {currentView === 'dashboard' && !user && (
          <div className="min-h-screen bg-yellow-50 flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-6">
              <div className="w-16 h-16 bg-yellow-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <span className="text-white text-2xl">⚠️</span>
              </div>
              <h1 className="text-2xl font-bold text-yellow-600 mb-4">Session Error</h1>
              <p className="text-yellow-700 mb-4">
                You're supposed to be on the dashboard, but no user data is available.
              </p>
              <div className="space-x-3">
                <button 
                  onClick={checkAuthStatus}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors duration-200"
                >
                  Check Auth
                </button>
                <button 
                  onClick={navigateToLanding}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* FALLBACK: INVALID VIEW */}
        {/* ============================================ */}
        {!['landing', 'login', 'register', 'dashboard'].includes(currentView) && (
          <div className="min-h-screen bg-red-50 flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-6">
              <div className="w-16 h-16 bg-red-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <span className="text-white text-2xl">🚫</span>
              </div>
              <h1 className="text-2xl font-bold text-red-600 mb-4">Error: Invalid View</h1>
              <p className="text-red-500 mb-2">Current view: <code className="bg-red-100 px-2 py-1 rounded">{currentView}</code></p>
              <p className="text-red-500 mb-4">This view doesn't exist in the application.</p>
              <button 
                onClick={navigateToLanding}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
              >
                Go to Landing Page
              </button>
            </div>
          </div>
        )}

      </div>
    </AuthContext.Provider>
  );
}

export default App;