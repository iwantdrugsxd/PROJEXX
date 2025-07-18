import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  const validationTimeoutRef = useRef(null);
  
  // ✅ Core Form State - OPTIMIZED
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

  // ✅ UI State - SEPARATED for better performance
  const [uiState, setUiState] = useState({
    teams: [],
    loading: false,
    loadingTeams: false,
    errors: {},
    showAdvanced: false,
    submitAttempted: false,
    serverInfo: null,
    networkStatus: 'online',
    fetchAttempts: 0
  });

  // ✅ Validation state - SEPARATED and debounced
  const [validationErrors, setValidationErrors] = useState({});
  
  // ✅ Constants - MEMOIZED
  const API_BASE = useMemo(() => 
    process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_BASE || 'http://localhost:5000/api'
  , []);
  
  const MAX_RETRY_ATTEMPTS = 3;
  
  const fileTypeOptions = useMemo(() => [
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
  ], []);

  const priorityOptions = useMemo(() => [
    { value: 'low', label: 'Low Priority', color: 'text-green-600 bg-green-50 border-green-200', icon: '🟢' },
    { value: 'medium', label: 'Medium Priority', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: '🟡' },
    { value: 'high', label: 'High Priority', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: '🟠' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-600 bg-red-50 border-red-200', icon: '🔴' }
  ], []);

  // ✅ OPTIMIZED: Fast validation without debouncing for immediate feedback
  const validateFieldSync = useCallback((name, value) => {
    switch (name) {
      case 'title':
        if (!value.trim()) return 'Task title is required';
        if (value.length < 3) return 'Title must be at least 3 characters';
        if (value.length > 100) return 'Title must be less than 100 characters';
        return null;
        
      case 'description':
        if (!value.trim()) return 'Description is required';
        if (value.length < 10) return 'Description must be at least 10 characters';
        if (value.length > 2000) return 'Description must be less than 2000 characters';
        return null;
        
      case 'dueDate':
        if (!value) return 'Due date is required';
        const dueDate = new Date(value);
        const now = new Date();
        const minDate = new Date(now.getTime() + 30 * 60 * 1000);
        if (dueDate <= minDate) return 'Due date must be at least 30 minutes in the future';
        return null;
        
      case 'maxPoints':
        const points = parseFloat(value);
        if (!points || points < 1) return 'Maximum points must be at least 1';
        if (points > 1000) return 'Maximum points cannot exceed 1000';
        return null;
        
      case 'maxAttempts':
        const attempts = parseInt(value);
        if (!attempts || attempts < 1) return 'Must allow at least 1 attempt';
        if (attempts > 10) return 'Cannot exceed 10 attempts';
        return null;
        
      default:
        return null;
    }
  }, []);

  // ✅ OPTIMIZED: Debounced validation update (non-blocking)
  const updateValidationErrors = useCallback((name, error) => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
    
    validationTimeoutRef.current = setTimeout(() => {
      setValidationErrors(prev => {
        if (error) {
          return { ...prev, [name]: error };
        } else {
          const { [name]: removed, ...rest } = prev;
          return rest;
        }
      });
    }, 100); // Very short debounce for smooth experience
  }, []);

  // ✅ Network status check
  const checkNetworkStatus = useCallback(async () => {
    setUiState(prev => ({ ...prev, networkStatus: 'checking' }));
    try {
      setUiState(prev => ({ ...prev, networkStatus: 'online' }));
      return true;
    } catch (error) {
      console.error('❌ Network check failed:', error);
      setUiState(prev => ({ ...prev, networkStatus: 'offline' }));
      return false;
    }
  }, []);

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
      if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current);
    };
  }, [serverId]);

  // ✅ Server info fetching
  const fetchServerInfo = useCallback(async () => {
    if (!serverId) return;
    
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

  // ✅ Optimized Team Fetching
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
      
      const endpoints = [
        `${API_BASE}/teamRoutes/server/${serverId}/teams`,
        `${API_BASE}/tasks/server/${serverId}/teams`,
        `${API_BASE}/teamRoutes/faculty-teams`
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
          } else {
            errorMessage = `Failed to load teams: ${lastError}`;
          }
        }
        
        setUiState(prev => ({ 
          ...prev, 
          errors: { ...prev.errors, teams: errorMessage }
        }));
      }
      
    } catch (error) {
      console.error(`❌ Team fetch error (attempt ${retryCount + 1}):`, error);
      
      if (!mountedRef.current) return;
      
      if (error.name === 'AbortError') {
        console.log('🚫 Request was aborted');
        return;
      }
      
      setUiState(prev => ({ ...prev, networkStatus: 'offline' }));
      
      if (retryCount < MAX_RETRY_ATTEMPTS - 1) {
        const retryDelay = Math.pow(2, retryCount) * 1000;
        console.log(`⏱️ Retrying in ${retryDelay}ms...`);
        
        fetchTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            fetchTeamsWithRetry(retryCount + 1);
          }
        }, retryDelay);
        return;
      } else {
        let errorMessage = 'Failed to load teams after multiple attempts.';
        
        if (error.message.includes('Network connection')) {
          errorMessage = 'Network connection unavailable. Please check your internet connection and try again.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Unable to connect to server. Please check if the server is running and try again.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again later.';
        }
        
        setUiState(prev => ({ 
          ...prev, 
          errors: { ...prev.errors, teams: errorMessage }
        }));
      }
    } finally {
      if (mountedRef.current) {
        setUiState(prev => ({ ...prev, loadingTeams: false }));
      }
    }
  }, [serverId, API_BASE, formData.assignToAll]);

  // ✅ Manual Refresh Handler
  const handleRefreshTeams = useCallback(async () => {
    setUiState(prev => ({ ...prev, teams: [], fetchAttempts: 0 }));
    await fetchTeamsWithRetry();
  }, [fetchTeamsWithRetry]);

  // ✅ OPTIMIZED: Fast input handler - NO DEBOUNCING
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    
    // IMMEDIATE state update for smooth typing
    setFormData(prev => {
      if (name === 'team') {
        const currentTeamIds = Array.isArray(prev.team) ? prev.team : [];
        return {
          ...prev,
          team: checked 
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
      } else if (name === 'assignToAll') {
        return {
          ...prev,
          assignToAll: checked,
          team: checked ? (Array.isArray(uiState.teams) ? uiState.teams.map(team => team._id).filter(Boolean) : []) : []
        };
      } else {
        return {
          ...prev,
          [name]: type === 'checkbox' ? checked : 
                  type === 'number' ? parseFloat(value) || 0 : value
        };
      }
    });
    
    // ASYNC validation (non-blocking)
    if (['title', 'description', 'dueDate', 'maxPoints', 'maxAttempts'].includes(name)) {
      const inputValue = type === 'checkbox' ? checked : value;
      const error = validateFieldSync(name, inputValue);
      updateValidationErrors(name, error);
    }
    
    // Clear submit errors when user makes changes
    if (uiState.errors.submit) {
      setUiState(prev => ({ 
        ...prev, 
        errors: { ...prev.errors, submit: null }
      }));
    }
  }, [uiState.teams, uiState.errors.submit, validateFieldSync, updateValidationErrors]);

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

    if (formData.maxFileSize < 1024 || formData.maxFileSize > 104857600) {
      newErrors.maxFileSize = 'File size must be between 1KB and 100MB';
    }

    return newErrors;
  }, [formData]);

  // ✅ Enhanced Task Submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (uiState.loading || uiState.submitAttempted) return;
    
    setUiState(prev => ({ 
      ...prev, 
      submitAttempted: true, 
      loading: true, 
      errors: {} 
    }));
    
    try {
      const validationErrors = validateForm();
      if (Object.keys(validationErrors).length > 0) {
        setUiState(prev => ({ ...prev, errors: validationErrors }));
        return;
      }
      
      const isOnline = await checkNetworkStatus();
      if (!isOnline) {
        throw new Error('Network connection unavailable. Please check your internet connection.');
      }
       
       // ✅ FIXED: Backend expects separate tasks for each team, not array
       const selectedTeams = formData.assignToAll 
         ? uiState.teams.map(team => team._id) 
         : Array.isArray(formData.team) ? formData.team : [];

       // Ensure we have valid team IDs
       const validTeamIds = selectedTeams.filter(id => id && typeof id === 'string' && id.length === 24);
       
       console.log('🔍 Team data debug:', {
         assignToAll: formData.assignToAll,
         rawTeams: formData.team,
         selectedTeams: selectedTeams,
         validTeamIds: validTeamIds,
         teamsCount: validTeamIds.length
       });

       if (validTeamIds.length === 0) {
         throw new Error('No valid teams selected. Please select at least one team.');
       }

       // ✅ FIXED: Proper null/undefined checks for team data
       const availableTeams = Array.isArray(uiState.teams) ? uiState.teams : [];
       const selectedTeamIds = Array.isArray(formData.team) ? formData.team : [];
       
       const selectedTeams = formData.assignToAll 
         ? availableTeams.map(team => team?._id).filter(Boolean)
         : selectedTeamIds.filter(Boolean);

       // Ensure we have valid team IDs with proper validation
       const validTeamIds = selectedTeams.filter(id => {
         return id && 
                typeof id === 'string' && 
                id.length === 24 && 
                /^[0-9a-fA-F]{24}$/.test(id); // Valid MongoDB ObjectId format
       });
       
       console.log('🔍 Team data debug:', {
         assignToAll: formData.assignToAll,
         availableTeams: availableTeams.length,
         rawFormTeam: formData.team,
         selectedTeamIds: selectedTeamIds,
         selectedTeams: selectedTeams,
         validTeamIds: validTeamIds,
         teamsCount: validTeamIds.length
       });

       if (validTeamIds.length === 0) {
         throw new Error('No valid teams selected. Please select at least one team.');
       }

       // ✅ FIXED: Send single request with team array (backend will handle multiple teams)
       const requestBody = {
         title: formData.title.trim(),
         description: formData.description.trim(),
         instructions: formData.instructions.trim(),
         rubric: formData.rubric.trim(),
         dueDate: formData.dueDate,
         maxPoints: parseInt(formData.maxPoints),
         serverId: serverId,
         team: validTeamIds, // Send as array - backend will create tasks for each team
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

       console.log('📤 Submitting task creation request:', {
         ...requestBody,
         teamCount: validTeamIds.length,
         teamIds: validTeamIds
       });

       const response = await fetch(`${API_BASE}/tasks/create`, {
         method: 'POST',
         headers: { 
           'Content-Type': 'application/json',
           'Accept': 'application/json'
         },
         credentials: 'include',
         body: JSON.stringify(requestBody)
       });

       if (!response.ok) {
         const errorText = await response.text();
         console.error('❌ Task creation failed:', {
           status: response.status,
           statusText: response.statusText,
           errorText: errorText
         });
         
         let errorData;
         try {
           errorData = JSON.parse(errorText);
         } catch (parseError) {
           errorData = { message: errorText };
         }
         
         // Enhanced error handling
         if (response.status === 400) {
           if (errorData.message && errorData.message.includes('team')) {
             throw new Error('Team assignment error: Please ensure you have selected valid teams.');
           } else if (errorData.message && errorData.message.includes('validation')) {
             throw new Error(`Validation error: ${errorData.message}`);
           } else {
             throw new Error(errorData.message || 'Invalid request data. Please check all fields.');
           }
         } else if (response.status === 401) {
           throw new Error('Authentication failed. Please log in again.');
         } else if (response.status === 403) {
           throw new Error('Access denied. You may not have permission to create tasks for this server.');
         } else if (response.status === 404) {
           throw new Error('Server not found. Please check your server selection.');
         } else {
           throw new Error(`Server error (${response.status}): ${errorData.message || errorText}`);
         }
       }

       const data = await response.json();
       console.log('✅ Task creation response:', data);

       if (data.success) {
         console.log('🎉 Tasks created successfully:', {
           totalCreated: data.totalCreated,
           tasksCreated: data.tasks?.length || 0
         });
         
         if (mountedRef.current) {
           onTaskCreated?.(data);
           onClose?.();
         }
       } else {
         console.error('❌ Task creation failed:', data.message);
         if (mountedRef.current) {
           setUiState(prev => ({ 
             ...prev, 
             errors: { submit: data.message || 'Failed to create task' }
           }));
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
         
         setUiState(prev => ({ 
           ...prev, 
           errors: { submit: errorMessage }
         }));
       }
     } finally {
       if (mountedRef.current) {
         setUiState(prev => ({ 
           ...prev, 
           loading: false, 
           submitAttempted: false 
         }));
       }
     }
   }, [uiState.loading, uiState.submitAttempted, uiState.teams, validateForm, checkNetworkStatus, formData, serverId, API_BASE, onTaskCreated, onClose]);

   // ✅ Helper Functions
   const formatFileSize = useCallback((bytes) => {
     if (bytes === 0) return '0 Bytes';
     const k = 1024;
     const sizes = ['Bytes', 'KB', 'MB', 'GB'];
     const i = Math.floor(Math.log(bytes) / Math.log(k));
     return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
   }, []);

   const getMinDateTime = useCallback(() => {
     const now = new Date();
     now.setMinutes(now.getMinutes() + 30);
     return now.toISOString().slice(0, 16);
   }, []);

   // ✅ MEMOIZED Components for better performance

   const TaskHeader = useMemo(() => (
     <div className="flex items-center justify-between p-6 border-b border-gray-200">
       <div className="flex items-center space-x-4">
         <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
           <FileText className="w-5 h-5 text-blue-600" aria-hidden="true" />
         </div>
         <div>
           <h1 className="text-xl font-semibold text-gray-900">Create New Task</h1>
           <p className="text-gray-600">
             {uiState.serverInfo ? `Server: ${uiState.serverInfo.title}` : serverTitle || 'Assign task to teams'}
           </p>
         </div>
       </div>
       
       <div className="flex items-center space-x-2">
         <div className="flex items-center space-x-2">
           {uiState.networkStatus === 'online' && (
             <div className="flex items-center space-x-1 text-green-600" role="status" aria-label="Online">
               <Wifi className="w-4 h-4" aria-hidden="true" />
               <span className="text-xs">Online</span>
             </div>
           )}
           {uiState.networkStatus === 'offline' && (
             <div className="flex items-center space-x-1 text-red-600" role="status" aria-label="Offline">
               <WifiOff className="w-4 h-4" aria-hidden="true" />
               <span className="text-xs">Offline</span>
             </div>
           )}
           {uiState.networkStatus === 'checking' && (
             <div className="flex items-center space-x-1 text-yellow-600" role="status" aria-label="Checking connection">
               <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
               <span className="text-xs">Checking...</span>
             </div>
           )}
         </div>
         
         {uiState.teams.length > 0 && (
           <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium" role="status">
             {uiState.teams.length} teams available
           </span>
         )}
         <button
           onClick={onClose}
           className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
           aria-label="Close task creator"
         >
           <X className="w-5 h-5" aria-hidden="true" />
         </button>
       </div>
     </div>
   ), [uiState.serverInfo, uiState.networkStatus, uiState.teams.length, serverTitle, onClose]);

   const NetworkError = useMemo(() => {
     if (uiState.networkStatus === 'online' && !uiState.errors.teams) return null;
     
     return (
       <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
         <div className="flex items-start space-x-2">
           <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" aria-hidden="true" />
           <div className="flex-1">
             <h4 className="text-sm font-medium text-red-800">Connection Issue</h4>
             <p className="text-sm text-red-700 mt-1">
               {uiState.errors.teams || 'Unable to connect to the server. Please check your internet connection.'}
             </p>
             <div className="mt-3 flex items-center space-x-3">
               <button
                 onClick={handleRefreshTeams}
                 disabled={uiState.loadingTeams}
                 className="flex items-center space-x-2 px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200 transition-colors disabled:opacity-50"
                 aria-label="Retry connection"
               >
                 <RefreshCw className={`w-4 h-4 ${uiState.loadingTeams ? 'animate-spin' : ''}`} aria-hidden="true" />
                 <span>Retry Connection</span>
               </button>
               
               <button
                 onClick={checkNetworkStatus}
                 className="text-sm text-red-600 hover:text-red-700 underline"
               >
                 Test Network
               </button>
               
               {uiState.fetchAttempts > 0 && (
                 <span className="text-xs text-red-600">
                   Attempt {uiState.fetchAttempts}/{MAX_RETRY_ATTEMPTS}
                 </span>
               )}
             </div>
           </div>
         </div>
       </div>
     );
   }, [uiState.networkStatus, uiState.errors.teams, uiState.loadingTeams, uiState.fetchAttempts, handleRefreshTeams, checkNetworkStatus]);

   // ✅ OPTIMIZED Basic Information Section
   const BasicInfoSection = useMemo(() => (
     <div className="space-y-6">
       {NetworkError}
       
       <div>
         <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
           <Info className="w-5 h-5 mr-2 text-blue-600" aria-hidden="true" />
           Basic Information
         </h2>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="md:col-span-2">
             <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 mb-2">
               Task Title *
             </label>
             <input
               type="text"
               id="task-title"
               name="title"
               value={formData.title}
               onChange={handleInputChange}
               className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                 validationErrors.title ? 'border-red-300' : 'border-gray-300'
               }`}
               placeholder="Enter a clear, descriptive title..."
               maxLength={100}
               aria-describedby="title-error title-counter"
               aria-invalid={validationErrors.title ? 'true' : 'false'}
               required
             />
             {validationErrors.title && (
               <p id="title-error" className="mt-1 text-sm text-red-600" role="alert">
                 {validationErrors.title}
               </p>
             )}
             <p id="title-counter" className="mt-1 text-xs text-gray-500">
               {formData.title.length}/100 characters
             </p>
           </div>
           
           <div>
             <label htmlFor="due-date" className="block text-sm font-medium text-gray-700 mb-2">
               Due Date & Time *
             </label>
             <input
               type="datetime-local"
               id="due-date"
               name="dueDate"
               value={formData.dueDate}
               onChange={handleInputChange}
               min={getMinDateTime()}
               className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                 validationErrors.dueDate ? 'border-red-300' : 'border-gray-300'
               }`}
               aria-describedby="due-date-error"
               aria-invalid={validationErrors.dueDate ? 'true' : 'false'}
               required
             />
             {validationErrors.dueDate && (
               <p id="due-date-error" className="mt-1 text-sm text-red-600" role="alert">
                 {validationErrors.dueDate}
               </p>
             )}
           </div>
           
           <div>
             <label htmlFor="max-points" className="block text-sm font-medium text-gray-700 mb-2">
               Maximum Points *
             </label>
             <input
               type="number"
               id="max-points"
               name="maxPoints"
               value={formData.maxPoints}
               onChange={handleInputChange}
               min="1"
               max="1000"
               className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                 validationErrors.maxPoints ? 'border-red-300' : 'border-gray-300'
               }`}
               aria-describedby="max-points-error"
               aria-invalid={validationErrors.maxPoints ? 'true' : 'false'}
               required
             />
             {validationErrors.maxPoints && (
               <p id="max-points-error" className="mt-1 text-sm text-red-600" role="alert">
                 {validationErrors.maxPoints}
               </p>
             )}
           </div>
           
           <div className="md:col-span-2">
             <fieldset>
               <legend className="block text-sm font-medium text-gray-700 mb-2">
                 Priority Level
               </legend>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-3" role="radiogroup">
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
                     <span className="mr-2" aria-hidden="true">{option.icon}</span>
                     <span className="text-sm font-medium">
                       {option.label}
                     </span>
                   </label>
                 ))}
               </div>
             </fieldset>
           </div>
           
           <div className="md:col-span-2">
             <label htmlFor="task-description" className="block text-sm font-medium text-gray-700 mb-2">
               Description *
             </label>
             <textarea
               id="task-description"
               name="description"
               value={formData.description}
               onChange={handleInputChange}
               rows={4}
               className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-colors ${
                 validationErrors.description ? 'border-red-300' : 'border-gray-300'
               }`}
               placeholder="Provide a detailed description of the task requirements..."
               maxLength={2000}
               aria-describedby="description-error description-counter"
               aria-invalid={validationErrors.description ? 'true' : 'false'}
               required
             />
             {validationErrors.description && (
               <p id="description-error" className="mt-1 text-sm text-red-600" role="alert">
                 {validationErrors.description}
               </p>
             )}
             <p id="description-counter" className="mt-1 text-xs text-gray-500">
               {formData.description.length}/2000 characters
             </p>
           </div>
         </div>
       </div>
     </div>
   ), [NetworkError, formData.title, formData.dueDate, formData.maxPoints, formData.priority, formData.description, validationErrors, handleInputChange, priorityOptions, getMinDateTime]);

   // ✅ OPTIMIZED Team Assignment Section
   const TeamAssignmentSection = useMemo(() => (
     <div className="space-y-6">
       <div>
         <div className="flex items-center justify-between mb-4">
           <h2 className="text-lg font-medium text-gray-900 flex items-center">
             <Users className="w-5 h-5 mr-2 text-green-600" aria-hidden="true" />
             Team Assignment
           </h2>
           <button
             type="button"
             onClick={handleRefreshTeams}
             disabled={uiState.loadingTeams}
             className="flex items-center space-x-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
             aria-label="Refresh teams list"
           >
             <RefreshCw className={`w-4 h-4 ${uiState.loadingTeams ? 'animate-spin' : ''}`} aria-hidden="true" />
             <span>Refresh Teams</span>
           </button>
         </div>
         
         {uiState.loadingTeams ? (
           <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg" role="status" aria-live="polite">
             <div className="text-center">
               <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" aria-hidden="true" />
               <p className="text-gray-600 mb-2">Loading teams from server...</p>
               <p className="text-sm text-gray-500">
                 This may take a few moments
                 {uiState.fetchAttempts > 1 && ` (Attempt ${uiState.fetchAttempts}/${MAX_RETRY_ATTEMPTS})`}
               </p>
             </div>
           </div>
         ) : uiState.teams.length > 0 ? (
           <div className="space-y-4">
             <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg" role="status">
               <CheckCircle className="w-5 h-5 text-green-600 mr-2" aria-hidden="true" />
               <span className="text-sm text-green-800">
                 Successfully loaded {uiState.teams.length} teams from server
               </span>
             </div>
             
             <div className="flex items-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
               <input
                 type="checkbox"
                 id="assign-to-all"
                 name="assignToAll"
                 checked={formData.assignToAll}
                 onChange={handleInputChange}
                 className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
               />
               <label htmlFor="assign-to-all" className="ml-3 flex items-center cursor-pointer">
                 <UserPlus className="w-4 h-4 text-blue-600 mr-2" aria-hidden="true" />
                 <span className="text-sm font-medium text-blue-900">
                   Assign to all teams ({uiState.teams.length} teams)
                 </span>
               </label>
             </div>
             
             {!formData.assignToAll && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {uiState.teams.map(team => (
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
                       id={`team-${team._id}`}
                       name="team"
                       value={team._id}
                       checked={formData.team.includes(team._id)}
                       onChange={handleInputChange}
                       className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                     />
                     <label htmlFor={`team-${team._id}`} className="ml-3 flex-1 cursor-pointer">
                       <div className="flex items-center justify-between">
                         <p className="text-sm font-medium text-gray-900">{team.name}</p>
                         <span className="text-xs text-gray-500">
                           {team.members?.length || 0} members
                         </span>
                       </div>
                       <p className="text-xs text-gray-600 mt-1">
                         {team.description || 'No description available'}
                       </p>
                     </label>
                     {formData.team.includes(team._id) && (
                       <CheckCircle className="w-5 h-5 text-blue-600 absolute top-2 right-2" aria-hidden="true" />
                     )}
                   </div>
                 ))}
               </div>
             )}
             
             <div className="p-3 bg-gray-50 rounded-lg" role="status" aria-live="polite">
               <p className="text-sm text-gray-600">
                 {formData.assignToAll 
                   ? `Task will be assigned to all ${uiState.teams.length} teams`
                   : `Selected ${formData.team.length} of ${uiState.teams.length} teams`
                 }
               </p>
             </div>
           </div>
         ) : (
           <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300" role="alert">
             <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" aria-hidden="true" />
             <h3 className="text-lg font-medium text-gray-600 mb-2">No Teams Available</h3>
             <p className="text-gray-500 mb-4">
               {uiState.errors.teams || 'No teams found in this server. Students need to create teams before you can assign tasks.'}
             </p>
             <div className="space-y-2">
               <button
                 type="button"
                 onClick={handleRefreshTeams}
                 disabled={uiState.loadingTeams}
                 className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
               >
                 <RefreshCw className={`w-4 h-4 ${uiState.loadingTeams ? 'animate-spin' : ''}`} aria-hidden="true" />
                 <span>Retry Loading Teams</span>
               </button>
               
               {uiState.networkStatus === 'offline' && (
                 <p className="text-sm text-red-600" role="alert">
                   ⚠️ Network connection issue detected. Please check your internet connection.
                 </p>
               )}
             </div>
           </div>
         )}
       </div>
     </div>
   ), [uiState.teams, uiState.loadingTeams, uiState.fetchAttempts, uiState.errors.teams, uiState.networkStatus, formData.assignToAll, formData.team, handleInputChange, handleRefreshTeams]);

   // ✅ OPTIMIZED File Upload Section
   const FileUploadSection = useMemo(() => (
     <div className="space-y-6">
       <div>
         <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
           <Upload className="w-5 h-5 mr-2 text-purple-600" aria-hidden="true" />
           File Upload Settings
         </h2>
         
         <div className="space-y-4">
           <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
             <div>
               <label htmlFor="allow-file-upload" className="text-sm font-medium text-gray-900 cursor-pointer">
                 Enable File Uploads
               </label>
               <p className="text-xs text-gray-600">Allow students to submit files with their assignments</p>
             </div>
             <div className="relative inline-flex items-center cursor-pointer">
               <input
                 type="checkbox"
                 id="allow-file-upload"
                 name="allowFileUpload"
                 checked={formData.allowFileUpload}
                 onChange={handleInputChange}
                 className="sr-only peer"
               />
               <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
             </div>
           </div>
           
           {formData.allowFileUpload && (
             <>
               <fieldset>
                 <legend className="block text-sm font-medium text-gray-700 mb-3">
                   Allowed File Types *
                 </legend>
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
                       <span className="ml-2 mr-1" aria-hidden="true">{option.icon}</span>
                       <span className="text-xs font-medium">
                         {option.label}
                       </span>
                     </label>
                   ))}
                 </div>
                 {validationErrors.allowedFileTypes && (
                   <p className="mt-1 text-sm text-red-600" role="alert">
                     {validationErrors.allowedFileTypes}
                   </p>
                 )}
               </fieldset>
               
               <div>
                 <label htmlFor="max-file-size" className="block text-sm font-medium text-gray-700 mb-2">
                   Maximum File Size
                 </label>
                 <select
                   id="max-file-size"
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
   ), [formData.allowFileUpload, formData.allowedFileTypes, formData.maxFileSize, fileTypeOptions, validationErrors.allowedFileTypes, handleInputChange, formatFileSize]);

   // ✅ OPTIMIZED Advanced Settings Section
   const AdvancedSettingsSection = useMemo(() => (
     <div className="space-y-6">
       <button
         type="button"
         onClick={() => setUiState(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
         className="flex items-center justify-between w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-2"
         aria-expanded={uiState.showAdvanced}
       >
         <h2 className="text-lg font-medium text-gray-900 flex items-center">
           <Settings className="w-5 h-5 mr-2 text-gray-600" aria-hidden="true" />
           Advanced Settings
         </h2>
         <div className={`transform transition-transform ${uiState.showAdvanced ? 'rotate-180' : ''}`}>
           <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
           </svg>
         </div>
       </button>
       
       {uiState.showAdvanced && (
         <div className="space-y-6 pl-7">
           <div>
             <label htmlFor="task-instructions" className="block text-sm font-medium text-gray-700 mb-2">
               Detailed Instructions
             </label>
             <textarea
               id="task-instructions"
               name="instructions"
               value={formData.instructions}
               onChange={handleInputChange}
               rows={3}
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
               placeholder="Provide step-by-step instructions for students..."
             />
           </div>
           
           <div>
             <label htmlFor="task-rubric" className="block text-sm font-medium text-gray-700 mb-2">
               Grading Rubric
             </label>
             <textarea
               id="task-rubric"
               name="rubric"
               value={formData.rubric}
               onChange={handleInputChange}
               rows={3}
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
               placeholder="Define grading criteria and point distribution..."
             />
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label htmlFor="max-attempts" className="block text-sm font-medium text-gray-700 mb-2">
                 Maximum Attempts
               </label>
               <input
                 type="number"
                 id="max-attempts"
                 name="maxAttempts"
                 value={formData.maxAttempts}
                 onChange={handleInputChange}
                 min="1"
                 max="10"
                 className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                   validationErrors.maxAttempts ? 'border-red-300' : 'border-gray-300'
                 }`}
               />
               {validationErrors.maxAttempts && (
                 <p className="mt-1 text-sm text-red-600" role="alert">
                   {validationErrors.maxAttempts}
                 </p>
               )}
             </div>
             
             <div className="flex items-center">
               <input
                 type="checkbox"
                 id="allow-late-submissions"
                 name="allowLateSubmissions"
                 checked={formData.allowLateSubmissions}
                 onChange={handleInputChange}
                 className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
               />
               <label htmlFor="allow-late-submissions" className="ml-2 text-sm text-gray-700 cursor-pointer">
                 Allow late submissions
               </label>
             </div>
           </div>
           
           <fieldset>
             <legend className="text-sm font-medium text-gray-700 mb-3">Notification Settings</legend>
             <div className="space-y-3">
               <div className="flex items-center">
                 <input
                   type="checkbox"
                   id="publish-immediately"
                   name="publishImmediately"
                   checked={formData.publishImmediately}
                   onChange={handleInputChange}
                   className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                 />
                 <label htmlFor="publish-immediately" className="ml-2 text-sm text-gray-700 cursor-pointer">
                   Publish task immediately
                 </label>
               </div>
               
               <div className="flex items-center">
                 <input
                   type="checkbox"
                   id="notify-students"
                   name="notifyStudents"
                   checked={formData.notifyStudents}
                   onChange={handleInputChange}
                   className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                 />
                 <label htmlFor="notify-students" className="ml-2 text-sm text-gray-700 cursor-pointer">
                   Send notifications to students
                 </label>
               </div>
               
               <div className="flex items-center">
                 <input
                   type="checkbox"
                   id="auto-grade"
                   name="autoGrade"
                   checked={formData.autoGrade}
                   onChange={handleInputChange}
                   className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                 />
                 <label htmlFor="auto-grade" className="ml-2 text-sm text-gray-700 cursor-pointer">
                   Enable auto-grading (when available)
                 </label>
               </div>
             </div>
           </fieldset>
         </div>
       )}
     </div>
   ), [uiState.showAdvanced, formData.instructions, formData.rubric, formData.maxAttempts, formData.allowLateSubmissions, formData.publishImmediately, formData.notifyStudents, formData.autoGrade, validationErrors.maxAttempts, handleInputChange]);

   // ✅ OPTIMIZED Submit Section
   const SubmitSection = useMemo(() => {
     // ✅ FIXED: Proper null checks for team validation
     const availableTeams = Array.isArray(uiState.teams) ? uiState.teams : [];
     const selectedTeamIds = Array.isArray(formData.team) ? formData.team : [];
     
     const hasValidTeams = formData.assignToAll 
       ? availableTeams.length > 0 
       : selectedTeamIds.length > 0;
       
     const canSubmit = availableTeams.length > 0 && hasValidTeams && uiState.networkStatus !== 'offline';
     
     return (
       <div className="flex items-center justify-between pt-6 border-t border-gray-200">
         <div className="text-sm text-gray-600">
           {availableTeams.length > 0 ? (
             formData.assignToAll 
              ? `Ready to assign to all ${availableTeams.length} teams`
               : `Selected ${selectedTeamIds.length} teams`
           ) : (
             <span className="text-red-600" role="alert">⚠️ No teams available - cannot create task</span>
           )}
         </div>
         
         <div className="flex items-center space-x-3">
           <button
             type="button"
             onClick={onClose}
             disabled={uiState.loading}
             className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
           >
             Cancel
           </button>
           
           <button
             type="submit"
             disabled={uiState.loading || !canSubmit}
             className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {uiState.loading ? (
               <>
                 <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                 <span>Creating Task...</span>
               </>
             ) : (
               <>
                 <Send className="w-4 h-4" aria-hidden="true" />
                 <span>Create Task</span>
               </>
             )}
           </button>
         </div>
       </div>
     );
   }, [uiState.teams, uiState.loading, uiState.networkStatus, formData.assignToAll, formData.team, onClose]);

   // ✅ Main Render
   return (
     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
       <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
         {TaskHeader}
         
         <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0" noValidate>
           <div className="flex-1 overflow-y-auto p-6 space-y-8" style={{ maxHeight: 'calc(90vh - 200px)' }}>
             {uiState.errors.submit && (
               <div className="p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
                 <div className="flex items-start space-x-2">
                   <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" aria-hidden="true" />
                   <div>
                     <p className="text-sm text-red-800 font-medium">Task Creation Failed</p>
                     <p className="text-sm text-red-700 mt-1">{uiState.errors.submit}</p>
                   </div>
                 </div>
               </div>
             )}
             
             {BasicInfoSection}
             {TeamAssignmentSection}
             {FileUploadSection}
             {AdvancedSettingsSection}
           </div>
           
           <div className="border-t border-gray-200 p-6 bg-gray-50 flex-shrink-0">
             {SubmitSection}
           </div>
         </form>
       </div>
     </div>
   );
 };

 export default React.memo(TaskCreator);