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
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

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

  const toggleAllTeams = () => {
    if (formData.teamIds.length === teams.length) {
      setFormData(prev => ({ ...prev, teamIds: [] }));
    } else {
      setFormData(prev => ({ ...prev, teamIds: teams.map(t => t._id) }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Create New Task</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Form */}
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter task title..."
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              placeholder="Describe the task requirements..."
            />
          </div>

          {/* Assignment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign To *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                formData.assignmentType === 'teams' 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="assignmentType"
                  value="teams"
                  checked={formData.assignmentType === 'teams'}
                  onChange={handleInputChange}
                  className="sr-only"
                />
                <Users className="w-5 h-5 mr-2" />
                <span>Specific Teams</span>
              </label>
              
              <label className={`flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                formData.assignmentType === 'all' 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="assignmentType"
                  value="all"
                  checked={formData.assignmentType === 'all'}
                  onChange={handleInputChange}
                  className="sr-only"
                />
                <UserPlus className="w-5 h-5 mr-2" />
                <span>All Teams</span>
              </label>
            </div>
          </div>

          {/* Team Selection */}
          {formData.assignmentType === 'teams' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Teams
                </label>
                <button
                  type="button"
                  onClick={toggleAllTeams}
                  className="text-sm text-purple-600 hover:text-purple-700"
                >
                  {formData.teamIds.length === teams.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              {loadingTeams ? (
                <div className="text-center py-4 text-gray-500">Loading teams...</div>
              ) : teams.length === 0 ? (
                <div className="text-center py-4 text-gray-500">No teams found in this server</div>
              ) : (
                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                  {teams.map(team => (
                    <label
                      key={team._id}
                      className="flex items-center p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="teamIds"
                        value={team._id}
                        checked={formData.teamIds.includes(team._id)}
                        onChange={handleInputChange}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{team.name}</div>
                        <div className="text-sm text-gray-600">
                          {team.members?.length || 0} members
                        </div>
                      </div>
                      {formData.teamIds.includes(team._id) && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
