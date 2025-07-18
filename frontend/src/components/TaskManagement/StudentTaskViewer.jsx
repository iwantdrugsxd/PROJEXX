// frontend/src/components/TaskManagement/StudentTaskViewer.jsx
import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  Download,
  Calendar,
  Clock,
  Award,
  User,
  Users,
  FileText,
  CheckCircle,
  AlertCircle,
  Star,
  MessageCircle,
  Paperclip,
  RefreshCw,
  Edit,
  Send
} from 'lucide-react';

const StudentTaskViewer = ({ task, onClose, onResubmit }) => {
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    if (task) {
      loadSubmissionData();
    }
  }, [task]);

  const loadSubmissionData = async () => {
    setLoading(true);
    try {
      // Find current user's submission
      const userSubmission = task.submissions?.find(sub => 
        sub.student === localStorage.getItem('userId') || 
        sub.student === sessionStorage.getItem('userId')
      );
      
      if (userSubmission) {
        setSubmission(userSubmission);
      }
    } catch (error) {
      console.error('❌ Failed to load submission data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getGradeColor = (grade, maxPoints) => {
    if (!grade || !maxPoints) return 'text-gray-600';
    const percentage = (grade / maxPoints) * 100;
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    if (percentage >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'graded':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'submitted':
        return <Clock className="w-5 h-5 text-blue-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const canResubmit = () => {
    if (!submission || !task) return false;
    return submission.attempt < task.maxAttempts && 
           (task.allowLateSubmissions || new Date() <= new Date(task.dueDate));
  };

  const handleResubmit = () => {
    if (onResubmit && canResubmit()) {
      onResubmit(task);
    }
  };

  const downloadFile = async (file) => {
    try {
      const response = await fetch(`${API_BASE}/tasks/submissions/${file.filename}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.originalName || file.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('❌ Download error:', error);
      alert('Failed to download file');
    }
  };

  // Header Component
  const TaskHeader = () => (
    <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Eye className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{task?.title}</h2>
          <div className="flex items-center space-x-4 mt-1">
            <p className="text-gray-600">View your submission</p>
            {submission && (
              <div className="flex items-center space-x-2">
                {getStatusIcon(submission.status)}
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {submission.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        {canResubmit() && (
          <button
            onClick={handleResubmit}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span>Resubmit</span>
          </button>
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

  // Task Details Component
  const TaskDetails = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Assignment Details</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            Due: {task?.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Award className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            Max Points: {task?.maxPoints || 'N/A'}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            Attempts: {submission?.attempt || 0}/{task?.maxAttempts || 1}
          </span>
        </div>
      </div>
      
      {task?.description && (
        <div className="pt-4 border-t border-blue-200">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Description</h4>
          <p className="text-sm text-blue-700">{task.description}</p>
        </div>
      )}
      
      {task?.instructions && (
        <div className="pt-4 border-t border-blue-200 mt-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Instructions</h4>
          <p className="text-sm text-blue-700">{task.instructions}</p>
        </div>
      )}
    </div>
  );

  // Submission Status Component
  const SubmissionStatus = () => {
    if (!submission) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h3 className="text-lg font-medium text-yellow-800">No Submission Found</h3>
          </div>
          <p className="text-yellow-700 mt-2">
            You haven't submitted this assignment yet.
          </p>
        </div>
      );
    }

    const isGraded = submission.grade !== undefined && submission.grade !== null;
    const isLate = submission.isLate;

    return (
      <div className={`border rounded-lg p-6 mb-6 ${
        isGraded ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getStatusIcon(submission.status)}
            <h3 className="text-lg font-medium text-gray-900">
              Submission Status
            </h3>
          </div>
          
          {isGraded && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${getGradeColor(submission.grade, task?.maxPoints)}`}>
                {submission.grade}/{task?.maxPoints}
              </div>
              <div className="text-sm text-gray-600">
                {Math.round((submission.grade / task?.maxPoints) * 100)}%
              </div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Submitted</p>
            <p className="text-sm text-gray-600">
              {new Date(submission.submittedAt).toLocaleString()}
            </p>
            {isLate && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1">
                Late Submission
              </span>
            )}
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-700">Attempt</p>
            <p className="text-sm text-gray-600">
              {submission.attempt} of {task?.maxAttempts || 1}
            </p>
            {canResubmit() && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                Can Resubmit
              </span>
            )}
          </div>
          
          {isGraded && submission.gradedAt && (
            <div>
              <p className="text-sm font-medium text-gray-700">Graded</p>
              <p className="text-sm text-gray-600">
                {new Date(submission.gradedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Submission Content Component
  const SubmissionContent = () => {
    if (!submission) return null;

    return (
      <div className="space-y-6">
        {/* Comment */}
        {submission.comment && (
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center space-x-2 mb-3">
              <MessageCircle className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900">Your Comments</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700">{submission.comment}</p>
            </div>
          </div>
        )}

        {/* Files */}
        {submission.files && submission.files.length > 0 && (
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Paperclip className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900">
                Submitted Files ({submission.files.length})
              </h3>
            </div>
            
            <div className="space-y-3">
              {submission.files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {file.originalName || `File ${index + 1}`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.size)} • Uploaded {new Date(file.uploadedAt || submission.submittedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => downloadFile(file)}
                    className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collaborators */}
        {submission.collaborators && submission.collaborators.length > 0 && (
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900">Collaborators</h3>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {submission.collaborators.map((email, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                >
                  <User className="w-3 h-3 mr-1" />
                  {email}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {submission.feedback && submission.status === 'graded' && (
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Star className="w-5 h-5 text-yellow-600" />
                <h3 className="text-lg font-medium text-gray-900">Instructor Feedback</h3>
              </div>
              <button
                onClick={() => setShowFeedback(!showFeedback)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {showFeedback ? 'Hide' : 'Show'} Feedback
              </button>
            </div>
            
            {showFeedback && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">{submission.feedback}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Loading State
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-700">Loading submission...</span>
          </div>
        </div>
      </div>
    );
  }

  // Main Render
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <TaskHeader />
        
        <div className="overflow-y-auto p-6 space-y-6" style={{ maxHeight: 'calc(90vh - 100px)' }}>
          <TaskDetails />
          <SubmissionStatus />
          <SubmissionContent />
          
          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              {submission ? (
                <span>
                  Submitted on {new Date(submission.submittedAt).toLocaleDateString()}
                  {submission.isLate && <span className="text-red-600 ml-2">(Late)</span>}
                </span>
              ) : (
                <span>No submission found</span>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              
              {canResubmit() && (
                <button
                  onClick={handleResubmit}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Again</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentTaskViewer;