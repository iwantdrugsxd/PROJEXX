import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Award, FileText, Upload, Download, Eye, Edit, Trash2 } from 'lucide-react';
import TaskCreator from './TaskCreator';
import TaskSubmission from './TaskSubmission';
import SubmissionViewer from './SubmissionViewer';

const TaskList = ({ serverId, userRole, userId }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showSubmissions, setShowSubmissions] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [serverId]);

  const fetchTasks = async () => {
    try {
      const response = await fetch(`/api/tasks/server/${serverId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setTasks(data.tasks);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskCreated = (newTask) => {
    setTasks(prev => [newTask, ...prev]);
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
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success) {
        setTasks(prev => prev.filter(task => task._id !== taskId));
      }
    } catch (error) {
      console.error('Error deleting task:', error);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Tasks</h2>
          <p className="text-gray-600">
            {userRole === 'faculty' 
              ? 'Manage and track student assignments'
              : 'Complete your assignments and submit on time'
            }
          </p>
        </div>
        {userRole === 'faculty' && (
          <TaskCreator serverId={serverId} onTaskCreated={handleTaskCreated} />
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Tasks Yet</h3>
          <p className="text-gray-500">
            {userRole === 'faculty' 
              ? 'Create your first task to get started'
              : 'No tasks have been assigned yet'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {tasks.map((task) => (
            <div key={task._id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">{task.title}</h3>
                  <p className="text-gray-600 mb-4">{task.description}</p>
                  
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>Due: {formatDate(task.dueDate)}</span>
                      {isOverdue(task.dueDate) && (
                        <span className="text-red-500 font-medium">(Overdue)</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <Award className="w-4 h-4" />
                      <span>{task.maxPoints} points</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {userRole === 'student' && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.submissionStatus)}`}>
                      {task.submissionStatus === 'pending' ? 'Not Submitted' : 
                       task.submissionStatus === 'submitted' ? 'Submitted' : 
                       task.submissionStatus === 'graded' ? 'Graded' : 'Pending'}
                    </span>
                  )}
                  
                  {userRole === 'faculty' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setShowSubmissions(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View submissions"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteTask(task._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {userRole === 'student' && (
                <div className="border-t pt-4">
                  {task.submissionStatus === 'pending' && !isOverdue(task.dueDate) ? (
                    <TaskSubmission 
                      taskId={task._id} 
                      onSubmitted={() => handleTaskSubmitted(task._id)}
                    />
                  ) : task.submissionStatus === 'submitted' ? (
                    <div className="text-center py-4">
                      <div className="text-green-600 font-medium mb-2">✓ Submitted successfully</div>
                      <p className="text-gray-500 text-sm">
                        Submitted on {formatDate(task.submissionDate)}
                      </p>
                    </div>
                  ) : task.submissionStatus === 'graded' ? (
                    <div className="text-center py-4">
                      <div className="text-green-600 font-medium mb-2">
                        ✓ Graded: {task.grade}/{task.maxPoints} points
                      </div>
                      {task.feedback && (
                        <p className="text-gray-600 text-sm mt-2">
                          <strong>Feedback:</strong> {task.feedback}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="text-red-600 font-medium">
                        Submission deadline has passed
                      </div>
                    </div>
                  )}
                </div>
              )}

              {userRole === 'faculty' && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Submissions: {task.submissions?.length || 0}</span>
                    <span>Created: {formatDate(task.createdAt)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Submissions Modal */}
      {showSubmissions && selectedTask && (
        <SubmissionViewer 
          task={selectedTask}
          onClose={() => {
            setShowSubmissions(false);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
};

export default TaskList;