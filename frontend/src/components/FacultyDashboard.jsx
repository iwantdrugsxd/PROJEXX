import React, { useState, useEffect, useContext } from 'react';
import { AuthContext, API_BASE } from '../App';
import { 
  BookOpen, Target, Users, BarChart3, FileText, Calendar, MessageSquare, Settings,
  Search, Bell, LogOut, Plus, Copy, Eye, Edit, Trash2, UserPlus, CheckCircle,
  Clock, TrendingUp, Award, Filter, Download, Share2, Code, Server
} from 'lucide-react';

function FacultyDashboard() {
  const { user, setUser, setCurrentView } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [projects, setProjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Mock data for demonstration
      setProjects([
        { _id: 1, title: "Web Development Course", description: "Learn modern web development", code: "WEB001", createdAt: new Date() },
        { _id: 2, title: "Mobile App Development", description: "Build mobile applications", code: "MOB001", createdAt: new Date() }
      ]);

      setStudents([
        { id: 1, name: "Alice Johnson", email: "alice@student.edu", teams: 2, projects: 3, performance: 92, status: "Active", lastSeen: "2 hours ago" },
        { id: 2, name: "Bob Smith", email: "bob@student.edu", teams: 1, projects: 2, performance: 88, status: "Active", lastSeen: "1 day ago" },
        { id: 3, name: "Carol Davis", email: "carol@student.edu", teams: 3, projects: 4, performance: 95, status: "Active", lastSeen: "30 minutes ago" },
        { id: 4, name: "David Wilson", email: "david@student.edu", teams: 2, projects: 3, performance: 78, status: "Inactive", lastSeen: "3 days ago" },
        { id: 5, name: "Emma Brown", email: "emma@student.edu", teams: 1, projects: 2, performance: 91, status: "Active", lastSeen: "5 hours ago" }
      ]);

      setAnalytics({
        totalProjects: 2,
        activeProjects: 2,
        totalStudents: 76,
        completionRate: 78,
        avgPerformance: 91.7,
        totalTeams: 19,
        thisMonthSubmissions: 145,
        pendingReviews: 23
      });

      setNotifications([
        {
          id: 1,
          type: "submission",
          title: "New project submission",
          message: "Team Alpha submitted their web development project",
          time: "2 hours ago",
          unread: true
        },
        {
          id: 2,
          type: "student",
          title: "Student joined project",
          message: "New student joined AI & Machine Learning project",
          time: "4 hours ago",
          unread: true
        },
        {
          id: 3,
          type: "deadline",
          title: "Project deadline approaching",
          message: "Mobile App Development project due in 3 days",
          time: "1 day ago",
          unread: false
        }
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Call the actual logout API endpoint
      await fetch(`${API_BASE}/faculty/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      
      // Clear user state and redirect to landing page
      setUser(null);
      setCurrentView('landing');
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if API call fails, clear the local state
      setUser(null);
      setCurrentView('landing');
    }
  };

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'servers', label: 'Project Servers', icon: Server },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'tasks', label: 'Tasks', icon: FileText },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">ProjectFlow</h1>
                <p className="text-sm text-gray-600">Faculty Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search projects, students..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 w-64"
                />
              </div>
              
              {/* Notifications */}
              <div className="relative">
                <button className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors duration-200 relative">
                  <Bell className="w-5 h-5" />
                  {notifications.filter(n => n.unread).length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {notifications.filter(n => n.unread).length}
                    </span>
                  )}
                </button>
              </div>
              
              {/* Profile */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-800">{user?.firstName || user?.name || 'Faculty'} {user?.lastName || ''}</p>
                  <p className="text-xs text-gray-600">Faculty</p>
                </div>
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-medium">
                  {user?.firstName?.charAt(0) || user?.name?.charAt(0) || 'F'}{user?.lastName?.charAt(0) || ''}
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors duration-200"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
          <nav className="p-4">
            <div className="space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      activeTab === item.id
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg transform scale-105'
                        : 'text-gray-600 hover:bg-purple-50 hover:text-purple-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {activeTab === 'overview' && <OverviewTab analytics={analytics} notifications={notifications} />}
          {activeTab === 'servers' && <ServersTab projects={projects} setProjects={setProjects} />}
          {activeTab === 'teams' && <TeamsTab />}
          {activeTab === 'tasks' && <TasksTab />}
          {activeTab === 'students' && <StudentsTab students={students} />}
          {activeTab === 'analytics' && <AnalyticsTab analytics={analytics} projects={projects} />}
          {activeTab === 'calendar' && <CalendarTab />}
          {activeTab === 'messages' && <MessagesTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}

// Project Servers Tab Component
function ServersTab({ projects, setProjects }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newServer, setNewServer] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  const createServer = async (e) => {
    e.preventDefault();
    if (!newServer.title.trim()) return;

    setLoading(true);
    
    try {
      // Mock server creation
      const mockServer = {
        _id: Date.now(),
        title: newServer.title,
        description: newServer.description,
        code: `${newServer.title.substring(0, 3).toUpperCase()}${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date()
      };
      
      setProjects(prev => [mockServer, ...prev]);
      setNewServer({ title: '', description: '' });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create server:', error);
      alert('Failed to create server');
    } finally {
      setLoading(false);
    }
  };

  const copyServerCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const generateWhatsAppMessage = (server) => {
    const message = `🚀 Join our Project Server: "${server.title}"

Use this code to join: ${server.code}

${server.description ? `Description: ${server.description}` : ''}

Copy the code and join through the ProjectFlow app!`;
    
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/?text=${encodedMessage}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Project Servers</h2>
          <p className="text-gray-600">Create and manage project servers for your courses</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          <span>Create Server</span>
        </button>
      </div>

      {/* Create Server Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Create Project Server</h3>
            <form onSubmit={createServer} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Server Title *</label>
                <input
                  type="text"
                  value={newServer.title}
                  onChange={(e) => setNewServer(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  placeholder="e.g., Web Development Course"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Description</label>
                <textarea
                  value={newServer.description}
                  onChange={(e) => setNewServer(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400 h-24 resize-none"
                  placeholder="Brief description of the project server..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading || !newServer.title.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Servers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((server) => (
          <div key={server._id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{server.title}</h3>
                <p className="text-gray-600 text-sm mb-3">{server.description || 'No description provided'}</p>
                
                {/* Server Code */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">JOIN CODE</p>
                      <p className="text-lg font-bold text-gray-800">{server.code}</p>
                    </div>
                    <button
                      onClick={() => copyServerCode(server.code)}
                      className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                      title="Copy code"
                    >
                      {copiedCode === server.code ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => copyServerCode(server.code)}
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  >
                    <Code className="w-4 h-4" />
                    <span className="text-sm">Copy Code</span>
                  </button>
                  <a
                    href={generateWhatsAppMessage(server)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="text-sm">WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Server Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">0</p>
                <p className="text-xs text-gray-500">Teams</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">0</p>
                <p className="text-xs text-gray-500">Students</p>
              </div>
            </div>

            {/* Created Date */}
            <div className="pt-3 border-t border-gray-100 mt-4">
              <p className="text-xs text-gray-500">
                Created {new Date(server.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No project servers yet</h3>
          <p className="text-gray-500 mb-6">Create your first project server to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300"
          >
            Create Server
          </button>
        </div>
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ analytics, notifications }) {
  const stats = [
    {
      label: "Total Project Servers",
      value: analytics.totalProjects || 0,
      icon: Server,
      color: "purple",
      change: "+2 this month"
    },
    {
      label: "Active Students",
      value: analytics.totalStudents || 0,
      icon: Users,
      color: "blue",
      change: "+12 this week"
    },
    {
      label: "Completion Rate",
      value: `${analytics.completionRate || 0}%`,
      icon: TrendingUp,
      color: "green",
      change: "+5% this month"
    },
    {
      label: "Pending Reviews",
      value: analytics.pendingReviews || 0,
      icon: Clock,
      color: "orange",
      change: "3 new today"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Welcome back, Professor!</h2>
            <p className="text-purple-100">Here's what's happening with your projects today</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{new Date().toLocaleDateString()}</p>
            <p className="text-purple-100">Today</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  stat.color === 'purple' ? 'bg-purple-100' :
                  stat.color === 'blue' ? 'bg-blue-100' :
                  stat.color === 'green' ? 'bg-green-100' :
                  'bg-orange-100'
                }`}>
                  <Icon className={`w-6 h-6 ${
                    stat.color === 'purple' ? 'text-purple-600' :
                    stat.color === 'blue' ? 'text-blue-600' :
                    stat.color === 'green' ? 'text-green-600' :
                    'text-orange-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-xs text-green-600 mt-1">{stat.change}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Plus className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-800">Create Project Server</p>
              <p className="text-sm text-gray-600">Start a new project</p>
            </div>
          </button>
          <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-800">Manage Teams</p>
              <p className="text-sm text-gray-600">View all teams</p>
            </div>
          </button>
          <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-800">Review Submissions</p>
              <p className="text-sm text-gray-600">Check pending work</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Notifications */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Recent Activity</h3>
          <button className="text-sm text-purple-600 hover:text-purple-700">View all</button>
        </div>
        <div className="space-y-4">
          {notifications.slice(0, 5).map((notification) => (
            <div key={notification.id} className="flex items-start space-x-4 p-3 rounded-xl hover:bg-gray-50 transition-colors duration-200">
              <div className={`w-2 h-2 rounded-full mt-2 ${notification.unread ? 'bg-purple-500' : 'bg-gray-300'}`}></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{notification.title}</p>
                <p className="text-xs text-gray-600">{notification.message}</p>
                <p className="text-xs text-gray-400 mt-1">{notification.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Teams Tab Component
function TeamsTab() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data - replace with actual API call
    setTimeout(() => {
      setTeams([
        { id: 1, name: "Team Alpha", members: 4, project: "Web Development", status: "Active", progress: 75 },
        { id: 2, name: "Team Beta", members: 3, project: "Mobile App", status: "Active", progress: 60 },
        { id: 3, name: "Team Gamma", members: 5, project: "Data Science", status: "Completed", progress: 100 },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Teams</h2>
          <p className="text-gray-600">Manage and monitor team progress</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <div key={team.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">{team.name}</h3>
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                team.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {team.status}
              </span>
            </div>
            <p className="text-gray-600 mb-3">{team.project}</p>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">{team.members} members</span>
              <span className="text-sm font-medium text-gray-800">{team.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${team.progress}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tasks Tab Component
function TasksTab() {
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignmentType: 'specific',
    teamId: '',
    projectServerCode: '',
    priority: 'medium',
    dueDate: ''
  });
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    loadTasksAndTeams();
  }, []);

  const loadTasksAndTeams = async () => {
    try {
      setLoading(true);
      
      // Mock data - replace with actual API calls
      setTeams([
        { _id: 1, name: "Team Alpha", projectServer: "WEB001", members: [1, 2, 3] },
        { _id: 2, name: "Team Beta", projectServer: "MOB001", members: [4, 5] },
      ]);
      
      setServers([
        { _id: 1, title: "Web Development Course", code: "WEB001" },
        { _id: 2, title: "Mobile App Development", code: "MOB001" },
      ]);
      
      setTasks([
        { id: 1, title: "Design Homepage", team: "Team Alpha", status: "In Progress", priority: "High", dueDate: "2024-02-15" },
        { id: 2, title: "Database Schema", team: "Team Beta", status: "Pending", priority: "Medium", dueDate: "2024-02-20" },
        { id: 3, title: "User Authentication", team: "Team Alpha", status: "Completed", priority: "High", dueDate: "2024-02-10" },
      ]);
    } catch (error) {
      console.error('Failed to load tasks and teams:', error);
      setTeams([]);
      setServers([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    
    if (newTask.assignmentType === 'specific' && !newTask.teamId) {
      alert('Please select a team');
      return;
    }
    
    if (newTask.assignmentType === 'all' && !newTask.projectServerCode) {
      alert('Please select a project server');
      return;
    }

    setCreateLoading(true);
    
    try {
      const mockTask = {
        id: Date.now(),
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        team: newTask.assignmentType === 'specific' ? 
          teams.find(t => t._id.toString() === newTask.teamId)?.name : 
          'All Teams',
        status: 'Pending',
        priority: newTask.priority,
        dueDate: newTask.dueDate || null
      };
      
      setTasks(prev => [mockTask, ...prev]);
      setNewTask({
        title: '',
        description: '',
        assignmentType: 'specific',
        teamId: '',
        projectServerCode: '',
        priority: 'medium',
        dueDate: ''
      });
      setShowCreateModal(false);
      alert('Task created successfully!');
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task');
    } finally {
      setCreateLoading(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Tasks</h2>
          <p className="text-gray-600">Create and manage tasks for teams</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300"
        >
          <Plus className="w-5 h-5" />
          <span>Create Task</span>
        </button>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Create New Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Task Title *</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  placeholder="e.g., Design homepage layout"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400 h-24 resize-none"
                  placeholder="Describe the task requirements..."
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Assignment Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center space-x-2 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="assignmentType"
                      value="specific"
                      checked={newTask.assignmentType === 'specific'}
                      onChange={(e) => setNewTask(prev => ({ ...prev, assignmentType: e.target.value, teamId: '', projectServerCode: '' }))}
                      className="text-purple-600"
                    />
                    <span className="text-sm font-medium text-gray-700">Specific Team</span>
                  </label>
                  <label className="flex items-center space-x-2 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="assignmentType"
                      value="all"
                      checked={newTask.assignmentType === 'all'}
                      onChange={(e) => setNewTask(prev => ({ ...prev, assignmentType: e.target.value, teamId: '', projectServerCode: '' }))}
                      className="text-purple-600"
                    />
                    <span className="text-sm font-medium text-gray-700">All Teams</span>
                  </label>
                </div>
              </div>

              {newTask.assignmentType === 'specific' && (
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Select Team *</label>
                  <select
                    value={newTask.teamId}
                    onChange={(e) => setNewTask(prev => ({ ...prev, teamId: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                    required
                  >
                    <option value="">Choose a team</option>
                    {teams.length === 0 ? (
                      <option value="" disabled>No teams available</option>
                    ) : (
                      teams.map((team) => (
                        <option key={team._id} value={team._id}>
                          {team.name} ({team.projectServer}) - {team.members?.length || 0} members
                        </option>
                      ))
                    )}
                  </select>
                  {teams.length === 0 && (
                    <p className="text-sm text-orange-600 mt-1">
                      No teams found. Students need to join your project servers and create teams first.
                    </p>
                  )}
                </div>
              )}

              {newTask.assignmentType === 'all' && (
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Select Project Server *</label>
                  <select
                    value={newTask.projectServerCode}
                    onChange={(e) => setNewTask(prev => ({ ...prev, projectServerCode: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                    required
                  >
                    <option value="">Choose a project server</option>
                    {servers.length === 0 ? (
                      <option value="" disabled>No project servers available</option>
                    ) : (
                      servers.map((server) => (
                        <option key={server._id} value={server.code}>
                          {server.title} ({server.code})
                        </option>
                      ))
                    )}
                  </select>
                  <p className="text-sm text-blue-600 mt-1">
                    This will create the task for all teams in the selected project server.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-gray-700 font-medium mb-2">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Due Date</label>
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={createLoading || !newTask.title.trim() || 
                    (newTask.assignmentType === 'specific' && !newTask.teamId) || 
                    (newTask.assignmentType === 'all' && !newTask.projectServerCode)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createLoading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tasks Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Task</th>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Team</th>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Status</th>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Priority</th>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Due Date</th>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id || task._id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-6">
                    <div>
                      <p className="font-medium text-gray-800">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-gray-600">{task.team?.name || task.team}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      task.status === 'Completed' || task.status === 'approved' ? 'bg-green-100 text-green-800' :
                      task.status === 'In Progress' || task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                      task.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      task.priority === 'High' || task.priority === 'high' ? 'bg-red-100 text-red-800' :
                      task.priority === 'Medium' || task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-gray-600">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors duration-200" title="View details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-green-600 transition-colors duration-200" title="Edit task">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200" title="Delete task">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No tasks yet</h3>
          <p className="text-gray-500 mb-6">Create your first task to get teams started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300"
          >
            Create Task
          </button>
        </div>
      )}
    </div>
  );
}

// Students Tab Component
function StudentsTab({ students }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Students</h2>
          <p className="text-gray-600">Monitor student progress and performance</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Student</th>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Teams</th>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Projects</th>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Performance</th>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Status</th>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Last Seen</th>
                <th className="text-left py-4 px-6 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {student.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{student.name}</p>
                        <p className="text-sm text-gray-600">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-gray-600">{student.teams}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-gray-600">{student.projects}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            student.performance >= 90 ? 'bg-green-500' :
                            student.performance >= 80 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${student.performance}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{student.performance}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      student.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-600">{student.lastSeen}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors duration-200">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-purple-600 transition-colors duration-200">
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-green-600 transition-colors duration-200">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Analytics Tab Component
function AnalyticsTab({ analytics }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
        <p className="text-gray-600">Detailed insights into project performance and student engagement</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{analytics.totalProjects}</p>
              <p className="text-sm text-gray-600">Total Projects</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{analytics.totalStudents}</p>
              <p className="text-sm text-gray-600">Active Students</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{analytics.completionRate}%</p>
              <p className="text-sm text-gray-600">Completion Rate</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{analytics.pendingReviews}</p>
              <p className="text-sm text-gray-600">Pending Reviews</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Other placeholder components
function CalendarTab() {
  return (
    <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
      <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-600 mb-2">Calendar Integration</h3>
      <p className="text-gray-500">Coming soon - Full calendar integration</p>
    </div>
  );
}

function MessagesTab() {
  return (
    <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
      <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-600 mb-2">No messages yet</h3>
      <p className="text-gray-500">Start communicating with your students</p>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Profile Settings</h3>
        <div className="space-y-4">
          <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200">
            <span className="font-medium text-gray-700">Edit Profile</span>
            <Edit className="w-5 h-5 text-gray-400" />
          </button>
          <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200">
            <span className="font-medium text-gray-700">Change Password</span>
            <Settings className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default FacultyDashboard;