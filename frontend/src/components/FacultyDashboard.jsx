import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, 
  Server, 
  Users, 
  FileText, 
  LogOut,
  Home,
  BarChart3,
  User,
  Eye,
  Edit,
  Trash2,
  Share2,
  Calendar,
  Bell,
  Search,
  Download,
  TrendingUp,
  Award,
  Clock,
  X,
  Copy,
  CheckCircle,
  AlertCircle,
  Send,
  Filter,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Settings,
  RefreshCw,
  Activity,
  Zap,
  Target,
  BookOpen,
  UserCheck,
  Timer,
  Wifi,
  WifiOff
} from 'lucide-react';

// Import task management components
import TaskCreator from './TaskManagement/TaskCreator';
import FacultyTaskList from './TaskManagement/FacultyTaskList';

// Utility Functions
const dateUtils = {
  getRelativeTime: (date) => {
    const now = new Date();
    const target = new Date(date);
    const diff = now - target;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  },
  formatDate: (date, format = 'default') => {
    const d = new Date(date);
    const options = {
      default: { month: 'short', day: 'numeric', year: 'numeric' },
      short: { month: 'short', day: 'numeric' },
      long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
      time: { hour: '2-digit', minute: '2-digit' },
      datetime: { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    };
    return d.toLocaleDateString('en-US', options[format] || options.default);
  }
};

const colorUtils = {
  getAvatarColor: (name) => {
    const colors = [
      'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-orange-500'
    ];
    const hash = name?.split('').reduce((a, b) => a + b.charCodeAt(0), 0) || 0;
    return colors[hash % colors.length];
  }
};

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const EnhancedFacultyDashboard = ({ user, onLogout }) => {
  // Main state
  const [activeTab, setActiveTab] = useState('overview');
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showServerModal, setShowServerModal] = useState(false);
  const [showTaskCreator, setShowTaskCreator] = useState(false);
  const [serverForm, setServerForm] = useState({ title: '', description: '' });
  
  // Enhanced state
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [copiedCode, setCopiedCode] = useState('');
  const [expandedServers, setExpandedServers] = useState(new Set());
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Dashboard stats computed from analytics and servers
  const [dashboardStats, setDashboardStats] = useState({
    totalServers: 0,
    totalStudents: 0,
    totalTeams: 0,
    totalTasks: 0,
    completionRate: 0,
    averageGrade: 0,
    recentActivity: 0
  });

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
  const refreshInterval = useRef(null);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setError(null);
      fetchDashboardData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-refresh dashboard data every 30 seconds
  useEffect(() => {
    if (isOnline) {
      refreshInterval.current = setInterval(() => {
        fetchDashboardData(true); // silent refresh
      }, 30000);
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [isOnline]);

  // Search functionality with debouncing
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.trim() && isOnline) {
        try {
          const response = await fetch(`${API_BASE}/search?query=${encodeURIComponent(query)}&type=faculty`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setSearchResults(data.results);
            }
          }
        } catch (error) {
          console.error('Search error:', error);
        }
      } else {
        setSearchResults(null);
      }
    }, 300),
    [isOnline]
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    
    try {
      setError(null);
      
      // Fetch servers with teams and stats - This is the main endpoint
      const serversResponse = await fetch(`${API_BASE}/projectServers/faculty-servers`, {
        credentials: 'include'
      });
      
      if (!serversResponse.ok) {
        throw new Error(`Failed to fetch servers: ${serversResponse.status}`);
      }
      
      const serversData = await serversResponse.json();
      if (serversData.success) {
        const serversWithTeams = serversData.servers || [];
        setServers(serversWithTeams);
        
        // Calculate basic stats from servers data
        const basicStats = {
          totalServers: serversWithTeams.length,
          totalStudents: serversWithTeams.reduce((sum, server) => sum + (server.stats?.studentsCount || 0), 0),
          totalTeams: serversWithTeams.reduce((sum, server) => sum + (server.stats?.teamsCount || 0), 0),
          totalTasks: serversWithTeams.reduce((sum, server) => sum + (server.stats?.tasksCount || 0), 0)
        };
        
        // Auto-select first server if available and no server is selected
        if (serversWithTeams.length > 0 && !selectedServer) {
          setSelectedServer(serversWithTeams[0]);
        }
        
        setDashboardStats(prev => ({ ...prev, ...basicStats }));
      }

      // Fetch analytics (optional - may not exist)
      try {
        const analyticsResponse = await fetch(`${API_BASE}/analytics/faculty`, {
          credentials: 'include'
        });
        
        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          if (analyticsData.success) {
            setAnalytics(analyticsData.analytics);
            
            // Merge analytics with dashboard stats
            setDashboardStats(prev => ({
              ...prev,
              completionRate: analyticsData.analytics.taskStats?.completedTasks || 0,
              recentActivity: analyticsData.analytics.recentActivity?.newTeamsThisWeek || 0
            }));
          }
        }
      } catch (error) {
        console.log('Analytics endpoint not available, using basic stats');
      }

      // Fetch notifications (optional - may not exist) 
      try {
        const notificationsResponse = await fetch(`${API_BASE}/notifications`, {
          credentials: 'include'
        });
        
        if (notificationsResponse.ok) {
          const notificationsData = await notificationsResponse.json();
          if (notificationsData.success) {
            setNotifications(notificationsData.notifications || []);
          }
        }
      } catch (error) {
        console.log('Notifications endpoint not available');
      }

      // Fetch calendar events from tasks (create our own calendar events)
      try {
        const tasksResponse = await fetch(`${API_BASE}/tasks/faculty-tasks`, {
          credentials: 'include'
        });
        
        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          if (tasksData.success) {
            const events = tasksData.tasks.map(task => ({
              id: task._id,
              title: `${task.title} Due`,
              type: 'task',
              dueDate: task.dueDate,
              server: task.server,
              team: task.team,
              priority: task.priority || 'medium'
            }));
            setCalendarEvents(events);
          }
        }
      } catch (error) {
        console.log('Tasks endpoint not available for calendar');
      }

      setLastUpdated(new Date());

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const createServer = async () => {
    if (!serverForm.title.trim()) {
      alert('Server title is required');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/projectServers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: serverForm.title.trim(),
          description: serverForm.description.trim()
        })
      });

      const data = await response.json();
      if (data.success) {
        setServers(prev => [data.server, ...prev]);
        setServerForm({ title: '', description: '' });
        setShowServerModal(false);
        setSelectedServer(data.server);
        // Show success message with server code
        alert(`Server created successfully! Server code: ${data.server.code}`);
        // Auto-copy code to clipboard
        copyToClipboard(data.server.code);
        // Refresh data to get updated stats
        fetchDashboardData(true);
      } else {
        alert(data.message || 'Failed to create server');
      }
    } catch (error) {
      console.error('Error creating server:', error);
      alert('Network error. Please try again.');
    }
  };

  const deleteServer = async (serverId) => {
    if (!window.confirm('Are you sure you want to delete this server? This will also delete all associated teams and tasks.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/projectServers/${serverId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        setServers(prev => prev.filter(server => server._id !== serverId));
        if (selectedServer?._id === serverId) {
          setSelectedServer(servers.find(s => s._id !== serverId) || null);
        }
        alert('Server deleted successfully');
        // Refresh data to get updated stats
        fetchDashboardData(true);
      } else {
        alert(data.message || 'Failed to delete server');
      }
    } catch (error) {
      console.error('Error deleting server:', error);
      alert('Network error. Please try again.');
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(''), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleServerExpansion = (serverId) => {
    const newExpanded = new Set(expandedServers);
    if (newExpanded.has(serverId)) {
      newExpanded.delete(serverId);
    } else {
      newExpanded.add(serverId);
    }
    setExpandedServers(newExpanded);
  };

  const handleTaskCreated = () => {
    setShowTaskCreator(false);
    fetchDashboardData(true); // Refresh data after task creation
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'servers', label: 'Project Servers', icon: Server },
    { id: 'tasks', label: 'Task Management', icon: FileText },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  // Enhanced Overview Tab Component
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Welcome Section with Status */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-3">
              Welcome back, {user?.firstName || 'Professor'}!
            </h1>
            <p className="text-purple-100 text-lg">
              Manage your courses, create assignments, and track student progress.
            </p>
            <div className="flex items-center space-x-4 mt-4">
              <div className="flex items-center space-x-2">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-green-300" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-300" />
                )}
                <span className="text-sm text-purple-100">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-purple-200" />
                <span className="text-sm text-purple-100">
                  Last updated: {dateUtils.getRelativeTime(lastUpdated)}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-purple-200">{dateUtils.formatDate(new Date(), 'long')}</div>
            <div className="text-xs text-purple-300">{dateUtils.formatDate(new Date(), 'time')}</div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="mt-2 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 font-medium">Connection Error</span>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Enhanced Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Project Servers</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalServers}</p>
              <p className="text-xs text-green-600 mt-1">Active projects</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Server className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalStudents}</p>
              <p className="text-xs text-blue-600 mt-1">Enrolled students</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Teams</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalTeams}</p>
              <p className="text-xs text-green-600 mt-1">Formed teams</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalTasks}</p>
              <p className="text-xs text-orange-600 mt-1">Created tasks</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Activity Stats */}
      {analytics.recentActivity && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">New Teams This Week</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.recentActivity.newTeamsThisWeek || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">New Tasks This Week</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.recentActivity.newTasksThisWeek || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Active Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.taskStats?.activeTasks || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Servers and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Servers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Project Servers</h3>
              <button
                onClick={() => setActiveTab('servers')}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                View All
              </button>
            </div>
          </div>
          <div className="p-6">
            {servers.length > 0 ? (
              <div className="space-y-4">
                {servers.slice(0, 4).map((server) => (
                  <div key={server._id} className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{server.title}</h4>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-gray-500">Code: {server.code}</span>
                        <span className="text-sm text-gray-500">{server.stats?.teamsCount || 0} teams</span>
                        <span className="text-sm text-gray-500">{server.stats?.studentsCount || 0} students</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Last activity: {server.stats?.lastActivity ? 
                          dateUtils.getRelativeTime(server.stats.lastActivity) : 
                          'No activity yet'
                        }
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(server.code)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Copy server code"
                    >
                      {copiedCode === server.code ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No project servers created yet</p>
                <button
                  onClick={() => setShowServerModal(true)}
                  className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Create your first server
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => setShowServerModal(true)}
                className="flex items-center space-x-3 p-4 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <Plus className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Create Project Server</p>
                  <p className="text-sm text-gray-500">Start a new course or project</p>
                </div>
              </button>

              <button
                onClick={() => {
                  if (selectedServer) {
                    setShowTaskCreator(true);
                  } else if (servers.length > 0) {
                    setSelectedServer(servers[0]);
                    setShowTaskCreator(true);
                  } else {
                    alert('Please create a project server first');
                  }
                }}
                className="flex items-center space-x-3 p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Create Assignment</p>
                  <p className="text-sm text-gray-500">Assign tasks to teams</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className="flex items-center space-x-3 p-4 border-2 border-dashed border-green-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">View Analytics</p>
                  <p className="text-sm text-gray-500">Track performance metrics</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {notifications.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {notifications.slice(0, 5).map((notification, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{notification.message || notification.title}</p>
                    <p className="text-xs text-gray-500">
                      {dateUtils.getRelativeTime(notification.createdAt || notification.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Enhanced Servers Tab Component
  const ServersTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Servers</h1>
          <p className="text-gray-600">Manage your project servers and course sections</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowServerModal(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus className="w-4 h-4" />
            <span>Create Server</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No servers created yet</h3>
          <p className="text-gray-500 mb-6">Create your first project server to get started</p>
          <button
            onClick={() => setShowServerModal(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Server</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {servers.map((server) => (
            <div key={server._id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-200">
              <div className="p-6">
                {/* Server Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{server.title}</h3>
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                        {server.code}
                      </span>
                      {refreshing && (
                        <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                      )}
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-2">{server.description}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyToClipboard(server.code)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Copy server code"
                    >
                      {copiedCode === server.code ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteServer(server._id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Server Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{server.stats?.teamsCount || 0}</p>
                    <p className="text-xs text-gray-500">Teams</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{server.stats?.studentsCount || 0}</p>
                    <p className="text-xs text-gray-500">Students</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{server.stats?.tasksCount || 0}</p>
                    <p className="text-xs text-gray-500">Tasks</p>
                  </div>
                </div>

                {/* Teams Section */}
                <div className="border-t border-gray-100 pt-4">
                  <button
                    onClick={() => toggleServerExpansion(server._id)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <span className="font-medium text-gray-900">Teams ({server.teams?.length || 0})</span>
                    {expandedServers.has(server._id) ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>

                  {expandedServers.has(server._id) && (
                    <div className="mt-3 space-y-2">
                      {server.teams && server.teams.length > 0 ? (
                        server.teams.map((team) => (
                          <div key={team._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">{team.name}</p>
                              <div className="flex items-center space-x-2 text-sm text-gray-500">
                                <span>{team.members?.length || 0} members</span>
                                {team.creator && (
                                  <span>• Created by {team.creator.firstName} {team.creator.lastName}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400">
                              {dateUtils.getRelativeTime(team.createdAt)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          No teams created yet. Students can join this server using code: <strong>{server.code}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedServer(server)}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="text-sm">Manage</span>
                  </button>

                  <div className="text-xs text-gray-500">
                    Created {dateUtils.getRelativeTime(server.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Enhanced Tasks Tab Component
  const TasksTab = () => {
    if (!selectedServer) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
            <p className="text-gray-600">Create and manage assignments for your students</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Project Server</h3>
            <p className="text-gray-500 mb-6">Choose a server to manage its tasks and assignments</p>
            
            {servers.length === 0 ? (
              <button
                onClick={() => setShowServerModal(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Server First</span>
              </button>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {servers.map((server) => (
                  <button
                    key={server._id}
                    onClick={() => setSelectedServer(server)}
                    className="p-4 border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{server.title}</h4>
                      <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">{server.code}</span>
                    </div>
                    <p className="text-sm text-gray-500">{server.stats?.teamsCount || 0} teams • {server.stats?.tasksCount || 0} tasks</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-gray-600">Server:</span>
              <span className="font-medium text-purple-600">{selectedServer.title}</span>
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">{selectedServer.code}</span>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setSelectedServer(null)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Change Server
            </button>
            <button
              onClick={() => setShowTaskCreator(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          </div>
        </div>

        <FacultyTaskList 
          serverId={selectedServer._id} 
          serverTitle={selectedServer.title}
        />
      </div>
    );
  };

  // Enhanced Calendar Tab Component
  const CalendarTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600">View upcoming deadlines and events</p>
        </div>
        <button 
          onClick={() => setShowTaskCreator(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Task</span>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex space-x-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronDown className="w-4 h-4 rotate-90 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronDown className="w-4 h-4 -rotate-90 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Days */}
        <div className="p-6">
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {generateCalendarDays().map((day, index) => (
              <div
                key={index}
                className={`p-2 h-20 border border-gray-100 rounded-lg ${
                  day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${day.isToday ? 'bg-purple-50 border-purple-200' : ''}`}
              >
                <div className={`text-sm ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'} ${day.isToday ? 'font-bold text-purple-600' : ''}`}>
                  {day.date}
                </div>
                <div className="mt-1 space-y-1">
                  {getEventsForDay(day.fullDate).map((event, eventIndex) => (
                    <div
                      key={eventIndex}
                      className={`text-xs px-2 py-1 rounded truncate ${
                        event.priority === 'high' ? 'bg-red-100 text-red-700' :
                        event.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-purple-100 text-purple-700'
                      }`}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h3>
        </div>
        <div className="p-6">
          {calendarEvents.length > 0 ? (
            <div className="space-y-4">
              {calendarEvents
                .filter(event => new Date(event.dueDate) > new Date())
                .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                .slice(0, 10)
                .map((event) => (
                  <div key={event.id} className="flex items-center space-x-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-3 h-3 rounded-full ${
                      event.priority === 'high' ? 'bg-red-500' :
                      event.priority === 'medium' ? 'bg-yellow-500' :
                      'bg-purple-500'
                    }`}></div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                      <p className="text-sm text-gray-500">
                        Due: {dateUtils.formatDate(event.dueDate, 'datetime')}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {dateUtils.getRelativeTime(event.dueDate)}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No upcoming deadlines</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Analytics Tab Component
  const AnalyticsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Track performance and engagement metrics</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Server Performance */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Server Performance</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {servers.map((server) => (
                <div key={server._id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">{server.title}</h4>
                    <p className="text-sm text-gray-500">{server.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{server.stats?.studentsCount || 0} students</p>
                    <p className="text-xs text-gray-500">{server.stats?.teamsCount || 0} teams</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Task Statistics */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Task Statistics</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Tasks Created</span>
                <span className="text-xl font-bold text-gray-900">{dashboardStats.totalTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Active Servers</span>
                <span className="text-xl font-bold text-gray-900">{dashboardStats.totalServers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Student Enrollment</span>
                <span className="text-xl font-bold text-green-600">{dashboardStats.totalStudents}</span>
              </div>
              {analytics.taskStats && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Active Tasks</span>
                    <span className="text-xl font-bold text-blue-600">{analytics.taskStats.activeTasks || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Completed Tasks</span>
                    <span className="text-xl font-bold text-green-600">{analytics.taskStats.completedTasks || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Graded Tasks</span>
                    <span className="text-xl font-bold text-purple-600">{analytics.taskStats.gradedTasks || 0}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {analytics.recentActivity && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Weekly Activity</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {analytics.recentActivity.newTeamsThisWeek || 0}
                </div>
                <p className="text-gray-600">New Teams This Week</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {analytics.recentActivity.newTasksThisWeek || 0}
                </div>
                <p className="text-gray-600">New Tasks This Week</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Profile Tab Component
  const ProfileTab = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center space-x-6 mb-6">
              <div className={`w-20 h-20 rounded-full ${colorUtils.getAvatarColor(user?.firstName || 'User')} flex items-center justify-center text-white text-2xl font-bold`}>
                {(user?.firstName?.[0] || 'U').toUpperCase()}
              </div>
              <div>
                <h4 className="text-xl font-semibold text-gray-900">
                  {user?.firstName} {user?.lastName}
                </h4>
                <p className="text-gray-600">{user?.email}</p>
                <p className="text-sm text-gray-500">Faculty Member</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  defaultValue={user?.firstName || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  defaultValue={user?.lastName || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  defaultValue={user?.email || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="mt-6">
              <button className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Quick Stats</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Servers Created</span>
                <span className="font-semibold text-gray-900">{dashboardStats.totalServers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Students Supervised</span>
                <span className="font-semibold text-gray-900">{dashboardStats.totalStudents}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Tasks Created</span>
                <span className="font-semibold text-gray-900">{dashboardStats.totalTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Active Teams</span>
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
                <span className="text-gray-600">Email Notifications</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Task Reminders</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Auto-refresh Dashboard</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Connection</span>
                <div className="flex items-center space-x-2">
                  {isOnline ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Update</span>
                <span className="text-sm text-gray-500">
                  {dateUtils.getRelativeTime(lastUpdated)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Auto-refresh</span>
                <span className="text-sm text-gray-500">Every 30s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Helper functions for calendar
  const generateCalendarDays = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startCalendar = new Date(firstDay);
    startCalendar.setDate(startCalendar.getDate() - firstDay.getDay());
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startCalendar);
      currentDate.setDate(startCalendar.getDate() + i);
      
      days.push({
        date: currentDate.getDate(),
        fullDate: new Date(currentDate),
        isCurrentMonth: currentDate.getMonth() === currentMonth,
        isToday: currentDate.toDateString() === today.toDateString()
      });
    }
    
    return days;
  };

  const getEventsForDay = (date) => {
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.dueDate);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  // Search overlay component
  const SearchOverlay = () => {
    if (!searchResults) return null;

    return (
      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1">
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Search Results</h4>
          
          {searchResults.tasks?.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-medium text-gray-700 mb-2">Tasks</h5>
              {searchResults.tasks.slice(0, 3).map(task => (
                <div key={task.id} className="py-2 hover:bg-gray-50 rounded cursor-pointer">
                  <p className="text-sm text-gray-900">{task.title}</p>
                  <p className="text-xs text-gray-500">{task.description}</p>
                </div>
              ))}
            </div>
          )}

          {searchResults.teams?.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-medium text-gray-700 mb-2">Teams</h5>
              {searchResults.teams.slice(0, 3).map(team => (
                <div key={team.id} className="py-2 hover:bg-gray-50 rounded cursor-pointer">
                  <p className="text-sm text-gray-900">{team.name}</p>
                  <p className="text-xs text-gray-500">{team.description}</p>
                </div>
              ))}
            </div>
          )}

          {(!searchResults.tasks?.length && !searchResults.teams?.length) && (
            <p className="text-sm text-gray-500">No results found</p>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Dashboard</h2>
          <p className="text-gray-500">Please wait while we set up your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PF</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">ProjectFlow</h1>
              {!isOnline && (
                <div className="flex items-center space-x-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                  <WifiOff className="w-3 h-3" />
                  <span>Offline</span>
                </div>
              )}
            </div>

            <div className="flex-1 max-w-lg mx-8 relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search tasks, teams, files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={!isOnline}
                />
              </div>
              <SearchOverlay />
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <Bell className="w-5 h-5" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full ${colorUtils.getAvatarColor(user?.firstName || 'User')} flex items-center justify-center text-white text-sm font-medium`}>
                  {(user?.firstName?.[0] || 'U').toUpperCase()}
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-500">Faculty</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-1 py-4 border-b-2 text-sm font-medium transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'servers' && <ServersTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      {/* Create Server Modal */}
      {showServerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Create New Server</h3>
              <button
                onClick={() => setShowServerModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); createServer(); }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Server Title *
                  </label>
                  <input
                    type="text"
                    value={serverForm.title}
                    onChange={(e) => setServerForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., CS 101 - Introduction to Programming"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={serverForm.description}
                    onChange={(e) => setServerForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the course or project..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowServerModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isOnline}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Creator Modal */}
      {showTaskCreator && selectedServer && (
        <TaskCreator
          serverId={selectedServer._id}
          serverTitle={selectedServer.title}
          onTaskCreated={handleTaskCreated}
          onClose={() => setShowTaskCreator(false)}
        />
      )}
    </div>
  );
};

export default EnhancedFacultyDashboard;