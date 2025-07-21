import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Calendar, 
  Clock, 
  Award, 
  Users, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Upload,
  X,
  Plus,
  Minus
} from 'lucide-react';

const TaskCreator = ({ serverId, onTaskCreated, onCancel }) => {
  // Form data state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructions: '',
    rubric: '',
    dueDate: '',
    maxPoints: 100,
    team: [], // Array of team IDs
    assignmentType: 'team',
    allowLateSubmissions: false,
    maxAttempts: 1,
    allowFileUpload: false,
    allowedFileTypes: [],
    maxFileSize: 10485760, // 10MB
    priority: 'medium',
    autoGrade: false,
    publishImmediately: true,
    notifyStudents: true,
    assignToAll: false
  });

  // UI state
  const [uiState, setUiState] = useState({
    loading: false,
    loadingTeams: false,
    teams: [],
    errors: {},
    success: false,
    networkStatus: 'online',
    fetchAttempts: 0,
    serverInfo: null
  });

  // Refs for cleanup
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Fetch server info
  const fetchServerInfo = useCallback(async () => {
    if (!serverId || !mountedRef.current) return;
    
    try {
      const response = await fetch(`${API_BASE}/projectServers/faculty-servers`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const server = data.servers?.find(s => s._id === serverId);
        if (server && mountedRef.current) {
          setUiState(prev => ({ ...prev, serverInfo: server }));
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch server info:', error);
    }
  }, [serverId, API_BASE]);

  // ✅ Optimized Team Fetching with Multiple Endpoints
  const fetchTeamsWithRetry = useCallback(async (retryCount = 0) => {
    if (!serverId || !mountedRef.current) return;
    
    console.log(`🔄 Fetching teams for server ${serverId} (attempt ${retryCount + 1})`);
    
    setUiState(prev => ({ 
      ...prev, 
      loadingTeams: true, 
      fetchAttempts: retryCount + 1,
      errors: { ...prev.errors, teams: null }
    }));
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setUiState(prev => ({ ...prev, networkStatus: 'online' }));
      
      // Try multiple endpoints in order of preference
      const endpoints = [
        `${API_BASE}/tasks/server/${serverId}/teams`,    // Primary endpoint (newly added)
        `${API_BASE}/teamRoutes/server/${serverId}/teams`, // Alternative (newly added)
        `${API_BASE}/teams/server/${serverId}/teams`,    // Alternative mounting
        `${API_BASE}/teamRoutes/faculty-teams`           // Fallback (requires filtering)
      ];
      
      let teams = [];
      let lastError = null;
      let successfulEndpoint = null;
      
      for (const endpoint of endpoints) {
        try {
          console.log(`🔍 Trying endpoint: ${endpoint}`);
          
          const response = await fetch(endpoint, {
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            signal: abortControllerRef.current.signal
          });
          
          if (!mountedRef.current) return;
          
          const data = await response.json();
          console.log(`📡 Response from ${endpoint}:`, data);
          
          if (response.ok && data.success) {
            if (data.teams) {
              teams = data.teams;
            } else if (Array.isArray(data)) {
              teams = data;
            }
            
            // Filter teams for current server if using faculty-teams endpoint
            if (endpoint.includes('faculty-teams') && teams.length > 0) {
              try {
                const serverResponse = await fetch(`${API_BASE}/projectServers/faculty-servers`, {
                  credentials: 'include'
                });
                
                if (serverResponse.ok) {
                  const serverData = await serverResponse.json();
                  const currentServer = serverData.servers?.find(s => s._id === serverId);
                  
                  if (currentServer) {
                    teams = teams.filter(team => 
                      team.projectServer === currentServer.code
                    );
                    console.log(`🔍 Filtered ${teams.length} teams for server ${currentServer.code}`);
                  }
                }
              } catch (filterError) {
                console.log('⚠️ Could not filter teams by server:', filterError);
              }
            }
            
            successfulEndpoint = endpoint;
            console.log(`✅ Successfully fetched ${teams.length} teams from ${endpoint}`);
            break;
            
          } else {
            lastError = data.message || `HTTP ${response.status}`;
            console.log(`❌ Endpoint ${endpoint} failed: ${lastError}`);
          }
          
        } catch (fetchError) {
          lastError = fetchError.message;
          console.log(`❌ Endpoint ${endpoint} error:`, fetchError.message);
        }
      }
      
      if (teams.length > 0) {
        setUiState(prev => ({ 
          ...prev, 
          teams, 
          networkStatus: 'online',
          errors: { ...prev.errors, teams: null }
        }));
        
        if (formData.assignToAll) {
          setFormData(prev => ({
            ...prev,
            team: teams.map(team => team._id)
          }));
        }
        
        console.log(`🎉 Successfully loaded ${teams.length} teams using ${successfulEndpoint}`);
        
      } else {
        console.log('📭 No teams found in any endpoint');
        setUiState(prev => ({ ...prev, teams: [] }));
        
        let errorMessage = 'No teams found. Students need to create teams before you can assign tasks.';
        
        if (lastError) {
          if (lastError.includes('403') || lastError.includes('Access denied')) {
            errorMessage = 'Access denied. Please check your permissions for this server.';
          } else if (lastError.includes('404') || lastError.includes('not found')) {
            errorMessage = 'Server not found or you don\'t have access to it.';
          } else if (lastError.includes('Network')) {
            errorMessage = 'Network error. Please check your connection and try again.';
          }
        }
        
        setUiState(prev => ({ 
          ...prev,
          errors: { ...prev.errors, teams: errorMessage }
        }));
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🛑 Team fetch request was aborted');
        return;
      }
      
      console.error('❌ Team fetching failed:', error);
      setUiState(prev => ({ 
        ...prev, 
        teams: [],
        networkStatus: 'offline',
        errors: { 
          ...prev.errors, 
          teams: 'Network error. Please check your connection and try again.'
        }
      }));
      
      // Retry logic for network failures
      if (retryCount < 2 && !error.message.includes('403') && !error.message.includes('404')) {
        console.log(`🔄 Retrying team fetch in 3 seconds (attempt ${retryCount + 1})`);
        setTimeout(() => {
          if (mountedRef.current) {
            fetchTeamsWithRetry(retryCount + 1);
          }
        }, 3000);
      }
      
    } finally {
      if (mountedRef.current) {
        setUiState(prev => ({ ...prev, loadingTeams: false }));
      }
    }
  }, [serverId, API_BASE, formData.assignToAll]);

  // Initial data loading
  useEffect(() => {
    if (serverId) {
      fetchServerInfo();
      fetchTeamsWithRetry();
    }
  }, [serverId, fetchServerInfo, fetchTeamsWithRetry]);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-select all teams when assignToAll is checked
      if (field === 'assignToAll' && value && uiState.teams.length > 0) {
        newData.team = uiState.teams.map(team => team._id);
      } else if (field === 'assignToAll' && !value) {
        newData.team = [];
      }
      
      return newData;
    });
    
    // Clear field-specific errors
    if (uiState.errors[field]) {
      setUiState(prev => ({
        ...prev,
        errors: { ...prev.errors, [field]: null }
      }));
    }
  };

  // Handle team selection
  const handleTeamSelection = (teamId) => {
    setFormData(prev => {
      const isSelected = prev.team.includes(teamId);
      let newTeamSelection;
      
      if (isSelected) {
        newTeamSelection = prev.team.filter(id => id !== teamId);
      } else {
        newTeamSelection = [...prev.team, teamId];
      }
      
      // Update assignToAll based on selection
      const assignToAll = newTeamSelection.length === uiState.teams.length;
      
      return {
        ...prev,
        team: newTeamSelection,
        assignToAll
      };
    });
  };

  // Add file type
  const addFileType = () => {
    const fileType = document.getElementById('newFileType')?.value.trim();
    if (fileType && !formData.allowedFileTypes.includes(fileType)) {
      setFormData(prev => ({
        ...prev,
        allowedFileTypes: [...prev.allowedFileTypes, fileType]
      }));
      document.getElementById('newFileType').value = '';
    }
  };

  // Remove file type
  const removeFileType = (typeToRemove) => {
    setFormData(prev => ({
      ...prev,
      allowedFileTypes: prev.allowedFileTypes.filter(type => type !== typeToRemove)
    }));
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Task title is required';
    }
    
    if (!formData.description.trim()) {
      errors.description = 'Task description is required';
    }
    
    if (!formData.dueDate) {
      errors.dueDate = 'Due date is required';
    } else if (new Date(formData.dueDate) <= new Date()) {
      errors.dueDate = 'Due date must be in the future';
    }
    
    if (!formData.maxPoints || formData.maxPoints < 1) {
      errors.maxPoints = 'Maximum points must be at least 1';
    }
    
    if (formData.assignmentType === 'team' && formData.team.length === 0) {
      errors.team = 'Please select at least one team for assignment';
    }
    
    if (formData.maxAttempts < 1) {
      errors.maxAttempts = 'Maximum attempts must be at least 1';
    }
    
    setUiState(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setUiState(prev => ({ ...prev, loading: true, errors: {} }));
    
    try {
      console.log('📤 Submitting task creation:', formData);
      
      const response = await fetch(`${API_BASE}/tasks/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          serverId
        })
      });
      
      const data = await response.json();
      console.log('📥 Task creation response:', data);
      
      if (data.success) {
        setUiState(prev => ({ ...prev, success: true }));
        console.log('✅ Task created successfully');
        
        // Notify parent component
        if (onTaskCreated) {
          onTaskCreated(data);
        }
        
        // Reset form
        setTimeout(() => {
          if (mountedRef.current) {
            setFormData({
              title: '',
              description: '',
              instructions: '',
              rubric: '',
              dueDate: '',
              maxPoints: 100,
              team: [],
              assignmentType: 'team',
              allowLateSubmissions: false,
              maxAttempts: 1,
              allowFileUpload: false,
              allowedFileTypes: [],
              maxFileSize: 10485760,
              priority: 'medium',
              autoGrade: false,
              publishImmediately: true,
              notifyStudents: true,
              assignToAll: false
            });
            setUiState(prev => ({ 
              ...prev, 
              success: false, 
              errors: {} 
            }));
          }
        }, 2000);
        
      } else {
        throw new Error(data.message || 'Failed to create task');
      }
      
    } catch (error) {
      console.error('❌ Task creation failed:', error);
      setUiState(prev => ({
        ...prev,
        errors: { submit: error.message || 'Failed to create task. Please try again.' }
      }));
    } finally {
      if (mountedRef.current) {
        setUiState(prev => ({ ...prev, loading: false }));
      }
    }
  };

  // Set minimum date to tomorrow
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 16);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Success Message */}
        {uiState.success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Task created successfully!</span>
            </div>
            <p className="text-green-700 mt-1">The task has been assigned to the selected teams.</p>
          </div>
        )}

        {/* Submit Error */}
        {uiState.errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error creating task</span>
            </div>
            <p className="text-red-700 mt-1">{uiState.errors.submit}</p>
          </div>
        )}

        {/* Basic Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  uiState.errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter task title..."
              />
              {uiState.errors.title && (
                <p className="text-red-600 text-sm mt-1">{uiState.errors.title}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  uiState.errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Describe what students need to do..."
              />
              {uiState.errors.description && (
                <p className="text-red-600 text-sm mt-1">{uiState.errors.description}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date *
              </label>
              <input
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e) => handleInputChange('dueDate', e.target.value)}
                min={getMinDate()}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  uiState.errors.dueDate ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {uiState.errors.dueDate && (
                <p className="text-red-600 text-sm mt-1">{uiState.errors.dueDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Points *
              </label>
              <input
                type="number"
                value={formData.maxPoints}
                onChange={(e) => handleInputChange('maxPoints', parseInt(e.target.value) || 0)}
                min="1"
                max="1000"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  uiState.errors.maxPoints ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {uiState.errors.maxPoints && (
                <p className="text-red-600 text-sm mt-1">{uiState.errors.maxPoints}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assignment Type
              </label>
              <select
                value={formData.assignmentType}
                onChange={(e) => handleInputChange('assignmentType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="team">Team Assignment</option>
                <option value="individual">Individual Assignment</option>
              </select>
            </div>
          </div>
        </div>

        {/* Team Assignment */}
        {formData.assignmentType === 'team' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Team Assignment</h3>
              {uiState.loadingTeams && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading teams...</span>
                </div>
              )}
            </div>

            {/* Teams Loading/Error States */}
            {uiState.errors.teams ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Teams not available</span>
                </div>
                <p className="text-yellow-700 mt-1">{uiState.errors.teams}</p>
                <button
                  type="button"
                  onClick={() => fetchTeamsWithRetry()}
                  className="mt-2 text-yellow-600 hover:text-yellow-800 underline text-sm"
                >
                  Try again
                </button>
              </div>
            ) : uiState.teams.length === 0 && !uiState.loadingTeams ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="h-5 w-5" />
                  <span className="font-medium">No teams found</span>
                </div>
                <p className="text-gray-600 mt-1">
                  Students need to create teams for this server before you can assign tasks.
                </p>
              </div>
            ) : (
              <>
                {/* Select All Teams */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.assignToAll}
                      onChange={(e) => handleInputChange('assignToAll', e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    Assign to all teams ({uiState.teams.length})
                  </label>
                </div>

                {/* Team Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {uiState.teams.map(team => (
                    <div
                      key={team._id}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        formData.team.includes(team._id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleTeamSelection(team._id)}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.team.includes(team._id)}
                          onChange={() => handleTeamSelection(team._id)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{team.name}</div>
                          <div className="text-sm text-gray-600">
                            {team.members?.length || 0} members
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {uiState.errors.team && (
                  <p className="text-red-600 text-sm mt-2">{uiState.errors.team}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Instructions & Rubric */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Instructions & Rubric</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detailed Instructions
              </label>
              <textarea
                value={formData.instructions}
                onChange={(e) => handleInputChange('instructions', e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Provide detailed instructions for completing this task..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grading Rubric
              </label>
              <textarea
                value={formData.rubric}
                onChange={(e) => handleInputChange('rubric', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Define grading criteria and point distribution..."
              />
            </div>
          </div>
        </div>

        {/* Submission Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Submission Settings</h3>
          
          <div className="space-y-6">
            {/* Basic Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Attempts
                </label>
                <input
                  type="number"
                  value={formData.maxAttempts}
                  onChange={(e) => handleInputChange('maxAttempts', parseInt(e.target.value) || 1)}
                  min="1"
                  max="10"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    uiState.errors.maxAttempts ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {uiState.errors.maxAttempts && (
                  <p className="text-red-600 text-sm mt-1">{uiState.errors.maxAttempts}</p>
                )}
              </div>

              <div className="flex items-center gap-4 pt-8">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.allowLateSubmissions}
                    onChange={(e) => handleInputChange('allowLateSubmissions', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  Allow late submissions
                </label>
              </div>
            </div>

            {/* File Upload Settings */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
                <input
                  type="checkbox"
                  checked={formData.allowFileUpload}
                  onChange={(e) => handleInputChange('allowFileUpload', e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                Allow file uploads
              </label>

              {formData.allowFileUpload && (
                <div className="ml-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum file size (MB)
                    </label>
                    <input
                      type="number"
                      value={formData.maxFileSize / 1048576} // Convert bytes to MB
                      onChange={(e) => handleInputChange('maxFileSize', (parseFloat(e.target.value) || 1) * 1048576)}
                      min="1"
                      max="100"
                      step="0.5"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allowed file types
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        id="newFileType"
                        placeholder="e.g., pdf, doc, jpg"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFileType())}
                      />
                      <button
                        type="button"
                        onClick={addFileType}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {formData.allowedFileTypes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.allowedFileTypes.map(type => (
                          <span
                            key={type}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                          >
                            {type}
                            <button
                              type="button"
                              onClick={() => removeFileType(type)}
                              className="text-gray-500 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Publishing Options */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Publishing Options</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={formData.publishImmediately}
                onChange={(e) => handleInputChange('publishImmediately', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              Publish immediately (uncheck to save as draft)
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={formData.notifyStudents}
                onChange={(e) => handleInputChange('notifyStudents', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              Notify students when published
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={formData.autoGrade}
                onChange={(e) => handleInputChange('autoGrade', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              Enable auto-grading (if supported)
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={uiState.loading || uiState.teams.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uiState.loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Task...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                {formData.publishImmediately ? 'Create & Publish Task' : 'Save as Draft'}
              </>
            )}
          </button>
        </div>

        {/* Network Status Indicator */}
        {uiState.networkStatus === 'offline' && (
          <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>Connection issues detected</span>
            </div>
          </div>
        )}

        {/* Retry Indicator */}
        {uiState.fetchAttempts > 1 && uiState.loadingTeams && (
          <div className="fixed bottom-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Retrying... ({uiState.fetchAttempts}/3)</span>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default TaskCreator;