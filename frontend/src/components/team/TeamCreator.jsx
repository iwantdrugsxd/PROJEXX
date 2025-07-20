import React, { useState, useEffect } from 'react';
import { Users, Plus, Server, AlertCircle } from 'lucide-react';

const TeamCreator = ({ serverId, onTeamCreated, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    maxMembers: 4
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverInfo, setServerInfo] = useState(null);

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    if (serverId) {
      fetchServerInfo();
    }
  }, [serverId]);

  const fetchServerInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/projectServers/student-servers`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const server = data.servers?.find(s => s._id === serverId);
        if (server) {
          setServerInfo(server);
        }
      }
    } catch (error) {
      console.error('Failed to fetch server info:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Team name is required');
      return;
    }

    if (!serverId) {
      setError('Server ID is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🚀 Creating team:', {
        ...formData,
        serverId,
        serverCode: serverInfo?.code
      });

      const response = await fetch(`${API_BASE}/teamRoutes/createTeam`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          maxMembers: formData.maxMembers,
          serverId: serverId,
          serverCode: serverInfo?.code // Some backends might need this
        })
      });

      const data = await response.json();
      console.log('📡 Create team response:', data);

      if (response.ok && data.success) {
        console.log('✅ Team created successfully');
        onTeamCreated?.(data.team);
        onClose?.();
      } else {
        setError(data.message || 'Failed to create team');
      }
    } catch (error) {
      console.error('❌ Team creation error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center mb-4">
          <Users className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold">Create New Team</h2>
        </div>

        {serverInfo && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center text-sm text-blue-700">
              <Server className="h-4 w-4 mr-2" />
              <span>Server: {serverInfo.title}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center text-red-700">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Team Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter team name"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional team description"
              rows="3"
              disabled={loading}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Members
            </label>
            <select
              value={formData.maxMembers}
              onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value={2}>2 members</option>
              <option value={3}>3 members</option>
              <option value={4}>4 members</option>
              <option value={5}>5 members</option>
              <option value={6}>6 members</option>
            </select>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Team
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export { TeamCreator };