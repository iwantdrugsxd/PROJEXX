// frontend/src/components/FileUpload/FileUpload.jsx
import React, { useState, useRef, useCallback } from 'react';
import { API_BASE } from '../../App';
import {
  Upload,
  File,
  X,
  Check,
  AlertCircle,
  FileText,
  Image,
  Archive,
  FileVideo,
  Music,
  Download,
  Eye,
  Trash2,
  Plus,
  Loader
} from 'lucide-react';

function FileUpload({ 
  onUploadComplete, 
  taskId = null, 
  category = 'general',
  multiple = false,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = null,
  showPreview = true,
  showFileList = true,
  className = ""
}) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);

  const defaultAcceptedTypes = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.jpg', '.jpeg', '.png', '.gif', '.zip', '.rar', '.mp4', '.mp3'
  ];

  const acceptTypes = acceptedTypes || defaultAcceptedTypes;

  // File type detection and icon mapping
  const getFileIcon = useCallback((type, name) => {
    const extension = name.split('.').pop()?.toLowerCase();
    
    if (type.startsWith('image/')) return { icon: Image, color: 'text-green-600' };
    if (type.startsWith('video/')) return { icon: FileVideo, color: 'text-red-600' };
    if (type.startsWith('audio/')) return { icon: Music, color: 'text-purple-600' };
    if (type.includes('zip') || type.includes('rar') || extension === 'zip' || extension === 'rar') {
      return { icon: Archive, color: 'text-yellow-600' };
    }
    if (type.includes('pdf') || extension === 'pdf') return { icon: FileText, color: 'text-red-600' };
    if (type.includes('word') || ['doc', 'docx'].includes(extension)) return { icon: FileText, color: 'text-blue-600' };
    if (type.includes('excel') || ['xls', 'xlsx'].includes(extension)) return { icon: FileText, color: 'text-green-600' };
    if (type.includes('powerpoint') || ['ppt', 'pptx'].includes(extension)) return { icon: FileText, color: 'text-orange-600' };
    
    return { icon: File, color: 'text-gray-600' };
  }, []);

  // Format file size
  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Validate file
  const validateFile = useCallback((file) => {
    const errors = [];
    
    // Size validation
    if (file.size > maxSize) {
      errors.push(`File size exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit`);
    }
    
    // Type validation
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptTypes.some(type => 
      file.type.includes(type.replace('.', '')) || extension === type
    )) {
      errors.push('File type not supported');
    }
    
    return errors;
  }, [maxSize, acceptTypes]);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
    // Reset input
    e.target.value = '';
  }, []);

  // Process selected files
  const handleFiles = useCallback((newFiles) => {
    if (!multiple && newFiles.length > 1) {
      alert('Only one file is allowed');
      return;
    }

    if (multiple && files.length + newFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const processedFiles = newFiles.map(file => {
      const errors = validateFile(file);
      const id = Math.random().toString(36).substr(2, 9);
      
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: errors.length > 0 ? 'error' : 'pending',
        progress: 0,
        description: '',
        errors,
        preview: null
      };
    });

    // Generate previews for images
    processedFiles.forEach(fileObj => {
      if (fileObj.type.startsWith('image/') && showPreview) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFiles(prev => prev.map(f => 
            f.id === fileObj.id ? { ...f, preview: e.target.result } : f
          ));
        };
        reader.readAsDataURL(fileObj.file);
      }
    });

    setFiles(prev => multiple ? [...prev, ...processedFiles] : processedFiles);
  }, [files.length, maxFiles, multiple, validateFile, showPreview]);

  // Remove file
  const removeFile = useCallback((fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  }, []);

  // Update file description
  const updateFileDescription = useCallback((fileId, description) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, description } : f
    ));
  }, []);

  // Upload files with progress tracking
  const uploadFiles = useCallback(async () => {
    const validFiles = files.filter(f => f.status === 'pending');
    if (validFiles.length === 0) return;

    setUploading(true);

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const fileObj = validFiles[i];
        
        // Update status to uploading
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id ? { ...f, status: 'uploading' } : f
        ));

        const formData = new FormData();
        formData.append('file', fileObj.file);
        if (taskId) formData.append('taskId', taskId);
        formData.append('category', category);
        formData.append('description', fileObj.description);

        try {
          const response = await fetch(`${API_BASE}/files/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData
          });

          const data = await response.json();

          if (data.success) {
            // Update status to success
            setFiles(prev => prev.map(f => 
              f.id === fileObj.id ? { 
                ...f, 
                status: 'success', 
                progress: 100,
                uploadedFile: data.file 
              } : f
            ));

            if (onUploadComplete) {
              onUploadComplete(data.file);
            }
          } else {
            // Update status to error
            setFiles(prev => prev.map(f => 
              f.id === fileObj.id ? { 
                ...f, 
                status: 'error', 
                errors: [data.message || 'Upload failed'] 
              } : f
            ));
          }
        } catch (error) {
          console.error('Upload error:', error);
          setFiles(prev => prev.map(f => 
            f.id === fileObj.id ? { 
              ...f, 
              status: 'error', 
              errors: ['Network error'] 
            } : f
          ));
        }
      }

      // Clear successful uploads after delay
      setTimeout(() => {
        setFiles(prev => prev.filter(f => f.status !== 'success'));
      }, 3000);

    } finally {
      setUploading(false);
    }
  }, [files, taskId, category, onUploadComplete]);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    setUploadProgress({});
  }, []);

  // Get status counts
  const statusCounts = files.reduce((acc, file) => {
    acc[file.status] = (acc[file.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={`w-full ${className}`}>
      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
          dragActive 
            ? 'border-purple-500 bg-purple-50 scale-105' 
            : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
        } ${uploading ? 'pointer-events-none opacity-75' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptTypes.join(',')}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />
        
        <div className="space-y-4">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
            dragActive ? 'bg-purple-200' : 'bg-purple-100'
          }`}>
            <Upload className={`w-8 h-8 transition-all duration-300 ${
              dragActive ? 'text-purple-700 scale-110' : 'text-purple-600'
            }`} />
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-800">
              {dragActive ? 'Drop files here!' : 'Drop files here or click to browse'}
            </h3>
            <p className="text-gray-500 mt-1">
              {multiple 
                ? `Upload up to ${maxFiles} files (max ${Math.round(maxSize / (1024 * 1024))}MB each)`
                : `Upload one file (max ${Math.round(maxSize / (1024 * 1024))}MB)`
              }
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Supported formats: {acceptTypes.slice(0, 6).join(', ')}
              {acceptTypes.length > 6 && ` +${acceptTypes.length - 6} more`}
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress Summary */}
      {files.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">
                {files.length} file{files.length > 1 ? 's' : ''} selected
              </span>
              {statusCounts.pending > 0 && (
                <span className="text-blue-600">
                  {statusCounts.pending} pending
                </span>
              )}
              {statusCounts.uploading > 0 && (
                <span className="text-purple-600">
                  {statusCounts.uploading} uploading
                </span>
              )}
              {statusCounts.success > 0 && (
                <span className="text-green-600">
                  {statusCounts.success} completed
                </span>
              )}
              {statusCounts.error > 0 && (
                <span className="text-red-600">
                  {statusCounts.error} failed
                </span>
              )}
            </div>
            
            <button
              onClick={clearFiles}
              className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* File List */}
      {showFileList && files.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-800">Files</h4>
            {statusCounts.pending > 0 && (
              <button
                onClick={uploadFiles}
                disabled={uploading}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                {uploading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload {statusCounts.pending} File{statusCounts.pending > 1 ? 's' : ''}</span>
                  </>
                )}
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {files.map((fileObj) => (
              <FileItem
                key={fileObj.id}
                fileObj={fileObj}
                onRemove={removeFile}
                onDescriptionUpdate={updateFileDescription}
                getFileIcon={getFileIcon}
                formatFileSize={formatFileSize}
                showPreview={showPreview}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick Upload Button (Alternative to drag-drop) */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all duration-300"
        >
          <Plus className="w-4 h-4" />
          <span>Add {multiple ? 'Files' : 'File'}</span>
        </button>
      </div>
    </div>
  );
}

// Individual File Item Component
function FileItem({ 
  fileObj, 
  onRemove, 
  onDescriptionUpdate, 
  getFileIcon, 
  formatFileSize, 
  showPreview 
}) {
  const { icon: IconComponent, color } = getFileIcon(fileObj.type, fileObj.name);
  const [showDetails, setShowDetails] = useState(false);

  const getStatusIcon = () => {
    switch (fileObj.status) {
      case 'uploading':
        return <Loader className="w-4 h-4 animate-spin text-blue-600" />;
      case 'success':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (fileObj.status) {
      case 'uploading':
        return 'border-blue-200 bg-blue-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  return (
    <div className={`border rounded-lg p-4 transition-all duration-300 ${getStatusColor()}`}>
      <div className="flex items-start space-x-3">
        {/* File Preview/Icon */}
        <div className="flex-shrink-0">
          {showPreview && fileObj.preview ? (
            <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
              <img 
                src={fileObj.preview} 
                alt={fileObj.name} 
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <IconComponent className={`w-6 h-6 ${color}`} />
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <h5 className="font-medium text-gray-800 truncate">{fileObj.name}</h5>
              <span className="text-sm text-gray-500 flex-shrink-0">
                ({formatFileSize(fileObj.size)})
              </span>
              {getStatusIcon()}
            </div>
            
            <div className="flex items-center space-x-2 flex-shrink-0">
              {fileObj.status === 'success' && fileObj.uploadedFile && (
                <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200">
                  <Download className="w-4 h-4" />
                </button>
              )}
              
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <Eye className="w-4 h-4" />
              </button>
              
              {fileObj.status === 'pending' && (
                <button
                  onClick={() => onRemove(fileObj.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Status Messages */}
          {fileObj.status === 'uploading' && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${fileObj.progress}%` }}
                ></div>
              </div>
              <p className="text-sm text-blue-600 mt-1">Uploading...</p>
            </div>
          )}
          
          {fileObj.status === 'success' && (
            <p className="text-sm text-green-600 mt-1">
              Upload completed successfully
            </p>
          )}
          
          {fileObj.status === 'error' && fileObj.errors && (
            <div className="mt-1">
              {fileObj.errors.map((error, index) => (
                <p key={index} className="text-sm text-red-600">{error}</p>
              ))}
            </div>
          )}

          {/* Description Input */}
          {fileObj.status === 'pending' && (
            <div className="mt-2">
              <input
                type="text"
                placeholder="Add description (optional)"
                value={fileObj.description}
                onChange={(e) => onDescriptionUpdate(fileObj.id, e.target.value)}
                className="w-full px-3 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Expanded Details */}
          {showDetails && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-medium text-gray-600">Type:</span>
                  <span className="ml-2 text-gray-800">{fileObj.type || 'Unknown'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Size:</span>
                  <span className="ml-2 text-gray-800">{formatFileSize(fileObj.size)}</span>
                </div>
                {fileObj.description && (
                  <div className="col-span-2">
                    <span className="font-medium text-gray-600">Description:</span>
                    <span className="ml-2 text-gray-800">{fileObj.description}</span>
                  </div>
                )}
                {fileObj.uploadedFile && (
                  <div className="col-span-2">
                    <span className="font-medium text-gray-600">File ID:</span>
                    <span className="ml-2 text-gray-800 font-mono text-xs">{fileObj.uploadedFile.id}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileUpload;