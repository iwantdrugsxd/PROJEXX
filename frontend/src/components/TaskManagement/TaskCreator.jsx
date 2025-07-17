// frontend/src/components/TaskManagement/TaskCreator.jsx - STABLE VERSION
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  // ✅ STABLE: Use refs to prevent form resets
  const formRef = useRef(null);
  const mountedRef = useRef(true);
  
  // ✅ FIXED: Stable form state that doesn't reset
  const [formData, setFormData] = useState(() => ({
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
    allowedFileTypes: ['pdf', 'doc', 'docx'],
    maxFileSize: 10485760, // 10MB
    priority: 'medium'
  }));

  // UI state
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [errors, setErrors] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  
  // Constants
  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
  
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

  // ✅ STABLE: Fetch teams only once on mount
  const fetchTeams = useCallback(async () => {
    if (!serverId || !mountedRef.current) return;
    
    try {
      setLoadingTeams(true);
      const response = await fetch(`${API_BASE}/tasks/server/${serverId}/teams`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success && mountedRef.current) {
        setTeams(data.teams || []);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      if (mountedRef.current) {
        setErrors(prev => ({ ...prev, teams: 'Failed to load teams' }));
      }
    } finally {
      if (mountedRef.current) {
        setLoadingTeams(false);
      }
    }
  }, [serverId, API_BASE]);

  useEffect(() => {
    fetchTeams();
    
    // Cleanup function
    return () => {
      mountedRef.current = false;
    };
  }, [fetchTeams]);

  // ✅ STABLE: Memoized validation function
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.title?.trim()) {
      newErrors.title = 'Task title is required';
    }

    if (!formData.description?.trim()) {
      newErrors.description = 'Task description is required';
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

    if (!formData.assignToAll && (!Array.isArray(formData.teamIds) || formData.teamIds.length === 0)) {
      newErrors.teams = 'Please select at least one team or choose "Assign to All Teams"';
    }

    if (!formData.maxPoints || formData.maxPoints < 1 || formData.maxPoints > 1000) {
      newErrors.maxPoints = 'Points must be between 1 and 1000';
    }

    if (!formData.maxAttempts || formData.maxAttempts < 1 || formData.maxAttempts > 10) {
      newErrors.maxAttempts = 'Maximum attempts must be between 1 and 10';
    }

    if (formData.allowFileUpload && (!Array.isArray(formData.allowedFileTypes) || formData.allowedFileTypes.length === 0)) {
      newErrors.allowedFileTypes = 'Please select at least one allowed file type when file upload is enabled';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // ✅ STABLE: Form handlers that don't cause re-renders
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => {
      if (name === 'teamIds') {
        const currentTeamIds = Array.isArray(prev.teamIds) ? prev.teamIds : [];
        return {
          ...prev,
          teamIds: checked 
            ? [...currentTeamIds, value]
            : currentTeamIds.filter(id => id !== value)
        };
      } else if (name === 'allowedFileTypes') {
        const currentFileTypes = Array.isArray(prev.allowedFileTypes) ? prev.allowedFileTypes : [];
        return {
          ...prev,
          allowedFileTypes: checked
            ? [...currentFileTypes, value]
            : currentFileTypes.filter(type => type !== value)
        };
      } else {
        return {
          ...prev,
          [name]: type === 'checkbox' ? checked : value
        };
      }
    });

    // Clear related errors
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  const handleSelectAllTeams = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      assignToAll: true,
      teamIds: []
    }));
    if (errors.teams) {
      setErrors(prev => ({ ...prev, teams: null }));
    }
  }, [errors.teams]);

  const handleSelectSpecificTeams = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      assignToAll: false
    }));
  }, []);

  // ✅ CRITICAL FIX: Prevent form from resetting during submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent multiple submissions
    if (loading || submitAttempted) {
      console.log('🚫 Submission blocked - already in progress');
      return;
    }
    
    setSubmitAttempted(true);
    
    console.log('🔍 Form submission started');
    console.log('🔍 allowedFileTypes:', formData.allowedFileTypes);
    console.log('🔍 teamIds:', formData.teamIds);
    
    if (!validateForm()) {
      setSubmitAttempted(false);
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
        teamIds: formData.assignToAll ? [] : (Array.isArray(formData.teamIds) ? formData.teamIds : []),
        allowLateSubmissions: formData.allowLateSubmissions,
        maxAttempts: parseInt(formData.maxAttempts),
        allowFileUpload: formData.allowFileUpload,
        allowedFileTypes: Array.isArray(formData.allowedFileTypes) ? formData.allowedFileTypes : [],
        maxFileSize: parseInt(formData.maxFileSize),
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
        console.log('✅ Task created successfully');
        // Only call callbacks if component is still mounted
        if (mountedRef.current) {
          onTaskCreated?.(data);
          onClose?.();
        }
      } else {
        console.error('❌ Task creation failed:', data.message);
        if (mountedRef.current) {
          setErrors({ submit: data.message || 'Failed to create task' });
        }
      }
    } catch (error) {
      console.error('❌ Network error:', error);
      if (mountedRef.current) {
        setErrors({ submit: 'Network error. Please try again.' });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setSubmitAttempted(false);
      }
    }
  }, [formData, loading, submitAttempted, validateForm, serverId, API_BASE, onTaskCreated, onClose]);

  // ✅ STABLE: Safe close handler
  const handleClose = useCallback(() => {
    if (!loading) {
      onClose?.();
    }
  }, [loading, onClose]);

  if (loadingTeams) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Teams</h3>
            <p className="text-gray-600">Please wait while we fetch team information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Create New Task</h2>
              <p className="text-gray-600">Server: {serverTitle}</p>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-purple-600" />
              Basic Information
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter task title"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={loading}
              />
              {errors.title && (
                <p className="text-red-600 text-sm mt-2">{errors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe the task requirements and objectives"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                disabled={loading}
              />
              {errors.description && (
                <p className="text-red-600 text-sm mt-2">{errors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date *
                </label>
                <input
                  type="datetime-local"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={loading}
                />
                {errors.dueDate && (
                  <p className="text-red-600 text-sm mt-2">{errors.dueDate}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Points *
                </label>
                <input
                  type="number"
                  name="maxPoints"
                  value={formData.maxPoints}
                  onChange={handleInputChange}
                  min="1"
                  max="1000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={loading}
                />
                {errors.maxPoints && (
                  <p className="text-red-600 text-sm mt-2">{errors.maxPoints}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={loading}
                >
                  {priorityOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Team Assignment */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-600" />
              Team Assignment
            </h3>

            <div className="space-y-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="assignment"
                  checked={formData.assignToAll}
                  onChange={handleSelectAllTeams}
                  className="mr-3 text-purple-600"
                  disabled={loading}
                />
                <div>
                  <span className="font-medium text-gray-700">Assign to All Teams</span>
                  <p className="text-sm text-gray-500">Task will be assigned to all teams in this server ({teams.length} teams)</p>
                </div>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="assignment"
                  checked={!formData.assignToAll}
                  onChange={handleSelectSpecificTeams}
                  className="mr-3 text-purple-600"
                  disabled={loading}
                />
                <span className="font-medium text-gray-700">Select Specific Teams</span>
              </label>

              {!formData.assignToAll && (
                <div className="ml-6 space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {teams.length > 0 ? (
                    teams.map(team => (
                      <label key={team._id} className="flex items-center cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          name="teamIds"
                          value={team._id}
                          checked={formData.teamIds.includes(team._id)}
                          onChange={handleInputChange}
                          className="mr-3 text-purple-600"
                          disabled={loading}
                        />
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">{team.name}</span>
                          <p className="text-sm text-gray-500">{team.members?.length || 0} members</p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No teams available in this server</p>
                  )}
                </div>
              )}
            </div>

            {errors.teams && (
              <p className="text-red-600 text-sm">{errors.teams}</p>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-lg font-semibold text-gray-900"
              disabled={loading}
            >
              <Target className="w-5 h-5 mr-2 text-purple-600" />
              Advanced Settings
              {showAdvanced ? (
                <Minus className="w-4 h-4 ml-2" />
              ) : (
                <Plus className="w-4 h-4 ml-2" />
              )}
            </button>

            {showAdvanced && (
              <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={loading}
                    />
                    {errors.maxAttempts && (
                      <p className="text-red-600 text-sm mt-2">{errors.maxAttempts}</p>
                    )}
                  </div>
                </div>

                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    name="allowLateSubmissions"
                    checked={formData.allowLateSubmissions}
                    onChange={handleInputChange}
                    className="mr-3 mt-1 text-purple-600"
                    disabled={loading}
                  />
                  <div>
                    <span className="font-medium text-gray-700">Allow Late Submissions</span>
                    <p className="text-sm text-gray-500">Students can submit after the due date</p>
                  </div>
                </label>

                <div>
                  <label className="flex items-center cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      name="allowFileUpload"
                      checked={formData.allowFileUpload}
                      onChange={handleInputChange}
                      className="mr-3 text-purple-600"
                      disabled={loading}
                    />
                    <span className="font-medium text-gray-700">Allow File Uploads</span>
                  </label>

                  {formData.allowFileUpload && (
                    <div className="ml-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Allowed File Types ({formData.allowedFileTypes.length} selected)
                        </label>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {fileTypeOptions.map(option => (
                            <label key={option.value} className="flex items-center cursor-pointer p-2 border rounded hover:bg-gray-50">
                              <input
                                type="checkbox"
                                name="allowedFileTypes"
                                value={option.value}
                                checked={formData.allowedFileTypes.includes(option.value)}
                                onChange={handleInputChange}
                                className="mr-2 text-purple-600"
                                disabled={loading}
                              />
                              <span className="text-sm">{option.label}</span>
                            </label>
                          ))}
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
                          disabled={loading}
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
              onClick={handleClose}
              disabled={loading}
              className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || teams.length === 0 || submitAttempted}
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
  );
};

export default TaskCreator;