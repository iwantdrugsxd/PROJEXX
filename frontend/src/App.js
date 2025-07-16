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
      // Check faculty authentication first
      const facultyResponse = await fetch(`${API_BASE}/faculty/dashboard`, {
        credentials: 'include'
      });
      
      if (facultyResponse.ok) {
        const data = await facultyResponse.json();
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
        setUser({ ...data, role: 'student' });
        setCurrentView('dashboard');
        setUserType('student');
        setLoading(false);
        return;
      }
      
      // No active session
      setLoading(false);
    } catch (error) {
      console.log('No active session');
      setLoading(false);
    }
  };

  // ✅ CORRECTED: Single logout function with proper role-based endpoints
  const handleLogout = async () => {
    try {
      // Use correct endpoint based on user role
      const endpoint = user?.role === 'faculty' ? 'faculty' : 'student';
      console.log(`Logging out ${endpoint}...`);
      
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
      console.error('Logout API failed:', error);
    } finally {
      // Clear all client-side state regardless of API response
      setUser(null);
      setCurrentView('landing');
      setUserType('student'); // Reset to default
      
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
    setUser(userData);
    setCurrentView('dashboard');
    setUserType(userData.role);
  };

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

  return (
    <AuthContext.Provider value={{ 
      user, 
      setUser, 
      userType, 
      setUserType, 
      currentView, 
      setCurrentView,
      handleLogout  // ✅ Provide logout function to all components
    }}>
      <div className="min-h-screen bg-white">
        {currentView === 'landing' && <LandingPage />}
        {currentView === 'login' && <LoginPage />}
        {currentView === 'register' && <RegisterPage />}
        {currentView === 'dashboard' && userType === 'student' && (
          <StudentDashboard user={user} onLogout={handleLogout} />
        )}
        {currentView === 'dashboard' && userType === 'faculty' && (
          <FacultyDashboard user={user} onLogout={handleLogout} />
        )}
      </div>
    </AuthContext.Provider>
  );
}

export default App;