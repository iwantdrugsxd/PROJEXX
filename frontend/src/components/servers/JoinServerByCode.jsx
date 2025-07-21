// src/components/JoinServerByCode.jsx
import React, { useState } from 'react';
import { Server, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';

const JoinServerByCode = ({ onServerJoined, onClose, user }) => {
  const [serverCode, setServerCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  const handleJoinServer = async (e) => {
    e.preventDefault();

    if (!serverCode.trim()) {
      setError('Server code is required');
      return;
    }

    // Get user ID from props or fallback methods
    const userId = user?.id || user?._id ||
                   localStorage.getItem('userId') || 
                   sessionStorage.getItem('userId') || 
                   window.currentUser?.id || 
                   window.currentUser?._id;

    if (!userId) {
      setError('User ID not found. Please log in again.');
      return;
    }

    setJoining(true);
    setError('');
    setSuccess(false);

    try {
      console.log('🚀 Attempting to join server with code:', serverCode);

      const response = await fetch(`${API_BASE}/projectServers/join`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          code: serverCode.trim().toUpperCase(),
          studentId: userId,  // Your backend expects studentId
          userRole: 'student'  // Add userRole
        })
      });

      const data = await response.json();
      console.log('📡 Join server response:', data);

      if (response.ok && data.success) {
        console.log('✅ Successfully joined server');
        setSuccess(true);
        onServerJoined?.(data.server);
        
        setTimeout(() => {
          onClose?.();
        }, 1500);
      } else {
        if (response.status === 400) {
          setError(data.message || 'Invalid server code');
        } else if (response.status === 401) {
          setError('Please log in to join a server');
        } else if (response.status === 403) {
          setError('Access denied - check your permissions');
        } else if (response.status === 404) {
          setError('Server not found with this code');
        } else {
          setError(data.message || 'Failed to join server');
        }
      }
    } catch (error) {
      console.error('❌ Join server error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Server className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold">Join Server</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={joining}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <h3 className="text-lg font-medium text-green-700">Success!</h3>
            <p className="text-sm text-gray-600">You've joined the server successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleJoinServer}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Server Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={serverCode}
                  onChange={(e) => setServerCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono tracking-wider"
                  placeholder="ABCD12"
                  maxLength={6}
                  disabled={joining}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Ask your instructor for the 6-character server code
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center text-red-700">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                disabled={joining}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                disabled={joining || !serverCode.trim()}
              >
                {joining ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Server className="h-4 w-4 mr-1" />
                    Join Server
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default JoinServerByCode;