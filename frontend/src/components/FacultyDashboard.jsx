import React, { useState, useEffect } from 'react';
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
  Share2
} from 'lucide-react';

// Import task management components
import TaskCreator from './TaskManagement/TaskCreator';
import FacultyTaskList from './TaskManagement/FacultyTaskList';

const FacultyDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showServerModal, setShowServerModal] = useState(false);
  const [showTaskCreator, setShowTaskCreator] = useState(false);
  const [serverForm, setServerForm] = useState({ title: '', description: '' });

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/projectServers/faculty-servers`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success) {
        setServers(data.servers || []);
        // Auto-select first server if available
        if (data.servers && data.servers.length > 0 && !selectedServer) {
          setSelectedServer(data.servers[0]);
        }
      } else {
        console.error('Failed to fetch servers:', data.message);
      }
    } catch (error) {
      console.error('Error fetching servers:', error);
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
    // Refresh any task lists if needed
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'servers', label: 'Project Servers', icon: Server },
    { id: 'tasks', label: 'Task Management', icon: FileText },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  // Overview Tab Component
  const OverviewTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user?.firstName || 'Professor'}!
        </h1>
        <p className="text-purple-100">
          Manage your courses, create assignments, and track student progress.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Server className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Project Servers</p>
              <p className="text-2xl font-bold text-gray-900">{servers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Teams</p>
              <p className="text-2xl font-bold text-gray-900">
                {servers.reduce((total, server) => total + (server.stats?.teamsCount || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-2xl font-bold text-gray-900">
                {servers.reduce((total, server) => total + (server.stats?.tasksCount || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Servers */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Project Servers</h2>
        </div>
        <div className="p-6">
          {servers.length === 0 ? (
            <div className="text-center py-8">
              <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Servers Yet</h3>
              <p className="text-gray-500 mb-4">Create your first project server to get started</p>
              <button
                onClick={() => setShowServerModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Create Server
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {servers.slice(0, 4).map((server) => (
                <div key={server._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{server.title}</h3>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      {server.code}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{server.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{server.stats?.teamsCount || 0} teams</span>
                    <span>{server.stats?.tasksCount || 0} tasks</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Servers Tab Component
  const ServersTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Servers</h1>
          <p className="text-gray-600">Manage your course servers and share codes with students</p>
        </div>
        <button
          onClick={() => setShowServerModal(true)}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center shadow-lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Server
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Project Servers</h3>
          <p className="text-gray-500 mb-6">Create your first server to start managing student projects</p>
          <button
            onClick={() => setShowServerModal(true)}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create Your First Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => (
            <div key={server._id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{server.title}</h3>
                  <p className="text-gray-600 text-sm mb-3">{server.description}</p>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium">
                      Code: {server.code}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-blue-600">{server.stats?.teamsCount || 0}</div>
                  <div className="text-xs text-gray-500">Teams</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-green-600">{server.stats?.tasksCount || 0}</div>
                  <div className="text-xs text-gray-500">Tasks</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-orange-600">{server.stats?.studentsCount || 0}</div>
                  <div className="text-xs text-gray-500">Students</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedServer(server)}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors duration-200"
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">Manage</span>
                </button>
                
                <button className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors duration-200">
                  <Share2 className="w-4 h-4" />
                  <span className="text-sm">Share</span>
                </button>
                
                <button
                  onClick={() => deleteServer(server._id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Tasks Tab Component
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
                className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Create Your First Server
              </button>
            ) : (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Available Servers:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {servers.map((server) => (
                    <button
                      key={server._id}
                      onClick={() => setSelectedServer(server)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                    >
                      <div className="font-medium text-gray-900">{server.title}</div>
                      <div className="text-sm text-gray-500">Code: {server.code}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {server.stats?.teamsCount || 0} teams • {server.stats?.tasksCount || 0} tasks
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Server Selection Header */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Server className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{selectedServer.title}</h2>
                <p className="text-sm text-gray-500">Code: {selectedServer.code}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowTaskCreator(true)}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </button>
              
              <button
                onClick={() => setSelectedServer(null)}
                className="text-gray-600 hover:text-gray-800 text-sm"
              >
                Switch Server
              </button>
            </div>
          </div>
        </div>

        {/* Task List */}
        <FacultyTaskList 
          serverId={selectedServer._id}
          serverTitle={selectedServer.title}
        />
      </div>
    );
  };

  // Profile Tab Component
  const ProfileTab = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-gray-600">Manage your account information and preferences</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center space-x-6 mb-6">
          <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-gray-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-gray-600">{user?.email}</p>
            <p className="text-sm text-gray-500">Faculty</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
            <input
              type="text"
              defaultValue={user?.firstName}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
            <input
              type="text"
              defaultValue={user?.lastName}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t">
          <button className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );

  // Server Creation Modal
  const ServerModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create Project Server</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Server Title *</label>
              <input
                type="text"
                value={serverForm.title}
                onChange={(e) => setServerForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Data Structures Fall 2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={serverForm.description}
                onChange={(e) => setServerForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the course..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => {
                setShowServerModal(false);
                setServerForm({ title: '', description: '' });
              }}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createServer}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create Server
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">ProjectFlow</h1>
              <span className="ml-2 text-sm text-gray-500">Faculty Portal</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <User className="w-4 h-4 mr-2" />
                {user?.firstName} {user?.lastName}
              </div>
              <button
                onClick={onLogout}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
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
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      {/* Modals */}
      {showServerModal && <ServerModal />}
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