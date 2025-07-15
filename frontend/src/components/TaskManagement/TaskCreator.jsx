import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Award, X, Server, Users } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000/api';

const TaskCreator = ({ onTaskCreated, currentServerId = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingServers, setLoadingServers] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  
  const [servers, setServers] = useState([]);
  const [teams, setTeams] = useState([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    serverId: currentServerId || '',
    teamId: '',
    dueDate: '',
    maxPoints: 100
  });

  // Load servers when component mounts or modal opens
  useEffect(() => {
    if (isOpen) {
      loadServers();
      if (formData.serverId) {
        loadTeamsForServer(formData.serverId);
      }
    }
  }, [isOpen]);

  // Load teams when server changes
  useEffect(() => {
    if (formData.serverId) {
      loadTeamsForServer(formData.serverId);
      setFormData(prev => ({ ...prev, teamId: '' })); // Reset team selection
    } else {
      setTeams([]);
    }
  }, [formData.serverId]);

  // Load available servers for faculty
  const loadServers = async () => {
    setLoadingServers(true);
    try {
      const response = await fetch(`${API_BASE}/projectServers/faculty-servers`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setServers(data.servers || []);
      } else {
        console.error('Failed to load servers:', response.status);
        setServers([]);
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
      setServers([]);
    } finally {
      setLoadingServers(false);
    }
  };

  // Load teams for selected server
  const loadTeamsForServer = async (serverId) => {
    if (!serverId) return;
    
    setLoadingTeams(true);
    try {
      const response = await fetch(`${API_BASE}/teamRoutes/server/${serverId}/teams`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      } else {
        console.error('Failed to load teams:', response.status);
        setTeams([]);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      alert('Task title is required');
      return;
    }
    
    if (!formData.description.trim()) {
      alert('Task description is required');
      return;
    }
    
    if (!formData.serverId) {
      alert('Please select a project server');
      return;
    }
    
    if (!formData.teamId) {
      alert('Please select a team');
      return;
    }
    
    if (!formData.dueDate) {
      alert('Due date is required');
      return;
    }

    // Check if due date is in the past
    if (new Date(formData.dueDate) <= new Date()) {
      alert('Due date must be in the future');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/tasks/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          serverId: formData.serverId,
          teamId: formData.teamId,
          dueDate: formData.dueDate,
          maxPoints: parseInt(formData.maxPoints) || 100
        })
      });

      const data = await response.json();
      
      if (data.success) {
        if (onTaskCreated) {
          onTaskCreated(data.task);
        }
        resetForm();
        alert('Task created successfully!');
      } else {
        alert(data.message || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      serverId: currentServerId || '',
      teamId: '',
      dueDate: '',
      maxPoints: 100
    });
    setIsOpen(false);
    setTeams([]);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
      >
        <Plus size={20} />
        <span>Create Task</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Create New Task</h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Task Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter task title"
                />
              </div>

              {/* Project Server Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Server size={16} className="inline mr-1" />
                  Project Server *
                </label>
                <select
                  name="serverId"
                  value={formData.serverId}
                  onChange={handleInputChange}
                  required
                  disabled={loadingServers || currentServerId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">
                    {loadingServers ? 'Loading servers...' : 'Select a project server'}
                  </option>
                  {servers.map((server) => (
                    <option key={server._id} value={server._id}>
                      {server.title} ({server.code})
                    </option>
                  ))}
                </select>
                {currentServerId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Server is pre-selected and cannot be changed
                  </p>
                )}
              </div>

              {/* Team Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users size={16} className="inline mr-1" />
                  Assign to Team *
                </label>
                <select
                  name="teamId"
                  value={formData.teamId}
                  onChange={handleInputChange}
                  required
                  disabled={!formData.serverId || loadingTeams}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">
                    {loadingTeams 
                      ? 'Loading teams...' 
                      : !formData.serverId 
                        ? 'Select a server first'
                        : teams.length === 0
                          ? 'No teams available'
                          : 'Select a team'
                    }
                  </option>
                  {teams.map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                {formData.serverId && teams.length === 0 && !loadingTeams && (
                  <p className="text-xs text-orange-600 mt-1">
                    No teams found in this server. Students need to create teams first.
                  </p>
                )}
              </div>

              {/* Task Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Describe the task requirements, objectives, and any specific instructions..."
                />
              </div>

              {/* Due Date and Max Points */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar size={16} className="inline mr-1" />
                    Due Date *
                  </label>
                  <input
                    type="datetime-local"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={handleInputChange}
                    required
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Award size={16} className="inline mr-1" />
                    Max Points
                  </label>
                  <input
                    type="number"
                    name="maxPoints"
                    value={formData.maxPoints}
                    onChange={handleInputChange}
                    min="1"
                    max="1000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="100"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.serverId || !formData.teamId}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskCreator;