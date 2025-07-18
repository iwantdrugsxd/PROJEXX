// frontend/src/components/TaskManagement/TaskCreator.jsx - FIXED VERSION
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
  Send,
  Server,
  RefreshCw,
  CheckCircle,
  Info,
  Upload,
  Settings,
  Wifi,
  WifiOff
} from 'lucide-react';

const TaskCreator = ({ serverId, serverTitle, onTaskCreated, onClose }) => {
  // ✅ Refs for stability
  const mountedRef = useRef(true);
  const fetchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  
  // ✅ Core Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    maxPoints: 100,
    assignmentType: 'team',
    team: [],
    assignToAll: false,
    allowLateSubmissions: false,
    maxAttempts: 1,
    allowFileUpload: true,
    allowedFileTypes: ['pdf', 'doc', 'docx'],
    maxFileSize: 10485760, // 10MB
    priority: 'medium',
    instructions: '',
    rubric: '',
    autoGrade: false,
    publishImmediately: true,
    notifyStudents: true
  });

  // ✅ UI State
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [errors, setErrors] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [networkStatus, setNetworkStatus] = useState('online'); // online, offline, checking
  const [fetchAttempts, setFetchAttempts] = useState(0);
  
  // ✅ Constants
  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
  const MAX_RETRY_ATTEMPTS = 3;
  
  const fileTypeOptions = [
    { value: 'pdf', label: 'PDF Documents', icon: '📄' },
    { value: 'doc', label: 'Word Documents (.doc)', icon: '📝' },
    { value: 'docx', label: 'Word Documents (.docx)', icon: '📝' },
    { value: 'txt', label: 'Text Files', icon: '📄' },
    { value: 'jpg', label: 'JPEG Images', icon: '🖼️' },
    { value: 'jpeg', label: 'JPEG Images (Alt)', icon: '🖼️' },
    { value: 'png', label: 'PNG Images', icon: '🖼️' },
    { value: 'gif', label: 'GIF Images', icon: '🖼️' },
    { value: 'zip', label: 'ZIP Archives', icon: '🗜️' },
    { value: 'rar', label: 'RAR Archives', icon: '🗜️' },
    { value: 'py', label: 'Python Files', icon: '🐍' },
    { value: 'js', label: 'JavaScript Files', icon: '⚡' },
    { value: 'html', label: 'HTML Files', icon: '🌐' },
    { value: 'css', label: 'CSS Files', icon: '🎨' },
    { value: 'json', label: 'JSON Files', icon: '📋' }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low Priority', color: 'text-green-600 bg-green-50 border-green-200', icon: '🟢' },
    { value: 'medium', label: 'Medium Priority', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: '🟡' },
    { value: 'high', label: 'High Priority', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: '🟠' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-600 bg-red-50 border-red-200', icon: '🔴' }
  ];

  // ✅ Network status check
  const checkNetworkStatus = async () => {
    setNetworkStatus('checking');
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        credentials: 'include',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        setNetworkStatus('online');
        return true;
      } else {
        setNetworkStatus('offline');
        return false;
      }
    } catch (error) {
      console.error('❌ Network check failed:', error);
      setNetworkStatus('offline');
      return false;
    }
  };

  // ✅ Initialize Component
  useEffect(() => {
    mountedRef.current = true;
    
    if (serverId) {
      fetchServerInfo();
      fetchTeamsWithRetry();
    }
    
    return () => {
      mountedRef.current = false;
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [serverId]);

  // ✅ Enhanced Server Info Fetching
  const fetchServerInfo = async () => {
    if (!serverId) return;
    
    try {
      const response = await fetch(`${API_BASE}/projectServers/faculty-servers`, {
        credentials: 'include',
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const server = data.servers?.find(s => s._id === serverId);
        if (server && mountedRef.current) {
          setServerInfo(server);
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch server info:', error);
    }
  };

  // ✅ Enhanced Team Fetching with Better Error Handling
  const fetchTeamsWithRetry = async (retryCount = 0) => {
    if (!serverId || !mountedRef.current) return;
    
    console.log(`🔄 Fetching teams for server ${serverId} (attempt ${retryCount + 1})`);
    
    setLoadingTeams(true);
    setFetchAttempts(retryCount + 1);
    setErrors(prev => ({ ...prev, teams: null }));
    
    // Abort previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      // Check network status first
      const isOnline = await checkNetworkStatus();
      if (!isOnline && retryCount === 0) {
        throw new Error('Network connection unavailable');
      }
      
      const response = await fetch(`${API_BASE}/tasks/server/${serverId}/teams`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: abortControllerRef.current.signal
      });
      
      if (!mountedRef.current) return;
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          const teamsList = data.teams || [];
          setTeams(teamsList);
          setNetworkStatus('online');
          
          // Auto-select all teams if requested
          if (formData.assignToAll && teamsList.length > 0) {
            setFormData(prev => ({
              ...prev,
              team: teamsList.map(team => team._id)
            }));
          }
          
          if (teamsList.length === 0) {
            setErrors(prev => ({ 
              ...prev, 
              teams: 'No teams found. Students need to create teams before you can assign tasks.'
            }));
          } else {
            setErrors(prev => ({ ...prev, teams: null }));
          }
          
          console.log(`✅ Successfully loaded ${teamsList.length} teams`);
        } else {
          throw new Error(data.message || 'Failed to load teams');
        }
      } else if (response.status === 404) {
        setErrors(prev => ({ 
          ...prev, 
          teams: 'Server not found or you don\'t have access to it.'
        }));
      } else if (response.status === 403) {
        setErrors(prev => ({ 
          ...prev, 
          teams: 'Access denied. Please check your permissions.'
        }));
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Team fetch error (attempt ${retryCount + 1}):`, error);
      
      if (!mountedRef.current) return;
      
      if (error.name === 'AbortError') {
        console.log('🚫 Request was aborted');
        return;
      }
      
      setNetworkStatus('offline');
      
      if (retryCount < MAX_RETRY_ATTEMPTS - 1) {
        const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`⏱️ Retrying in ${retryDelay}ms...`);
        
        fetchTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            fetchTeamsWithRetry(retryCount + 1);
          }
        }, retryDelay);
        return;
      } else {
        // Final failure
        let errorMessage = 'Failed to load teams after multiple attempts.';
        
        if (error.message.includes('Network connection')) {
          errorMessage = 'Network connection unavailable. Please check your internet connection and try again.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Unable to connect to server. Please check if the server is running and try again.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again later.';
        }
        
        setErrors(prev => ({ 
          ...prev, 
          teams: errorMessage
        }));
      }
    } finally {
      if (mountedRef.current) {
        setLoadingTeams(false);
      }
    }
  };

  // ✅ Manual Refresh Handler
  const handleRefreshTeams = async () => {
    setTeams([]);
    setFetchAttempts(0);
    await fetchTeamsWithRetry();
  };

  // ✅ Real-time Form Validation
  const validateField = useCallback((name, value) => {
    const newErrors = { ...validationErrors };
    
    switch (name) {
      case 'title':
        if (!value.trim()) {
          newErrors.title = 'Task title is required';
        } else if (value.length < 3) {
          newErrors.title = 'Title must be at least 3 characters';
        } else if (value.length > 100) {
          newErrors.title = 'Title must be less than 100 characters';
        } else {
          delete newErrors.title;
        }
        break;
        
      case 'description':
        if (!value.trim()) {
          newErrors.description = 'Description is required';
        } else if (value.length < 10) {
          newErrors.description = 'Description must be at least 10 characters';
        } else if (value.length > 2000) {
          newErrors.description = 'Description must be less than 2000 characters';
        } else {
          delete newErrors.description;
        }
        break;
        
      case 'dueDate':
        if (!value) {
          newErrors.dueDate = 'Due date is required';
        } else {
          const dueDate = new Date(value);
          const now = new Date();
          const minDate = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
          
          if (dueDate <= minDate) {
            newErrors.dueDate = 'Due date must be at least 30 minutes in the future';
          } else {
            delete newErrors.dueDate;
          }
        }
        break;
        
      case 'maxPoints':
        const points = parseFloat(value);
        if (!points || points < 1) {
          newErrors.maxPoints = 'Maximum points must be at least 1';
        } else if (points > 1000) {
          newErrors.maxPoints = 'Maximum points cannot exceed 1000';
        } else {
          delete newErrors.maxPoints;
        }
        break;
        
      case 'maxAttempts':
        const attempts = parseInt(value);
        if (!attempts || attempts < 1) {
          newErrors.maxAttempts = 'Must allow at least 1 attempt';
        } else if (attempts > 10) {
          newErrors.maxAttempts = 'Cannot exceed 10 attempts';
        } else {
          delete newErrors.maxAttempts;
        }
        break;
        
      default:
        break;
    }
    
    setValidationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [validationErrors]);

  // ✅ Enhanced Form Validation
  const validateForm = useCallback(() => {
    const newErrors = {};

    // Required fields
    if (!formData.title.trim()) newErrors.title = 'Task title is required';
    if (!formData.description.trim()) newErrors.description = 'Task description is required';
    if (!formData.dueDate) newErrors.dueDate = 'Due date is required';
    if (!formData.maxPoints || formData.maxPoints < 1) newErrors.maxPoints = 'Maximum points must be at least 1';

    // Due date validation
    if (formData.dueDate) {
      const dueDate = new Date(formData.dueDate);
      const now = new Date();
      const minDate = new Date(now.getTime() + 30 * 60 * 1000);
      
      if (dueDate <= minDate) {
        newErrors.dueDate = 'Due date must be at least 30 minutes in the future';
      }
    }

    // Team assignment validation
    if (!formData.assignToAll && formData.team.length === 0) {
      newErrors.teams = 'Please select at least one team or choose "Assign to All Teams"';
    }

    // File upload validation
    if (formData.allowFileUpload && formData.allowedFileTypes.length === 0) {
      newErrors.allowedFileTypes = 'Please select at least one allowed file type';
    }

    // Advanced validation
    if (formData.maxAttempts < 1 || formData.maxAttempts > 10) {
      newErrors.maxAttempts = 'Maximum attempts must be between 1 and 10';
    }

    if (formData.maxFileSize < 1024 || formData.maxFileSize > 104857600) { // 1KB to 100MB
      newErrors.maxFileSize = 'File size must be between 1KB and 100MB';
    }

    return newErrors;
  }, [formData]);

  // ✅ Input Handler with Debouncing
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => {
      let newValue;
      
      if (name === 'team') {
        const currentTeamIds = Array.isArray(prev.team) ? prev.team : [];
        newValue = {
          ...prev,
          team: checked 
            ? [...currentTeamIds, value]
            : currentTeamIds.filter(id => id !== value)
        };
      } else if (name === 'allowedFileTypes') {
        const currentFileTypes = Array.isArray(prev.allowedFileTypes) ? prev.allowedFileTypes : [];
        newValue = {
          ...prev,
          allowedFileTypes: checked
            ? [...currentFileTypes, value]
            : currentFileTypes.filter(type => type !== value)
        };
      } else if (name === 'assignToAll') {
        newValue = {
          ...prev,
          assignToAll: checked,
          team: checked ? teams.map(team => team._id) : []
        };
      } else {
        newValue = {
          ...prev,
          [name]: type === 'checkbox' ? checked : 
                  type === 'number' ? parseFloat(value) || 0 : value
        };
      }
      
      // Validate field
      setTimeout(() => {
        if (mountedRef.current) {
          validateField(name, type === 'checkbox' ? checked : value);
        }
      }, 300);
      
      return newValue;
    });
    
    // Clear submit errors when user makes changes
    if (errors.submit) {
      setErrors(prev => ({ ...prev, submit: null }));
    }
  }, [teams, errors.submit, validateField]);

  // ✅ Enhanced Task Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (loading || submitAttempted) return;
    
    setSubmitAttempted(true);
    setLoading(true);
    setErrors({});
    
    try {
      // Final validation
      const validationErrors = validateForm();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
      
      // Check network status before submitting
      const isOnline = await checkNetworkStatus();
      if (!isOnline) {
        throw new Error('Network connection unavailable. Please check your internet connection.');
      }
      
      // Prepare request payload
      const requestBody = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        instructions: formData.instructions.trim(),
        rubric: formData.rubric.trim(),
        dueDate: formData.dueDate,
        maxPoints: parseInt(formData.maxPoints),
        serverId: serverId,
        team: formData.assignToAll ? teams.map(team => team._id) : formData.team,
        assignmentType: formData.assignmentType,
        allowLateSubmissions: formData.allowLateSubmissions,
        maxAttempts: parseInt(formData.maxAttempts),
        allowFileUpload: formData.allowFileUpload,
        allowedFileTypes: formData.allowedFileTypes,
        maxFileSize: parseInt(formData.maxFileSize),
        priority: formData.priority,
        autoGrade: formData.autoGrade,
        publishImmediately: formData.publishImmediately,
        notifyStudents: formData.notifyStudents
      };

      console.log('📤 Submitting task:', requestBody);

      const response = await fetch(`${API_BASE}/tasks/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Task creation failed:', errorText);
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('🎉 Task created successfully:', data);
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
        let errorMessage = error.message || 'Network error. Please try again.';
        
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please check your connection and try again.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Unable to connect to server. Please check if the server is running.';
        }
        
        setErrors({ submit: errorMessage });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setSubmitAttempted(false);
      }
    }
  };

  // ✅ Helper Functions
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30); // Minimum 30 minutes from now
    return now.toISOString().slice(0, 16);
  };

  // ✅ Component Sections

  // Header Section
  const TaskHeader = () => (
    <div className="flex items-center justify-between p-6 border-b border-gray-200">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Create New Task</h2>
          <p className="text-gray-600">
            {serverInfo ? `Server: ${serverInfo.title}` : serverTitle || 'Assign task to teams'}
          </p>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        {/* Network Status Indicator */}
        <div className="flex items-center space-x-2">
          {networkStatus === 'online' && (
            <div className="flex items-center space-x-1 text-green-600">
              <Wifi className="w-4 h-4" />
              <span className="text-xs">Online</span>
            </div>
          )}
          {networkStatus === 'offline' && (
            <div className="flex items-center space-x-1 text-red-600">
              <WifiOff className="w-4 h-4" />
              <span className="text-xs">Offline</span>
            </div>
          )}
          {networkStatus === 'checking' && (
            <div className="flex items-center space-x-1 text-yellow-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Checking...</span>
            </div>
          )}
        </div>
        
        {teams.length > 0 && (
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            {teams.length} teams available
          </span>
        )}
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // Network Error Component
  const NetworkError = () => {
    if (networkStatus === 'online' && !errors.teams) return null;
    
    return (
      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-red-800">Connection Issue</h4>
            <p className="text-sm text-red-700 mt-1">
              {errors.teams || 'Unable to connect to the server. Please check your internet connection.'}
            </p>
            <div className="mt-3 flex items-center space-x-3">
              <button
                onClick={handleRefreshTeams}
                disabled={loadingTeams}
                className="flex items-center space-x-2 px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingTeams ? 'animate-spin' : ''}`} />
                <span>Retry Connection</span>
              </button>
              
              <button
                onClick={checkNetworkStatus}
                className="text-sm text-red-600 hover:text-red-700 underline"
              >
                Test Network
              </button>
              
              {fetchAttempts > 0 && (
                <span className="text-xs text-red-600">
                  Attempt {fetchAttempts}/{MAX_RETRY_ATTEMPTS}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Basic Information Section - Same as before but with network error handling
  const BasicInfoSection = () => (
    <div className="space-y-6">
      <NetworkError />
      
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Info className="w-5 h-5 mr-2 text-blue-600" />
          Basic Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.title ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter a clear, descriptive title..."
              maxLength={100}
            />
            {validationErrors.title && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.title}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">{formData.title.length}/100 characters</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date & Time *
            </label>
            <input
              type="datetime-local"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleInputChange}
              min={getMinDateTime()}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.dueDate ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {validationErrors.dueDate && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.dueDate}</p>
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
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.maxPoints ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {validationErrors.maxPoints && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.maxPoints}</p>
            )}
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority Level
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {priorityOptions.map(option => (
                <label
                  key={option.value}
                  className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.priority === option.value
                      ? option.color
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={option.value}
                    checked={formData.priority === option.value}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  <span className="mr-2">{option.icon}</span>
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                validationErrors.description ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Provide a detailed description of the task requirements..."
              maxLength={2000}
            />
            {validationErrors.description && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.description}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">{formData.description.length}/2000 characters</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Enhanced Team Assignment Section with better error handling
  const TeamAssignmentSection = () => (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Users className="w-5 h-5 mr-2 text-green-600" />
            Team Assignment
          </h3>
          <button
            type="button"
            onClick={handleRefreshTeams}
            disabled={loadingTeams}
            className="flex items-center space-x-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingTeams ? 'animate-spin' : ''}`} />
            <span>Refresh Teams</span>
          </button>
        </div>
        
        {loadingTeams ? (
          <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">Loading teams from server...</p>
              <p className="text-sm text-gray-500">
                This may take a few moments
                {fetchAttempts > 1 && ` (Attempt ${fetchAttempts}/${MAX_RETRY_ATTEMPTS})`}
              </p>
            </div>
          </div>
        ) : teams.length > 0 ? (
          <div className="space-y-4">
            {/* Success indicator */}
            <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <span className="text-sm text-green-800">
                Successfully loaded {teams.length} teams from server
              </span>
            </div>
            
            {/* Assign to All Toggle */}
            <div className="flex items-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <input
                type="checkbox"
                name="assignToAll"
                checked={formData.assignToAll}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-3 flex items-center cursor-pointer">
                <UserPlus className="w-4 h-4 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-900">
                  Assign to all teams ({teams.length} teams)
                </span>
              </label>
            </div>
            
            {/* Individual Team Selection */}
            {!formData.assignToAll && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map(team => (
                  <div
                    key={team._id}
                    className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.team.includes(team._id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="team"
                      value={team._id}
                      checked={formData.team.includes(team._id)}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">{team.name}</p>
                        <span className="text-xs text-gray-500">{team.members?.length || 0} members</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{team.description}</p>
                    </div>
                    {formData.team.includes(team._id) && (
                      <CheckCircle className="w-5 h-5 text-blue-600 absolute top-2 right-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Selection Summary */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                {formData.assignToAll 
                  ? `Task will be assigned to all ${teams.length} teams`
                  : `Selected ${formData.team.length} of ${teams.length} teams`
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-600 mb-2">No Teams Available</h4>
            <p className="text-gray-500 mb-4">
              {errors.teams || 'No teams found in this server. Students need to create teams before you can assign tasks.'}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleRefreshTeams}
                disabled={loadingTeams}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingTeams ? 'animate-spin' : ''}`} />
                <span>Retry Loading Teams</span>
              </button>
              
              {networkStatus === 'offline' && (
                <p className="text-sm text-red-600">
                  ⚠️ Network connection issue detected. Please check your internet connection.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // File Upload Settings - Same as before
  const FileUploadSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2 text-purple-600" />
          File Upload Settings
        </h3>
        
        <div className="space-y-4">
          {/* Allow File Upload Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-900">Enable File Uploads</label>
              <p className="text-xs text-gray-600">Allow students to submit files with their assignments</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="allowFileUpload"
                checked={formData.allowFileUpload}
                onChange={handleInputChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {formData.allowFileUpload && (
            <>
              {/* File Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Allowed File Types *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {fileTypeOptions.map(option => (
                    <label
                      key={option.value}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.allowedFileTypes.includes(option.value)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="allowedFileTypes"
                        value={option.value}
                        checked={formData.allowedFileTypes.includes(option.value)}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 mr-1">{option.icon}</span>
                      <span className="text-xs font-medium">{option.label}</span>
                    </label>
                  ))}
                </div>
                {validationErrors.allowedFileTypes && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.allowedFileTypes}</p>
                )}
              </div>
              
              {/* File Size Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum File Size
                </label>
                <select
                  name="maxFileSize"
                  value={formData.maxFileSize}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={1048576}>1 MB</option>
                  <option value={5242880}>5 MB</option>
                  <option value={10485760}>10 MB</option>
                  <option value={20971520}>20 MB</option>
                  <option value={52428800}>50 MB</option>
                  <option value={104857600}>100 MB</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Current limit: {formatFileSize(formData.maxFileSize)}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Advanced Settings - Same as before
  const AdvancedSettingsSection = () => (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-gray-600" />
          Advanced Settings
        </h3>
        <div className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {showAdvanced && (
        <div className="space-y-6 pl-7">
          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Detailed Instructions
            </label>
            <textarea
              name="instructions"
              value={formData.instructions}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Provide step-by-step instructions for students..."
            />
          </div>
          
          {/* Rubric */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grading Rubric
            </label>
            <textarea
              name="rubric"
              value={formData.rubric}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Define grading criteria and point distribution..."
            />
          </div>
          
          {/* Submission Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                name="allowLateSubmissions"
                checked={formData.allowLateSubmissions}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">
                Allow late submissions
              </label>
            </div>
          </div>
          
          {/* Notification Settings */}
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="publishImmediately"
                checked={formData.publishImmediately}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">
                Publish task immediately
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                name="notifyStudents"
                checked={formData.notifyStudents}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">
                Send notifications to students
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                name="autoGrade"
                checked={formData.autoGrade}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">
                Enable auto-grading (when available)
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Submit Section with better error handling
  const SubmitSection = () => (
    <div className="flex items-center justify-between pt-6 border-t border-gray-200">
      <div className="text-sm text-gray-600">
        {teams.length > 0 ? (
          formData.assignToAll 
            ? `Ready to assign to all ${teams.length} teams`
            : `Selected ${formData.team.length} teams`
        ) : (
          <span className="text-red-600">⚠️ No teams available - cannot create task</span>
        )}
      </div>
      
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        
        <button
          type="submit"
          disabled={loading || teams.length === 0 || (!formData.assignToAll && formData.team.length === 0) || networkStatus === 'offline'}
          className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating Task...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Create Task</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Main Render
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <TaskHeader />
        
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {errors.submit && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800 font-medium">Task Creation Failed</p>
                    <p className="text-sm text-red-700 mt-1">{errors.submit}</p>
                  </div>
                </div>
              </div>
            )}
            
            <BasicInfoSection />
            <TeamAssignmentSection />
            <FileUploadSection />
            <AdvancedSettingsSection />
          </div>
          
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <SubmitSection />
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskCreator;