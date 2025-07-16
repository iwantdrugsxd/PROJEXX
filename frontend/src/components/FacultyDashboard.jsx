import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Server, 
  Users, 
  FileText, 
  Calendar,
  MessageSquare,
  Settings, 
  LogOut,
  Home,
  BarChart3,
  Bell,
  Search,
  Eye,
  Edit,
  Trash2,
  Share2,
  User
} from 'lucide-react';

// Import task management components
import TaskCreator from './TaskManagement/TaskCreator';
import FacultyTaskList from './TaskManagement/FacultyTaskList';

const FacultyDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTaskCreator, setShowTaskCreator] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '' });

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/projectServers/faculty-servers`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success) {
        setProjects(data.servers || []);
      } else {
        console.error('Failed to fetch projects:', data.message);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!createForm.title.trim()) {
      alert('Project title is required');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/projectServers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: createForm.title.trim(),
          description: createForm.description.trim()
        })
      });

      const data = await response.json();
      if (data.success) {
        setProjects(prev => [data.server, ...prev]);
        setCreateForm({ title: '', description: '' });
        setShowCreateModal(false);
      } else {
        alert(data.message || 'Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Network error. Please try again.');
    }
  };

  const deleteServer = async (serverId) => {
    if (!window.confirm('Are you sure you want to delete this project server?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/projectServers/${serverId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        setProjects(prev => prev.filter(project => project._id !== serverId));
        if (selectedProject?._id === serverId) {
          setSelectedProject(null);
        }
      } else {
        alert(data.message || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Network error. Please try again.');
    }
  };

  const handleTaskCreated = () => {
    setShowTaskCreator(false);
    // Refresh task lists if needed
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'projects', label: 'Projects', icon: Server },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'tasks', label: 'Tasks', icon: FileText },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'messaging', label: 'Messages', icon: MessageSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  // Overview Tab
  function OverviewTab() {
    return (
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.firstName || 'Professor'}!</h1>
          <p className="text-purple-100 text-lg">Here's what's happening with your projects and students today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <Server className="w-8 h-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Projects</p>
                <p className="text-3xl font-bold text-gray-900">{projects.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-3xl font-bold text-gray-900">
                  {projects.reduce((total, project) => total + (project.stats?.studentsCount || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <FileText className="w-8 h-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Tasks</p>
                <p className="text-3xl font-bold text-gray-900">
                  {projects.reduce((total, project) => total + (project.stats?.tasksCount || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-full">
                <Bell className="w-8 h-8 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Notifications</p>
                <p className="text-3xl font-bold text-gray-900">5</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Projects</h2>
            {projects.length === 0 ? (
              <div className="text-center py-8">
                <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No projects yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.slice(0, 3).map((project) => (
                  <div key={project._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">{project.title}</h3>
                      <p className="text-sm text-gray-500">Code: {project.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{project.stats?.teamsCount || 0} teams</p>
                      <p className="text-xs text-gray-500">{project.stats?.studentsCount || 0} students</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full flex items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors duration-200"
              >
                <Plus className="w-5 h-5 text-purple-600 mr-3" />
                <span className="text-purple-600 font-medium">Create New Project</span>
              </button>
              <button className="w-full flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200">
                <Users className="w-5 h-5 text-blue-600 mr-3" />
                <span className="text-blue-600 font-medium">Manage Teams</span>
              </button>
              <button className="w-full flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors duration-200">
                <FileText className="w-5 h-5 text-green-600 mr-3" />
                <span className="text-green-600 font-medium">Create Assignment</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Projects Tab
  function ProjectsTab() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Project Servers</h2>
            <p className="text-gray-600">Manage your project servers and share access codes with students</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 flex items-center shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Project
          </button>
        </div>

        {projects.length === 0 ? (
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project._id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border-l-4 border-purple-500">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{project.title}</h3>
                    <p className="text-gray-600 text-sm mb-3">{project.description}</p>
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                        Code: {project.code}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{project.stats?.teamsCount || 0}</div>
                    <div className="text-xs text-gray-500">Teams</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{project.stats?.tasksCount || 0}</div>
                    <div className="text-xs text-gray-500">Tasks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{project.stats?.studentsCount || 0}</div>
                    <div className="text-xs text-gray-500">Students</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedProject(project)}
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
                    onClick={() => deleteServer(project._id)}
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
  }

  // Teams Tab
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

  // Tasks Tab
  function TasksTab() {
    if (!selectedProject) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Task Management</h2>
            <p className="text-gray-600">Create and manage assignments for your students</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Project Server</h3>
            <p className="text-gray-500 mb-6">Choose a project server to manage its tasks and assignments</p>
            
            {projects.length === 0 ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300"
              >
                Create Your First Project
              </button>
            ) : (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Available Projects:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {projects.map((project) => (
                    <button
                      key={project._id}
                      onClick={() => setSelectedProject(project)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                    >
                      <div className="font-medium text-gray-900">{project.title}</div>
                      <div className="text-sm text-gray-500">Code: {project.code}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {project.stats?.teamsCount || 0} teams • {project.stats?.tasksCount || 0} tasks
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
        {/* Project Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Server className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedProject.title}</h2>
                <p className="text-sm text-gray-500">Code: {selectedProject.code}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowTaskCreator(true)}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </button>
              
              <button
                onClick={() => setSelectedProject(null)}
                className="text-gray-600 hover:text-gray-800 text-sm"
              >
                Switch Project
              </button>
            </div>
          </div>
        </div>

        {/* Task List */}
        <FacultyTaskList 
          serverId={selectedProject._id}
          serverTitle={selectedProject.title}
        />
      </div>
    );
  }

  // Calendar Tab
  function CalendarTab() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Calendar</h2>
          <p className="text-gray-600">View important dates and deadlines</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Calendar Coming Soon</h3>
            <p className="text-gray-500">Calendar functionality will be available in the next update</p>
          </div>
        </div>
      </div>
    );
  }

  // Messaging Tab
  function MessagingTab() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Messages</h2>
          <p className="text-gray-600">Communicate with your students</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Messaging Coming Soon</h3>
            <p className="text-gray-500">Messaging functionality will be available in the next update</p>
          </div>
        </div>
      </div>
    );
  }

  // Analytics Tab
  function AnalyticsTab() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
          <p className="text-gray-600">Track student progress and performance</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Analytics Coming Soon</h3>
            <p className="text-gray-500">Analytics functionality will be available in the next update</p>
          </div>
        </div>
      </div>
    );
  }

  // Settings Tab
  function SettingsTab() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
          <p className="text-gray-600">Manage your account and preferences</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
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
  }

  // Create Modal
  const CreateModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create Project Server</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Title *</label>
              <input
                type="text"
                value={createForm.title}
                onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Data Structures Fall 2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the course..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setCreateForm({ title: '', description: '' });
              }}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createProject}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create Project
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
              <h1 className="text-2xl font-bold text-gray-900">ProjectFlow</h1>
              <span className="ml-2 text-sm text-gray-500">Faculty Dashboard</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <User className="w-4 h-4 mr-2" />
                Welcome, {user?.firstName || 'Faculty'}
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Logout button clicked'); // Debug log
                  if (onLogout && typeof onLogout === 'function') {
                    onLogout();
                  } else {
                    // Fallback logout logic
                    localStorage.removeItem('authToken');
                    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    window.location.href = '/login';
                  }
                }}
                className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-1 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
        {activeTab === 'projects' && <ProjectsTab />}
        {activeTab === 'teams' && <TeamsTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'messaging' && <MessagingTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      {/* Modals */}
      {showCreateModal && <CreateModal />}
      {showTaskCreator && selectedProject && (
        <TaskCreator
          serverId={selectedProject._id}
          serverTitle={selectedProject.title}
          onTaskCreated={handleTaskCreated}
          onClose={() => setShowTaskCreator(false)}
        />
      )}
    </div>
  );
};

export default FacultyDashboard;