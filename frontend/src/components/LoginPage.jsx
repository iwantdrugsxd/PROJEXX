import React, { useState, useContext } from 'react';
import { AuthContext, API_BASE } from '../App';
import { BookOpen, ArrowLeft, Eye, EyeOff } from 'lucide-react';

function LoginPage() {
  const { setUser, userType, setUserType, setCurrentView } = useContext(AuthContext);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Sanitize username to remove any appended paths
      const sanitizedUsername = formData.username.split(' ')[0];
      const loginData = { ...formData, username: sanitizedUsername };

      const endpoint = userType === 'faculty' ? 'faculty' : 'student';
      const response = await fetch(`${API_BASE}/${endpoint}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginData)
      });

      const data = await response.json();
      
      if (response.ok) {
        setUser({ ...data[userType], role: userType });
        setCurrentView('dashboard');
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Back Button */}
          <button
            onClick={() => setCurrentView('landing')}
            className="flex items-center space-x-2 text-gray-600 hover:text-purple-600 mb-8 transition-colors duration-200"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center transform hover:scale-110 transition-transform duration-300">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Sign in to continue your journey</p>
          </div>

          {/* User Type Toggle */}
          <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
            <button
              onClick={() => setUserType('student')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                userType === 'student'
                  ? 'bg-white text-purple-600 shadow-lg transform scale-105'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              Student
            </button>
            <button
              onClick={() => setUserType('faculty')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                userType === 'faculty'
                  ? 'bg-white text-purple-600 shadow-lg transform scale-105'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              Faculty
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 animate-pulse">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-gray-700 font-medium mb-2">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all duration-300"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all duration-300"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                <span className="ml-2 text-sm text-gray-600">Remember me</span>
              </label>
              <button type="button" className="text-sm text-purple-600 hover:text-purple-700 transition-colors duration-200">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 px-4 rounded-xl font-medium hover:from-purple-600 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-purple-100 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="text-center mt-6">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => setCurrentView('register')}
                className="text-purple-600 font-medium hover:text-purple-700 transition-colors duration-300"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Decorative */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-purple-500 via-indigo-600 to-purple-700 relative overflow-hidden">
        {/* Floating Elements */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-white/20 rounded-full blur-lg animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-white/15 rounded-full blur-md animate-pulse delay-500"></div>
        
        {/* Content */}
        <div className="flex items-center justify-center p-12 relative z-10">
          <div className="text-center text-white space-y-8">
            <h2 className="text-4xl font-bold">Welcome to ProjectFlow</h2>
            <p className="text-xl text-purple-100 max-w-md">
              Join thousands of educators and students creating amazing projects together.
            </p>
            
            {/* Feature Pills */}
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm">Real-time Collaboration</span>
              </div>
              <div className="flex items-center justify-center space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-sm">Smart Project Management</span>
              </div>
              <div className="flex items-center justify-center space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className="text-sm">Advanced Analytics</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;