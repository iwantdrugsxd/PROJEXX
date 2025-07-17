// frontend/src/components/Analytics/ComprehensiveAnalyticsDashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import {
  TrendingUp, Users, FileText, CheckCircle, Clock, AlertTriangle,
  Calendar, Target, Award, Activity, Zap, BookOpen, Filter, 
  Download, RefreshCw, ChevronRight, ChevronLeft, Plus, Edit,
  Trash2, MoreVertical, Eye, DragDropContext, Droppable, Draggable
} from 'lucide-react';

const ComprehensiveAnalyticsDashboard = ({ selectedServer, user }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState({});
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todoItems, setTodoItems] = useState([]);
  const [kanbanData, setKanbanData] = useState({
    todo: [],
    inProgress: [],
    inReview: [],
    completed: []
  });
  const [timeRange, setTimeRange] = useState('week');
  const [showCreateTodo, setShowCreateTodo] = useState(false);
  const [newTodo, setNewTodo] = useState({ title: '', description: '', priority: 'medium', dueDate: '' });

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    if (selectedServer) {
      fetchAnalyticsData();
    }
  }, [selectedServer, timeRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // Fetch server analytics
      const analyticsResponse = await fetch(`${API_BASE}/analytics/server/${selectedServer._id}?timeRange=${timeRange}`, {
        credentials: 'include'
      });
      
      if (analyticsResponse.ok) {
        const data = await analyticsResponse.json();
        setAnalytics(data.analytics || {});
      }

      // Fetch tasks for Kanban
      const tasksResponse = await fetch(`${API_BASE}/tasks/server/${selectedServer._id}`, {
        credentials: 'include'
      });
      
      if (tasksResponse.ok) {
        const data = await tasksResponse.json();
        setTasks(data.tasks || []);
        organizeKanbanData(data.tasks || []);
      }

      // Fetch teams
      const teamsResponse = await fetch(`${API_BASE}/teamRoutes/server/${selectedServer._id}/teams`, {
        credentials: 'include'
      });
      
      if (teamsResponse.ok) {
        const data = await teamsResponse.json();
        setTeams(data.teams || []);
      }

      // Fetch or create todo items for this server
      loadTodoItems();

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const organizeKanbanData = (taskList) => {
    const organized = {
      todo: [],
      inProgress: [],
      inReview: [],
      completed: []
    };

    taskList.forEach(task => {
      const submissions = task.submissions || [];
      const totalSubmissions = submissions.length;
      const gradedSubmissions = submissions.filter(s => s.status === 'graded').length;
      
      if (gradedSubmissions === totalSubmissions && totalSubmissions > 0) {
        organized.completed.push({ ...task, type: 'task' });
      } else if (totalSubmissions > 0) {
        organized.inReview.push({ ...task, type: 'task' });
      } else if (new Date(task.dueDate) > new Date()) {
        organized.inProgress.push({ ...task, type: 'task' });
      } else {
        organized.todo.push({ ...task, type: 'task' });
      }
    });

    setKanbanData(organized);
  };

  const loadTodoItems = () => {
    // Load from localStorage for now (can be moved to backend later)
    const savedTodos = localStorage.getItem(`todos_${selectedServer._id}`);
    if (savedTodos) {
      setTodoItems(JSON.parse(savedTodos));
    }
  };

  const saveTodoItems = (items) => {
    localStorage.setItem(`todos_${selectedServer._id}`, JSON.stringify(items));
    setTodoItems(items);
  };

  const createTodo = () => {
    if (newTodo.title.trim()) {
      const todo = {
        id: Date.now().toString(),
        ...newTodo,
        createdAt: new Date().toISOString(),
        completed: false,
        type: 'todo'
      };
      saveTodoItems([...todoItems, todo]);
      setNewTodo({ title: '', description: '', priority: 'medium', dueDate: '' });
      setShowCreateTodo(false);
    }
  };

  const toggleTodo = (id) => {
    const updated = todoItems.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    saveTodoItems(updated);
  };

  const deleteTodo = (id) => {
    const updated = todoItems.filter(todo => todo.id !== id);
    saveTodoItems(updated);
  };

  // Analytics calculations
  const getCompletionRate = () => {
    if (tasks.length === 0) return 0;
    const completedTasks = kanbanData.completed.length;
    return Math.round((completedTasks / tasks.length) * 100);
  };

  const getTeamPerformance = () => {
    return teams.map(team => {
      const teamTasks = tasks.filter(task => task.team?._id === team._id);
      const completedTasks = teamTasks.filter(task => 
        kanbanData.completed.some(completed => completed._id === task._id)
      ).length;
      
      return {
        name: team.name,
        completed: completedTasks,
        total: teamTasks.length,
        percentage: teamTasks.length > 0 ? Math.round((completedTasks / teamTasks.length) * 100) : 0
      };
    });
  };

  const getGradeDistribution = () => {
    const grades = [];
    tasks.forEach(task => {
      task.submissions?.forEach(submission => {
        if (submission.grade !== undefined && submission.grade !== null) {
          grades.push(submission.grade);
        }
      });
    });

    const distribution = {
      'A (90-100)': grades.filter(g => g >= 90).length,
      'B (80-89)': grades.filter(g => g >= 80 && g < 90).length,
      'C (70-79)': grades.filter(g => g >= 70 && g < 80).length,
      'D (60-69)': grades.filter(g => g >= 60 && g < 70).length,
      'F (0-59)': grades.filter(g => g < 60).length,
    };

    return Object.entries(distribution).map(([grade, count]) => ({
      grade,
      count,
      percentage: grades.length > 0 ? Math.round((count / grades.length) * 100) : 0
    }));
  };

  const getActivityTimeline = () => {
    const timeline = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const tasksCreated = tasks.filter(task => 
        task.createdAt?.startsWith(dateStr)
      ).length;
      
      const submissionsReceived = tasks.reduce((sum, task) => 
        sum + (task.submissions?.filter(sub => 
          sub.submittedAt?.startsWith(dateStr)
        ).length || 0), 0
      );

      timeline.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        tasksCreated,
        submissions: submissionsReceived,
        activity: tasksCreated + submissionsReceived
      });
    }
    
    return timeline;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600">Server: {selectedServer?.title}</p>
        </div>
        <div className="flex items-center space-x-3">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button 
            onClick={fetchAnalyticsData}
            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', icon: TrendingUp },
            { key: 'kanban', label: 'Kanban Board', icon: Target },
            { key: 'todos', label: 'Todo Lists', icon: CheckCircle },
            { key: 'teams', label: 'Team Performance', icon: Users },
            { key: 'grades', label: 'Grade Analytics', icon: Award }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === key
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                  <p className="text-3xl font-bold text-green-600">{getCompletionRate()}%</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Teams</p>
                  <p className="text-3xl font-bold text-blue-600">{teams.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                  <p className="text-3xl font-bold text-purple-600">{tasks.length}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Reviews</p>
                  <p className="text-3xl font-bold text-orange-600">{kanbanData.inReview.length}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getActivityTimeline()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="tasksCreated" stroke="#8b5cf6" name="Tasks Created" />
                <Line type="monotone" dataKey="submissions" stroke="#10b981" name="Submissions Received" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'kanban' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {Object.entries(kanbanData).map(([status, items]) => (
              <div key={status} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 capitalize">
                    {status === 'inProgress' ? 'In Progress' : status === 'inReview' ? 'In Review' : status}
                  </h3>
                  <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                    {items.length}
                  </span>
                </div>
                
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item._id} className="bg-white p-3 rounded-lg shadow-sm border">
                      <h4 className="font-medium text-gray-900 text-sm mb-1">{item.title}</h4>
                      {item.team && (
                        <p className="text-xs text-gray-500 mb-2">Team: {item.team.name}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.priority === 'high' ? 'bg-red-100 text-red-700' :
                          item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.priority || 'Normal'}
                        </span>
                        {item.dueDate && (
                          <span className="text-xs text-gray-500">
                            {new Date(item.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'todos' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Faculty Todo List</h3>
            <button
              onClick={() => setShowCreateTodo(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              <span>Add Todo</span>
            </button>
          </div>

          {showCreateTodo && (
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Create New Todo</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Todo title"
                  value={newTodo.title}
                  onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <select
                  value={newTodo.priority}
                  onChange={(e) => setNewTodo({ ...newTodo, priority: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <input
                  type="date"
                  value={newTodo.dueDate}
                  onChange={(e) => setNewTodo({ ...newTodo, dueDate: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <textarea
                placeholder="Description (optional)"
                value={newTodo.description}
                onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                className="w-full mt-4 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows="3"
              />
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={createTodo}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Create Todo
                </button>
                <button
                  onClick={() => setShowCreateTodo(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6">
              <div className="space-y-3">
                {todoItems.map((todo) => (
                  <div key={todo.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                    todo.completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => toggleTodo(todo.id)}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <div className={todo.completed ? 'line-through text-gray-500' : ''}>
                        <h4 className="font-medium">{todo.title}</h4>
                        {todo.description && (
                          <p className="text-sm text-gray-600">{todo.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        todo.priority === 'high' ? 'bg-red-100 text-red-700' :
                        todo.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {todo.priority}
                      </span>
                      {todo.dueDate && (
                        <span className="text-xs text-gray-500">
                          Due: {new Date(todo.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {todoItems.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">No todos yet</h3>
                    <p className="text-gray-500">Create your first todo to get organized</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={getTeamPerformance()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#10b981" name="Completed Tasks" />
                <Bar dataKey="total" fill="#e5e7eb" name="Total Tasks" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => {
              const teamPerf = getTeamPerformance().find(t => t.name === team.name);
              return (
                <div key={team._id} className="bg-white p-6 rounded-xl shadow-sm border">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-900">{team.name}</h4>
                    <span className="text-sm text-gray-500">{team.members?.length || 0} members</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Progress</span>
                      <span className="text-sm font-medium text-gray-900">
                        {teamPerf?.percentage || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${teamPerf?.percentage || 0}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Completed: {teamPerf?.completed || 0}</span>
                      <span>Total: {teamPerf?.total || 0}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'grades' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h3>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={getGradeDistribution()}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="count"
                  label={({ grade, percentage }) => `${grade}: ${percentage}%`}
                >
                  {getGradeDistribution().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={[
                      '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6b7280'
                    ][index % 5]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComprehensiveAnalyticsDashboard;