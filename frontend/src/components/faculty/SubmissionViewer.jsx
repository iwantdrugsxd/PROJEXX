// frontend/src/components/Faculty/SubmissionViewer.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Eye,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  File,
  Calendar,
  Clock,
  User,
  Mail,
  MessageCircle,
  Star,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  RefreshCw,
  Award,
  Users,
  BookOpen,
  TrendingUp,
  BarChart3,
  FileCheck,
  FileX,
  Timer,
  GraduationCap
} from 'lucide-react';

const SubmissionViewer = ({ taskId, onClose }) => {
  // ✅ State management
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    sortBy: 'submittedAt',
    sortOrder: 'desc',
    showLateOnly: false,
    showGradedOnly: false
  });
  const [stats, setStats] = useState({
    total: 0,
    graded: 0,
    pending: 0,
    late: 0,
    averageGrade: 0
  });

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  // ✅ File type configuration
  const fileTypeConfig = {
    pdf: { icon: FileText, color: 'text-red-600 bg-red-100' },
    doc: { icon: FileText, color: 'text-blue-600 bg-blue-100' },
    docx: { icon: FileText, color: 'text-blue-600 bg-blue-100' },
    txt: { icon: FileText, color: 'text-gray-600 bg-gray-100' },
    jpg: { icon: Image, color: 'text-green-600 bg-green-100' },
    jpeg: { icon: Image, color: 'text-green-600 bg-green-100' },
    png: { icon: Image, color: 'text-green-600 bg-green-100' },
    gif: { icon: Image, color: 'text-green-600 bg-green-100' },
    mp4: { icon: Video, color: 'text-purple-600 bg-purple-100' },
    mp3: { icon: Music, color: 'text-orange-600 bg-orange-100' },
    zip: { icon: Archive, color: 'text-yellow-600 bg-yellow-100' },
    rar: { icon: Archive, color: 'text-yellow-600 bg-yellow-100' },
    default: { icon: File, color: 'text-gray-600 bg-gray-100' }
  };

  // ✅ Fetch submissions
  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/files/task/${taskId}/submissions?${new URLSearchParams({
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        ...(filters.status !== 'all' && { status: filters.status })
      })}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch submissions: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        let filteredSubmissions = data.submissions;

        // Apply client-side filters
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filteredSubmissions = filteredSubmissions.filter(sub =>
            sub.student.name.toLowerCase().includes(searchLower) ||
            sub.student.email.toLowerCase().includes(searchLower) ||
            sub.comment.toLowerCase().includes(searchLower)
          );
        }

        if (filters.showLateOnly) {
          filteredSubmissions = filteredSubmissions.filter(sub => sub.isLate);
        }

        if (filters.showGradedOnly) {
          filteredSubmissions = filteredSubmissions.filter(sub => sub.grade !== null && sub.grade !== undefined);
        }

        setSubmissions(filteredSubmissions);

        // Calculate stats
        const totalSubmissions = filteredSubmissions.length;
        const gradedSubmissions = filteredSubmissions.filter(sub => sub.grade !== null && sub.grade !== undefined);
        const lateSubmissions = filteredSubmissions.filter(sub => sub.isLate);
        const averageGrade = gradedSubmissions.length > 0 
          ? gradedSubmissions.reduce((sum, sub) => sum + sub.grade, 0) / gradedSubmissions.length 
          : 0;

        setStats({
          total: totalSubmissions,
          graded: gradedSubmissions.length,
          pending: totalSubmissions - gradedSubmissions.length,
          late: lateSubmissions.length,
          averageGrade: Math.round(averageGrade * 100) / 100
        });
      }
    } catch (err) {
      console.error('❌ Failed to fetch submissions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId, filters, API_BASE]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // ✅ Utility functions
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const config = fileTypeConfig[extension] || fileTypeConfig.default;
    return config;
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      submitted: 'bg-blue-100 text-blue-800',
      under_review: 'bg-yellow-100 text-yellow-800',
      graded: 'bg-green-100 text-green-800',
      returned: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const downloadFile = async (fileId, fileName) => {
    try {
      const response = await fetch(`${API_BASE}/files/download/${fileId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file');
    }
  };

  const viewFile = (fileUrl) => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  // ✅ Components
  const StatsCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <FileCheck className="w-8 h-8 text-blue-500" />
        </div>
      </div>
      
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Graded</p>
            <p className="text-2xl font-bold text-green-600">{stats.graded}</p>
          </div>
          <Award className="w-8 h-8 text-green-500" />
        </div>
      </div>
      
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
          </div>
          <Timer className="w-8 h-8 text-orange-500" />
        </div>
      </div>
      
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Late</p>
            <p className="text-2xl font-bold text-red-600">{stats.late}</p>
          </div>
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
      </div>
      
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Avg Grade</p>
            <p className="text-2xl font-bold text-purple-600">
              {stats.averageGrade > 0 ? `${stats.averageGrade}%` : 'N/A'}
            </p>
          </div>
          <TrendingUp className="w-8 h-8 text-purple-500" />
        </div>
      </div>
    </div>
  );

  const FilterBar = () => (
    <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by student name, email, or comment..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        {/* Status Filter */}
        <select
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="graded">Graded</option>
          <option value="returned">Returned</option>
        </select>
        
        {/* Sort By */}
        <select
          value={filters.sortBy}
          onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="submittedAt">Submission Date</option>
          <option value="grade">Grade</option>
          <option value="student.name">Student Name</option>
          <option value="isLate">Late Status</option>
        </select>
        
        {/* Sort Order */}
        <button
          onClick={() => setFilters(prev => ({ 
            ...prev, 
            sortOrder: prev.sortOrder === 'desc' ? 'asc' : 'desc' 
          }))}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
        >
          {filters.sortOrder === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
          <span className="hidden sm:inline">{filters.sortOrder === 'desc' ? 'Desc' : 'Asc'}</span>
        </button>
        
        {/* Quick Filters */}
        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={filters.showLateOnly}
              onChange={(e) => setFilters(prev => ({ ...prev, showLateOnly: e.target.checked }))}
              className="rounded"
            />
            <span>Late only</span>
          </label>
          
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={filters.showGradedOnly}
              onChange={(e) => setFilters(prev => ({ ...prev, showGradedOnly: e.target.checked }))}
              className="rounded"
            />
            <span>Graded only</span>
          </label>
        </div>
        
        {/* Refresh */}
        <button
          onClick={fetchSubmissions}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );

  const SubmissionCard = ({ submission }) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{submission.student.name}</h3>
              <p className="text-sm text-gray-500">{submission.student.email}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {submission.isLate && (
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                Late
              </span>
            )}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
              {submission.status.replace('_', ' ').toUpperCase()}
            </span>
            {submission.grade !== null && submission.grade !== undefined && (
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                {submission.grade}%
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Submission Info */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>Submitted: {formatDateTime(submission.submittedAt)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span>Attempt #{submission.attemptNumber}</span>
          </div>
        </div>
        
        {/* Comment */}
        {submission.comment && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Comment:</h4>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 line-clamp-3">
              {submission.comment}
            </p>
          </div>
        )}
        
        {/* Collaborators */}
        {submission.collaborators && submission.collaborators.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Collaborators:</h4>
            <div className="flex flex-wrap gap-2">
              {submission.collaborators.map((email, index) => (
                <span key={index} className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                  <Users className="w-3 h-3" />
                  <span>{email}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Files */}
        {submission.files && submission.files.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Files ({submission.files.length}):
            </h4>
            <div className="space-y-2">
              {submission.files.map((file) => {
                const { icon: Icon, color } = getFileIcon(file.originalName);
                
                return (
                  <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.originalName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                          {file.isImage && ' • Image'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {file.webViewLink && (
                        <button
                          onClick={() => viewFile(file.webViewLink)}
                          className="p-1 text-blue-500 hover:text-blue-700 rounded"
                          title="View file"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => downloadFile(file.id, file.originalName)}
                        className="p-1 text-gray-500 hover:text-gray-700 rounded"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Grading Info */}
        {submission.feedback && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Feedback:</h4>
            <p className="text-sm text-gray-600 bg-green-50 rounded-lg p-3">
              {submission.feedback}
            </p>
            {submission.gradedAt && (
              <p className="text-xs text-gray-500 mt-2">
                Graded on {formatDateTime(submission.gradedAt)}
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedSubmission(submission)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View Details
          </button>
          
          <div className="flex items-center space-x-2">
            {submission.grade === null || submission.grade === undefined ? (
              <button className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Grade
              </button>
            ) : (
              <button className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                Update Grade
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const SubmissionDetail = ({ submission, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Submission Details
            </h2>
            <p className="text-gray-600">
              {submission.student.name} • {formatDateTime(submission.submittedAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            ×
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Student Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Student Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Name</label>
                  <p className="text-gray-900">{submission.student.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p className="text-gray-900">{submission.student.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Student ID</label>
                  <p className="text-gray-900">{submission.student.studentId || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                    {submission.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Submission Details */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Submission Details</h3>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="prose max-w-none">
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {submission.comment}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Files Grid */}
            {submission.files && submission.files.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">
                  Attached Files ({submission.files.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {submission.files.map((file) => {
                    const { icon: Icon, color } = getFileIcon(file.originalName);
                    
                    return (
                      <div key={file.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">
                              {file.originalName}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(file.size)}
                              {file.mimeType && ` • ${file.mimeType}`}
                            </p>
                            {file.isImage && file.thumbnailLink && (
                              <img
                                src={file.thumbnailLink}
                                alt={file.originalName}
                                className="mt-2 max-w-full h-32 object-cover rounded"
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-end space-x-2 mt-3">
                          {file.webViewLink && (
                            <button
                              onClick={() => viewFile(file.webViewLink)}
                              className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                            >
                              View
                            </button>
                          )}
                          <button
                            onClick={() => downloadFile(file.id, file.originalName)}
                            className="px-3 py-1 text-gray-600 hover:bg-gray-50 rounded text-sm"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Grading Section */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-3">Grading</h3>
              {submission.grade !== null && submission.grade !== undefined ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-blue-700">Current Grade</label>
                    <p className="text-xl font-bold text-blue-900">{submission.grade}%</p>
                  </div>
                  {submission.feedback && (
                    <div>
                      <label className="text-sm font-medium text-blue-700">Feedback</label>
                      <p className="text-blue-900 bg-white rounded p-3 mt-1">
                        {submission.feedback}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-blue-600">
                    Graded on {formatDateTime(submission.gradedAt)}
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <GraduationCap className="w-12 h-12 text-blue-400 mx-auto mb-2" />
                  <p className="text-blue-700">This submission has not been graded yet.</p>
                  <button className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Grade Submission
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ✅ Main render
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading submissions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2">
          <XCircle className="w-5 h-5 text-red-500" />
          <h3 className="font-medium text-red-900">Error Loading Submissions</h3>
        </div>
        <p className="text-red-700 mt-2">{error}</p>
        <button
          onClick={fetchSubmissions}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StatsCards />
      <FilterBar />
      
      {submissions.length === 0 ? (
        <div className="text-center py-12">
          <FileX className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions found</h3>
          <p className="text-gray-600">
            {filters.search || filters.showLateOnly || filters.showGradedOnly
              ? 'Try adjusting your filters to see more results.'
              : 'No students have submitted their work yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {submissions.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} />
          ))}
        </div>
      )}
      
      {selectedSubmission && (
        <SubmissionDetail
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </div>
  );
};

export default SubmissionViewer;