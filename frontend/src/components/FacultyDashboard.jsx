import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Server, 
  Users, 
  FileText, 
  Settings, 
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
  MessageSquare,
  Download,
  Filter,
  TrendingUp,
  Award,
  Clock,
  X
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
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;
    return `${years}y ago`;
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
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  },
  getRandomGradient: () => {
    const gradients = [
      'from-purple-400 to-pink-400',
      'from-blue-400 to-purple-400',
      'from-green-400 to-blue-400',
      'from-yellow-400 to-orange-400',
      'from-red-400 to-pink-400',
      'from-indigo-400 to-purple-400'
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  }
};

const performanceUtils = {
  debounce: (func, wait) => {
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
};

const exportUtils = {
  exportToCSV: (data, filename = 'export.csv') => {
    const csvContent = convertToCSV(data);
    downloadFile(csvContent, filename, 'text/csv');
  },
  exportToJSON: (data, filename = 'export.json') => {
    const jsonContent = JSON.stringify(data, null, 2);
    downloadFile(jsonContent, filename, 'application/json');
  }
};

const convertToCSV = (data) => {
  if (!Array.isArray(data) || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(',')
    )
  ];
  return csvRows.join('\n');
};

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const FacultyDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showServerModal, setShowServerModal] = useState(false);
  const [showTaskCreator, setShowTaskCreator] = useState(false);
  const [serverForm, setServerForm] = useState({ title: '', description: '' });
  const [analytics, setAnalytics] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  const debouncedSearch = useCallback(
    performanceUtils.debounce(async (query) => {
      if (query.trim()) {
        try {
          const response = await fetch(`${API_BASE}/search?query=${encodeURIComponent(query)}&type=faculty`, {
            credentials: 'include'
          });
          const data = await response.json();
          if (data.success) {
            setSearchResults(data.results);
          }
        } catch (error) {
          console.error('Search error:', error);
        }
      } else {
        setSearchResults(null);
      }
    }, 300),
    []
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const serversResponse = await fetch(`${API_BASE}/projectServers/faculty-servers`, {
        credentials: 'include'
      });
      
      const serversData = await serversResponse.json();
      if (serversData.success) {
        setServers(serversData.servers || []);
        if (serversData.servers && serversData.servers.length > 0 && !selectedServer) {
          setSelectedServer(serversData.servers[0]);
        }
      }

      try {
        const analyticsResponse = await fetch(`${API_BASE}/analytics/faculty`, {
          credentials: 'include'
        });
        const analyticsData = await analyticsResponse.json();
        if (analyticsData.success) {
          setAnalytics(analyticsData.analytics);
        }
      } catch (error) {
        console.log('Analytics not available:', error);
      }

      try {
        const notificationsResponse = await fetch(`${API_BASE}/notifications`, {
          credentials: 'include'
        });
        const notificationsData = await notificationsResponse.json();
        if (notificationsData.success) {
          setNotifications(notificationsData.notifications || []);
        }
      } catch (error) {
        console.log('Notifications not available:', error);
      }

      try {
        const eventsResponse = await fetch(`${API_BASE}/calendar/events?startDate=${new Date().toISOString()}&endDate=${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}`, {
          credentials: 'include'
        });
        const eventsData = await eventsResponse.json();
        if (eventsData.success) {
          setUpcomingEvents(eventsData.events || []);
        }
      } catch (error) {
        console.log('Calendar events not available:', error);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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
      } else {
        alert(data.message || 'Failed to create server');
      }
    } catch (error) {
      console.error('Error creating server:', error);
      alert('Network error. Please try again.');
    }
  };

  const deleteServer = async (serverId) => {
    if (!window.confirm('Are you sure you want to delete this server?')) {
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
      } else {
        alert(data.message || 'Failed to delete server');
      }
    } catch (error) {
      console.error('Error deleting server:', error);
      alert('Network error. Please try again.');
    }
  };

  const handleTaskCreated = () => {
    setShowTaskCreator(false);
    fetchDashboardData();
  };

  const exportData = async (type) => {
    try {
      let data = [];
      let filename = '';

      switch (type) {
        case 'servers':
          data = servers.map(s => ({
            title: s.title,
            description: s.description,
            teamsCount: s.teams?.length || 0,
            createdAt: dateUtils.formatDate(s.createdAt)
          }));
          filename = 'project_servers.csv';
          break;
        case 'analytics':
          data = analytics ? [analytics] : [];
          filename = 'analytics_data.json';
          break;
        default:
          return;
      }

      if (type === 'analytics') {
        exportUtils.exportToJSON(data, filename);
      } else {
        exportUtils.exportToCSV(data, filename);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'servers', label: 'Project Servers', icon: Server },
    { id: 'tasks', label: 'Task Management', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  const OverviewTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              Welcome back, {user?.firstName || 'Professor'}!
            </h1>
            <p className="text-purple-100">
              Manage your courses, create assignments, and track student progress.
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-purple-200">{dateUtils.formatDate(new Date(), 'long')}</div>
            <div className="text-xs text-purple-300">{dateUtils.formatDate(new Date(), 'time')}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Servers</p>
              <p className="text-2xl font-bold text-gray-900">{servers.length}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Server className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-900">{analytics?.studentsSupervised || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tasks Created</p>
              <p className="text-2xl font-bold text-gray-900">{analytics?.tasksCreated || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Class Grade</p>
              <p className="text-2xl font-bold text-gray-900">{analytics?.averageClassGrade || 0}%</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6">
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <FileText className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">{dateUtils.getRelativeTime(activity.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Events</h3>
          </div>
          <div className="p-6">
            {upcomingEvents.length > 0 ? (
              <div className="space-y-4">
                {upcomingEvents.slice(0, 5).map((event, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{event.title}</p>
                      <p className="text-xs text-gray-500">{dateUtils.formatDate(event.startDate, 'datetime')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No upcoming events</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setShowServerModal(true)}
              className="flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors duration-200"
            >
              <Plus className="w-5 h-5 text-gray-500" />
              <span className="text-gray-700">Create New Server</span>
            </button>

            <button
              onClick={() => setShowTaskCreator(true)}
              className="flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors duration-200"
            >
              <FileText className="w-5 h-5 text-gray-500" />
              <span className="text-gray-700">Create Assignment</span>
            </button>

            <button
              onClick={() => exportData('servers')}
              className="flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors duration-200"
            >
              <Download className="w-5 h-5 text-gray-500" />
              <span className="text-gray-700">Export Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const ServersTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Servers</h1>
          <p className="text-gray-600">Manage your project servers and course sections</p>
        </div>
        <button
          onClick={() => setShowServerModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
        >
          <Plus className="w-4 h-4" />
          <span>Create Server</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No servers created yet</h3>
          <p className="text-gray-500 mb-6">Create your first project server to get started</p>
          <button
            onClick={() => setShowServerModal(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Server</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => (
            <div key={server._id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{server.title}</h3>
                    <p className="text-gray-600 text-sm line-clamp-2">{server.description}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${colorUtils.getRandomGradient()}`}></div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{server.teams?.length || 0} teams</span>
                  <span>{dateUtils.getRelativeTime(server.createdAt)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedServer(server)}
                      className="flex items-center justify-center space-x-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition-colors duration-200"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="text-sm">View</span>
                    </button>
                    
                    <button className="flex items-center justify-center space-x-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors duration-200">
                      <Share2 className="w-4 h-4" />
                      <span className="text-sm">Share</span>
                    </button>
                  </div>
                  
                  <button
                    onClick={() => deleteServer(server._id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const TasksTab = () => {
    if (!selectedServer) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
            <p className="text-gray-600">Create and manage assignments for your students</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Project Server</h3>
            <p className="text-gray-500 mb-6">Choose a server to manage its tasks and assignments</p>
            
            {servers.length === 0 ? (
              <button
                onClick={() => setShowServerModal(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
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
                    className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors duration-200 text-left"
                  >
                    <h4 className="font-medium text-gray-900">{server.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">{server.teams?.length || 0} teams</p>
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
            <p className="text-gray-600">Server: {selectedServer.title}</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setSelectedServer(null)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Change Server
            </button>
            <button
              onClick={() => setShowTaskCreator(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
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

  const AnalyticsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Track performance and engagement metrics</p>
        </div>
        <button
          onClick={() => exportData('analytics')}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
        >
          <Download className="w-4 h-4" />
          <span>Export Data</span>
        </button>
      </div>

      {analytics ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Productivity Metrics</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Tasks Created</span>
                  <span className="text-xl font-bold text-gray-900">{analytics.tasksCreated || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Average Grade</span>
                  <span className="text-xl font-bold text-gray-900">{analytics.averageClassGrade || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Improvement Trend</span>
                  <span className="text-xl font-bold text-green-600">+{analytics.improvementTrend || 0}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Collaboration Metrics</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Students Supervised</span>
                  <span className="text-xl font-bold text-gray-900">{analytics.studentsSupervised || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Team Participation</span>
                  <span className="text-xl font-bold text-gray-900">{analytics.teamParticipation || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Messages Exchanged</span>
                  <span className="text-xl font-bold text-gray-900">{analytics.messagesExchanged || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border lg:col-span-2">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Weekly Progress</h3>
            </div>
            <div className="p-6">
              <div className="flex items-end space-x-2 h-40">
                {analytics.weeklyProgress?.map((value, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-purple-500 rounded-t"
                      style={{ height: `${(value / 100) * 120}px` }}
                    ></div>
                    <div className="text-xs text-gray-500 mt-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Analytics Loading</h3>
          <p className="text-gray-500">Analytics data will appear here once available</p>
        </div>
      )}
    </div>
  );

  const CalendarTab = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-600">Manage your schedule and upcoming events</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">Calendar View</h3>
        <p className="text-gray-500">Calendar functionality will be implemented here</p>
      </div>
    </div>
  );

  const ProfileTab = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
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
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  rows={3}
                  placeholder="Tell us about yourself..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                ></textarea>
              </div>
            </div>
            
            <div className="mt-6">
              <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200">
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Quick Stats</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Servers Created</span>
                <span className="font-semibold text-gray-900">{servers.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Students Supervised</span>
                <span className="font-semibold text-gray-900">{analytics?.studentsSupervised || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Tasks Created</span>
                <span className="font-semibold text-gray-900">{analytics?.tasksCreated || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Member Since</span>
                <span className="font-semibold text-gray-900">{dateUtils.formatDate(user?.createdAt || new Date(), 'short')}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Preferences</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Email Notifications</span>
                <input type="checkbox" defaultChecked className="toggle" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Task Reminders</span>
                <input type="checkbox" defaultChecked className="toggle" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Grade Notifications</span>
                <input type="checkbox" defaultChecked className="toggle" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PF</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">ProjectFlow</h1>
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
                />
              </div>
              <SearchOverlay />
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                  <Bell className="w-5 h-5" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
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
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'servers' && <ServersTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      {showServerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Create New Server</h3>
              <button
                onClick={() => setShowServerModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
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
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
                >
                  Create Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

export default FacultyDashboard;