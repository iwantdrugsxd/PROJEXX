import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Calendar, 
  Clock, 
  Award, 
  Users, 
  FileText, 
  Eye, 
  Edit, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Filter,
  Search,
  BarChart3,
  Download,
  X
} from 'lucide-react';
import TaskCreator from './TaskManagement/TaskCreator';


const FacultyTaskList = ({ serverId, serverTitle }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskCreator, setShowTaskCreator] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    search: ''
  });

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    if (serverId) {
      fetchTasks();
    }
  }, [serverId]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const endpoint = serverId 
        ? `${API_BASE}/tasks/server/${serverId}`
        : `${API_BASE}/tasks/faculty-tasks`;

      const response = await fetch(endpoint, {
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

  const fetchSubmissions = async (taskId) => {
    setLoadingSubmissions(true);
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/submissions`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success) {
        setSubmissions(data.submissions || []);
      } else {
        console.error('Failed to fetch submissions:', data.message);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleTaskCreated = (newTaskData) => {
    // Refresh tasks after creation
    fetchTasks();
    setShowTaskCreator(false);
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        setTasks(prev => prev.filter(task => task._id !== taskId));
      } else {
        alert(data.message || 'Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Network error. Please try again.');
    }
  };

  const handleViewSubmissions = (task) => {
    setSelectedTask(task);
    setShowSubmissions(true);
    fetchSubmissions(task._id);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const getSubmissionStats = (task) => {
    const total = task.team?.members?.length || 0;
    const submitted = task.totalSubmissions || 0;
    const graded = task.gradedSubmissions || 0;
    
    return { total, submitted, graded };
  };

  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filters.status === 'all' || task.status === filters.status;
    const matchesPriority = filters.priority === 'all' || task.priority === filters.priority;
    const matchesSearch = !filters.search || 
      task.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      task.description.toLowerCase().includes(filters.search.toLowerCase()) ||
      task.team?.name?.toLowerCase().includes(filters.search.toLowerCase());
    
    return matchesStatus && matchesPriority && matchesSearch;
  });

  const TaskCard = ({ task }) => {
    const stats = getSubmissionStats(task);
    const isOverdue = new Date() > new Date(task.dueDate);
    const submissionRate = stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0;

    return (
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-l-4 border-purple-500">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
              </div>
              <p className="text-gray-600 text-sm line-clamp-2">{task.description}</p>
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={() => handleViewSubmissions(task)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="View Submissions"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteTask(task._id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Task Info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center text-sm text-gray-600">
              <Users className="w-4 h-4 mr-2" />
              <span>{task.team?.name || 'Multiple Teams'}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Award className="w-4 h-4 mr-2" />
              <span>{task.maxPoints} points</span>
            </div>
          </div>

          {/* Due Date */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center text-sm">
              <Calendar className="w-4 h-4 mr-2 text-gray-400" />
              <span className={`${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                {formatDate(task.dueDate)}
                {isOverdue && ' (Overdue)'}
              </span>
            </div>
            
            {isOverdue && (
              <div className="flex items-center text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 mr-1" />
                <span>Overdue</span>
              </div>
            )}
          </div>

          {/* Submission Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Submission Progress</span>
              <span className="font-medium">{stats.submitted}/{stats.total} submitted</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${submissionRate}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>{submissionRate}% submitted</span>
              <span>{stats.graded} graded</span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-blue-600">{stats.submitted}</div>
                <div className="text-xs text-gray-500">Submitted</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-600">{stats.graded}</div>
                <div className="text-xs text-gray-500">Graded</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-600">{stats.total - stats.submitted}</div>
                <div className="text-xs text-gray-500">Pending</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SubmissionsModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Task Submissions</h2>
              <p className="text-blue-100 text-sm">{selectedTask?.title}</p>
            </div>
            <button
              onClick={() => setShowSubmissions(false)}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {loadingSubmissions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading submissions...</span>
            </div>
          ) : (
            <div className="p-6">
              {/* Task Summary */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{selectedTask?.maxPoints}</div>
                    <div className="text-sm text-gray-500">Max Points</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{submissions.length}</div>
                    <div className="text-sm text-gray-500">Total Submissions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {submissions.filter(s => s.status === 'graded').length}
                    </div>
                    <div className="text-sm text-gray-500">Graded</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {submissions.filter(s => s.status === 'submitted').length}
                    </div>
                    <div className="text-sm text-gray-500">Pending Review</div>
                  </div>
                </div>
              </div>

              {/* Submissions List */}
              {submissions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No Submissions Yet</h3>
                  <p className="text-gray-500">Student submissions will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission, index) => (
                    <div key={index} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-medium text-gray-900">
                              {submission.student?.firstName} {submission.student?.lastName}
                            </h4>
                            <span className="text-sm text-gray-500">
                              {submission.student?.email}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              submission.status === 'graded' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {submission.status === 'graded' ? 'Graded' : 'Pending Review'}
                            </span>
                          </div>
                          
                          <div className="text-sm text-gray-600 mb-3">
                            <span className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              Submitted: {formatDate(submission.submittedAt)}
                              {submission.isLate && (
                                <span className="ml-2 text-red-600 font-medium">(Late)</span>
                              )}
                            </span>
                          </div>

                          {submission.comment && (
                            <div className="bg-gray-50 p-3 rounded-lg mb-3">
                              <p className="text-sm text-gray-700">{submission.comment}</p>
                            </div>
                          )}

                          {submission.collaborators && submission.collaborators.length > 0 && (
                            <div className="mb-3">
                              <span className="text-sm font-medium text-gray-700">Collaborators: </span>
                              <span className="text-sm text-gray-600">
                                {submission.collaborators.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Grade Section */}
                        <div className="ml-6 text-right">
                          {submission.status === 'graded' ? (
                            <div>
                              <div className="text-2xl font-bold text-green-600">
                                {submission.grade}/{selectedTask?.maxPoints}
                              </div>
                              <div className="text-sm text-gray-500">
                                {Math.round((submission.grade / selectedTask?.maxPoints) * 100)}%
                              </div>
                              {submission.gradedAt && (
                                <div className="text-xs text-gray-400 mt-1">
                                  Graded: {formatDate(submission.gradedAt)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm text-gray-500 mb-2">Not graded yet</div>
                              <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">
                                Grade Now
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Feedback */}
                      {submission.feedback && (
                        <div className="border-t pt-3">
                          <div className="text-sm font-medium text-gray-700 mb-1">Feedback:</div>
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-sm text-blue-800">{submission.feedback}</p>
                          </div>
                        </div>
                      )}

                      {/* Files */}
                      {submission.files && submission.files.length > 0 && (
                        <div className="border-t pt-3">
                          <div className="text-sm font-medium text-gray-700 mb-2">Attachments:</div>
                          <div className="flex flex-wrap gap-2">
                            {submission.files.map((file, fileIndex) => (
                              <div key={fileIndex} className="flex items-center bg-gray-100 px-3 py-1 rounded-lg text-sm">
                                <FileText className="w-4 h-4 mr-2 text-gray-500" />
                                <span>{file.originalName || `File ${fileIndex + 1}`}</span>
                                <button className="ml-2 text-blue-600 hover:text-blue-800">
                                  <Download className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-3 text-gray-600">Loading tasks...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
          <p className="text-gray-600">
            {serverId ? `${serverTitle} Tasks` : 'All Your Tasks'}
          </p>
        </div>
        <button
          onClick={() => setShowTaskCreator(true)}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center shadow-lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Task
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Results Count */}
          <div className="text-sm text-gray-500">
            {filteredTasks.length} of {tasks.length} tasks
          </div>
        </div>
      </div>

      {/* Task Grid */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            {tasks.length === 0 ? 'No Tasks Created Yet' : 'No Tasks Match Your Filters'}
          </h3>
          <p className="text-gray-500 mb-6">
            {tasks.length === 0 
              ? 'Create your first task to get started with assignments'
              : 'Try adjusting your search or filter criteria'
            }
          </p>
          {tasks.length === 0 && (
            <button
              onClick={() => setShowTaskCreator(true)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center mx-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Task
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map(task => (
            <TaskCard key={task._id} task={task} />
          ))}
        </div>
      )}

      {/* Modals */}
      {showTaskCreator && (
        <TaskCreator
          serverId={serverId}
          serverTitle={serverTitle}
          onTaskCreated={handleTaskCreated}
          onClose={() => setShowTaskCreator(false)}
        />
      )}

      {showSubmissions && <SubmissionsModal />}
    </div>
  );
};

export default FacultyTaskList;