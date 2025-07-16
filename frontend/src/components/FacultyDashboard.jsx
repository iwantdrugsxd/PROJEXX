import React, { useState, useEffect, useContext } from 'react';
import { AuthContext, API_BASE } from '../App';
import { 
  Award, 
  Server, 
  Users, 
  BookOpen, 
  BarChart3,
  Calendar, 
  MessageSquare, 
  Settings, 
  Plus, 
  Bell, 
  Search,
  LogOut,
  User,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  UserPlus,
  Trash2,
  Edit,
  Eye,
  Share2,
  X,
  Check
} from 'lucide-react';

// Import the actual functional components
import TaskList from './TaskManagement/TaskList';
import CalendarView from './Calendar/CalendarView';
import MessagingSystem from './Messaging/MessagingSystem';
import SettingsPage from './Settings/SettingsPage';
import QuickTaskCreator from './QuickTaskCreator';
import NotificationCenter from './Notifications/NotificationCenter';
function FacultyDashboard() {
  // Use logout from context instead of local implementation
  const { user, setUser, setCurrentView, handleLogout } = useContext(AuthContext);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load faculty servers
      const serversResponse = await fetch(`${API_BASE}/projectServers/faculty-servers`, {
        credentials: 'include'
      });
      
      if (serversResponse.ok) {
        const serversData = await serversResponse.json();
        setProjects(serversData.servers || []);
      } else {
        console.error('Failed to load servers:', serversResponse.status);
        setProjects([]);
      }

      // Mock data for other sections (replace with real API calls later)
      setAnalytics({
        totalProjects: 5,
        totalStudents: 48,
        activeTasks: 23,
        completionRate: 78
      });

      setStudents([
        { id: 1, name: "John Doe", email: "john@email.com", projects: 2, status: "active" },
        { id: 2, name: "Jane Smith", email: "jane@email.com", projects: 1, status: "active" },
        { id: 3, name: "Mike Johnson", email: "mike@email.com", projects: 3, status: "inactive" }
      ]);

      setNotifications([
        {
          id: 1,
          type: "task",
          title: "New submission received",
          message: "Team Alpha submitted Database Design task",
          time: "1 hour ago",
          unread: true
        },
        {
          id: 2,
          type: "student",
          title: "Student joined server",
          message: "Sarah Wilson joined Web Development Project",
          time: "3 hours ago",
          unread: true
        },
        {
          id: 3,
          type: "deadline",
          title: "Task deadline approaching",
          message: "UI Mockups task due in 2 days",
          time: "5 hours ago",
          unread: false
        }
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: Award },
    { id: 'servers', label: 'Project Servers', icon: Server },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'tasks', label: 'Tasks', icon: BookOpen },
    { id: 'students', label: 'Students', icon: UserPlus },
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
               <NotificationCenter user={{ id: user._id, role: 'faculty' }} />
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  Welcome, {user?.firstName || 'Faculty'}!
                </h1>
                <p className="text-gray-600">Manage your projects and students</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                />
              </div>
              
              <button className="relative p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors duration-200">
                <Bell className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifications.filter(n => n.unread).length}
                </span>
              </button>
              
              {/* Use context logout function */}
              <button 
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-600 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors duration-200"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
          <nav className="p-4">
            <ul className="space-y-2">
              {sidebarItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                      activeTab === item.id
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg'
                        : 'text-gray-600 hover:bg-purple-50 hover:text-purple-600'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {activeTab === 'overview' && <OverviewTab analytics={analytics} notifications={notifications} />}
          {activeTab === 'servers' && <ServersTab projects={projects} setProjects={setProjects} />}
          {activeTab === 'teams' && <TeamsTab />}
          {activeTab === 'tasks' && <TasksTab projects={projects} />}
          {activeTab === 'students' && <StudentsTab students={students} />}
          {activeTab === 'analytics' && <AnalyticsTab analytics={analytics} projects={projects} />}
          {activeTab === 'calendar' && (
            <CalendarView 
              userRole="faculty" 
              userId={user?.id} 
            />
          )}
          {activeTab === 'messages' && (
            <MessagingSystem 
              userRole="faculty" 
              userId={user?.id} 
              user={user} 
            />
          )}
          {activeTab === 'settings' && (
            <SettingsPage 
              user={user} 
              userRole="faculty" 
              onUserUpdate={setUser} 
            />
          )}
        </main>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ notifications, analytics }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Faculty Dashboard</h2>
        <p className="text-gray-600">Monitor your projects and student progress</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stats Cards */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Total Projects</p>
              <p className="text-3xl font-bold">{analytics.totalProjects}</p>
            </div>
            <Server className="w-8 h-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Total Students</p>
              <p className="text-3xl font-bold">{analytics.totalStudents}</p>
            </div>
            <Users className="w-8 h-8 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Active Tasks</p>
              <p className="text-3xl font-bold">{analytics.activeTasks}</p>
            </div>
            <BookOpen className="w-8 h-8 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Completion Rate</p>
              <p className="text-3xl font-bold">{analytics.completionRate}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-200" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-xl">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">New student joined Web Dev Project</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-xl">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Team Alpha submitted assignment</p>
                <p className="text-xs text-gray-500">4 hours ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-xl">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Created new project server</p>
                <p className="text-xs text-gray-500">1 day ago</p>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Notifications</h3>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-xl transition-colors duration-200">
                <div className={`w-2 h-2 rounded-full mt-2 ${notification.unread ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{notification.title}</h4>
                  <p className="text-sm text-gray-600">{notification.message}</p>
                  <span className="text-xs text-gray-500">{notification.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center space-x-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors duration-200">
            <Plus className="w-5 h-5 text-purple-600" />
            <span className="text-purple-600 font-medium">Create New Project</span>
          </button>
          <button className="flex items-center space-x-3 p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors duration-200">
            <BookOpen className="w-5 h-5 text-green-600" />
            <span className="text-green-600 font-medium">Assign Task</span>
          </button>
          <button className="flex items-center space-x-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors duration-200">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span className="text-blue-600 font-medium">View Analytics</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Project Servers Tab Component - Enhanced with better server creation
function ServersTab({ projects, setProjects }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newServer, setNewServer] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  // Enhanced server creation with better UX
  const createServer = async (e) => {
    e.preventDefault();
    
    if (!newServer.title.trim()) {
      alert('Project title is required');
      return;
    }
    
    if (newServer.title.trim().length < 3) {
      alert('Project title must be at least 3 characters');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/projectServers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: newServer.title.trim(),
          description: newServer.description.trim()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setProjects(prev => [data.server, ...prev]);
        setNewServer({ title: '', description: '' });
        setShowCreateModal(false);
        
        // Show server code immediately and auto-copy
        alert(`Project server created successfully!\n\nServer Code: ${data.server.code}\n\nThis code has been copied to your clipboard. Share it with your students.`);
        
        // Auto-copy code to clipboard
        if (navigator.clipboard) {
          navigator.clipboard.writeText(data.server.code);
        }
      } else {
        alert(data.message || 'Failed to create server');
      }
    } catch (error) {
      console.error('Failed to create server:', error);
      alert('Failed to create server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyServerCode = (code) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2000);
    }
  };

  const generateWhatsAppMessage = (server) => {
    const message = `🚀 Join our Project Server: "${server.title}"

Use this code to join: ${server.code}

${server.description ? `Description: ${server.description}` : ''}

Instructions:
1. Login to your student account
2. Go to Project Servers
3. Click "Join Server"
4. Enter the code above

Happy coding! 💻`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const deleteServer = async (serverId) => {
    if (!window.confirm('Are you sure you want to delete this project server? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/projectServers/${serverId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        setProjects(prev => prev.filter(p => p._id !== serverId));
        alert('Project server deleted successfully');
      } else {
        alert(data.message || 'Failed to delete server');
      }
    } catch (error) {
      console.error('Failed to delete server:', error);
      alert('Failed to delete server');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Project Servers</h2>
          <p className="text-gray-600">Manage your project servers and track student participation</p>
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Create Project Server</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={createServer} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Project Title</label>
                <input
                  type="text"
                  value={newServer.title}
                  onChange={(e) => setNewServer(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  placeholder="e.g., Web Development Project"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Description (Optional)</label>
                <textarea
                  value={newServer.description}
                  onChange={(e) => setNewServer(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  placeholder="Brief description of the project..."
                  rows={3}
                  disabled={loading}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors duration-200"
                  disabled={loading}
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
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project._id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => copyServerCode(project.code)}
                    className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors duration-200 ${
                      copiedCode === project.code 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {copiedCode === project.code ? 'Copied!' : project.code}
                  </button>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-gray-800 mb-2">{project.title}</h3>
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {project.description || 'No description provided'}
              </p>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>Students: {project.studentCount || 0}</span>
                <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => copyServerCode(project.code)}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <Copy className="w-4 h-4" />
                  <span className="text-sm">Copy Code</span>
                </button>
                
                <button
                  onClick={() => generateWhatsAppMessage(project)}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors duration-200"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="text-sm">Share</span>
                </button>
                
                <button
                  onClick={() => deleteServer(project._id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
          <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Project Servers Yet</h3>
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

// Teams Tab Component
function TeamsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Teams</h2>
        <p className="text-gray-600">Monitor student teams and their progress</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Teams Management Coming Soon</h3>
          <p className="text-gray-500">Team management functionality will be available in the next update</p>
        </div>
      </div>
    </div>
  );
}

// Tasks Tab Component
function TasksTab({ projects }) {
  const [selectedProject, setSelectedProject] = useState(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Task Management</h2>
        <p className="text-gray-600">Create and manage assignments for your students</p>
      </div>

      {!selectedProject ? (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-700">Select a Project Server</h3>
          {projects.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Project Servers</h3>
              <p className="text-gray-500">Create a project server first to manage tasks</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {projects.map((project) => (
                <div 
                  key={project._id}
                  onClick={() => setSelectedProject(project)}
                  className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-purple-500"
                >
                  <h4 className="font-semibold text-gray-800">{project.title}</h4>
                  <p className="text-gray-600 text-sm mt-1">{project.description}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-gray-500">
                      {project.studentCount || 0} students
                    </span>
                    <span className="text-purple-600 text-sm font-medium">
                      Manage Tasks →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center space-x-4 mb-6">
            <button
              onClick={() => setSelectedProject(null)}
              className="text-purple-600 hover:text-purple-700 font-medium"
            >
              ← Back to Projects
            </button>
            <div>
              <h3 className="text-xl font-semibold text-gray-800">{selectedProject.title}</h3>
              <p className="text-gray-600">Task Management</p>
            </div>
          </div>
          
          <div className="mb-6">
            <QuickTaskCreator 
              serverId={selectedProject._id}
              onTaskCreated={(task) => {
                console.log('Task created:', task);
                // Optionally refresh any task lists
              }}
            />
          </div>
          
          <TaskList 
            serverId={selectedProject._id} 
            userRole="faculty" 
            userId={null} 
          />
        </div>
      )}
    </div>
  );
}

// Students Tab Component
function StudentsTab({ students }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Students</h2>
        <p className="text-gray-600">Monitor student participation and progress</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800">All Students</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {students.map((student) => (
            <div key={student.id} className="p-6 hover:bg-gray-50 transition-colors duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-800">{student.name}</h4>
                    <p className="text-gray-600">{student.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Projects: {student.projects}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      student.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {student.status}
                    </span>
                  </div>
                  <button className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Analytics Tab Component
function AnalyticsTab({ analytics, projects }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
        <p className="text-gray-600">Track performance and engagement metrics</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Advanced Analytics Coming Soon</h3>
          <p className="text-gray-500">Detailed analytics and reporting will be available in the next update</p>
        </div>
      </div>
    </div>
  );
}

export default FacultyDashboard;