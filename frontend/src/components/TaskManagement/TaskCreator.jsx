import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Award, AlertCircle, Users, UserPlus, Check } from 'lucide-react';

const TaskCreator = ({ serverId, onTaskCreated, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    maxPoints: 100,
    assignmentType: 'teams', // 'teams' or 'all'
    teamIds: []
  });
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);
  
  // Fix: Use process.env with REACT_APP_ prefix instead of import.meta.env
  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    loadTeams();
  }, [serverId]);

  const loadTeams = async () => {
    setLoadingTeams(true);
    try {
      const response = await fetch(`${API_BASE}/teamRoutes/server/${serverId}/teams`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.assignmentType === 'teams' && formData.teamIds.length === 0) {
      alert('Please select at least one team');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/tasks/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          serverId: serverId,
          teamIds: formData.assignmentType === 'teams' ? formData.teamIds : [],
          assignToAll: formData.assignmentType === 'all',
          dueDate: formData.dueDate,
          maxPoints: formData.maxPoints
        })
      });

      const data = await response.json();
      
      if (data.success) {
        onTaskCreated(data);
        onClose();
      } else {
        alert(data.message || 'Failed to create task');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'teamIds') {
      setFormData(prev => ({
        ...prev,
        teamIds: checked 
          ? [...prev.teamIds, value]
          : prev.teamIds.filter(id => id !== value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  // Rest of your component code...
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Create New Task</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter task title"
            />
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Describe the task requirements..."
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date *
            </label>
            <input
              type="datetime-local"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Max Points */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Points
            </label>
            <input
              type="number"
              name="maxPoints"
              value={formData.maxPoints}
              onChange={handleInputChange}
              min="1"
              max="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Assignment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Assignment Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="assignmentType"
                  value="teams"
                  checked={formData.assignmentType === 'teams'}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                <span>Assign to specific teams</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="assignmentType"
                  value="all"
                  checked={formData.assignmentType === 'all'}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                <span>Assign to all teams</span>
              </label>
            </div>
          </div>

          {/* Team Selection */}
          {formData.assignmentType === 'teams' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Teams *
              </label>
              {loadingTeams ? (
                <div className="text-gray-500">Loading teams...</div>
              ) : teams.length === 0 ? (
                <div className="text-gray-500">No teams available</div>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {teams.map(team => (
                    <label key={team._id} className="flex items-center">
                      <input
                        type="checkbox"
                        name="teamIds"
                        value={team._id}
                        checked={formData.teamIds.includes(team._id)}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <span>{team.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskCreator;