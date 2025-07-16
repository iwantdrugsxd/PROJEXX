// File: src/components/TaskManagement/StudentTaskManager.jsx

import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Clock, 
  Award, 
  FileText, 
  Upload, 
  Download, 
  Eye, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Users,
  Target,
  MessageSquare,
  Paperclip,
  X,
  Plus,
  Trash2,
  Send
} from 'lucide-react';

const StudentTaskManager = ({ userId }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submissionData, setSubmissionData] = useState({
    comment: '',
    collaborators: [''],
    files: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/tasks/student-tasks`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success) {
        setTasks(data.tasks || []);
      } else {
        console.error('Failed to fetch tasks:', data.message);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status, dueDate) => {
    const isOverdue = new Date() > new Date(dueDate);
    
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'graded':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'returned':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return isOverdue 
          ? 'bg-red-100 text-red-800 border-red-200'
          : 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusIcon = (status, dueDate) => {
    const isOverdue = new Date() > new Date(dueDate);
    
    switch (status) {
      case 'submitted':
        return <CheckCircle className="w-4 h-4" />;
      case 'graded':
        return <Award className="w-4 h-4" />;
      case 'returned':
        return <Eye className="w-4 h-4" />;
      default:
        return isOverdue 
          ? <AlertCircle className="w-4 h-4" />
          : <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status, dueDate) => {
    const isOverdue = new Date() > new Date(dueDate);
    
    switch (status) {
      case 'submitted':
        return 'Submitted';
      case 'graded':
        return 'Graded';
      case 'returned':
        return 'Returned';
      default:
        return isOverdue ? 'Overdue' : 'Pending';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = selectedTask?.maxFileSize || 10485760; // 10MB default
    const allowedTypes = selectedTask?.allowedFileTypes || ['pdf', 'doc', 'docx', 'txt'];
    
    const validFiles = [];
    const fileErrors = [];

    files.forEach(file => {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      if (!allowedTypes.includes(fileExtension)) {
        fileErrors.push(`${file.name}: File type not allowed`);
      } else if (file.size > maxSize) {
        fileErrors.push(`${file.name}: File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`);
      } else {
        validFiles.push(file);
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

  const TaskCard = ({ task }) => (
    <div 
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-purple-500"
      onClick={() => handleTaskClick(task)}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{task.title}</h3>
            <p className="text-gray-600 text-sm line-clamp-2">{task.description}</p>
          </div>
          
          <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center ${getStatusColor(task.submissionStatus, task.dueDate)}`}>
            {getStatusIcon(task.submissionStatus, task.dueDate)}
            <span className="ml-1">{getStatusText(task.submissionStatus, task.dueDate)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-1" />
            <span>{task.team?.name || 'Unknown Team'}</span>
          </div>
          
          <div className="flex items-center">
            <Award className="w-4 h-4 mr-1" />
            <span>{task.maxPoints} points</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm">
            <Calendar className="w-4 h-4 mr-1 text-gray-400" />
            <span className="text-gray-600">{formatDate(task.dueDate)}</span>
          </div>
          
          <div className="text-sm">
            {task.submissionStatus === 'graded' && task.grade !== undefined && (
              <span className="text-green-600 font-medium">
                Grade: {task.grade}/{task.maxPoints}
              </span>
            )}
            {task.submissionStatus === 'pending' && (
              <span className={`font-medium ${new Date() > new Date(task.dueDate) ? 'text-red-600' : 'text-orange-600'}`}>
                {getTimeRemaining(task.dueDate)}
              </span>
            )}
          </div>
        </div>

        {canSubmit(task) && (
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSubmitClick(task);
              }}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2 px-4 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center"
            >
              <Upload className="w-4 h-4 mr-2" />
              Submit Task
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const TaskDetailModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{selectedTask?.title}</h2>
              <p className="text-purple-100 text-sm">{selectedTask?.team?.name}</p>
            </div>
            <button
              onClick={() => setSelectedTask(null)}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
          <div className="space-y-6">
            {/* Task Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center text-gray-600 mb-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Due Date</span>
                </div>
                <p className="font-semibold">{formatDate(selectedTask?.dueDate)}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center text-gray-600 mb-1">
                  <Award className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Points</span>
                </div>
                <p className="font-semibold">{selectedTask?.maxPoints} points</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center text-gray-600 mb-1">
                  <Target className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Status</span>
                </div>
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTask?.submissionStatus, selectedTask?.dueDate)}`}>
                  {getStatusIcon(selectedTask?.submissionStatus, selectedTask?.dueDate)}
                  <span className="ml-1">{getStatusText(selectedTask?.submissionStatus, selectedTask?.dueDate)}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Description</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700 whitespace-pre-wrap">{selectedTask?.description}</p>
              </div>
            </div>

            {/* Submission Info */}
            {selectedTask?.submissionStatus === 'submitted' && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Submission Details</h3>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-blue-800">
                    <strong>Submitted:</strong> {formatDate(selectedTask?.submissionDate)}
                  </p>
                  {selectedTask?.feedback && (
                    <div className="mt-3">
                      <p className="text-blue-800 font-medium mb-1">Feedback:</p>
                      <p className="text-blue-700">{selectedTask.feedback}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Grade */}
            {selectedTask?.submissionStatus === 'graded' && selectedTask?.grade !== undefined && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Grade</h3>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-800 font-medium">Score:</span>
                    <span className="text-2xl font-bold text-green-600">
                      {selectedTask.grade}/{selectedTask.maxPoints}
                    </span>
                  </div>
                  <div className="w-full bg-green-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(selectedTask.grade / selectedTask.maxPoints) * 100}%` }}
                    ></div>
                  </div>
                  {selectedTask?.feedback && (
                    <div className="mt-3">
                      <p className="text-green-800 font-medium mb-1">Feedback:</p>
                      <p className="text-green-700">{selectedTask.feedback}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            {canSubmit(selectedTask) && (
              <div className="pt-4 border-t">
                <button
                  onClick={() => handleSubmitClick(selectedTask)}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-6 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Submit This Task
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const SubmissionModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Submit Task</h2>
              <p className="text-green-100 text-sm">{selectedTask?.title}</p>
            </div>
            <button
              onClick={() => setShowSubmissionModal(false)}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
          <div className="space-y-6">
            {/* Error Display */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-red-800 font-medium">Submission Error</h4>
                  <p className="text-red-700 text-sm mt-1">{errors.submit}</p>
                </div>
              </div>
            )}

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4 inline mr-2" />
                Submission Comment *
              </label>
              <textarea
                value={submissionData.comment}
                onChange={(e) => setSubmissionData(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="Describe your work, approach, challenges faced, etc..."
                rows={4}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors resize-none ${
                  errors.comment ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                maxLength={1000}
              />
              <div className="flex justify-between mt-1">
                {errors.comment && (
                  <p className="text-red-600 text-sm">{errors.comment}</p>
                )}
                <p className="text-gray-500 text-sm ml-auto">
                  {submissionData.comment.length}/1000
                </p>
              </div>
            </div>

            {/* Collaborators */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 inline mr-2" />
                Collaborators (Optional)
              </label>
              <div className="space-y-2">
                {submissionData.collaborators.map((collaborator, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="email"
                      value={collaborator}
                      onChange={(e) => handleCollaboratorChange(index, e.target.value)}
                      placeholder="collaborator@email.com"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    {submissionData.collaborators.length > 1 && (
                      <button
                        onClick={() => removeCollaborator(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addCollaborator}
                  className="flex items-center text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Collaborator
                </button>
              </div>
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
                    Allowed: {selectedTask?.allowedFileTypes?.join(', ') || 'All types'} 
                    (Max: {Math.round((selectedTask?.maxFileSize || 10485760) / 1024 / 1024)}MB)
                  </p>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={selectedTask?.allowedFileTypes?.map(type => `.${type}`).join(',')}
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
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 text-gray-500 mr-2" />
                          <span className="text-sm font-medium">{file.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({Math.round(file.size / 1024)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                onClick={() => setShowSubmissionModal(false)}
                disabled={submitting}
                className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmission}
                disabled={submitting}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-3 text-gray-600">Loading your tasks...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-600">View and submit your assignments</p>
        </div>
        <div className="text-sm text-gray-500">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} total
        </div>
      </div>

      {/* Task Grid */}
      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Tasks Yet</h3>
          <p className="text-gray-500">Tasks assigned to your teams will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map(task => (
            <TaskCard key={task._id} task={task} />
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedTask && !showSubmissionModal && <TaskDetailModal />}
      {showSubmissionModal && <SubmissionModal />}
    </div>
  );
};

export default StudentTaskManager;