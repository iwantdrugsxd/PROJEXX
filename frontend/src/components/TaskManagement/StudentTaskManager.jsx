import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  FileText, 
  User, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  X,
  Upload,
  Trash2,
  Plus,
  Send,
  Eye,
  Download
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const StudentTaskManager = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submissionData, setSubmissionData] = useState({
    comment: '',
    collaborators: [''],
    files: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [logs, setLogs] = useState([]);

  const parsedAllowedFileTypes = useMemo(() => {
    if (!selectedTask?.allowFileUpload || !selectedTask?.allowedFileTypes) {
      return [];
    }
    const types = selectedTask.allowedFileTypes;
    if (Array.isArray(types)) {
      return types;
    }
    if (typeof types === 'string') {
      try {
        // Handle JSON string: "[\"pdf\",\"docx\"]"
        const parsed = JSON.parse(types);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // Handle comma-separated string: "pdf,docx"
        return types.split(',').map(t => t.trim().replace('.', ''));
      }
    }
    return [];
  }, [selectedTask]);

  // Enhanced logging function
  const addLog = (type, message, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type, // 'info', 'success', 'warning', 'error'
      message,
      data
    };
    
    setLogs(prev => [...prev, logEntry]);
    
    // Console logging with proper formatting
    const consoleMethod = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log';
    console[consoleMethod](`[${timestamp}] ${type.toUpperCase()}: ${message}`, data || '');
  };

  // Clear logs function
  const clearLogs = () => {
    setLogs([]);
    addLog('info', 'Logs cleared');
  };

  useEffect(() => {
    addLog('info', 'StudentTaskManager component mounted');
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      addLog('info', 'Starting to load tasks');
      setLoading(true);
      
      const response = await fetch(`${API_BASE}/tasks/student-tasks`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      addLog('info', `Tasks API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        addLog('error', `Failed to load tasks: ${response.status}`, errorText);
        throw new Error(`Failed to load tasks: ${response.status}`);
      }

      const data = await response.json();
      addLog('success', `Successfully loaded ${data.tasks?.length || 0} tasks`, data);
      
      if (data.success && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
      } else {
        addLog('warning', 'Invalid tasks data structure', data);
        setTasks([]);
      }
    } catch (error) {
      addLog('error', 'Error loading tasks', error.message);
      console.error('Error loading tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    addLog('info', 'Manual refresh triggered');
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
    addLog('success', 'Manual refresh completed');
  };

  const getTimeRemaining = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diff = due - now;

    if (diff < 0) {
      const overdue = Math.abs(diff);
      const days = Math.floor(overdue / (1000 * 60 * 60 * 24));
      const hours = Math.floor((overdue % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} overdue`;
      } else {
        return `${hours} hour${hours > 1 ? 's' : ''} overdue`;
      }
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} remaining`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
    } else {
      return 'Due soon';
    }
  };

  const canSubmit = (task) => {
    const isOverdue = new Date() > new Date(task.dueDate);
    const hasSubmitted = task.submissionStatus === 'submitted' || task.submissionStatus === 'graded';
    
    return !hasSubmitted && (!isOverdue || task.allowLateSubmissions);
  };

  const handleTaskClick = (task) => {
    addLog('info', `Selected task: ${task.title}`, task);
    setSelectedTask(task);
  };

  const handleSubmitClick = (task) => {
    addLog('info', `Opening submission modal for task: ${task.title}`, task);
    setSelectedTask(task);
    setShowSubmissionModal(true);
    setSubmissionData({
      comment: '',
      collaborators: [''],
      files: []
    });
    setErrors({});
  };

  const handleCollaboratorChange = (index, value) => {
    const newCollaborators = [...submissionData.collaborators];
    newCollaborators[index] = value;
    setSubmissionData(prev => ({
      ...prev,
      collaborators: newCollaborators
    }));
    addLog('info', `Updated collaborator ${index}: ${value}`);
  };

  const addCollaborator = () => {
    setSubmissionData(prev => ({
      ...prev,
      collaborators: [...prev.collaborators, '']
    }));
    addLog('info', 'Added new collaborator field');
  };

  const removeCollaborator = (index) => {
    const newCollaborators = submissionData.collaborators.filter((_, i) => i !== index);
    setSubmissionData(prev => ({
      ...prev,
      collaborators: newCollaborators
    }));
    addLog('info', `Removed collaborator at index ${index}`);
  };

  // FIXED: Enhanced file selection with proper event handling
  const handleFileSelect = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.target.files);
    const maxSize = selectedTask?.maxFileSize || 10485760; // 10MB default
    
    addLog('info', `Processing file selection - ${files.length} files selected`);
    addLog('info', `Task file upload settings`, {
      allowFileUpload: selectedTask?.allowFileUpload,
      allowedFileTypes: selectedTask?.allowedFileTypes,
      maxFileSize: maxSize
    });
    
    // Check if file uploads are allowed
    if (!selectedTask?.allowFileUpload) {
      const errorMsg = 'File uploads are not allowed for this task';
      setErrors(prev => ({ ...prev, files: errorMsg }));
      addLog('error', errorMsg);
      return;
    }
    
    const allowedTypes = parsedAllowedFileTypes;
    
    const validFiles = [];
    const fileErrors = [];

    files.forEach((file, index) => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      addLog('info', `Validating file ${index + 1}: ${file.name}`, {
        extension: fileExtension,
        size: file.size,
        type: file.type,
        maxSize: maxSize
      });
      
      // Validate file type (if restrictions exist)
      if (allowedTypes.length > 0 && !allowedTypes.includes(fileExtension)) {
        const errorMsg = `${file.name}: File type ".${fileExtension}" not allowed. Allowed: ${allowedTypes.join(', ')}`;
        fileErrors.push(errorMsg);
        addLog('error', `File type validation failed for ${file.name}`, {
          fileExtension,
          allowedTypes
        });
      }
      // Validate file size
      else if (file.size > maxSize) {
        const errorMsg = `${file.name}: File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`;
        fileErrors.push(errorMsg);
        addLog('error', `File size validation failed for ${file.name}`, {
          fileSize: file.size,
          maxSize: maxSize
        });
      }
      // File is valid
      else {
        validFiles.push(file);
        addLog('success', `File validated successfully: ${file.name}`);
      }
    });

    // Update errors and files
    if (fileErrors.length > 0) {
      setErrors(prev => ({ ...prev, files: fileErrors.join('\n') }));
      addLog('error', `File validation completed with ${fileErrors.length} errors`, fileErrors);
    } else {
      setErrors(prev => ({ ...prev, files: null }));
      addLog('success', 'All files passed validation');
    }

    if (validFiles.length > 0) {
      setSubmissionData(prev => ({
        ...prev,
        files: [...prev.files, ...validFiles]
      }));
      addLog('success', `Added ${validFiles.length} valid files to submission`);
    }

    // Clear the input
    e.target.value = '';
  };

  // FIXED: Proper file browse button handler
  const handleBrowseClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addLog('info', 'Browse button clicked - opening file dialog');
    document.getElementById('fileInput').click();
  };

  const removeFile = (index) => {
    const removedFile = submissionData.files[index];
    setSubmissionData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
    addLog('info', `Removed file: ${removedFile?.name}`, { index, fileName: removedFile?.name });
  };

  const validateSubmission = () => {
    addLog('info', 'Starting submission validation');
    const newErrors = {};

    // Validate comment
    if (!submissionData.comment.trim()) {
      newErrors.comment = 'Please provide a comment about your submission';
      addLog('error', 'Validation failed: Missing comment');
    }

    // Validate files if file upload is required
    if (selectedTask?.allowFileUpload && submissionData.files.length === 0) {
      newErrors.files = 'Please attach at least one file';
      addLog('error', 'Validation failed: No files attached when required');
    }

    // Validate collaborators format
    const invalidEmails = submissionData.collaborators.filter(email => 
      email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    );
    
    if (invalidEmails.length > 0) {
      newErrors.collaborators = 'Please enter valid email addresses for collaborators';
      addLog('error', 'Validation failed: Invalid collaborator emails', invalidEmails);
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    addLog(isValid ? 'success' : 'error', `Validation ${isValid ? 'passed' : 'failed'}`, newErrors);
    return isValid;
  };

  // Enhanced submission handler with comprehensive logging
  const handleSubmission = async (e) => {
    e.preventDefault();
    
    addLog('info', '=== SUBMISSION PROCESS STARTED ===');
    addLog('info', 'Submission URL', `${API_BASE}/tasks/${selectedTask?._id}/submit`);
    addLog('info', 'Selected task details', selectedTask);
    
    if (!selectedTask || !selectedTask._id) {
      const errorMsg = 'No valid task selected. Please refresh and try again.';
      setErrors(prev => ({ ...prev, submit: errorMsg }));
      addLog('error', errorMsg);
      return;
    }

    // Validate form first
    if (!validateSubmission()) {
      addLog('error', 'Form validation failed, aborting submission');
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      // Create FormData
      const formData = new FormData();
      
      if (submissionData.comment.trim()) {
        formData.append('comment', submissionData.comment.trim());
        addLog('info', 'Added comment to FormData', submissionData.comment.trim());
      }
      
      if (submissionData.files && submissionData.files.length > 0) {
        submissionData.files.forEach((file, index) => {
          formData.append('files', file);
          addLog('info', `Added file ${index + 1} to FormData`, {
            name: file.name,
            size: file.size,
            type: file.type
          });
        });
      }
      
      const validCollaborators = submissionData.collaborators.filter(email => email.trim());
      if (validCollaborators.length > 0) {
        formData.append('collaborators', JSON.stringify(validCollaborators));
        addLog('info', 'Added collaborators to FormData', validCollaborators);
      }

      addLog('info', 'FormData prepared successfully', {
        comment: submissionData.comment.trim(),
        filesCount: submissionData.files.length,
        collaboratorsCount: validCollaborators.length
      });

      // Make the request
      addLog('info', 'Making submission request...');
      const response = await fetch(`${API_BASE}/tasks/${selectedTask._id}/submit`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      addLog('info', `Response received - Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        addLog('error', `HTTP Error ${response.status}`, errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        // Specific error handling based on status
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          throw new Error(errorData.message || 'Access denied. You may not be a member of this task\'s team.');
        } else if (response.status === 404) {
          addLog('error', 'Task not found - 404 error details', {
            taskId: selectedTask._id,
            taskTitle: selectedTask.title,
            url: `${API_BASE}/tasks/${selectedTask._id}/submit`,
            errorMessage: errorData.message
          });
          throw new Error('Task not found. This task may have been deleted or you may not have access to it. Please refresh the page and try again.');
        } else {
          throw new Error(errorData.message || `Server error (${response.status})`);
        }
      }

      const data = await response.json();
      addLog('success', 'Submission successful', data);

      if (data.success) {
        addLog('success', 'Task submitted successfully!');
        
        // Close modal and reset form
        setShowSubmissionModal(false);
        setSubmissionData({
          comment: '',
          collaborators: [''],
          files: []
        });
        
        // Refresh tasks to show updated status
        addLog('info', 'Refreshing tasks after successful submission...');
        await loadTasks();
        
        // Show success message
        alert('Task submitted successfully!');
        addLog('success', '=== SUBMISSION PROCESS COMPLETED SUCCESSFULLY ===');
      } else {
        throw new Error(data.message || 'Submission failed');
      }

    } catch (error) {
      addLog('error', 'Submission error occurred', {
        error: error.message,
        taskId: selectedTask?._id,
        taskTitle: selectedTask?.title,
        url: `${API_BASE}/tasks/${selectedTask?._id}/submit`
      });
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setErrors(prev => ({ ...prev, submit: 'Network error. Please check your connection and ensure the server is running.' }));
      } else {
        setErrors(prev => ({ ...prev, submit: error.message || 'An unexpected error occurred during submission' }));
      }
    } finally {
      setSubmitting(false);
      addLog('info', '=== SUBMISSION PROCESS ENDED ===');
    }
  };

  // Debug function to test task existence
  const debugTask = async () => {
    if (!selectedTask) return;
    
    addLog('info', '=== TASK DEBUG START ===');
    addLog('info', 'Debug task details', selectedTask);
    
    try {
      // Test submit endpoint with OPTIONS request
      const optionsResponse = await fetch(`${API_BASE}/tasks/${selectedTask._id}/submit`, {
        method: 'OPTIONS',
        credentials: 'include'
      });
      addLog('info', `OPTIONS response: ${optionsResponse.status}`);
      
      // Test with empty POST to see detailed error
      const testResponse = await fetch(`${API_BASE}/tasks/${selectedTask._id}/submit`, {
        method: 'POST',
        credentials: 'include',
        body: new FormData()
      });
      
      const testResult = await testResponse.text();
      addLog('info', `Test submission response: ${testResponse.status}`, testResult);
      
    } catch (error) {
      addLog('error', 'Debug test failed', error.message);
    }
    
    addLog('info', '=== TASK DEBUG END ===');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header with refresh button */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Tasks</h1>
          <p className="text-gray-600">View and submit your assigned tasks</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={clearLogs}
            className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Clear Logs
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Logs Panel */}
      {logs.length > 0 && (
        <div className="mb-6 bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono max-h-64 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-white font-bold">Debug Logs ({logs.length})</h3>
            <button
              onClick={clearLogs}
              className="text-gray-400 hover:text-white text-xs"
            >
              Clear
            </button>
          </div>
          {logs.slice(-50).map((log, index) => (
            <div key={index} className={`mb-1 ${
              log.type === 'error' ? 'text-red-400' :
              log.type === 'warning' ? 'text-yellow-400' :
              log.type === 'success' ? 'text-green-400' :
              'text-blue-400'
            }`}>
              <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span className="text-white ml-2">{log.type.toUpperCase()}:</span>
              <span className="ml-2">{log.message}</span>
              {log.data && (
                <div className="ml-4 text-xs text-gray-300">
                  {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : log.data}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tasks Grid */}
      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No Tasks Found</h2>
          <p className="text-gray-500">You don't have any assigned tasks yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task) => (
            <div
              key={task._id}
              onClick={() => handleTaskClick(task)}
              className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{task.title}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    task.priority === 'high' ? 'bg-red-100 text-red-700' :
                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {task.priority}
                  </span>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{task.description}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>{getTimeRemaining(task.dueDate)}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <User className="w-4 h-4 mr-2" />
                    <span>{task.maxPoints} points</span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    task.submissionStatus === 'submitted' ? 'bg-blue-100 text-blue-800' :
                    task.submissionStatus === 'graded' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.submissionStatus === 'submitted' ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Submitted
                      </>
                    ) : task.submissionStatus === 'graded' ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Graded
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Pending
                      </>
                    )}
                  </span>

                  {canSubmit(task) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubmitClick(task);
                      }}
                      className="px-3 py-1 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-700 transition-colors"
                    >
                      Submit
                    </button>
                  )}
                </div>

                {task.submissionStatus === 'submitted' && task.submissionDate && (
                  <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-800">
                      Submitted on {task.submissionDate ? 
                        new Date(task.submissionDate).toLocaleDateString() : 'Unknown date'}
                    </p>
                  </div>
                )}

                {task.submissionStatus === 'graded' && task.grade !== undefined && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-green-800">
                        Grade: {task.grade}/{task.maxPoints}
                      </p>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    {task.feedback && (
                      <p className="text-sm text-green-700 mt-1">{task.feedback}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && !showSubmissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-xl font-bold text-gray-900">{selectedTask.title}</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={debugTask}
                  className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                >
                  Debug
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600">{selectedTask.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">Due Date</h4>
                  <p className="text-gray-600">{new Date(selectedTask.dueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Points</h4>
                  <p className="text-gray-600">{selectedTask.maxPoints}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Priority</h4>
                  <p className="text-gray-600 capitalize">{selectedTask.priority}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Attempts</h4>
                  <p className="text-gray-600">Max {selectedTask.maxAttempts}</p>
                </div>
              </div>

              {selectedTask.allowFileUpload && (
                <div>
                  <h4 className="font-medium text-gray-900">File Upload Settings</h4>
                  <p className="text-gray-600">
                    Allowed types: {selectedTask.allowedFileTypes?.join(', ') || 'All types'}
                  </p>
                  <p className="text-gray-600">
                    Max size: {Math.round((selectedTask.maxFileSize || 10485760) / 1024 / 1024)}MB
                  </p>
                </div>
              )}
            </div>

            <div className="border-t bg-gray-50 px-6 py-4 flex space-x-3 rounded-b-xl">
              <button
                onClick={() => setSelectedTask(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              {canSubmit(selectedTask) && (
                <button
                  onClick={() => handleSubmitClick(selectedTask)}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all"
                >
                  Submit Task
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FIXED: Enhanced Submission Modal with Proper Scrolling */}
      {showSubmissionModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* FIXED Header - stays at top */}
            <div className="flex-shrink-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Submit: {selectedTask.title}</h2>
                <p className="text-sm text-gray-600">Complete the form below to submit your work</p>
              </div>
              <button
                onClick={() => setShowSubmissionModal(false)}
                disabled={submitting}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            {/* FIXED Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Debug info in submission modal */}
              <div className="p-3 bg-blue-50 rounded-lg text-sm border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Debug Information</h4>
                <div className="space-y-1 text-blue-800">
                  <p><strong>Submit URL:</strong> {API_BASE}/tasks/{selectedTask._id}/submit</p>
                  <p><strong>Task ID:</strong> {selectedTask._id}</p>
                  <p><strong>File uploads allowed:</strong> {selectedTask.allowFileUpload ? 'Yes' : 'No'}</p>
                  {selectedTask.allowFileUpload && (
                    <>
                      <p><strong>Allowed types:</strong> {parsedAllowedFileTypes?.join(', ') || 'All types'}</p>
                      <p><strong>Max file size:</strong> {Math.round((selectedTask.maxFileSize || 10485760) / 1024 / 1024)}MB</p>
                    </>
                  )}
                </div>
              </div>

              {/* Error Display */}
              {Object.keys(errors).length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-900 mb-2">Please fix the following errors:</h4>
                  <ul className="space-y-1">
                    {Object.entries(errors).map(([field, error]) => (
                      <li key={field} className="text-red-800 text-sm">
                        <strong>{field}:</strong> {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <form onSubmit={handleSubmission} className="space-y-6">
                {/* Comment Section */}
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Submission Comment *
                </label>
                <textarea
                  value={submissionData.comment}
                  onChange={(e) => setSubmissionData(prev => ({ ...prev, comment: e.target.value }))}
                  rows={4}
                  placeholder="Describe your work, approach, or any notes about your submission..."
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${
                    errors.comment ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  disabled={submitting}
                />
                {errors.comment && (
                  <p className="mt-1 text-sm text-red-600">{errors.comment}</p>
                )}
              </div>

              {/* FIXED File Upload Section */}
              {selectedTask.allowFileUpload && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    File Attachments {selectedTask.allowFileUpload ? '*' : ''}
                  </label>
                  
                  {/* File Drop Zone */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 mb-2">
                      Drag and drop files here, or{' '}
                      <label className="text-purple-600 hover:text-purple-700 font-medium cursor-pointer">
                        browse
                        <input
                          type="file"
                          multiple
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={submitting}
                          accept={parsedAllowedFileTypes?.map(type => `.${type}`).join(',') || '*'}
                        />
                      </label>
                    </p>
                    <p className="text-xs text-gray-500">
                      Max size: {Math.round((selectedTask.maxFileSize || 10485760) / 1024 / 1024)}MB per file
                    </p>
                    {parsedAllowedFileTypes && parsedAllowedFileTypes.length > 0 && (
                      <p className="text-xs text-gray-500">
                        Allowed types: {parsedAllowedFileTypes.join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Selected Files List */}
                  {submissionData.files.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                      <h4 className="text-sm font-medium text-gray-700">Selected Files ({submissionData.files.length}):</h4>
                      {submissionData.files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            disabled={submitting}
                            className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.files && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-600 whitespace-pre-line">{errors.files}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Collaborators Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Collaborators (Optional)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Add email addresses of team members who worked on this submission
                </p>
                
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {submissionData.collaborators.map((collaborator, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="email"
                        value={collaborator}
                        onChange={(e) => handleCollaboratorChange(index, e.target.value)}
                        placeholder="Enter email address"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        disabled={submitting}
                      />
                      {submissionData.collaborators.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCollaborator(index)}
                          disabled={submitting}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Remove collaborator"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addCollaborator}
                  disabled={submitting}
                  className="mt-2 flex items-center space-x-1 text-purple-600 hover:text-purple-700 text-sm font-medium disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Collaborator</span>
                </button>

                {errors.collaborators && (
                  <p className="mt-1 text-sm text-red-600">{errors.collaborators}</p>
                )}
              </div>
              </form>
            </div>

          {/* FIXED Footer - stays at bottom */}
          <div className="flex-shrink-0 border-t bg-gray-50 px-6 py-4 rounded-b-xl">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {submitting ? (
                    <span className="flex items-center">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Submitting your work...
                    </span>
                  ) : (
                    <span>Ready to submit your work?</span>
                  )}
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowSubmissionModal(false)}
                    disabled={submitting}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmission}
                    disabled={submitting}
                    className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Task</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {errors.submit && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentTaskManager;