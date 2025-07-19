import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Award, FileText, Upload, Download, Eye, Edit, Trash2, Users, Server, Loader2, AlertCircle } from 'lucide-react';
import TaskCreator from './TaskCreator';
import TaskSubmission from './TaskSubmission';
import SubmissionViewer from './SubmissionViewer';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const TaskList = ({ serverId, userRole, userId }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [showTaskCreator, setShowTaskCreator] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    fetchTasks();
  }, [serverId, userRole]);

  const fetchTasks = async () => {
    if (!serverId && userRole === 'faculty') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Fetching tasks:', { serverId, userRole, userId });
      
      // Updated endpoint logic
      let endpoint;
      
      if (serverId) {
        // Server-specific tasks
        endpoint = `${API_BASE}/tasks/server/${serverId}`;
      } else {
        // All tasks for user
        endpoint = userRole === 'faculty' 
          ? `${API_BASE}/tasks/faculty`
          : `${API_BASE}/tasks/student-tasks`;
      }
      
      console.log('📡 Fetching from endpoint:', endpoint);
      
      const response = await fetch(endpoint, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📊 Tasks response:', data);
      
      if (data.success) {
        setTasks(data.tasks || []);
        setRetryCount(0);
        console.log(`✅ Successfully loaded ${data.tasks?.length || 0} tasks`);
      } else {
        throw new Error(data.message || 'Failed to fetch tasks');
      }
    } catch (error) {
      console.error('❌ Error fetching tasks:', error);
      setError(error.message);
      setTasks([]);
      
      // Retry logic for network errors
      if (retryCount < 3 && !error.message.includes('403') && !error.message.includes('404')) {
        console.log(`🔄 Retrying fetch tasks (attempt ${retryCount + 1})`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchTasks(), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTaskCreated = (newTask) => {
    console.log('🎉 New task created:', newTask);
    // Refresh the task list
    fetchTasks();
    setShowTaskCreator(false);
  };

  const handleTaskSubmitted = (taskId) => {
    setTasks(prev => prev.map(task => 
      task._id === taskId 
        ? { ...task, submissionStatus: 'submitted' }
        : task
    ));
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('🗑️ Deleting task:', taskId);
      
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        setTasks(prev => prev.filter(task => task._id !== taskId));
        console.log('✅ Task deleted successfully');
        alert('Task deleted successfully');
      } else {
        throw new Error(data.message || 'Failed to delete task');
      }
    } catch (error) {
      console.error('❌ Error deleting task:', error);
      alert('Failed to delete task: ' + error.message);
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'draft': return 'text-yellow-600 bg-yellow-100';
      case 'archived': return 'text-gray-600 bg-gray-100';
      case 'submitted': return 'text-blue-600 bg-blue-100';
      case 'graded': return 'text-purple-600 bg-purple-100';
      case 'pending': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-orange-600 bg-orange-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const isOverdue = (dueDate, status) => {
    return new Date(dueDate) < new Date() && status === 'active';
  };

  if (loading && retryCount === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {userRole === 'faculty' ? 'Task Management' : 'My Tasks'}
          </h2>
          <p className="text-gray-600 mt-1">
            {userRole === 'faculty' 
              ? 'Create and manage task assignments'
              : 'View and submit your assigned tasks'
            }
          </p>
        </div>
        
        {userRole === 'faculty' && (
          <button
            onClick={() => setShowTaskCreator(true)}
            disabled={!serverId}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={!serverId ? 'Select a server to create tasks' : 'Create new task'}
          >
            <FileText className="h-4 w-4" />
            Create Task
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Error loading tasks</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
          <button
            onClick={() => fetchTasks()}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Server Selection Notice */}
      {userRole === 'faculty' && !serverId && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800">
            <Server className="h-5 w-5" />
            <span className="font-medium">Select a server</span>
          </div>
          <p className="text-blue-700 mt-1">
            Please select a project server from your dashboard to view and manage tasks for that server.
          </p>
        </div>
      )}

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {userRole === 'faculty' ? 'No tasks created yet' : 'No tasks assigned'}
          </h3>
          <p className="text-gray-600 mb-6">
            {userRole === 'faculty' 
              ? 'Create your first task to start assigning work to teams.'
              : 'You don\'t have any assigned tasks at the moment.'
            }
          </p>
          {userRole === 'faculty' && serverId && (
            <button
              onClick={() => setShowTaskCreator(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="h-4 w-4" />
              Create First Task
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => (
            <div key={task._id} className={`bg-white rounded-lg border p-6 hover:shadow-md transition-shadow ${
              isOverdue(task.dueDate, task.status) ? 'border-red-200 bg-red-50' : 'border-gray-200'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                    
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                    
                    {task.priority && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {task.priority} priority
                      </span>
                    )}
                    
                    {userRole === 'student' && task.submissionStatus && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.submissionStatus)}`}>
                        {task.submissionStatus}
                      </span>
                    )}
                    
                    {isOverdue(task.dueDate, task.status) && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium text-red-600 bg-red-100">
                        Overdue
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-600 mb-4 line-clamp-2">{task.description}</p>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Due: {formatDate(task.dueDate)}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Award className="h-4 w-4" />
                      <span>{task.maxPoints} points</span>
                    </div>
                    
                    {task.team && (
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{task.team.name}</span>
                      </div>
                    )}
                    
                    {task.server && (
                      <div className="flex items-center gap-1">
                        <Server className="h-4 w-4" />
                        <span>{task.server.title}</span>
                      </div>
                    )}
                    
                    {userRole === 'faculty' && task.faculty && (
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        <span>By: {task.faculty.firstName} {task.faculty.lastName}</span>
                      </div>
                    )}
                    
                    {task.allowFileUpload && (
                      <div className="flex items-center gap-1">
                        <Upload className="h-4 w-4" />
                        <span>File upload allowed</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2 ml-4">
                  {userRole === 'student' && task.status === 'active' && task.submissionStatus !== 'submitted' && (
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Submit Task"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setSelectedTask(task);
                      setShowSubmissions(true);
                    }}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title={userRole === 'faculty' ? 'View Submissions' : 'View Details'}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  
                  {userRole === 'faculty' && (
                    <>
                      <button
                        onClick={() => {/* Handle edit */}}
                        className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                        title="Edit Task"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => deleteTask(task._id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  
                  {task.allowFileUpload && task.submissionFiles && task.submissionFiles.length > 0 && (
                    <button
                      className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Download Files"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Progress bar for faculty */}
              {userRole === 'faculty' && task.team && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Submissions</span>
                    <span>{task.submissionCount || 0}/{task.team.members?.length || 0}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${task.team.members?.length ? 
                          ((task.submissionCount || 0) / task.team.members.length) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Task Creator Modal */}
      {showTaskCreator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Create New Task</h2>
              <button
                onClick={() => setShowTaskCreator(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FileText className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <TaskCreator
                serverId={serverId}
                onTaskCreated={handleTaskCreated}
                onCancel={() => setShowTaskCreator(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Task Submission Modal */}
      {selectedTask && !showSubmissions && userRole === 'student' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Submit Task</h2>
                <p className="text-gray-600 mt-1">{selectedTask.title}</p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FileText className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <TaskSubmission
                task={selectedTask}
                onSubmitted={(taskId) => {
                  handleTaskSubmitted(taskId);
                  setSelectedTask(null);
                }}
                onCancel={() => setSelectedTask(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Submissions/Details Viewer Modal */}
      {selectedTask && showSubmissions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {userRole === 'faculty' ? 'Task Submissions' : 'Task Details'}
                </h2>
                <p className="text-gray-600 mt-1">{selectedTask.title}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setShowSubmissions(false);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FileText className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <SubmissionViewer
                task={selectedTask}
                userRole={userRole}
                onClose={() => {
                  setSelectedTask(null);
                  setShowSubmissions(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Retry Loading Indicator */}
      {loading && retryCount > 0 && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Retrying... ({retryCount}/3)</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskList;