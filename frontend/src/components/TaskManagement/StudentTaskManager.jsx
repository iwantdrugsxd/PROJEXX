// ===== 3. frontend/src/components/TaskManagement/StudentTaskManager.jsx (COMPLETE FILE) =====
import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Award, 
  Users, 
  FileText, 
  Upload, 
  X, 
  Plus, 
  Minus, 
  AlertCircle,
  CheckCircle,
  Loader2,
  File,
  Trash2
} from 'lucide-react';

const StudentTaskManager = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionData, setSubmissionData] = useState({
    comment: '',
    collaborators: [''],
    files: []
  });
  const [errors, setErrors] = useState({});

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/tasks/student-tasks`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setTasks(data.tasks || []);
      } else {
        console.error('Failed to load tasks:', data.message);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return 'text-blue-600 bg-blue-50';
      case 'graded': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatTimeRemaining = (dueDate) => {
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
    setSelectedTask(task);
  };

 // Corrected functions for StudentTaskManager.jsx
// Replace your existing functions with these optimized versions:

const handleSubmitClick = (task) => {
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
};

const addCollaborator = () => {
  setSubmissionData(prev => ({
    ...prev,
    collaborators: [...prev.collaborators, '']
  }));
};

const removeCollaborator = (index) => {
  const newCollaborators = submissionData.collaborators.filter((_, i) => i !== index);
  setSubmissionData(prev => ({
    ...prev,
    collaborators: newCollaborators
  }));
};

// ✅ FIXED: Unified file selection handler
const handleFileSelect = (e) => {
  const files = Array.from(e.target.files);
  const maxSize = selectedTask?.maxFileSize || 10485760; // 10MB default
  
  console.log('🔍 Processing file selection...');
  console.log('📎 Selected files:', files.length);
  console.log('🔍 Task file upload allowed:', selectedTask?.allowFileUpload);
  console.log('🔍 Allowed file types:', selectedTask?.allowedFileTypes);
  
  // Check if file uploads are allowed
  if (!selectedTask?.allowFileUpload) {
    setErrors({ files: 'File uploads are not allowed for this task' });
    return;
  }
  
  // Get allowed file types
  let allowedTypes = selectedTask?.allowedFileTypes;
  
  // Handle different formats of allowedFileTypes
  if (typeof allowedTypes === 'string') {
    try {
      allowedTypes = JSON.parse(allowedTypes);
    } catch (e) {
      allowedTypes = allowedTypes.split(',').map(type => type.trim());
    }
  }
  
  if (!Array.isArray(allowedTypes)) {
    allowedTypes = [];
  }
  
  console.log('🔍 Processed allowed types:', allowedTypes);
  
  const validFiles = [];
  const fileErrors = [];

  files.forEach(file => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    console.log(`🔍 Validating file: ${file.name}`);
    console.log(`   - Extension: .${fileExtension}`);
    console.log(`   - Size: ${file.size} bytes`);
    console.log(`   - Max size: ${maxSize} bytes`);
    
    // Validate file type (if restrictions exist)
    if (allowedTypes.length > 0 && !allowedTypes.includes(fileExtension)) {
      const errorMsg = `${file.name}: File type ".${fileExtension}" not allowed. Allowed: ${allowedTypes.join(', ')}`;
      fileErrors.push(errorMsg);
      console.log('❌ File type rejected:', errorMsg);
    }
    // Validate file size
    else if (file.size > maxSize) {
      const errorMsg = `${file.name}: File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`;
      fileErrors.push(errorMsg);
      console.log('❌ File size rejected:', errorMsg);
    }
    // File is valid
    else {
      validFiles.push(file);
      console.log('✅ File accepted:', file.name);
    }
  });

  // Update errors and files
  if (fileErrors.length > 0) {
    setErrors(prev => ({ ...prev, files: fileErrors.join('\n') }));
  } else {
    setErrors(prev => ({ ...prev, files: null }));
  }

  if (validFiles.length > 0) {
    setSubmissionData(prev => ({
      ...prev,
      files: [...prev.files, ...validFiles]
    }));
  }

  // Clear the input
  e.target.value = '';
};

// ✅ File removal function
const removeFile = (index) => {
  console.log(`🗑️ Removing file at index ${index}`);
  setSubmissionData(prev => ({
    ...prev,
    files: prev.files.filter((_, i) => i !== index)
  }));
};

// ✅ Form validation
const validateSubmission = () => {
  const newErrors = {};

  // Validate comment
  if (!submissionData.comment.trim()) {
    newErrors.comment = 'Please provide a comment about your submission';
  }

  // Validate files if file upload is required
  if (selectedTask?.allowFileUpload && submissionData.files.length === 0) {
    newErrors.files = 'Please attach at least one file';
  }

  // Validate collaborators format
  const invalidEmails = submissionData.collaborators.filter(email => 
    email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
  
  if (invalidEmails.length > 0) {
    newErrors.collaborators = 'Please enter valid email addresses for collaborators';
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

// ✅ MAIN SUBMISSION HANDLER - This is the primary function
const handleSubmission = async () => {
  console.log('🚀 Starting task submission...');
  
  // Validate form first
  if (!validateSubmission()) {
    console.log('❌ Validation failed');
    return;
  }

  setSubmitting(true);
  setErrors({});

  try {
    // Create FormData
    const formData = new FormData();
    formData.append('comment', submissionData.comment.trim());
    
    // Process collaborators
    const validCollaborators = submissionData.collaborators.filter(email => 
      email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    );
    
    if (validCollaborators.length > 0) {
      formData.append('collaborators', JSON.stringify(validCollaborators));
    }

    // Process files
    console.log(`📎 Processing ${submissionData.files.length} files for submission...`);
    
    let validFileCount = 0;
    submissionData.files.forEach((file, index) => {
      if (file && file.name && file.size > 0) {
        formData.append('files', file);
        validFileCount++;
        console.log(`✅ Added file ${index + 1}: ${file.name} (${file.size} bytes)`);
      } else {
        console.error(`❌ Invalid file at index ${index}:`, file);
      }
    });

    console.log(`📤 Submitting to: ${API_BASE}/tasks/${selectedTask._id}/submit`);
    console.log(`📋 Submission details:`);
    console.log(`   - Comment: ${submissionData.comment.trim()}`);
    console.log(`   - Collaborators: ${validCollaborators.length}`);
    console.log(`   - Files: ${validFileCount}`);

    // Submit to server
    const response = await fetch(`${API_BASE}/tasks/${selectedTask._id}/submit`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    console.log(`📡 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP Error ${response.status}:`, errorText);
      throw new Error(`Server error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('📦 Server response:', data);

    if (data.success) {
      console.log('🎉 Task submitted successfully!');
      
      // Update local task state
      setTasks(prev => prev.map(task => 
        task._id === selectedTask._id 
          ? { 
              ...task, 
              submissionStatus: 'submitted',
              submissionDate: new Date().toISOString()
            }
          : task
      ));
      
      // Close modal and reset form
      setShowSubmissionModal(false);
      setSelectedTask(null);
      setSubmissionData({ comment: '', collaborators: [''], files: [] });
      setErrors({});
      
      // Show success message
      alert('Task submitted successfully!');
      
    } else {
      console.error('❌ Submission failed:', data.message);
      setErrors({ submit: data.message || 'Failed to submit task' });
    }

  } catch (error) {
    console.error('❌ Submission error:', error);
    setErrors({ 
      submit: error.message || 'Network error. Please check your connection and try again.' 
    });
  } finally {
    setSubmitting(false);
  }
};

// ✅ Alternative handler names for compatibility
const handleFileUpload = handleFileSelect; // Alias for consistency
const handleSubmit = handleSubmission;     // Alias for form submission
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Tasks</h1>
        <p className="text-gray-600">View and submit your assigned tasks</p>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Tasks Available</h3>
          <p className="text-gray-500">You don't have any tasks assigned yet. Check back later or contact your instructor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map(task => (
            <div key={task._id} className="bg-white rounded-lg shadow-md border hover:shadow-lg transition-shadow duration-200">
              <div className="p-6">
                {/* Task Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{task.title}</h3>
                    <p className="text-sm text-gray-600">Server: {task.server?.title}</p>
                    <p className="text-sm text-gray-600">Team: {task.team?.name}</p>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.submissionStatus)}`}>
                      {task.submissionStatus || 'pending'}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                </div>

                {/* Task Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    Due: {new Date(task.dueDate).toLocaleDateString()} at {new Date(task.dueDate).toLocaleTimeString()}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2" />
                    {formatTimeRemaining(task.dueDate)}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Award className="w-4 h-4 mr-2" />
                    {task.maxPoints} points
                  </div>
                  {task.allowFileUpload && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Upload className="w-4 h-4 mr-2" />
                      File uploads allowed ({task.allowedFileTypes?.join(', ') || 'All types'})
                    </div>
                  )}
                </div>

                {/* Task Description Preview */}
                <p className="text-sm text-gray-700 mb-4 line-clamp-3">
                  {task.description}
                </p>

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleTaskClick(task)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    View Details
                  </button>
                  {canSubmit(task) && (
                    <button
                      onClick={() => handleSubmitClick(task)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all text-sm"
                    >
                      Submit
                    </button>
                  )}
                </div>

                {/* Submission Info */}
                {task.submissionStatus === 'submitted' && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Submitted on {new Date(task.submissionDate).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {task.submissionStatus === 'graded' && (
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{selectedTask.title}</h2>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700">{selectedTask.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Due Date</h4>
                    <p className="text-gray-600">
                      {new Date(selectedTask.dueDate).toLocaleDateString()} at {new Date(selectedTask.dueDate).toLocaleTimeString()}
                    </p>
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

                <div className="flex space-x-3 pt-4">
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
          </div>
        </div>
      )}

      {/* Submission Modal */}
      {showSubmissionModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Submit: {selectedTask.title}</h2>
              <button
                onClick={() => setShowSubmissionModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                {/* Comment */}
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
                  />
                  {errors.comment && (
                    <p className="text-red-600 text-sm mt-1">{errors.comment}</p>
                  )}
                </div>

                {/* File Upload */}
                {selectedTask.allowFileUpload && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Files
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-4">
                        Drag files here or click to browse
                      </p>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        accept={selectedTask.allowedFileTypes?.map(type => `.${type}`).join(',') || '*'}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-block"
                      >
                        Choose Files
                      </label>
                      <p className="text-xs text-gray-500 mt-2">
                        Allowed: {selectedTask.allowedFileTypes?.join(', ') || 'All types'} | 
                        Max: {Math.round((selectedTask.maxFileSize || 10485760) / 1024 / 1024)}MB
                      </p>
                    </div>

                    {/* File List */}
                    {submissionData.files.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {submissionData.files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center">
                              <File className="w-5 h-5 text-gray-500 mr-3" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                <p className="text-xs text-gray-500">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFile(index)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {errors.files && (
                      <p className="text-red-600 text-sm mt-2">{errors.files}</p>
                    )}
                  </div>
                )}

                {/* Collaborators */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Collaborators (Optional)
                  </label>
                  <p className="text-sm text-gray-500 mb-3">
                    Add email addresses of team members who worked on this task
                  </p>
                  
                  {submissionData.collaborators.map((collaborator, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <input
                        type="email"
                        value={collaborator}
                        onChange={(e) => handleCollaboratorChange(index, e.target.value)}
                        placeholder="Enter email address"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      {submissionData.collaborators.length > 1 && (
                        <button
                          onClick={() => removeCollaborator(index)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  
                  <button
                    onClick={addCollaborator}
                    className="flex items-center text-purple-600 hover:text-purple-700 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Collaborator
                  </button>
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
                <div className="flex space-x-3 pt-4 border-t">
                  <button
                    onClick={() => setShowSubmissionModal(false)}
                    disabled={submitting}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmission}
                    disabled={submitting}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Task'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentTaskManager;