// frontend/src/components/FileSystem/FileUploadSystem.jsx
import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, File, Image, FileText, Video, Music, Archive,
  Download, Trash2, Eye, Share2, Clock, CheckCircle,
  AlertCircle, X, Plus, Folder, Search, Filter,
  MoreVertical, Copy, Edit, Star, CloudUpload
} from 'lucide-react';

const FileUploadSystem = ({ 
  taskId, 
  studentId, 
  userRole, 
  onFileUploaded, 
  allowedTypes = ['all'],
  maxFileSize = 50 * 1024 * 1024, // 50MB
  maxFiles = 10,
  showVersionControl = true 
}) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showFileDetails, setShowFileDetails] = useState(null);
  const [fileVersions, setFileVersions] = useState({});

  const fileInputRef = useRef(null);
  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  const fileTypeIcons = {
    'image': Image,
    'video': Video,
    'audio': Music,
    'document': FileText,
    'archive': Archive,
    'default': File
  };

  const getFileType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return 'audio';
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'document';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    return 'default';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file) => {
    if (file.size > maxFileSize) {
      return `File size exceeds ${formatFileSize(maxFileSize)} limit`;
    }
    
    if (allowedTypes.length > 0 && !allowedTypes.includes('all')) {
      const fileType = getFileType(file.name);
      if (!allowedTypes.includes(fileType)) {
        return `File type '${fileType}' is not allowed`;
      }
    }
    
    return null;
  };

  // Drag and Drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFiles = (fileList) => {
    const validFiles = [];
    const errors = [];

    fileList.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      alert('Some files were rejected:\n' + errors.join('\n'));
    }

    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }
  };

  const uploadFiles = async (fileList) => {
    if (files.length + fileList.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setUploading(true);
    
    for (const file of fileList) {
      try {
        const formData = new FormData();
        formData.append('files', file); // Changed from 'file' to 'files' to match backend
        if (taskId) formData.append('taskId', taskId);
        if (studentId) formData.append('studentId', studentId);
        formData.append('userRole', userRole);

        // Create unique file ID
        const fileId = Date.now() + Math.random().toString(36).substr(2, 9);
        
        // Create file object for UI
        const fileObj = {
          id: fileId,
          name: file.name,
          size: file.size,
          type: getFileType(file.name),
          uploadedAt: new Date().toISOString(),
          status: 'uploading',
          progress: 0
        };

        setFiles(prev => [...prev, fileObj]);

        // Upload with progress tracking
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(prev => ({
              ...prev,
              [fileId]: progress
            }));
          }
        });

        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.success) {
                setFiles(prev => prev.map(f => 
                  f.id === fileId 
                    ? { ...f, status: 'completed', serverId: response.files?.[0]?.id, url: response.files?.[0]?.url }
                    : f
                ));
                if (onFileUploaded && response.files?.[0]) {
                  onFileUploaded(response.files[0]);
                }
              } else {
                setFiles(prev => prev.map(f => 
                  f.id === fileId 
                    ? { ...f, status: 'error', error: response.message || 'Upload failed' }
                    : f
                ));
              }
            } catch (parseError) {
              console.error('Failed to parse response:', parseError);
              setFiles(prev => prev.map(f => 
                f.id === fileId 
                  ? { ...f, status: 'error', error: 'Invalid server response' }
                  : f
              ));
            }
          } else {
            setFiles(prev => prev.map(f => 
              f.id === fileId 
                ? { ...f, status: 'error', error: `Upload failed (${xhr.status})` }
                : f
            ));
          }
          
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileId];
            return newProgress;
          });
        };

        xhr.onerror = () => {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'error', error: 'Network error' }
              : f
          ));
          
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileId];
            return newProgress;
          });
        };

        xhr.open('POST', `${API_BASE}/files/upload`);
        xhr.withCredentials = true;
        xhr.send(formData);

      } catch (error) {
        console.error('Upload error:', error);
        // Handle any errors that occur before the request is sent
      }
    }
    
    setUploading(false);
  };

  const downloadFile = async (fileId, filename) => {
    try {
      const response = await fetch(`${API_BASE}/files/${fileId}/download`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download file');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file');
    }
  };

  const deleteFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setFiles(prev => prev.filter(f => f.serverId !== fileId));
      } else {
        alert('Failed to delete file');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete file');
    }
  };

  const copyFileLink = (file) => {
    const link = `${window.location.origin}/files/${file.serverId}`;
    navigator.clipboard.writeText(link).then(() => {
      alert('File link copied to clipboard');
    });
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || file.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const FileIcon = ({ type, className = "w-8 h-8" }) => {
    const Icon = fileTypeIcons[type] || fileTypeIcons.default;
    return <Icon className={className} />;
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div 
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          dragActive 
            ? 'border-purple-500 bg-purple-50' 
            : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CloudUpload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-purple-500' : 'text-gray-400'}`} />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {dragActive ? 'Drop files here' : 'Upload Files'}
        </h3>
        <p className="text-gray-600 mb-4">
          Drag and drop files here, or click to select files
        </p>
        <div className="space-y-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Uploading...' : 'Choose Files'}</span>
          </button>
          <p className="text-sm text-gray-500">
            Max file size: {formatFileSize(maxFileSize)} • Max files: {maxFiles}
          </p>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
        />
      </div>

      {/* File Management Header */}
      {files.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Files ({filteredFiles.length})
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                </div>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <div className="w-4 h-4 space-y-1">
                  <div className="bg-current h-0.5 rounded"></div>
                  <div className="bg-current h-0.5 rounded"></div>
                  <div className="bg-current h-0.5 rounded"></div>
                </div>
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="document">Documents</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="audio">Audio</option>
              <option value="archive">Archives</option>
            </select>
          </div>
        </div>
      )}

      {/* Files Display */}
      {filteredFiles.length > 0 && (
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          : "space-y-2"
        }>
          {filteredFiles.map((file) => (
            <div key={file.id} className={`bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-200 ${
              viewMode === 'grid' ? 'p-4' : 'p-3 flex items-center space-x-4'
            }`}>
              {viewMode === 'grid' ? (
                // Grid View
                <>
                  <div className="flex items-center justify-between mb-3">
                    <FileIcon type={file.type} className="w-8 h-8 text-purple-600" />
                    <div className="flex items-center space-x-1">
                      {file.status === 'completed' && (
                        <>
                          <button
                            onClick={() => setShowFileDetails(file)}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {file.serverId && (
                            <button
                              onClick={() => downloadFile(file.serverId, file.name)}
                              className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => copyFileLink(file)}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                            title="Copy link"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {userRole === 'faculty' && file.serverId && (
                            <button
                              onClick={() => deleteFile(file.serverId)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 text-sm truncate" title={file.name}>
                      {file.name}
                    </h4>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    
                    {file.status === 'uploading' && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Uploading...</span>
                          <span className="text-gray-600">{uploadProgress[file.id] || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-purple-600 h-1 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress[file.id] || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {file.status === 'completed' && (
                      <div className="flex items-center space-x-1 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        <span>Uploaded</span>
                      </div>
                    )}
                    
                    {file.status === 'error' && (
                      <div className="flex items-center space-x-1 text-xs text-red-600">
                        <AlertCircle className="w-3 h-3" />
                        <span>Error: {file.error}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                // List View
                <>
                  <FileIcon type={file.type} className="w-6 h-6 text-purple-600 flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 text-sm truncate">{file.name}</h4>
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                      {file.status === 'uploading' && (
                        <>
                          <span>•</span>
                          <span className="text-purple-600">Uploading {uploadProgress[file.id] || 0}%</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    {file.status === 'completed' ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {file.serverId && (
                          <button
                            onClick={() => downloadFile(file.serverId, file.name)}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        {userRole === 'faculty' && file.serverId && (
                          <button
                            onClick={() => deleteFile(file.serverId)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    ) : file.status === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {files.length === 0 && (
        <div className="text-center py-12">
          <File className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No files uploaded yet</h3>
          <p className="text-gray-500">Upload your first file to get started</p>
        </div>
      )}

      {/* File Details Modal */}
      {showFileDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">File Details</h3>
              <button
                onClick={() => setShowFileDetails(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <FileIcon type={showFileDetails.type} className="w-10 h-10 text-purple-600" />
                <div>
                  <h4 className="font-medium text-gray-900">{showFileDetails.name}</h4>
                  <p className="text-sm text-gray-500">{showFileDetails.type} file</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Size</span>
                  <span className="font-medium">{formatFileSize(showFileDetails.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Uploaded</span>
                  <span className="font-medium">
                    {new Date(showFileDetails.uploadedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`font-medium ${
                    showFileDetails.status === 'completed' ? 'text-green-600' :
                    showFileDetails.status === 'error' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {showFileDetails.status === 'completed' ? 'Uploaded' :
                     showFileDetails.status === 'error' ? 'Error' : 'Uploading'}
                  </span>
                </div>
              </div>
              
              <div className="flex space-x-3 pt-4">
                {showFileDetails.serverId && (
                  <button
                    onClick={() => downloadFile(showFileDetails.serverId, showFileDetails.name)}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                )}
                <button
                  onClick={() => copyFileLink(showFileDetails)}
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadSystem;