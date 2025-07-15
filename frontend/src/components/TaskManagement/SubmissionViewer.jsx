import React, { useState, useEffect } from 'react';
import { X, Download, Award, Calendar, MessageSquare, User } from 'lucide-react';

const SubmissionViewer = ({ task, onClose }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gradingSubmission, setGradingSubmission] = useState(null);
  const [gradeForm, setGradeForm] = useState({ grade: '', feedback: '' });

  useEffect(() => {
    fetchSubmissions();
  }, [task._id]);

  const fetchSubmissions = async () => {
    try {
      const response = await fetch(`/api/tasks/${task._id}/submissions`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSubmissions(data.submissions);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (studentId) => {
    try {
      const response = await fetch(`/api/tasks/${task._id}/download/${studentId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = submissions.find(s => s.student._id === studentId)?.fileName || 'download';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download file');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  const handleGradeSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`/api/tasks/${task._id}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          studentId: gradingSubmission.student._id,
          grade: parseInt(gradeForm.grade),
          feedback: gradeForm.feedback
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Update local state
        setSubmissions(prev => prev.map(sub => 
          sub.student._id === gradingSubmission.student._id 
            ? { 
                ...sub, 
                grade: parseInt(gradeForm.grade), 
                feedback: gradeForm.feedback,
                status: 'graded',
                gradedAt: new Date()
              }
            : sub
        ));
        setGradingSubmission(null);
        setGradeForm({ grade: '', feedback: '' });
        alert('Grade submitted successfully!');
      } else {
        alert(data.message || 'Failed to submit grade');
      }
    } catch (error) {
      console.error('Error submitting grade:', error);
      alert('Failed to submit grade');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{task.title}</h2>
              <p className="text-gray-600">Submissions Overview</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Submissions Yet</h3>
              <p className="text-gray-500">Students haven't submitted their work yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {submissions.map((submission) => (
                <div key={submission.student._id} className="bg-gray-50 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">{submission.student.name}</h4>
                        <p className="text-sm text-gray-500">{submission.student.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {submission.status === 'graded' && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          {submission.grade}/{task.maxPoints} pts
                        </span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        submission.status === 'graded' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {submission.status === 'graded' ? 'Graded' : 'Submitted'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Submitted: {formatDate(submission.submittedAt)}</span>
                    </div>
                    {submission.fileName && (
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Download className="w-4 h-4" />
                        <span className="text-sm">{submission.fileName} ({formatFileSize(submission.fileSize)})</span>
                      </div>
                    )}
                  </div>

                  {submission.comment && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-700 bg-white p-3 rounded-lg">
                        <strong>Student Comment:</strong> {submission.comment}
                      </p>
                    </div>
                  )}

                  {submission.feedback && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-400">
                        <strong>Your Feedback:</strong> {submission.feedback}
                      </p>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    {submission.fileName && (
                      <button
                        onClick={() => downloadFile(submission.student._id)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download</span>
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        setGradingSubmission(submission);
                        setGradeForm({
                          grade: submission.grade || '',
                          feedback: submission.feedback || ''
                        });
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                    >
                      <Award className="w-4 h-4" />
                      <span>{submission.status === 'graded' ? 'Update Grade' : 'Grade'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grading Modal */}
      {gradingSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Grade Submission - {gradingSubmission.student.name}
            </h3>
            
            <form onSubmit={handleGradeSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Grade (out of {task.maxPoints})
                </label>
                <input
                  type="number"
                  value={gradeForm.grade}
                  onChange={(e) => setGradeForm(prev => ({ ...prev, grade: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  min="0"
                  max={task.maxPoints}
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Feedback
                </label>
                <textarea
                  value={gradeForm.feedback}
                  onChange={(e) => setGradeForm(prev => ({ ...prev, feedback: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  rows="4"
                  placeholder="Provide feedback for the student..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setGradingSubmission(null);
                    setGradeForm({ grade: '', feedback: '' });
                  }}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300"
                >
                  Submit Grade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionViewer;