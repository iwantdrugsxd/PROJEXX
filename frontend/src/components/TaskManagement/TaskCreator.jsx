// ===== 2. frontend/src/components/TaskManagement/TaskCreator.jsx (COMPLETE FILE) =====
import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Award, 
  AlertCircle, 
  Users, 
  UserPlus, 
  Check, 
  Loader2,
  Plus,
  Minus,
  FileText,
  Target,
  Send
} from 'lucide-react';

const TaskCreator = ({ serverId, serverTitle, onTaskCreated, onClose }) => {
  // ✅ FIXED: Form state with proper array initialization
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    maxPoints: 100,
    assignmentType: 'team',
    teamIds: [], // ✅ Always an array
    assignToAll: false,
    allowLateSubmissions: false,
    maxAttempts: 1,
    allowFileUpload: true,
    allowedFileTypes: ['pdf', 'doc', 'docx'], // ✅ Default to common types
    maxFileSize: 10485760, // 10MB
    priority: 'medium'
  });

  // UI state
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [errors, setErrors] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Constants
  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
  
  // ✅ File types that match backend validation
  const fileTypeOptions = [
    { value: 'pdf', label: 'PDF' },
    { value: 'doc', label: 'Word Doc' },
    { value: 'docx', label: 'Word Docx' },
    { value: 'txt', label: 'Text File' },
    { value: 'jpg', label: 'JPEG Image' },
    { value: 'jpeg', label: 'JPEG Image (Alt)' },
    { value: 'png', label: 'PNG Image' },
    { value: 'gif', label: 'GIF Image' },
    { value: 'zip', label: 'ZIP Archive' },
    { value: 'rar', label: 'RAR Archive' }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'text-green-600 bg-green-50' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600 bg-yellow-50' },
    { value: 'high', label: 'High', color: 'text-orange-600 bg-orange-50' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-600 bg-red-50' }
  ];

  // ✅ SAFETY: Ensure arrays are always arrays
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      teamIds: Array.isArray(prev.teamIds) ? prev.teamIds : [],
      allowedFileTypes: Array.isArray(prev.allowedFileTypes) ? prev.allowedFileTypes : ['pdf', 'doc', 'docx']
    }));
  }, []);

  // Load teams on component mount
  useEffect(() => {
    if (serverId) {
      loadTeams();
    }
  }, [serverId]);

  const loadTeams = useCallback(async () => {
    setLoadingTeams(true);
    setErrors(prev => ({ ...prev, teams: null }));
    
    try {
      const response = await fetch(`${API_BASE}/tasks/server/${serverId}/teams`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setTeams(data.teams || []);
        if (data.teams.length === 0) {
          setErrors(prev => ({ 
            ...prev, 
            teams: 'No teams found in this server. Students need to create teams first.'
          }));
        }
      } else {
        setErrors(prev => ({ 
          ...prev, 
          teams: data.message || 'Failed to load teams' 
        }));
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
      setErrors(prev => ({ 
        ...prev, 
        teams: 'Network error. Please check your connection.' 
      }));
    } finally {
      setLoadingTeams(false);
    }
  }, [serverId, API_BASE]);

  // ✅ FIXED: Validation with proper array checks
  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Task title is required';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters long';
    } else if (formData.title.trim().length > 200) {
      newErrors.title = 'Title cannot exceed 200 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Task description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters long';
    } else if (formData.description.trim().length > 2000) {
      newErrors.description = 'Description cannot exceed 2000 characters';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    } else {
      const dueDate = new Date(formData.dueDate);
      const now = new Date();
      if (dueDate <= now) {
        newErrors.dueDate = 'Due date must be in the future';
      }
    }

    // ✅ SAFETY: Check if teamIds is array and has length
    const teamIds = Array.isArray(formData.teamIds) ? formData.teamIds : [];
    if (formData.assignmentType === 'team' && !formData.assignToAll && teamIds.length === 0) {
      newErrors.teams = 'Please select at least one team or choose "Assign to All Teams"';
    }

    if (!formData.maxPoints || formData.maxPoints < 1 || formData.maxPoints > 1000) {
      newErrors.maxPoints = 'Points must be between 1 and 1000';
    }

    if (!formData.maxAttempts || formData.maxAttempts < 1 || formData.maxAttempts > 10) {
      newErrors.maxAttempts = 'Maximum attempts must be between 1 and 10';
    }

    // ✅ SAFETY: Check if allowedFileTypes is array
    const allowedFileTypes = Array.isArray(formData.allowedFileTypes) ? formData.allowedFileTypes : [];
    if (formData.allowFileUpload && allowedFileTypes.length === 0) {
      newErrors.allowedFileTypes = 'Please select at least one allowed file type when file upload is enabled';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ FIXED: Safe form handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'teamIds') {
      setFormData(prev => {
        // ✅ SAFETY: Ensure teamIds is always an array
        const currentTeamIds = Array.isArray(prev.teamIds) ? prev.teamIds : [];
        
        return {
          ...prev,
          teamIds: checked 
            ? [...currentTeamIds, value]
            : currentTeamIds.filter(id => id !== value)
        };
      });
    } else if (name === 'allowedFileTypes') {
      setFormData(prev => {
        // ✅ SAFETY: Ensure allowedFileTypes is always an array
        const currentFileTypes = Array.isArray(prev.allowedFileTypes) ? prev.allowedFileTypes : [];
        
        return {
          ...prev,
          allowedFileTypes: checked
            ? [...currentFileTypes, value]
            : currentFileTypes.filter(type => type !== value)
        };
      });
      
      // Clear error when user selects file types
      if (checked && errors.allowedFileTypes) {
        setErrors(prev => ({ ...prev, allowedFileTypes: null }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }

    // Clear related errors
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSelectAllTeams = () => {
    setFormData(prev => ({
      ...prev,
      assignToAll: true,
      teamIds: []
    }));
    if (errors.teams) {
      setErrors(prev => ({ ...prev, teams: null }));
    }
  };

  const handleSelectSpecificTeams = () => {
    setFormData(prev => ({
      ...prev,
      assignToAll: false
    }));
  };

  // ✅ FIXED: Submit handler with debugging
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('🔍 Form submission - allowedFileTypes:', formData.allowedFileTypes);
    console.log('🔍 Form submission - teamIds:', formData.teamIds);
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      const requestBody = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        serverId: serverId,
        dueDate: formData.dueDate,
        maxPoints: parseInt(formData.maxPoints),
        assignmentType: 'team',
        assignToAll: formData.assignToAll,
        teamIds: formData.assignToAll ? [] : Array.isArray(formData.teamIds) ? formData.teamIds : [],
        allowLateSubmissions: formData.allowLateSubmissions,
        maxAttempts: parseInt(formData.maxAttempts),
        allowFileUpload: formData.allowFileUpload,
        allowedFileTypes: Array.isArray(formData.allowedFileTypes) ? formData.allowedFileTypes : [],
        maxFileSize: formData.maxFileSize,
        priority: formData.priority
      };

      console.log('🚀 Sending request:', requestBody);

      const response = await fetch(`${API_BASE}/tasks/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (data.success) {
        onTaskCreated(data);
        onClose();
      } else {
        setErrors({ submit: data.message || 'Failed to create task' });
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Generate minimum date (current date + 1 hour)
  const getMinDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create New Task</h2>
            <p className="text-gray-600">Server: {serverTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Target className="w-4 h-4 inline mr-2" />
                  Task Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter task title"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                    errors.title ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.title && (
                  <p className="text-red-600 text-sm mt-1">{errors.title}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Due Date *
                </label>
                <input
                  type="datetime-local"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  min={getMinDateTime()}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                    errors.dueDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.dueDate && (
                  <p className="text-red-600 text-sm mt-1">{errors.dueDate}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Task Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                placeholder="Describe the task requirements, objectives, and any specific instructions..."
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors resize-none ${
                  errors.description ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.description && (
                <p className="text-red-600 text-sm mt-1">{errors.description}</p>
              )}
            </div>

            {/* Points and Attempts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Award className="w-4 h-4 inline mr-2" />
                  Maximum Points
                </label>
                <input
                  type="number"
                  name="maxPoints"
                  value={formData.maxPoints}
                  onChange={handleInputChange}
                  min="1"
                  max="1000"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                    errors.maxPoints ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.maxPoints && (
                  <p className="text-red-600 text-sm mt-1">{errors.maxPoints}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Attempts
                </label>
                <input
                  type="number"
                  name="maxAttempts"
                  value={formData.maxAttempts}
                  onChange={handleInputChange}
                  min="1"
                  max="10"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                    errors.maxAttempts ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.maxAttempts && (
                  <p className="text-red-600 text-sm mt-1">{errors.maxAttempts}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority Level
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {priorityOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Team Assignment */}
            {loadingTeams ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600 mr-2" />
                <span className="text-gray-600">Loading teams...</span>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-6">
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  <Users className="w-4 h-4 inline mr-2" />
                  Team Assignment
                </label>

                {errors.teams && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center text-red-800">
                      <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="text-sm">{errors.teams}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="assignmentOption"
                        checked={formData.assignToAll}
                        onChange={handleSelectAllTeams}
                        className="mr-2 text-purple-600"
                      />
                      <span className="text-sm font-medium">Assign to All Teams</span>
                    </label>
                   
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="assignmentOption"
                        checked={!formData.assignToAll}
                        onChange={handleSelectSpecificTeams}
                        className="mr-2 text-purple-600"
                      />
                      <span className="text-sm font-medium">Select Specific Teams</span>
                    </label>
                  </div>

                  {/* Team Selection */}
                  {!formData.assignToAll && (
                    <div className="border rounded-lg p-4 bg-white max-h-48 overflow-y-auto">
                      <div className="space-y-3">
                        {teams.map(team => {
                          // ✅ SAFETY CHECK: Ensure teamIds is an array before using .includes()
                          const currentTeamIds = Array.isArray(formData.teamIds) ? formData.teamIds : [];
                          const isChecked = currentTeamIds.includes(team._id);
                          
                          return (
                            <label key={team._id} className="flex items-start cursor-pointer group">
                              <input
                                type="checkbox"
                                name="teamIds"
                                value={team._id}
                                checked={isChecked}
                                onChange={handleInputChange}
                                className="mr-3 mt-1 text-purple-600"
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-gray-900 group-hover:text-purple-600">
                                    {team.name}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {team.members?.length || 0} members
                                  </span>
                                </div>
                                {team.description && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {team.description}
                                  </p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* File Upload Settings */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="space-y-4">
                {/* Late Submissions */}
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="allowLateSubmissions"
                    checked={formData.allowLateSubmissions}
                    onChange={handleInputChange}
                    className="mr-3 text-purple-600"
                  />
                  <div>
                    <span className="font-medium text-gray-700">Allow Late Submissions</span>
                    <p className="text-sm text-gray-500">Students can submit after the due date</p>
                  </div>
                </label>

                {/* File Upload Settings */}
                <div>
                  <label className="flex items-center cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      name="allowFileUpload"
                      checked={formData.allowFileUpload}
                      onChange={handleInputChange}
                      className="mr-3 text-purple-600"
                    />
                    <span className="font-medium text-gray-700">Allow File Uploads</span>
                  </label>

                  {formData.allowFileUpload && (
                    <div className="ml-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Allowed File Types ({Array.isArray(formData.allowedFileTypes) ? formData.allowedFileTypes.length : 0} selected)
                        </label>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {fileTypeOptions.map(option => {
                            const allowedTypes = Array.isArray(formData.allowedFileTypes) ? formData.allowedFileTypes : [];
                            return (
                              <label key={option.value} className="flex items-center cursor-pointer p-2 border rounded hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                  name="allowedFileTypes"
                                  value={option.value}
                                  checked={allowedTypes.includes(option.value)}
                                  onChange={handleInputChange}
                                  className="mr-2 text-purple-600"
                                />
                                <span className="text-sm">{option.label}</span>
                              </label>
                            );
                          })}
                        </div>
                        
                        {errors.allowedFileTypes && (
                          <p className="text-red-600 text-sm mt-2">{errors.allowedFileTypes}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Maximum File Size
                        </label>
                        <select
                          name="maxFileSize"
                          value={formData.maxFileSize}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value={5242880}>5 MB</option>
                          <option value={10485760}>10 MB</option>
                          <option value={20971520}>20 MB</option>
                          <option value={52428800}>50 MB</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center text-red-800">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="text-sm">{errors.submit}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || teams.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating Task...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Create Task
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TaskCreator;