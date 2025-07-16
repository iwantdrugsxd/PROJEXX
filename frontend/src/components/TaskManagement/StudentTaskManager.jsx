import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Clock, 
  Award, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Upload, 
  X, 
  Plus, 
  Paperclip,
  User,
  Mail,
  Send,
  Loader2
} from 'lucide-react';

const StudentTaskManager = () => {
  // State management
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [submissionData, setSubmissionData] = useState({
    comment: '',
    collaborators: [''],
    files: []
  });
  
  const fileInputRef = useRef(null);
  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  // Load tasks on component mount
  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
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
        setTasks([]);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Utility functions
  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return 'text-blue-600 bg-blue-50';
      case 'graded': return 'text-green-600 bg-green-50';
      case 'overdue': return 'text-red-600 bg-red-50';
      default: return 'text-yellow-600 bg-yellow-50';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'urgent': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
    setSelectedTask(task);
  };

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

  // ✅ FIXED: File selection handler with proper validation
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = selectedTask?.maxFileSize || 10485760; // 10MB default
    
    // ✅ FIXED: Better handling of allowedFileTypes
    console.log('🔍 Selected task:', selectedTask);
    console.log('🔍 Task allowedFileTypes:', selectedTask?.allowedFileTypes);
    console.log('🔍 Is allowedFileTypes array?:', Array.isArray(selectedTask?.allowedFileTypes));
    console.log('🔍 allowedFileTypes length:', selectedTask?.allowedFileTypes?.length);
    
    // ✅ FIXED: Proper fallback and validation
    let allowedTypes = selectedTask?.allowedFileTypes;
    
    if (!allowedTypes || !Array.isArray(allowedTypes) || allowedTypes.length === 0) {
      console.log('⚠️ No allowedFileTypes found, using default types');
      allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'zip', 'rar'];
    }
    
    console.log('🔍 Final allowedTypes for validation:', allowedTypes);
    
    const validFiles = [];
    const fileErrors = [];

    files.forEach(file => {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      console.log(`🔍 Checking file "${file.name}" with extension "${fileExtension}"`);
      console.log(`🔍 Is "${fileExtension}" in allowedTypes?`, allowedTypes.includes(fileExtension));
      
      if (!allowedTypes.includes(fileExtension)) {
        const errorMsg = `${file.name}: File type ".${fileExtension}" not allowed. Allowed types: ${allowedTypes.join(', ')}`;
        fileErrors.push(errorMsg);
        console.log('❌ File rejected:', errorMsg);
      } else if (file.size > maxSize) {
        const errorMsg = `${file.name}: File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`;
        fileErrors.push(errorMsg);
        console.log('❌ File too large:', errorMsg);
      } else {
        validFiles.push(file);
        console.log('✅ File accepted:', file.name);
      }
    });

    if (fileErrors.length > 0) {
      setErrors(prev => ({ ...prev, files: fileErrors.join(', ') }));
    } else {
      setErrors(prev => ({ ...prev, files: null }));
    }

    setSubmissionData(prev => ({
      ...prev,
      files: [...prev.files, ...validFiles]
    }));
  };

  const removeFile = (index) => {
    setSubmissionData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const validateSubmission = () => {
    const newErrors = {};

    if (!submissionData.comment.trim()) {
      newErrors.comment = 'Please provide a comment about your submission';
    }

    if (submissionData.files.length === 0 && selectedTask?.allowFileUpload) {
      newErrors.files = 'Please attach at least one file';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmission = async () => {
    if (!validateSubmission()) {
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('comment', submissionData.comment.trim());
      
      const validCollaborators = submissionData.collaborators.filter(email => 
        email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      );
      formData.append('collaborators', JSON.stringify(validCollaborators));

      submissionData.files.forEach((file) => {
        formData.append(`files`, file);
      });

      const response = await fetch(`${API_BASE}/tasks/${selectedTask._id}/submit`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        // Update task status
        setTasks(prev => prev.map(task => 
          task._id === selectedTask._id 
            ? { ...task, submissionStatus: 'submitted' }
            : task
        ));
        
        setShowSubmissionModal(false);
        setSelectedTask(null);
      } else {
        setErrors({ submit: data.message || 'Failed to submit task' });
      }
    } catch (error) {
      console.error('Submission error:', error);
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ DEBUGGING: Debug function to check task data
  const debugTaskData = () => {
    console.log('=== TASK DEBUG DATA ===');
    console.log('Selected Task:', selectedTask);
    console.log('Task ID:', selectedTask?._id);
    console.log('Allow File Upload:', selectedTask?.allowFileUpload);
    console.log('Allowed File Types:', selectedTask?.allowedFileTypes);
    console.log('Allowed File Types Type:', typeof selectedTask?.allowedFileTypes);
    console.log('Allowed File Types Array?:', Array.isArray(selectedTask?.allowedFileTypes));
    console.log('Allowed File Types Length:', selectedTask?.allowedFileTypes?.length);
    console.log('Max File Size:', selectedTask?.maxFileSize);
    console.log('Full Task Object:', JSON.stringify(selectedTask, null, 2));
  };

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
          <h3 className="text-xl font-medium text-gray-900 mb-2">No tasks assigned</h3>
          <p className="text-gray-600">You don't have any tasks assigned to your teams yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map(task => (
            <div
              key={task._id}
              className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleTaskClick(task)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.submissionStatus)}`}>
                    {task.submissionStatus || 'pending'}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {task.title}
                </h3>

                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {task.description}
                </p>

                <div className="space-y-2 text-sm text-gray-500 mb-4">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Due: {formatDate(task.dueDate)}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>{getTimeRemaining(task.dueDate)}</span>
                  </div>
                  <div className="flex items-center">
                    <Award className="w-4 h-4 mr-2" />
                    <span>{task.maxPoints} points</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    <span>{task.team?.name}</span>
                  </div>
                </div>

                {canSubmit(task) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubmitClick(task);
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2 px-4 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center justify-center"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Submit Task
                  </button>
                )}

                {task.submissionStatus === 'submitted' && (
                  <div className="flex items-center text-blue-600 text-sm">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Submitted on {formatDate(task.submissionDate)}
                  </div>
                )}

                {task.submissionStatus === 'graded' && task.grade && (
                  <div className="flex items-center text-green-600 text-sm">
                    <Award className="w-4 h-4 mr-2" />
                    Grade: {task.grade}/{task.maxPoints}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Submission Modal */}
      {showSubmissionModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-green-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold">Submit Task</h2>
                <p className="text-green-100 text-sm">{selectedTask.title}</p>
              </div>
              <button
                onClick={() => setShowSubmissionModal(false)}
                className="text-green-100 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* ✅ DEBUG BUTTON - Remove after testing */}
              <button
                type="button"
                onClick={debugTaskData}
                className="mb-4 px-4 py-2 bg-blue-500 text-white rounded text-sm"
              >
                🔍 Debug Task Data
              </button>

              {/* Submission Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-2" />
                  Submission Comment *
                </label>
                <textarea
                  value={submissionData.comment}
                  onChange={(e) => setSubmissionData(prev => ({ ...prev, comment: e.target.value }))}
                  rows={4}
                  placeholder="Describe your submission, approach, or any notes..."
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none ${
                    errors.comment ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                <div className="text-right text-sm text-gray-500 mt-1">
                  {submissionData.comment.length}/1000
                </div>
                {errors.comment && (
                  <p className="text-red-600 text-sm mt-1">{errors.comment}</p>
                )}
              </div>

              {/* Collaborators */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Collaborators (Optional)
                </label>
                <div className="space-y-2">
                  {submissionData.collaborators.map((email, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="flex-1 relative">
                        <Mail className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => handleCollaboratorChange(index, e.target.value)}
                          placeholder="collaborator@email.com"
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      {submissionData.collaborators.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCollaborator(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addCollaborator}
                  className="mt-2 flex items-center text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Collaborator
                </button>
              </div>

              {/* File Upload */}
              {selectedTask?.allowFileUpload && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Paperclip className="w-4 h-4 inline mr-2" />
                    Attach Files
                  </label>
                  
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">Click to upload files or drag and drop</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {/* ✅ FIXED: Better display of allowed types */}
                      Allowed: {(() => {
                        const types = selectedTask?.allowedFileTypes;
                        if (!types || !Array.isArray(types) || types.length === 0) {
                          return 'All types';
                        }
                        return types.join(', ');
                      })()} 
                      (Max: {Math.round((selectedTask?.maxFileSize || 10485760) / 1024 / 1024)}MB)
                    </p>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={(() => {
                      const types = selectedTask?.allowedFileTypes;
                      if (!types || !Array.isArray(types) || types.length === 0) {
                        return "*/*"; // Accept all types if none specified
                      }
                      return types.map(type => `.${type}`).join(',');
                    })()}
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {errors.files && (
                    <p className="text-red-600 text-sm mt-2">{errors.files}</p>
                  )}

                  {/* File List */}
                  {submissionData.files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {submissionData.files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 text-gray-500 mr-2" />
                            <span className="text-sm font-medium">{file.name}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({Math.round(file.size / 1024)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                  onClick={() => setShowSubmissionModal(false)}
                  disabled={submitting}
                  className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmission}
                  disabled={submitting}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Task
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && !showSubmissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedTask.title}</h2>
                <p className="text-sm text-gray-600">
                  {selectedTask.server?.title} • {selectedTask.team?.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedTask.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Due Date</h4>
                    <p className="text-gray-600">{formatDate(selectedTask.dueDate)}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Points</h4>
                    <p className="text-gray-600">{selectedTask.maxPoints}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Priority</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedTask.priority)}`}>
                      {selectedTask.priority}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Status</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTask.submissionStatus)}`}>
                      {selectedTask.submissionStatus || 'pending'}
                    </span>
                  </div>
                </div>

                {selectedTask.allowFileUpload && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">File Upload Requirements</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <strong>Allowed file types:</strong> {
                          selectedTask.allowedFileTypes && selectedTask.allowedFileTypes.length > 0
                            ? selectedTask.allowedFileTypes.join(', ')
                            : 'All types'
                        }
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <strong>Maximum file size:</strong> {Math.round((selectedTask.maxFileSize || 10485760) / 1024 / 1024)}MB
                      </p>
                    </div>
                  </div>
                )}

                {canSubmit(selectedTask) && (
                  <div className="pt-4 border-t">
                    <button
                      onClick={() => handleSubmitClick(selectedTask)}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-4 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center justify-center"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Submit This Task
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentTaskManager;