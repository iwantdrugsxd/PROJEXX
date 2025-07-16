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
  // Form state
 const [formData, setFormData] = useState({
  title: '',
  description: '',
  dueDate: '',
  maxPoints: 100,
  assignmentType: 'team',
  teamIds: [],
  assignToAll: false,
  allowLateSubmissions: false,
  maxAttempts: 1,
  allowFileUpload: true,
  allowedFileTypes: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png', 'zip'], // ✅ FIXED: Direct array
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
  
  const fileTypeOptions = [
    { value: 'pdf', label: 'PDF' },
    { value: 'doc', label: 'Word Doc' },
    { value: 'docx', label: 'Word Docx' },
    { value: 'txt', label: 'Text File' },
    { value: 'jpg', label: 'JPEG Image' },
    { value: 'png', label: 'PNG Image' },
    { value: 'zip', label: 'ZIP Archive' }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'text-green-600 bg-green-50' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600 bg-yellow-50' },
    { value: 'high', label: 'High', color: 'text-orange-600 bg-orange-50' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-600 bg-red-50' }
  ];

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

  // Validation functions
  const validateForm = () => {
    const newErrors = {};

    // Title validation
    if (!formData.title.trim()) {
      newErrors.title = 'Task title is required';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters long';
    } else if (formData.title.trim().length > 200) {
      newErrors.title = 'Title cannot exceed 200 characters';
    }

    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = 'Task description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters long';
    } else if (formData.description.trim().length > 2000) {
      newErrors.description = 'Description cannot exceed 2000 characters';
    }

    // Due date validation
    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    } else {
      const dueDate = new Date(formData.dueDate);
      const now = new Date();
      if (dueDate <= now) {
        newErrors.dueDate = 'Due date must be in the future';
      }
    }

    // Team selection validation
    if (formData.assignmentType === 'team' && !formData.assignToAll && formData.teamIds.length === 0) {
      newErrors.teams = 'Please select at least one team or choose "Assign to All Teams"';
    }

    // Points validation
    if (!formData.maxPoints || formData.maxPoints < 1 || formData.maxPoints > 1000) {
      newErrors.maxPoints = 'Points must be between 1 and 1000';
    }

    // Attempts validation
    if (!formData.maxAttempts || formData.maxAttempts < 1 || formData.maxAttempts > 10) {
      newErrors.maxAttempts = 'Maximum attempts must be between 1 and 10';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'teamIds') {
      setFormData(prev => ({
        ...prev,
        teamIds: checked 
          ? [...prev.teamIds, value]
          : prev.teamIds.filter(id => id !== value)
      }));
    } else if (name === 'allowedFileTypes') {
      setFormData(prev => ({
        ...prev,
        allowedFileTypes: checked
          ? [...prev.allowedFileTypes, value]
          : prev.allowedFileTypes.filter(type => type !== value)
      }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
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
        teamIds: formData.assignToAll ? [] : formData.teamIds,
        allowLateSubmissions: formData.allowLateSubmissions,
        maxAttempts: parseInt(formData.maxAttempts),
        allowFileUpload: formData.allowFileUpload,
        allowedFileTypes: formData.allowedFileTypes,
        maxFileSize: formData.maxFileSize,
        priority: formData.priority
      };

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

  // Get minimum date (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 16);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Create New Task</h2>
              <p className="text-purple-100 text-sm">{serverTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="p-6 space-y-6">
            {/* Error Display */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-red-800 font-medium">Error</h4>
                  <p className="text-red-700 text-sm mt-1">{errors.submit}</p>
                </div>
              </div>
            )}

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Task Title */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-2" />
                  Task Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter task title..."
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                    errors.title ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  maxLength={200}
                />
                <div className="flex justify-between mt-1">
                  {errors.title && (
                    <p className="text-red-600 text-sm">{errors.title}</p>
                  )}
                  <p className="text-gray-500 text-sm ml-auto">
                    {formData.title.length}/200
                  </p>
                </div>
              </div>

              {/* Due Date */}
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
                  min={getMinDate()}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                    errors.dueDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.dueDate && (
                  <p className="text-red-600 text-sm mt-1">{errors.dueDate}</p>
                )}
              </div>

              {/* Max Points */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Award className="w-4 h-4 inline mr-2" />
                  Maximum Points *
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
            </div>

            {/* Task Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Provide detailed instructions for the task..."
                rows={5}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors resize-none ${
                  errors.description ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                maxLength={2000}
              />
              <div className="flex justify-between mt-1">
                {errors.description && (
                  <p className="text-red-600 text-sm">{errors.description}</p>
                )}
                <p className="text-gray-500 text-sm ml-auto">
                  {formData.description.length}/2000
                </p>
              </div>
            </div>

            {/* Team Assignment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <Users className="w-4 h-4 inline mr-2" />
                Team Assignment *
              </label>
              
              {loadingTeams ? (
                <div className="flex items-center justify-center py-8 bg-gray-50 rounded-lg">
                  <Loader2 className="w-6 h-6 animate-spin mr-3" />
                  <span className="text-gray-600">Loading teams...</span>
                </div>
              ) : errors.teams ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <p className="text-yellow-800 font-medium">No Teams Available</p>
                      <p className="text-yellow-700 text-sm mt-1">{errors.teams}</p>
                      <button
                        type="button"
                        onClick={loadTeams}
                        className="mt-2 text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                      >
                        Retry Loading Teams
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Assignment Options */}
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="assignmentOption"
                        checked={formData.assignToAll}
                        onChange={handleSelectAllTeams}
                        className="mr-2 text-purple-600"
                      />
                      <span className="text-sm font-medium">Assign to All Teams ({teams.length})</span>
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
                    <div className="border rounded-lg p-4 bg-gray-50 max-h-48 overflow-y-auto">
                      <div className="space-y-3">
                        {teams.map(team => (
                          <label key={team._id} className="flex items-start cursor-pointer group">
                            <input
                              type="checkbox"
                              name="teamIds"
                              value={team._id}
                              checked={formData.teamIds.includes(team._id)}
                              onChange={handleInputChange}
                              className="mr-3 mt-1 text-purple-600"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors">
                                  {team.name}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {team.members?.length || 0} members
                                </span>
                              </div>
                              {team.members && team.members.length > 0 && (
                                <div className="text-sm text-gray-600 mt-1">
                                  {team.members.slice(0, 3).map(member => 
                                    `${member.firstName} ${member.lastName}`
                                  ).join(', ')}
                                  {team.members.length > 3 && ` +${team.members.length - 3} more`}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Advanced Settings Toggle */}
            <div className="border-t pt-6">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center text-gray-700 hover:text-purple-600 transition-colors"
              >
                {showAdvanced ? <Minus className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Advanced Settings
              </button>
            </div>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-lg">
                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Target className="w-4 h-4 inline mr-2" />
                    Priority
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

                {/* Max Attempts */}
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
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      errors.maxAttempts ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {errors.maxAttempts && (
                    <p className="text-red-600 text-sm mt-1">{errors.maxAttempts}</p>
                  )}
                </div>

                {/* Late Submissions */}
                <div className="md:col-span-2">
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
                </div>

                {/* File Upload Settings */}
                <div className="md:col-span-2">
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
                          Allowed File Types
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {fileTypeOptions.map(option => (
                            <label key={option.value} className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                name="allowedFileTypes"
                                value={option.value}
                                checked={formData.allowedFileTypes.includes(option.value)}
                                onChange={handleInputChange}
                                className="mr-2 text-purple-600"
                              />
                              <span className="text-sm">{option.label}</span>
                            </label>
                          ))}
                        </div>
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
                type="button"
                onClick={handleSubmit}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCreator;