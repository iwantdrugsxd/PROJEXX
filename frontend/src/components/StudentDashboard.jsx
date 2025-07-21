// frontend/src/components/StudentDashboard.jsx - COMPLETE REWRITE
import React, { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, 
  Users, 
  FileText, 
  Calendar, 
  Award, 
  Target, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Plus, 
  Search, 
  Bell, 
  Settings, 
  BarChart3,
  Activity,
  PieChart,
  LineChart,
  Loader2,
  User,
  Upload,
  Download,
  Eye,
  Star,
  ArrowUp,
  ArrowDown,
  Filter,
  RefreshCw
} from 'lucide-react';
import { AuthContext } from '../App';
import TaskSubmission from './TaskManagement/TaskSubmission';
import StudentTaskViewer from './TaskManagement/StudentTaskViewer';
import StudentAnalyticsDashboard from './Analytics/StudentAnalyticsDashboard';
import { API_BASE } from '../App';

const StudentDashboard = () => {
  const { user } = React.useContext(AuthContext);
  
  // State Management
  const [activeTab, setActiveTab] = useState('overview');
  const [servers, setServers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskSubmission, setShowTaskSubmission] = useState(false);
  const [showTaskViewer, setShowTaskViewer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [notifications, setNotifications] = useState([]);

  // Modal States
  const [showJoinServerModal, setShowJoinServerModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);

  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState({
    totalServers: 0,
    totalTeams: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    averageGrade: 0,
    completionRate: 0,
    onTimeSubmissions: 0
  });

  // Initialize Dashboard
  useEffect(() => {
    initializeDashboard();
  }, []);

  const initializeDashboard = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchServers(),
        fetchTeams(),
        fetchTasks(),
        fetchAnalytics(),
        fetchNotifications()
      ]);
    } catch (error) {
      console.error('❌ Dashboard initialization failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Enhanced Server Fetching
 const fetchTeams = async () => {
  try {
    // Add studentId as query parameter
    const studentId = user?.id || user?._id || 'STUDENT_ID_HERE'; // Replace with actual student ID
    const response = await fetch(`${API_BASE}/teams/student-teams?studentId=${studentId}`, {
      credentials: 'include'
    });
    const data = await response.json();
    if (data.success) {
      setTeams(data.teams || []);
      setDashboardStats(prev => ({ ...prev, totalTeams: data.teams?.length || 0 }));
    } else {
      console.error('❌ Failed to fetch teams:', data.message);
    }
  } catch (error) {
    console.error('❌ Failed to fetch teams:', error);
  }
};

// ✅ Update fetchServers function  
const fetchServers = async () => {
  try {
    const studentId = user?.id || user?._id || 'STUDENT_ID_HERE'; // Replace with actual student ID
    const response = await fetch(`${API_BASE}/projectServers/student-servers?studentId=${studentId}`, {
      credentials: 'include'
    });
    const data = await response.json();
    if (data.success) {
      setServers(data.servers || []);
      setDashboardStats(prev => ({ ...prev, totalServers: data.servers?.length || 0 }));
      
      if (!selectedServer && data.servers?.length > 0) {
        setSelectedServer(data.servers[0]);
      }
    } else {
      console.error('❌ Failed to fetch servers:', data.message);
    }
  } catch (error) {
    console.error('❌ Failed to fetch servers:', error);
  }
};

// ✅ Update fetchTasks function
const fetchTasks = async () => {
  try {
    const studentId = user?.id || user?._id || 'STUDENT_ID_HERE'; // Replace with actual student ID
    const response = await fetch(`${API_BASE}/tasks/student-tasks?studentId=${studentId}`, {
      credentials: 'include'
    });
    const data = await response.json();
    if (data.success) {
      const taskList = data.tasks || [];
      setTasks(taskList);
      
      // Calculate task statistics
      const completed = taskList.filter(task => task.hasSubmission).length;
      const pending = taskList.length - completed;
      
      setDashboardStats(prev => ({
        ...prev,
        totalTasks: taskList.length,
        completedTasks: completed,
        pendingTasks: pending,
        completionRate: taskList.length > 0 ? Math.round((completed / taskList.length) * 100) : 0
      }));
    } else {
      console.error('❌ Failed to fetch tasks:', data.message);
    }
  } catch (error) {
    console.error('❌ Failed to fetch tasks:', error);
  }
};

  // ✅ NEW: Analytics Integration
  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/student`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.analytics || {});
        
        // Update dashboard stats with analytics data
        setDashboardStats(prev => ({
          ...prev,
          averageGrade: data.analytics.averageGrade || 0,
          onTimeSubmissions: data.analytics.onTimeSubmissions || 0,
          completionRate: data.analytics.completionRate || 0
        }));
      }
    } catch (error) {
      console.error('❌ Failed to fetch analytics:', error);
    }
  };

  // ✅ Notification Fetching
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE}/notifications`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('❌ Failed to fetch notifications:', error);
    }
  };

  // ✅ Refresh Handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await initializeDashboard();
    setRefreshing(false);
  };

  // ✅ Filter and Search Functions
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    
    const hasSubmission = task.submissions?.some(sub => sub.student === user.id);
    if (filterStatus === 'completed') return matchesSearch && hasSubmission;
    if (filterStatus === 'pending') return matchesSearch && !hasSubmission;
    
    return matchesSearch;
  });

  // ✅ Color Utilities
  const getTaskPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'submitted': return 'text-blue-600';
      case 'graded': return 'text-purple-600';
      case 'overdue': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // ✅ Task Handlers
  const handleTaskClick = (task) => {
    setSelectedTask(task);
    const hasSubmission = task.submissions?.some(sub => sub.student === user.id);
    
    if (hasSubmission) {
      setShowTaskViewer(true);
    } else {
      setShowTaskSubmission(true);
    }
  };

  const handleTaskSubmitted = () => {
    setShowTaskSubmission(false);
    setSelectedTask(null);
    fetchTasks(); // Refresh tasks
    fetchAnalytics(); // Refresh analytics
  };

  // ✅ Header Component
  const DashboardHeader = () => (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName}! 👋
          </h1>
          <p className="text-gray-600 mt-1">
            Track your progress and manage your assignments
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Notifications */}
          <div className="relative">
            <button className="p-2 text-gray-400 hover:text-gray-600 relative">
              <Bell className="w-5 h-5" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );

  // ✅ Navigation Tabs
  const NavigationTabs = () => (
    <div className="bg-white border-b border-gray-200">
      <nav className="px-6">
        <div className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Target },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'tasks', label: 'Tasks', icon: FileText },
            { id: 'teams', label: 'Teams', icon: Users },
            { id: 'servers', label: 'Servers', icon: BookOpen },
            { id: 'calendar', label: 'Calendar', icon: Calendar },
            { id: 'profile', label: 'Profile', icon: User }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );

  // ✅ Overview Tab - Enhanced with Analytics
  const OverviewTab = () => (
    <div className="p-6 space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalTasks}</p>
              <p className="text-xs text-blue-600 mt-1">Active assignments</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.completedTasks}</p>
              <p className="text-xs text-green-600 mt-1">Tasks finished</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Grade</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.averageGrade}%</p>
              <p className="text-xs text-purple-600 mt-1">Current performance</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Teams Joined</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalTeams}</p>
              <p className="text-xs text-orange-600 mt-1">Active collaborations</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity & Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Tasks</h3>
              <button 
                onClick={() => setActiveTab('tasks')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View All
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {tasks.slice(0, 5).map(task => {
                const hasSubmission = task.submissions?.some(sub => sub.student === user.id);
                const isOverdue = new Date(task.dueDate) < new Date() && !hasSubmission;
                
                return (
                  <div 
                    key={task._id}
                    onClick={() => handleTaskClick(task)}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        hasSubmission ? 'bg-green-500' : isOverdue ? 'bg-red-500' : 'bg-yellow-500'
                      }`}></div>
                      <div>
                        <p className="font-medium text-gray-900">{task.title}</p>
                        <p className="text-sm text-gray-500">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      hasSubmission ? 'bg-green-100 text-green-800' :
                      isOverdue ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {hasSubmission ? 'Submitted' : isOverdue ? 'Overdue' : 'Pending'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Performance Overview</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Completion Rate</span>
              <span className="font-semibold text-gray-900">{dashboardStats.completionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${dashboardStats.completionRate}%` }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">On-Time Submissions</span>
              <span className="font-semibold text-gray-900">{dashboardStats.onTimeSubmissions}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Average Grade</span>
              <span className="font-semibold text-gray-900">{dashboardStats.averageGrade}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ✅ Analytics Tab - Full Integration
  const AnalyticsTab = () => (
    <StudentAnalyticsDashboard 
      analytics={analytics}
      tasks={tasks}
      teams={teams}
      onRefresh={fetchAnalytics}
    />
  );

  // ✅ Tasks Tab - Enhanced
  const TasksTab = () => (
    <div className="p-6 space-y-6">
      {/* Task Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Your Tasks</h2>
          <p className="text-gray-600">Manage your assignments and submissions</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Tasks</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTasks.map(task => {
          const hasSubmission = task.submissions?.some(sub => sub.student === user.id);
          const isOverdue = new Date(task.dueDate) < new Date() && !hasSubmission;
          const submission = task.submissions?.find(sub => sub.student === user.id);
          
          return (
            <div
              key={task._id}
              onClick={() => handleTaskClick(task)}
              className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">{task.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getTaskPriorityColor(task.priority)}`}>
                    {task.priority || 'Medium'}
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Due Date:</span>
                    <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Max Points:</span>
                    <span className="font-medium text-gray-900">{task.maxPoints}</span>
                  </div>
                  
                  {submission && submission.grade !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Your Grade:</span>
                      <span className="font-medium text-green-600">
                        {submission.grade}/{task.maxPoints}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      hasSubmission ? 'bg-green-100 text-green-800' :
                      isOverdue ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {hasSubmission ? 'Submitted' : isOverdue ? 'Overdue' : 'Pending'}
                    </span>
                    
                    <div className="flex items-center space-x-2">
                      {task.allowFileUpload && (
                        <Upload className="w-4 h-4 text-gray-400" />
                      )}
                      <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No tasks found</h3>
          <p className="text-gray-500">
            {searchQuery ? 'Try adjusting your search criteria' : 'No tasks available at the moment'}
          </p>
        </div>
      )}
    </div>
  );

  // ✅ Teams Tab
  const TeamsTab = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Your Teams</h2>
          <p className="text-gray-600">Collaborate with your classmates</p>
        </div>
        <button
          onClick={() => setShowCreateTeamModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Team
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {teams.map(team => (
          <div key={team._id} className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{team.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{team.description}</p>
                </div>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {team.members?.length || 0} members
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Server: {team.projectServer}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {team.members?.slice(0, 4).map((member, index) => (
                      <div
                        key={index}
                        className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center border-2 border-white text-xs font-medium text-blue-600"
                      >
                        {member.firstName?.[0]}{member.lastName?.[0]}
                      </div>
                    ))}
                    {team.members?.length > 4 && (
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center border-2 border-white text-xs font-medium text-gray-600">
                        +{team.members.length - 4}
                      </div>
                    )}
                  </div>
                  
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {teams.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No teams yet</h3>
          <p className="text-gray-500 mb-6">Create or join a team to start collaborating</p>
          <button
            onClick={() => setShowCreateTeamModal(true)}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Team
          </button>
        </div>
      )}
    </div>
  );

  // ✅ Servers Tab
  const ServersTab = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Project Servers</h2>
          <p className="text-gray-600">Access your course servers and projects</p>
        </div>
        <button
          onClick={() => setShowJoinServerModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Join Server
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {servers.map(server => (
          <div 
            key={server._id} 
            onClick={() => setSelectedServer(server)}
            className={`bg-white rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
              selectedServer?._id === server._id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{server.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{server.description}</p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                  Active
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="w-4 h-4 mr-2" />
                  {server.studentCount || 0} students enrolled
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <FileText className="w-4 h-4 mr-2" />
                  Code: {server.code}
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-gray-500">
                    Joined {new Date(server.joinedAt || server.createdAt).toLocaleDateString()}
                  </span>
                  {selectedServer?._id === server._id && (
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {servers.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No servers joined</h3>
          <p className="text-gray-500 mb-6">Join a server to access courses and assignments</p>
          <button
            onClick={() => setShowJoinServerModal(true)}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Join Your First Server
          </button>
        </div>
      )}
    </div>
  );

  // ✅ Calendar Tab
  const CalendarTab = () => (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Calendar</h2>
        <p className="text-gray-600">View your upcoming deadlines and events</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Widget */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
          <div className="text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Calendar Coming Soon</h3>
            <p className="text-gray-500">Calendar integration will be available in the next update</p>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {tasks
                .filter(task => !task.submissions?.some(sub => sub.student === user.id))
                .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                .slice(0, 5)
                .map(task => {
                  const dueDate = new Date(task.dueDate);
                  const isOverdue = dueDate < new Date();
                  const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <div key={task._id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg">
                      <div className={`w-3 h-3 rounded-full ${isOverdue ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{task.title}</p>
                        <p className="text-sm text-gray-500">
                          {isOverdue ? 'Overdue' : `${daysLeft} days left`}
                        </p>
                      </div>
                      <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                  );
                })}
              
              {tasks.filter(task => !task.submissions?.some(sub => sub.student === user.id)).length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">All caught up!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ✅ Profile Tab
  const ProfileTab = () => (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Profile Settings</h2>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center space-x-6 mb-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div>
                <h4 className="text-xl font-semibold text-gray-900">
                  {user?.firstName} {user?.lastName}
                </h4>
                <p className="text-gray-600">{user?.email}</p>
                <p className="text-sm text-gray-500">Student</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  value={user?.firstName || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  value={user?.lastName || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student ID</label>
                <input
                  type="text"
                  value={user?.id || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>

        {/* Academic Stats */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Academic Stats</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Tasks</span>
                <span className="font-semibold text-gray-900">{dashboardStats.totalTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Completed</span>
                <span className="font-semibold text-gray-900">{dashboardStats.completedTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Average Grade</span>
                <span className="font-semibold text-gray-900">{dashboardStats.averageGrade}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Teams Joined</span>
                <span className="font-semibold text-gray-900">{dashboardStats.totalTeams}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Preferences</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Email Notifications</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Push Notifications</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // ✅ Main Render
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <NavigationTabs />
      
      <main className="max-w-7xl mx-auto">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'teams' && <TeamsTab />}
        {activeTab === 'servers' && <ServersTab />}
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      {/* Modals */}
      {showTaskSubmission && selectedTask && (
        <TaskSubmission
          task={selectedTask}
          onClose={() => {
            setShowTaskSubmission(false);
            setSelectedTask(null);
          }}
          onSubmitted={handleTaskSubmitted}
        />
      )}

      {showTaskViewer && selectedTask && (
        <StudentTaskViewer
          task={selectedTask}
          onClose={() => {
            setShowTaskViewer(false);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Quick Action Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={handleRefresh}
          className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 flex items-center justify-center"
          title="Refresh Dashboard"
        >
          <RefreshCw className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};

export default StudentDashboard;