// frontend/src/components/TaskManagement/TaskSubmission.jsx - COMPLETE REWRITE
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  File,
  Image,
  FileText,
  Video,
  Music,
  Archive,
  X,
  Plus,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
  Loader2,
  Eye,
  User,
  Users,
  MessageCircle,
  Paperclip,
  Calendar,
  Award,
  Info,
  RefreshCw,
  Save
} from 'lucide-react';

const TaskSubmission = ({ task, onClose, onSubmitted }) => {
  // ✅ Refs for stability
  const mountedRef = useRef(true);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);
  
  // ✅ State Management
  const [submissionData, setSubmissionData] = useState({
    comment: '',
    collaborators: [],
    files: []
  });
  
  const [uiState, setUiState] = useState({
    loading: false,
    uploading: false,
    dragActive: false,
    showCollaborators: false,
    showPreview: null
  });
  
  const [validation, setValidation] = useState({
    errors: {},
    warnings: []
  });
  
  const [uploadProgress, setUploadProgress] = useState({});
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [collaboratorInput, setCollaboratorInput] = useState('');
  
  // ✅ Constants
  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
  const MAX_FILE_SIZE = task?.maxFileSize || 50 * 1024 * 1024; // 50MB default
  const MAX_FILES = 10;
  const ALLOWED_TYPES = task?.allowedFileTypes || ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png'];
  
  // ✅ File type configuration
  const fileTypeConfig = {
    'pdf': { icon: FileText, color: 'text-red-600 bg-red-100', label: 'PDF Document' },
    'doc': { icon: FileText, color: 'text-blue-600 bg-blue-100', label: 'Word Document' },
    'docx': { icon: FileText, color: 'text-blue-600 bg-blue-100', label: 'Word Document' },
    'txt': { icon: FileText, color: 'text-gray-600 bg-gray-100', label: 'Text File' },
    'jpg': { icon: Image, color: 'text-green-600 bg-green-100', label: 'JPEG Image' },
    'jpeg': { icon: Image, color: 'text-green-600 bg-green-100', label: 'JPEG Image' },
    'png': { icon: Image, color: 'text-green-600 bg-green-100', label: 'PNG Image' },
    'gif': { icon: Image, color: 'text-green-600 bg-green-100', label: 'GIF Image' },
    'mp4': { icon: Video, color: 'text-purple-600 bg-purple-100', label: 'Video File' },
    'mp3': { icon: Music, color: 'text-orange-600 bg-orange-100', label: 'Audio File' },
    'zip': { icon: Archive, color: 'text-yellow-600 bg-yellow-100', label: 'ZIP Archive' },
    'rar': { icon: Archive, color: 'text-yellow-600 bg-yellow-100', label: 'RAR Archive' },
    'py': { icon: File, color: 'text-green-600 bg-green-100', label: 'Python File' },
    'js': { icon: File, color: 'text-yellow-600 bg-yellow-100', label: 'JavaScript File' },
    'html': { icon: File, color: 'text-orange-600 bg-orange-100', label: 'HTML File' },
    'css': { icon: File, color: 'text-blue-600 bg-blue-100', label: 'CSS File' },
    'json': { icon: File, color: 'text-gray-600 bg-gray-100', label: 'JSON File' }
  };

  // ✅ Initialize component
  useEffect(() => {
    mountedRef.current = true;
    checkExistingSubmission();
    
    return () => {
      mountedRef.current = false;
    };
  }, [task]);

  // ✅ Check for existing submission
  const checkExistingSubmission = async () => {
    if (!task?._id) return;
    
    try {
      const response = await fetch(`${API_BASE}/tasks/${task._id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.task.submissions) {
          const userSubmission = data.task.submissions.find(sub => 
            sub.student === localStorage.getItem('userId') || 
            sub.student === sessionStorage.getItem('userId')
          );
          
          if (userSubmission && mountedRef.current) {
            setExistingSubmission(userSubmission);
            // Populate form with existing data for resubmission
            setSubmissionData(prev => ({
              ...prev,
              comment: userSubmission.comment || '',
              collaborators: userSubmission.collaborators || []
            }));
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to check existing submission:', error);
    }
  };

  // ✅ File validation
  const validateFile = useCallback((file) => {
    const errors = [];
    
    // Size validation
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`);
    }
    
    // Type validation
    const extension = file.name.split('.').pop().toLowerCase();
    if (ALLOWED_TYPES.length > 0 && !ALLOWED_TYPES.includes(extension)) {
      errors.push(`File type .${extension} is not allowed`);
    }
    
    // Name validation
    if (file.name.length > 255) {
      errors.push('File name is too long');
    }
    
    // Check for duplicates
    const isDuplicate = submissionData.files.some(f => 
      f.name === file.name && f.size === file.size
    );
    if (isDuplicate) {
      errors.push('File already added');
    }
    
    return errors;
  }, [submissionData.files, MAX_FILE_SIZE, ALLOWED_TYPES]);

  // ✅ File handling
  const handleFiles = useCallback(async (fileList) => {
    const newFiles = [];
    const errors = [];
    
    // Validate total file count
    if (submissionData.files.length + fileList.length > MAX_FILES) {
      errors.push(`Maximum ${MAX_FILES} files allowed`);
      setValidation(prev => ({ ...prev, errors: { files: errors } }));
      return;
    }
    
    // Process each file
    for (const file of fileList) {
      const fileErrors = validateFile(file);
      
      if (fileErrors.length === 0) {
        const fileId = Date.now() + Math.random().toString(36).substr(2, 9);
        const fileObj = {
          id: fileId,
          file: file,
          name: file.name,
          size: file.size,
          type: file.type,
          extension: file.name.split('.').pop().toLowerCase(),
          status: 'pending',
          progress: 0,
          preview: null
        };
        
        // Generate preview for images
        if (file.type.startsWith('image/')) {
          try {
            const preview = await generateImagePreview(file);
            fileObj.preview = preview;
          } catch (error) {
            console.warn('Failed to generate preview for', file.name);
          }
        }
        
        newFiles.push(fileObj);
      } else {
        errors.push(`${file.name}: ${fileErrors.join(', ')}`);
      }
    }
    
    if (errors.length > 0) {
      setValidation(prev => ({ 
        ...prev, 
        errors: { files: errors } 
      }));
    }
    
    if (newFiles.length > 0) {
      setSubmissionData(prev => ({
        ...prev,
        files: [...prev.files, ...newFiles]
      }));
      
      // Clear previous file errors
      setValidation(prev => ({ 
        ...prev, 
        errors: { ...prev.errors, files: null } 
      }));
    }
  }, [submissionData.files, validateFile]);

  // ✅ Generate image preview
  const generateImagePreview = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ✅ Drag and drop handlers
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setUiState(prev => ({ ...prev, dragActive: true }));
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setUiState(prev => ({ ...prev, dragActive: false }));
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setUiState(prev => ({ ...prev, dragActive: false }));
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  // ✅ File input handler
  const handleFileInputChange = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFiles(files);
    }
    // Reset input
    e.target.value = '';
  }, [handleFiles]);

  // ✅ Remove file
  const removeFile = useCallback((fileId) => {
    setSubmissionData(prev => ({
      ...prev,
      files: prev.files.filter(f => f.id !== fileId)
    }));
    
    // Remove from upload progress
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  }, []);

  // ✅ Collaborator management
  const addCollaborator = useCallback(() => {
    const email = collaboratorInput.trim().toLowerCase();
    
    if (!email) return;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidation(prev => ({
        ...prev,
        errors: { ...prev.errors, collaborator: 'Invalid email format' }
      }));
      return;
    }
    
    // Check for duplicates
    if (submissionData.collaborators.includes(email)) {
      setValidation(prev => ({
        ...prev,
        errors: { ...prev.errors, collaborator: 'Email already added' }
      }));
      return;
    }
    
    setSubmissionData(prev => ({
      ...prev,
      collaborators: [...prev.collaborators, email]
    }));
    
    setCollaboratorInput('');
    setValidation(prev => ({
      ...prev,
      errors: { ...prev.errors, collaborator: null }
    }));
  }, [collaboratorInput, submissionData.collaborators]);

  const removeCollaborator = useCallback((email) => {
    setSubmissionData(prev => ({
      ...prev,
      collaborators: prev.collaborators.filter(c => c !== email)
    }));
  }, []);

  // ✅ Form validation
  const validateSubmission = useCallback(() => {
    const errors = {};
    const warnings = [];
    
    // Comment validation
    if (!submissionData.comment.trim()) {
      warnings.push('Consider adding a comment to explain your submission');
    } else if (submissionData.comment.length > 1000) {
      errors.comment = 'Comment must be less than 1000 characters';
    }
    
    // File validation
    if (task?.allowFileUpload && submissionData.files.length === 0) {
      warnings.push('No files attached. Make sure this is intentional.');
    }
    
    // Check for pending uploads
    const pendingFiles = submissionData.files.filter(f => f.status === 'pending');
    if (pendingFiles.length > 0) {
      errors.files = 'Please wait for all files to finish uploading';
    }
    
    // Due date warning
    if (task?.dueDate) {
      const dueDate = new Date(task.dueDate);
      const now = new Date();
      const hoursDiff = (dueDate - now) / (1000 * 60 * 60);
      
      if (hoursDiff < 0) {
        warnings.push('This submission is past the due date');
      } else if (hoursDiff < 24) {
        warnings.push('Less than 24 hours remaining until due date');
      }
    }
    
    return { errors, warnings };
  }, [submissionData, task]);

  // ✅ Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (uiState.loading) return;
    
    const { errors, warnings } = validateSubmission();
    
    if (Object.keys(errors).length > 0) {
      setValidation({ errors, warnings });
      return;
    }
    
    setUiState(prev => ({ ...prev, loading: true }));
    setValidation({ errors: {}, warnings });
    
    try {
      // Upload files first
      const uploadedFiles = await uploadFiles();
      
      // Prepare submission data
      const submissionPayload = {
        comment: submissionData.comment.trim(),
        collaborators: submissionData.collaborators,
        files: uploadedFiles
      };
      
      console.log('📤 Submitting task:', submissionPayload);
      
      // Submit to server
      const formData = new FormData();
      formData.append('comment', submissionPayload.comment);
      formData.append('collaborators', JSON.stringify(submissionPayload.collaborators));
      
      // Add files to FormData
      submissionData.files.forEach((fileObj, index) => {
        formData.append('files', fileObj.file);
      });
      
      const response = await fetch(`${API_BASE}/tasks/${task._id}/submit`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Submission failed: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Task submitted successfully');
        onSubmitted?.(result);
        onClose?.();
      } else {
        throw new Error(result.message || 'Submission failed');
      }
      
    } catch (error) {
      console.error('❌ Submission error:', error);
      setValidation(prev => ({
        ...prev,
        errors: { submit: error.message || 'Failed to submit task' }
      }));
    } finally {
      if (mountedRef.current) {
        setUiState(prev => ({ ...prev, loading: false }));
      }
    }
  };

  // ✅ Upload files
  const uploadFiles = async () => {
    const uploadedFiles = [];
    
    for (const fileObj of submissionData.files) {
      if (fileObj.status === 'completed') {
        uploadedFiles.push({
          filename: fileObj.serverFilename,
          originalName: fileObj.name,
          size: fileObj.size,
          mimetype: fileObj.type
        });
      }
    }
    
    return uploadedFiles;
  };

  // ✅ Utility functions
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (extension) => {
    const config = fileTypeConfig[extension] || fileTypeConfig['default'] || { icon: File, color: 'text-gray-600 bg-gray-100' };
    return config;
  };

  const formatTimeRemaining = () => {
    if (!task?.dueDate) return null;
    
    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const diff = dueDate - now;
    
    if (diff < 0) return 'Past due';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  // ✅ Component sections

  // Header Component
  const SubmissionHeader = () => (
    <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Send className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{task?.title}</h2>
          <div className="flex items-center space-x-4 mt-1">
            <p className="text-gray-600">Submit your assignment</p>
            {task?.dueDate && (
              <div className="flex items-center space-x-1 text-sm">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="text-orange-600 font-medium">
                  {formatTimeRemaining()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        {existingSubmission && (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            Resubmission
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

  // Task Info Component
  const TaskInfo = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center space-x-2">
          <Award className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            Max Points: {task?.maxPoints || 'N/A'}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            Due: {task?.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            Attempts: {task?.maxAttempts || 1} allowed
          </span>
        </div>
      </div>
      
      {task?.description && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <p className="text-sm text-blue-800">{task.description}</p>
        </div>
      )}
    </div>
  );

  // File Upload Component
  const FileUploadArea = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">File Attachments</h3>
        <span className="text-sm text-gray-500">
          {submissionData.files.length}/{MAX_FILES} files
        </span>
      </div>
      
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          uiState.dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 mb-2">
          Drag and drop files here, or{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            browse
          </button>
        </p>
        <p className="text-xs text-gray-500">
          Max file size: {formatFileSize(MAX_FILE_SIZE)} • 
          Allowed types: {ALLOWED_TYPES.join(', ')}
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.map(type => `.${type}`).join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>
      
      {/* File List */}
      {submissionData.files.length > 0 && (
        <div className="space-y-3">
          {submissionData.files.map((file) => {
            const { icon: Icon, color } = getFileIcon(file.extension);
            
            return (
              <div
                key={file.id}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)} • {file.extension.toUpperCase()}
                  </p>
                  
                  {file.status === 'uploading' && (
                    <div className="mt-1">
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div 
                          className="bg-blue-600 h-1 rounded-full transition-all"
                          style={{ width: `${uploadProgress[file.id] || 0}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {file.preview && (
                    <button
                      type="button"
                      onClick={() => setUiState(prev => ({ 
                        ...prev, 
                        showPreview: file.preview 
                      }))}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {validation.errors.files && (
        <div className="text-sm text-red-600">
          {Array.isArray(validation.errors.files) 
            ? validation.errors.files.map((error, index) => (
                <p key={index}>{error}</p>
              ))
            : validation.errors.files
          }
        </div>
      )}
    </div>
  );

  // Comment Section
  const CommentSection = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Submission Comments</h3>
      
      <div>
        <textarea
          value={submissionData.comment}
          onChange={(e) => setSubmissionData(prev => ({ 
            ...prev, 
            comment: e.target.value 
          }))}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Add any comments about your submission, challenges faced, or additional notes for your instructor..."
          maxLength={1000}
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-500">
            Optional but recommended for better feedback
          </p>
          <p className="text-xs text-gray-500">
            {submissionData.comment.length}/1000
          </p>
        </div>
      </div>
      
      {validation.errors.comment && (
        <p className="text-sm text-red-600">{validation.errors.comment}</p>
      )}
    </div>
  );

  // Collaborators Section
  const CollaboratorsSection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Collaborators</h3>
        <button
          type="button"
          onClick={() => setUiState(prev => ({ 
            ...prev, 
            showCollaborators: !prev.showCollaborators 
          }))}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {uiState.showCollaborators ? 'Hide' : 'Add Collaborators'}
        </button>
      </div>
      
      {uiState.showCollaborators && (
        <div className="space-y-3">
          <div className="flex space-x-2">
            <input
              type="email"
              value={collaboratorInput}
              onChange={(e) => setCollaboratorInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCollaborator()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter collaborator email..."
            />
            <button
              type="button"
              onClick={addCollaborator}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          {validation.errors.collaborator && (
            <p className="text-sm text-red-600">{validation.errors.collaborator}</p>
          )}
          
          {submissionData.collaborators.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Added collaborators:</p>
              {submissionData.collaborators.map((email, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-100 rounded-lg"
                >
                  <span className="text-sm text-gray-700">{email}</span>
                  <button
                    type="button"
                    onClick={() => removeCollaborator(email)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Existing Submission Warning
  const ExistingSubmissionWarning = () => {
    if (!existingSubmission) return null;
    
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-yellow-800">Previous Submission Found</h4>
            <p className="text-sm text-yellow-700 mt-1">
              You submitted this task on {new Date(existingSubmission.submittedAt).toLocaleString()}.
              {existingSubmission.grade !== undefined && (
                <span> Your grade: {existingSubmission.grade}/{task?.maxPoints}</span>
              )}
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              This will be attempt {(existingSubmission.attempt || 0) + 1} of {task?.maxAttempts || 1}.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Validation Summary
  const ValidationSummary = () => {
    const hasErrors = Object.keys(validation.errors).length > 0;
    const hasWarnings = validation.warnings.length > 0;
    
    if (!hasErrors && !hasWarnings) return null;
    
    return (
      <div className="space-y-3">
        {hasErrors && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Please fix these issues:</h4>
                <ul className="text-sm text-red-700 mt-1 space-y-1">
                  {Object.entries(validation.errors).map(([key, error]) => (
                    <li key={key}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {hasWarnings && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800">Recommendations:</h4>
                <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Submit Section
  const SubmitSection = () => {
    const hasErrors = Object.keys(validation.errors).length > 0;
    const canSubmit = !hasErrors && !uiState.loading;
    
    return (
      <div className="flex items-center justify-between pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {submissionData.files.length > 0 && (
            <span>{submissionData.files.length} file(s) ready • </span>
          )}
          {submissionData.collaborators.length > 0 && (
            <span>{submissionData.collaborators.length} collaborator(s) • </span>
          )}
          Ready to submit
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
            disabled={!canSubmit}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uiState.loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Assignment</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Image Preview Modal
  const ImagePreviewModal = () => {
    if (!uiState.showPreview) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="relative max-w-4xl max-h-full">
          <button
            onClick={() => setUiState(prev => ({ ...prev, showPreview: null }))}
            className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={uiState.showPreview}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      </div>
    );
  };

  // Main Render
  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <SubmissionHeader />
          
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <TaskInfo />
              <ExistingSubmissionWarning />
              <ValidationSummary />
              
              {task?.allowFileUpload && <FileUploadArea />}
              <CommentSection />
              <CollaboratorsSection />
            </div>
            
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <SubmitSection />
            </div>
          </form>
        </div>
      </div>
      
      <ImagePreviewModal />
    </>
  );
};

export default TaskSubmission;