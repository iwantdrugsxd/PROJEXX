// src/components/TeamCreator.jsx
import React, { useState, useEffect } from 'react';
import { Users, Plus, AlertCircle, CheckCircle, Loader2, X, Server } from 'lucide-react';

const TeamCreator = ({ onTeamCreated, onClose, user }) => {
  const [teamData, setTeamData] = useState({
    name: '',
    description: '',
    serverId: ''
  });
  const [servers, setServers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  // Fetch available servers on component mount
  useEffect(() => {
    fetchAvailableServers();
  }, []);

  const fetchAvailableServers = async () => {
    try {
      console.log('🔍 Fetching available servers for team creation...');
      
      // Get user from props or fallback methods
      const userId = user?.id || user?._id ||
                   localStorage.getItem('userId') || 
                   sessionStorage.getItem('userId') || 
                   window.currentUser?.id || 
                   window.currentUser?._id;
      
      if (!userId) {
        setError('User ID not found. Please log in again.');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${API_BASE}/projectServers/student-servers?studentId=${userId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setServers(data.servers || []);
          // Auto-select first server if only one available
          if (data.servers?.length === 1) {
            setTeamData(prev => ({ ...prev, serverId: data.servers[0]._id }));
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch servers:', error);
      setError('Failed to load available servers');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTeamData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();

    if (!teamData.name.trim()) {
      setError('Team name is required');
      return;
    }

    if (!teamData.serverId) {
      setError('Please select a server');
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

    setCreating(true);
    setError('');
    setSuccess(false);

    try {
      console.log('🚀 Creating team:', teamData);

      const response = await fetch(`${API_BASE}/teams/createTeam`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: teamData.name.trim(),
          description: teamData.description.trim(),
          projectServer: teamData.serverId,  // This should be the server CODE, not ID
          userId: userId,  // Add userId for no-auth backend
          userRole: 'student'  // Add userRole
        })
      });

      const data = await response.json();
      console.log('📡 Create team response:', data);

      if (response.ok && data.success) {
        console.log('✅ Successfully created team');
        setSuccess(true);
        onTeamCreated?.(data.team);
        
        setTimeout(() => {
          onClose?.();
        }, 1500);
      } else {
        if (response.status === 400) {
          setError(data.message || 'Invalid team data');
        } else if (response.status === 401) {
          setError('Please log in to create a team');
        } else if (response.status === 403) {
          setError('Access denied - check your permissions');
        } else {
          setError(data.message || 'Failed to create team');
        }
      }
    } catch (error) {
      console.error('❌ Create team error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading servers...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Users className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold">Create Team</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={creating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <h3 className="text-lg font-medium text-green-700">Success!</h3>
            <p className="text-sm text-gray-600">Team created successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleCreateTeam}>
            {/* Team Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team Name *
              </label>
              <input
                type="text"
                name="name"
                value={teamData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter team name"
                disabled={creating}
                required
                maxLength={100}
              />
            </div>

            {/* Team Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={teamData.description}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of your team (optional)"
                disabled={creating}
                maxLength={500}
              />
            </div>

            {/* Server Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Server *
              </label>
              {servers.length > 0 ? (
                <select
                  name="serverId"
                  value={teamData.serverId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={creating}
                  required
                >
                  <option value="">Choose a server</option>
                  {servers.map(server => (
                    <option key={server._id} value={server.code}>
                      {server.title} ({server.code})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center text-yellow-700">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span className="text-sm">No servers available. Join a server first to create a team.</span>
                  </div>
                </div>
              )}
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
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                disabled={creating || !teamData.name.trim() || !teamData.serverId || servers.length === 0}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Create Team
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

export default TeamCreator;