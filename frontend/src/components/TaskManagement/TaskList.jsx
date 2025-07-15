import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Award, FileText, Upload, Download, Eye, Edit, Trash2, Users, Server } from 'lucide-react';
import TaskCreator from './TaskCreator';
import TaskSubmission from './TaskSubmission';
import SubmissionViewer from './SubmissionViewer';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000/api';

const TaskList = ({ serverId, userRole, userId }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [showTaskCreator, setShowTaskCreator] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [serverId]);

  const fetchTasks = async () => {
    if (!serverId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const endpoint = serverId 
        ? `${API_BASE}/tasks/server/${serverId}`
        : userRole === 'faculty' 
          ? `${API_BASE}/tasks/faculty-tasks`
          : `${API_BASE}/tasks/student-tasks`;

      const response = await fetch(endpoint, {
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success) {
        setTasks(data.tasks || []);
      } else {
        console.error('Failed to fetch tasks:', data.message);
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskCreated = (newTask) => {
    setTasks(prev => [newTask, ...prev]);
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
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success) {
        setTasks(prev => prev.filter(task => task._id !== taskId));
        alert('Task deleted successfully');
      } else {
        alert(data.message || 'Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
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
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'graded': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (dueDate) => {
    return new Date() > new Date(dueDate);
  };

  const getTimeRemaining = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffInMs = due - now;
    
    if (diffInMs < 0) return 'Overdue';
    
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''} left`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} left`;
    return 'Due soon';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Tasks</h2>
          <p className="text-gray-600">
            {userRole === 'faculty' 
              ? 'Manage and track task assignments for your students'
              : 'View your assigned tasks and submit your work'
            }
          </p>
        </div>
        {userRole === 'faculty' && serverId && (
          <TaskCreator 
            currentServerId={serverId} 
            onTaskCreated={handleTaskCreated}
          />
        )}
      </div>

      {/* Tasks Grid */}
      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">No tasks found</h3>
          <p className="text-gray-400">
            {userRole === 'faculty' 
              ? 'Create your first task to get started'
              : 'No tasks have been assigned yet'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              userRole={userRole}
              userId={userId}
              onTaskSubmitted={handleTaskSubmitted}
              onDeleteTask={deleteTask}
              onViewSubmissions={(task) => {
                setSelectedTask(task);
                setShowSubmissions(true);
              }}
              formatDate={formatDate}
              getStatusColor={getStatusColor}
              isOverdue={isOverdue}
              getTimeRemaining={getTimeRemaining}
            />
          ))}
        </div>
      )}

      {/* Submission Viewer Modal */}
      {showSubmissions && selectedTask && (
        <SubmissionViewer
          task={selectedTask}
          onClose={() => {
            setShowSubmissions(false);
            setSelectedTask(null);
          }}
          onTaskUpdated={(updatedTask) => {
            setTasks(prev => prev.map(t => 
              t._id === updatedTask._id ? updatedTask : t
            ));
          }}
        />
      )}
    </div>
  );
};

// Task Card Component
const TaskCard = ({ 
  task, 
  userRole, 
  userId, 
  onTaskSubmitted, 
  onDeleteTask, 
  onViewSubmissions,
  formatDate,
  getStatusColor,
  isOverdue,
  getTimeRemaining
}) => {
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const overdue = isOverdue(task.dueDate);
  const timeRemaining = getTimeRemaining(task.dueDate);

  return (
    <>
      <div className={`bg-white rounded-xl shadow-lg border-l-4 p-6 hover:shadow-xl transition-all duration-200 ${
        overdue ? 'border-red-500' : 'border-purple-500'
      }`}>
        {/* Task Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800 mb-2 line-clamp-2">
              {task.title}
            </h3>
            <p className="text-sm text-gray-600 line-clamp-3 mb-3">
              {task.description}
            </p>
          </div>
          {userRole === 'faculty' && (
            <div className="flex space-x-1 ml-2">
              <button
                onClick={() => onViewSubmissions(task)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="View Submissions"
              >
                <Eye size={16} />
              </button>
              <button
                onClick={() => onDeleteTask(task._id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Task"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Task Info */}
        <div className="space-y-3 mb-4">
          {/* Server and Team Info */}
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <Server size={14} />
              <span>{task.server?.title || 'Unknown Server'}</span>
            </div>
            {task.team && (
              <div className="flex items-center space-x-1">
                <Users size={14} />
                <span>{task.team.name}</span>
              </div>
            )}
          </div>

          {/* Due Date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar size={16} className={overdue ? 'text-red-500' : 'text-gray-500'} />
              <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                Due: {formatDate(task.dueDate)}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock size={14} className={overdue ? 'text-red-500' : 'text-gray-500'} />
              <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {timeRemaining}
              </span>
            </div>
          </div>

          {/* Points */}
          <div className="flex items-center space-x-2">
            <Award size={16} className="text-yellow-500" />
            <span className="text-sm text-gray-600">
              {task.maxPoints} points
            </span>
          </div>

          {/* Faculty Info */}
          {task.faculty && (
            <div className="text-xs text-gray-500">
              Created by: {task.faculty.firstName} {task.faculty.lastName}
            </div>
          )}
        </div>

        {/* Student Status and Actions */}
        {userRole === 'student' && (
          <div className="space-y-3">
            {/* Submission Status */}
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.submissionStatus || 'pending')}`}>
                {task.submissionStatus === 'submitted' ? 'Submitted' :
                 task.submissionStatus === 'graded' ? 'Graded' : 'Pending'}
              </span>
              {task.grade !== undefined && task.grade !== null && (
                <span className="text-sm font-medium text-green-600">
                  Grade: {task.grade}/{task.maxPoints}
                </span>
              )}
            </div>

            {/* Submission Date */}
            {task.submissionDate && (
              <div className="text-xs text-gray-500">
                Submitted: {formatDate(task.submissionDate)}
              </div>
            )}

            {/* Feedback */}
            {task.feedback && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs font-medium text-gray-700 mb-1">Feedback:</p>
                <p className="text-xs text-gray-600">{task.feedback}</p>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-2">
              {task.submissionStatus === 'pending' ? (
                <button
                  onClick={() => setShowSubmissionModal(true)}
                  disabled={overdue}
                  className={`w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg transition-all duration-200 ${
                    overdue 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700'
                  }`}
                >
                  <Upload size={16} />
                  <span>{overdue ? 'Overdue' : 'Submit Task'}</span>
                </button>
              ) : (
                <div className="w-full py-2 px-4 bg-green-50 text-green-700 rounded-lg text-center text-sm font-medium">
                  ✅ Task Submitted
                </div>
              )}
            </div>
          </div>
        )}

        {/* Faculty Actions */}
        {userRole === 'faculty' && (
          <div className="space-y-3">
            {/* Submission Stats */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Submissions: {task.totalSubmissions || 0}
              </span>
              <div className="flex space-x-2">
                <span className="text-yellow-600">
                  Pending: {task.pendingSubmissions || 0}
                </span>
                <span className="text-green-600">
                  Graded: {task.gradedSubmissions || 0}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <button
                onClick={() => onViewSubmissions(task)}
                className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors duration-200"
              >
                <Eye size={16} />
                <span>View Submissions</span>
              </button>
              <button
                onClick={() => onDeleteTask(task._id)}
                className="py-2 px-4 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors duration-200"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Task Submission Modal */}
      {showSubmissionModal && (
        <TaskSubmission
          task={task}
          onClose={() => setShowSubmissionModal(false)}
          onSubmitted={() => {
            onTaskSubmitted(task._id);
            setShowSubmissionModal(false);
          }}
        />
      )}
    </>
  );
};

export default TaskList;