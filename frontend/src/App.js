import React, { useState, useEffect, createContext } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import StudentDashboard from './components/StudentDashboard';
import FacultyDashboard from './components/FacultyDashboard';

export const AuthContext = createContext();
export const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('landing');
  const [userType, setUserType] = useState('student');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Checking authentication status...');
      
      // Check faculty authentication first
      const facultyResponse = await fetch(`${API_BASE}/faculty/dashboard`, {
        credentials: 'include'
      });
      
      if (facultyResponse.ok) {
        const data = await facultyResponse.json();
        console.log('✅ Faculty authentication successful');
        setUser({ ...data, role: 'faculty' });
        setCurrentView('dashboard');
        setUserType('faculty');
        setLoading(false);
        return;
      }
      
      // Check student authentication
      const studentResponse = await fetch(`${API_BASE}/student/dashboard`, {
        credentials: 'include'
      });
      
      if (studentResponse.ok) {
        const data = await studentResponse.json();
        console.log('✅ Student authentication successful');
        setUser({ ...data, role: 'student' });
        setCurrentView('dashboard');
        setUserType('student');
        setLoading(false);
        return;
      }
      
      // No active session
      console.log('ℹ️ No active session found');
      setLoading(false);
    } catch (error) {
      console.log('❌ Authentication check failed:', error);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const endpoint = user?.role === 'faculty' ? 'faculty' : 'student';
      console.log(`🔓 Logging out ${endpoint}...`);
      
      const response = await fetch(`${API_BASE}/${endpoint}/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('✅ Logout API call successful');
      } else {
        console.warn('⚠️ Logout response not OK, but proceeding with frontend logout');
      }
      
    } catch (error) {
      console.error('❌ Logout API failed:', error);
    } finally {
      // Clear all client-side state regardless of API response
      setUser(null);
      setCurrentView('landing');
      setUserType('student');
      
      // Clear localStorage
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      
      // Clear cookies
      document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      console.log('✅ User logged out successfully');
    }
  };

  // Handle successful login
  const handleLogin = (userData) => {
    console.log('✅ Login successful:', userData);
    setUser(userData);
    setCurrentView('dashboard');
    setUserType(userData.role);
  };

  // ✅ DEBUGGING: Add console logs to see what's happening
  console.log('🔍 App render state:', {
    loading,
    currentView,
    userType,
    hasUser: !!user
  });

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading ProjectFlow</h2>
          <p className="text-gray-500">Please wait while we set up your workspace...</p>
        </div>
      </div>
    );
  }

  // ✅ MAIN APP RENDER
  return (
    <AuthContext.Provider value={{ 
      user, 
      setUser, 
      userType, 
      setUserType, 
      currentView, 
      setCurrentView,
      handleLogin,
      handleLogout
    }}>
      <div className="min-h-screen bg-white">
        {/* ✅ DEBUGGING: Show current view in console and as hidden div */}
        <div style={{ display: 'none' }}>
          Current View: {currentView}, User Type: {userType}, User: {user ? 'Yes' : 'No'}
        </div>

        {/* ✅ LANDING PAGE */}
        {currentView === 'landing' && (
          <div>
            {console.log('🏠 Rendering LandingPage')}
            <LandingPage 
              onLogin={() => setCurrentView('login')}
              onRegister={() => setCurrentView('register')}
            />
          </div>
        )}

        {/* ✅ LOGIN PAGE */}
        {currentView === 'login' && (
          <div>
            {console.log('🔑 Rendering LoginPage')}
            <LoginPage 
              onLogin={handleLogin}
              onBack={() => setCurrentView('landing')}
              onRegister={() => setCurrentView('register')}
              setUserType={setUserType}
            />
          </div>
        )}

        {/* ✅ REGISTER PAGE */}
        {currentView === 'register' && (
          <div>
            {console.log('📝 Rendering RegisterPage')}
            <RegisterPage 
              onRegister={handleLogin}
              onBack={() => setCurrentView('landing')}
              onLogin={() => setCurrentView('login')}
              setUserType={setUserType}
            />
          </div>
        )}

        {/* ✅ STUDENT DASHBOARD */}
        {currentView === 'dashboard' && userType === 'student' && (
          <div>
            {console.log('🎓 Rendering StudentDashboard')}
            <StudentDashboard 
              user={user} 
              onLogout={handleLogout} 
            />
          </div>
        )}

        {/* ✅ FACULTY DASHBOARD */}
        {currentView === 'dashboard' && userType === 'faculty' && (
          <div>
            {console.log('👨‍🏫 Rendering FacultyDashboard')}
            <FacultyDashboard 
              user={user} 
              onLogout={handleLogout} 
            />
          </div>
        )}

        {/* ✅ FALLBACK: If no view matches */}
        {!['landing', 'login', 'register', 'dashboard'].includes(currentView) && (
          <div className="min-h-screen bg-red-50 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">Error: Invalid View</h1>
              <p className="text-red-500 mb-4">Current view: {currentView}</p>
              <button 
                onClick={() => setCurrentView('landing')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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