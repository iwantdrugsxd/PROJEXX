import React, { useState, useContext, useEffect } from 'react';
import { AuthContext, API_BASE } from '../App';
import { 
  User, 
  BookOpen, 
  Users, 
  Plus, 
  Settings, 
  LogOut, 
  Bell, 
  Search,
  Calendar,
  TrendingUp,
  Target,
  Award,
  MessageSquare,
  FileText,
  ChevronRight,
  Copy,
  Eye,
  Edit,
  Download,
  Filter,
  BarChart3,
  Clock
} from 'lucide-react';

function FacultyDashboard() {
  const { user, setUser, setCurrentView } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [projects, setProjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchFacultyData();
  }, []);

  const fetchFacultyData = async () => {
    // Mock data - replace with real API calls
    setProjects([
      {
        id: 1,
        title: "Web Development Bootcamp",
        description: "Full-stack web development course project",
        code: "PRJ-WEB123",
        teams: 8,
        students: 32,
        status: "Active",
        createdAt: "2024-01-15",
        progress: 65,
        dueDate: "2024-03-15"
      },
      {
        id: 2,
        title: "AI & Machine Learning",
        description: "Advanced AI research project",
        code: "PRJ-AI456",
        teams: 5,
        students: 20,
        status: "Active", 
        createdAt: "2024-01-20",
        progress: 45,
        dueDate: "2024-04-01"
      },
      {
        id: 3,
        title: "Mobile App Development",
        description: "iOS and Android app development",
        code: "PRJ-MOB789",
        teams: 6,
        students: 24,
        status: "Completed",
        createdAt: "2023-12-01",
        progress: 100,
        dueDate: "2024-01-30"
      }
    ]);

    setStudents([
      { id: 1, name: "Alice Johnson", email: "alice@student.edu", teams: 2, projects: 3, performance: 92, status: "Active", lastSeen: "2 hours ago" },
      { id: 2, name: "Bob Smith", email: "bob@student.edu", teams: 1, projects: 2, performance: 88, status: "Active", lastSeen: "1 day ago" },
      { id: 3, name: "Carol Davis", email: "carol@student.edu", teams: 3, projects: 4, performance: 95, status: "Active", lastSeen: "30 minutes ago" },
      { id: 4, name: "David Wilson", email: "david@student.edu", teams: 2, projects: 3, performance: 78, status: "Inactive", lastSeen: "3 days ago" },
      { id: 5, name: "Emma Brown", email: "emma@student.edu", teams: 1, projects: 2, performance: 91, status: "Active", lastSeen: "5 hours ago" }
    ]);

    setAnalytics({
      totalProjects: 3,
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
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/faculty/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      setCurrentView('landing');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'projects', label: 'Projects', icon: BookOpen },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'assignments', label: 'Assignments', icon: FileText },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

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
                <button className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all duration-200 relative">
                  <Bell className="w-5 h-5" />
                  {notifications.filter(n => n.unread).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
                  )}
                </button>
              </div>
              
              {/* User Menu */}
              <div className="flex items-center space-x-3 bg-gray-100 rounded-xl px-3 py-2">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-700">{user?.name || 'Professor'}</p>
                  <p className="text-xs text-gray-500">Faculty</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 text-gray-500 hover:text-red-600 transition-colors duration-200"
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
          <nav className="p-6">
            <div className="space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
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
          {activeTab === 'overview' && <OverviewTab analytics={analytics} projects={projects} notifications={notifications} setActiveTab={setActiveTab} />}
          {activeTab === 'projects' && <ProjectsTab projects={projects} setProjects={setProjects} />}
          {activeTab === 'students' && <StudentsTab students={students} />}
          {activeTab === 'analytics' && <AnalyticsTab analytics={analytics} projects={projects} />}
          {activeTab === 'assignments' && <AssignmentsTab />}
          {activeTab === 'calendar' && <CalendarTab />}
          {activeTab === 'messages' && <MessagesTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ analytics, projects, notifications, setActiveTab }) {
  const stats = [
    {
      label: "Total Projects",
      value: analytics.totalProjects || 0,
      icon: BookOpen,
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
      label: "Avg Performance",
      value: `${analytics.avgPerformance || 0}%`,
      icon: Award,
      color: "orange",
      change: "+3% this week"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full transform translate-x-16 -translate-y-16"></div>
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">Good morning, Professor! 👨‍🏫</h2>
              <p className="text-purple-100 text-lg">Ready to inspire your students today?</p>
            </div>
            <div className="hidden md:block">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                <Target className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const colorClasses = {
            purple: 'bg-purple-100 text-purple-600',
            blue: 'bg-blue-100 text-blue-600',
            green: 'bg-green-100 text-green-600',
            orange: 'bg-orange-100 text-orange-600'
          };
          
          return (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[stat.color]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-gray-800">{stat.value}</span>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">{stat.label}</h3>
              <p className="text-sm text-green-600">{stat.change}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Recent Projects</h3>
            <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">View All</button>
          </div>
          <div className="space-y-4">
            {projects.slice(0, 3).map((project) => (
              <div key={project.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{project.title}</h4>
                  <p className="text-sm text-gray-600">{project.description}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Users className="w-3 h-3" />
                      <span>{project.students} students</span>
                    </div>
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Target className="w-3 h-3" />
                      <span>{project.teams} teams</span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      project.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Quick Actions</h3>
            <div className="space-y-3">
              <button 
                onClick={() => setActiveTab('projects')}
                className="w-full flex items-center space-x-3 p-3 text-left bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors duration-200"
              >
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium text-purple-700">Create New Project</span>
              </button>
              <button 
                onClick={() => setActiveTab('students')}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-xl transition-colors duration-200"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium text-gray-700">Manage Students</span>
              </button>
              <button 
                onClick={() => setActiveTab('analytics')}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-xl transition-colors duration-200"
              >
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium text-gray-700">View Analytics</span>
              </button>
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-xl transition-colors duration-200">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Download className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium text-gray-700">Export Reports</span>
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Recent Activity</h3>
            <div className="space-y-4">
              {notifications.slice(0, 4).map((notification) => (
                <div key={notification.id} className="flex items-start space-x-3">
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
      </div>
    </div>
  );
}

// Projects Tab Component
function ProjectsTab({ projects, setProjects }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(false);

  const createProject = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/projectServers/createProjectServer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newProject)
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(prev => [...prev, data.projectServer]);
        setNewProject({ title: '', description: '' });
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyProjectCode = (code) => {
    navigator.clipboard.writeText(code);
    // Add toast notification here if needed
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Projects</h2>
          <p className="text-gray-600">Manage your project servers and monitor progress</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Create New Project</h3>
            <form onSubmit={createProject} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Project Title</label>
                <input
                  type="text"
                  value={newProject.title}
                  onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  placeholder="Enter project title"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400 h-24 resize-none"
                  placeholder="Describe your project"
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
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div key={project.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 transform hover:scale-105">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => copyProjectCode(project.code)}
                  className="p-1 text-gray-400 hover:text-purple-600 transition-colors duration-200"
                  title="Copy project code"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors duration-200" title="View details">
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-1 text-gray-400 hover:text-green-600 transition-colors duration-200" title="Edit project">
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <h3 className="font-semibold text-gray-800 mb-2">{project.title}</h3>
            <p className="text-gray-600 text-sm mb-4">{project.description}</p>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Progress</span>
                <span className="text-xs text-gray-500">{project.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${project.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <Users className="w-3 h-3" />
                  <span>{project.students} students</span>
                </div>
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <Target className="w-3 h-3" />
                  <span>{project.teams} teams</span>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                project.status === 'Active' ? 'bg-green-100 text-green-800' : 
                project.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {project.status}
              </span>
            </div>

            <div className="bg-gray-100 px-3 py-2 rounded-lg flex items-center justify-between">
              <span className="text-xs font-mono text-gray-600">{project.code}</span>
              <button
                onClick={() => copyProjectCode(project.code)}
                className="text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                Copy Code
              </button>
            </div>
          </div>
        ))}
        
        {/* Empty state */}
        {projects.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-600 mb-2">No projects yet</h3>
            <p className="text-gray-500 text-center mb-4">Create your first project to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300"
            >
              <Plus className="w-4 h-4" />
              <span>Create Project</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Students Tab Component
function StudentsTab({ students }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || student.status.toLowerCase() === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Students</h2>
          <p className="text-gray-600">Monitor student progress and performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors duration-200">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
          <button className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400"
          >
            <option value="all">All Students</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Students Table */}
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
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50 transition-colors duration-200">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {student.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{student.name}</p>
                        <p className="text-sm text-gray-600">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-lg text-sm font-medium">
                      {student.teams}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-lg text-sm font-medium">
                      {student.projects}
                    </span>
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
                      <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors duration-200" title="View profile">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-purple-600 transition-colors duration-200" title="Send message">
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-green-600 transition-colors duration-200" title="Edit student">
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
function AnalyticsTab({ analytics, projects }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
        <p className="text-gray-600">Detailed insights into project performance and student engagement</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Teams</p>
              <p className="text-2xl font-bold text-gray-800">{analytics.totalTeams}</p>
            </div>
          </div>
          <p className="text-xs text-green-600">+12% from last month</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Submissions</p>
              <p className="text-2xl font-bold text-gray-800">{analytics.thisMonthSubmissions}</p>
            </div>
          </div>
          <p className="text-xs text-green-600">This month</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Reviews</p>
              <p className="text-2xl font-bold text-gray-800">{analytics.pendingReviews}</p>
            </div>
          </div>
          <p className="text-xs text-orange-600">Needs attention</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Score</p>
              <p className="text-2xl font-bold text-gray-800">{analytics.avgPerformance}%</p>
            </div>
          </div>
          <p className="text-xs text-green-600">+2.3% improvement</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Project Progress Overview</h3>
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{project.title}</span>
                  <span className="text-sm text-gray-500">{project.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${project.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Student Engagement</h3>
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Advanced charts coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Assignments Tab Component
function AssignmentsTab() {
  const assignments = [
    {
      id: 1,
      title: "Web Development Project Phase 1",
      project: "Web Development Bootcamp",
      dueDate: "2024-02-25",
      submissions: 25,
      totalStudents: 32,
      status: "Active"
    },
    {
      id: 2,
      title: "AI Model Training Report",
      project: "AI & Machine Learning",
      dueDate: "2024-03-05",
      submissions: 12,
      totalStudents: 20,
      status: "Active"
    },
    {
      id: 3,
      title: "Mobile App Prototype",
      project: "Mobile App Development",
      dueDate: "2024-01-30",
      submissions: 24,
      totalStudents: 24,
      status: "Completed"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Assignments</h2>
          <p className="text-gray-600">Create and manage assignments for your projects</p>
        </div>
        <button className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300">
          <Plus className="w-4 h-4" />
          <span>New Assignment</span>
        </button>
      </div>

      <div className="grid gap-4">
        {assignments.map((assignment) => (
          <div key={assignment.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="font-semibold text-gray-800">{assignment.title}</h3>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                    assignment.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {assignment.status}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-2">{assignment.project}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>Due: {assignment.dueDate}</span>
                  <span>Submissions: {assignment.submissions}/{assignment.totalStudents}</span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">
                    {Math.round((assignment.submissions / assignment.totalStudents) * 100)}%
                  </p>
                  <p className="text-xs text-gray-500">Completion</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors duration-200" title="View submissions">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-green-600 transition-colors duration-200" title="Edit assignment">
                    <Edit className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Calendar Tab Component
function CalendarTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Calendar</h2>
        <p className="text-gray-600">Schedule and manage important dates</p>
      </div>
      
      <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">Calendar Integration</h3>
        <p className="text-gray-500 mb-4">Full calendar functionality coming soon</p>
        <button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300">
          Enable Calendar
        </button>
      </div>
    </div>
  );
}

// Messages Tab Component
function MessagesTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Messages</h2>
        <p className="text-gray-600">Communicate with students and teams</p>
      </div>
      
      <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
        <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">Messaging System</h3>
        <p className="text-gray-500 mb-4">Direct messaging with students coming soon</p>
        <button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300">
          Start Messaging
        </button>
      </div>
    </div>
  );
}

// Settings Tab Component
function SettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      <div className="grid gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Profile Settings</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">First Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  placeholder="Your first name"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Last Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  placeholder="Your last name"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Email</label>
              <input
                type="email"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                placeholder="Your email address"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Phone</label>
              <input
                type="tel"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                placeholder="Your phone number"
              />
            </div>
            <button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300">
              Save Changes
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800">Email Notifications</h4>
                <p className="text-sm text-gray-600">Receive email updates about student activities</p>
              </div>
              <button className="w-12 h-6 bg-purple-500 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 transition-transform duration-200"></div>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800">Project Updates</h4>
                <p className="text-sm text-gray-600">Get notified when students submit work</p>
              </div>
              <button className="w-12 h-6 bg-purple-500 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 transition-transform duration-200"></div>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800">Weekly Reports</h4>
                <p className="text-sm text-gray-600">Receive weekly progress reports</p>
              </div>
              <button className="w-12 h-6 bg-gray-300 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 transition-transform duration-200"></div>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Security</h3>
          <div className="space-y-4">
            <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200">
              <span className="font-medium text-gray-700">Change Password</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200">
              <span className="font-medium text-gray-700">Two-Factor Authentication</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200">
              <span className="font-medium text-gray-700">Login History</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FacultyDashboard;