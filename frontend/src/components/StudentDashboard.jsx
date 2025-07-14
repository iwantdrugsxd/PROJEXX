import React, { useState, useEffect, useContext } from 'react';
import { AuthContext, API_BASE } from '../App';
import { 
  Users, Award, TrendingUp, Clock, BookOpen, Calendar, MessageSquare, Settings,
  Plus, Search, Bell, LogOut, ChevronRight, Server, Code, UserPlus, Copy, CheckCircle
} from 'lucide-react';

function StudentDashboard() {
  const { user, setUser, setCurrentView } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [teams, setTeams] = useState([]);
  const [servers, setServers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load joined servers
      const serversResponse = await fetch(`${API_BASE}/projectServers/student-servers`, {
        credentials: 'include'
      });
      
      if (serversResponse.ok) {
        const serversData = await serversResponse.json();
        setServers(serversData.servers || []);
      }

      // Load joined teams
      const teamsResponse = await fetch(`${API_BASE}/teamRoutes/by-student/${user.id}`, {
        credentials: 'include'
      });
      
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        setTeams(teamsData.teams || []);
      }

      // Load tasks for student
      const tasksResponse = await fetch(`${API_BASE}/task/student/${user.id}`, {
        credentials: 'include'
      });
      
      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json();
        setTasks(tasksData.tasks || []);
      }

      // Mock notifications
      setNotifications([
        {
          id: 1,
          type: "task",
          title: "New task assigned",
          message: "Design Homepage task assigned to Team Alpha",
          time: "2 hours ago",
          unread: true
        },
        {
          id: 2,
          type: "team",
          title: "Team meeting scheduled",
          message: "Team Beta meeting tomorrow at 3 PM",
          time: "4 hours ago",
          unread: true
        },
        {
          id: 3,
          type: "submission",
          title: "Task submitted",
          message: "Your submission for Database Schema was received",
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

  const handleJoinServer = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/projectServers/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: joinCode.trim() })
      });

      const data = await response.json();
      
      if (data.success) {
        setServers(prev => [data.server, ...prev]);
        setJoinCode('');
        setShowJoinModal(false);
        alert('Successfully joined project server!');
      } else {
        alert(data.message || 'Failed to join server');
      }
    } catch (error) {
      console.error('Failed to join server:', error);
      alert('Failed to join server');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/student/logout`, {
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
    { id: 'overview', label: 'Overview', icon: Award },
    { id: 'servers', label: 'Project Servers', icon: Server },
    { id: 'teams', label: 'My Teams', icon: Users },
    { id: 'tasks', label: 'Tasks', icon: BookOpen },
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
                <p className="text-sm text-gray-600">Student Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search teams, tasks..."
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
                  <p className="text-sm font-medium text-gray-800">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-600">Student</p>
                </div>
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-medium">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors duration-200"
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
          {activeTab === 'overview' && <OverviewTab teams={teams} tasks={tasks} notifications={notifications} />}
          {activeTab === 'servers' && <ServersTab servers={servers} setServers={setServers} showJoinModal={showJoinModal} setShowJoinModal={setShowJoinModal} joinCode={joinCode} setJoinCode={setJoinCode} handleJoinServer={handleJoinServer} />}
          {activeTab === 'teams' && <TeamsTab teams={teams} setTeams={setTeams} servers={servers} showCreateTeamModal={showCreateTeamModal} setShowCreateTeamModal={setShowCreateTeamModal} />}
          {activeTab === 'tasks' && <TasksTab tasks={tasks} />}
          {activeTab === 'calendar' && <CalendarTab />}
          {activeTab === 'messages' && <MessagesTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ teams, tasks, notifications }) {
  const stats = [
    {
      label: "Active Teams",
      value: teams.length,
      icon: Users,
      color: "purple",
      change: "+2 this month"
    },
    {
      label: "Total Tasks",
      value: tasks.length,
      icon: BookOpen,
      color: "blue",
      change: "+5 this week"
    },
    {
      label: "Completed Tasks",
      value: tasks.filter(task => task.status === 'completed' || task.status === 'approved').length,
      icon: Award,
      color: "green",
      change: "+3 this month"
    },
    {
      label: "Pending Tasks",
      value: tasks.filter(task => task.status === 'pending' || task.status === 'in-progress').length,
      icon: Clock,
      color: "orange",
      change: "2 due today"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Welcome back!</h2>
            <p className="text-purple-100">Ready to collaborate and achieve your goals?</p>
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
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${stat.color}-100`}>
                  <Icon className={`w-6 h-6 text-${stat.color}-600`} />
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
              <Server className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-800">Join Server</p>
              <p className="text-sm text-gray-600">Enter server code</p>
            </div>
          </button>
          <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-800">Create Team</p>
              <p className="text-sm text-gray-600">Start collaborating</p>
            </div>
          </button>
          <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-800">View Tasks</p>
              <p className="text-sm text-gray-600">Check assignments</p>
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

// Project Servers Tab Component
function ServersTab({ servers, setServers, showJoinModal, setShowJoinModal, joinCode, setJoinCode, handleJoinServer }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Project Servers</h2>
          <p className="text-gray-600">Join project servers to access courses and collaborate</p>
        </div>
        <button
          onClick={() => setShowJoinModal(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          <span>Join Server</span>
        </button>
      </div>

      {/* Join Server Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Join Project Server</h3>
            <form onSubmit={handleJoinServer} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Server Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  placeholder="Enter server code (e.g., PRJ-ABC123)"
                  required
                />
                <p className="text-sm text-gray-500 mt-2">Get this code from your instructor</p>
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300"
                >
                  Join Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Servers Grid */}
      {servers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => (
            <div key={server._id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{server.title}</h3>
                  <p className="text-gray-600 text-sm mb-3">{server.description || 'No description provided'}</p>
                  
                  {/* Faculty Info */}
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-purple-600">
                        {server.faculty?.firstName?.charAt(0)}{server.faculty?.lastName?.charAt(0)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {server.faculty?.firstName} {server.faculty?.lastName}
                    </span>
                  </div>

                  {/* Server Code */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">SERVER CODE</p>
                        <p className="text-lg font-bold text-gray-800">{server.code}</p>
                      </div>
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Joined Date */}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Joined {new Date(server.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No project servers yet</h3>
          <p className="text-gray-500 mb-6">Join your first project server to get started</p>
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300"
          >
            Join Server
          </button>
        </div>
      )}
    </div>
  );
}

// Teams Tab Component
function TeamsTab({ teams, setTeams, servers, showCreateTeamModal, setShowCreateTeamModal }) {
  const [newTeam, setNewTeam] = useState({ name: '', serverCode: '', memberEmails: [''] });
  const [loading, setLoading] = useState(false);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeam.name.trim() || !newTeam.serverCode.trim()) return;

    const validEmails = newTeam.memberEmails.filter(email => email.trim().length > 0);
    if (validEmails.length === 0) {
      alert('Please add at least one team member email');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/teamRoutes/createTeam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newTeam.name.trim(),
          projectServerCode: newTeam.serverCode.trim(),
          memberEmails: validEmails
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setTeams(prev => [data.team, ...prev]);
        setNewTeam({ name: '', serverCode: '', memberEmails: [''] });
        setShowCreateTeamModal(false);
        alert('Team created successfully!');
      } else {
        alert(data.message || 'Failed to create team');
      }
    } catch (error) {
      console.error('Failed to create team:', error);
      alert('Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  const addEmailField = () => {
    setNewTeam(prev => ({
      ...prev,
      memberEmails: [...prev.memberEmails, '']
    }));
  };

  const updateEmail = (index, value) => {
    setNewTeam(prev => ({
      ...prev,
      memberEmails: prev.memberEmails.map((email, i) => i === index ? value : email)
    }));
  };

  const removeEmail = (index) => {
    if (newTeam.memberEmails.length > 1) {
      setNewTeam(prev => ({
        ...prev,
        memberEmails: prev.memberEmails.filter((_, i) => i !== index)
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">My Teams</h2>
          <p className="text-gray-600">Collaborate with your teammates on projects</p>
        </div>
        <button
          onClick={() => setShowCreateTeamModal(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          <span>Create Team</span>
        </button>
      </div>

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Create Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Team Name *</label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  placeholder="e.g., Team Alpha"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">Project Server Code *</label>
                <select
                  value={newTeam.serverCode}
                  onChange={(e) => setNewTeam(prev => ({ ...prev, serverCode: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  required
                >
                  <option value="">Select a server</option>
                  {servers.map((server) => (
                    <option key={server._id} value={server.code}>
                      {server.title} ({server.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Team Member Emails *</label>
                {newTeam.memberEmails.map((email, index) => (
                  <div key={index} className="flex space-x-2 mb-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                      placeholder="student@email.com"
                    />
                    {newTeam.memberEmails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmail(index)}
                        className="px-3 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors duration-200"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEmailField}
                  className="text-sm text-purple-600 hover:text-purple-700 flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add another member</span>
                </button>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teams Grid */}
      {teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div key={team._id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{team.name}</h3>
                  <p className="text-gray-600 text-sm mb-3">{team.description || 'No description'}</p>
                  
                  {/* Team Stats */}
                  <div className="flex items-center space-x-4 mb-3">
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">{team.memberCount || team.members?.length || 0} members</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <BookOpen className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">{team.stats?.totalTasks || 0} tasks</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Progress</span>
                      <span className="text-sm font-medium text-gray-800">{team.completionRate || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${team.completionRate || 0}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Team Code */}
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Team Code</p>
                    <p className="text-sm font-bold text-gray-800">{team.teamCode}</p>
                  </div>
                </div>
              </div>

              {/* Created Date */}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Created {new Date(team.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No teams yet</h3>
          <p className="text-gray-500 mb-6">Create your first team to start collaborating</p>
          <button
            onClick={() => setShowCreateTeamModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300"
          >
            Create Team
          </button>
        </div>
      )}
    </div>
  );
}

// Tasks Tab Component
function TasksTab({ tasks }) {
  const [filter, setFilter] = useState('all');

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Tasks</h2>
          <p className="text-gray-600">Track your assignments and submissions</p>
        </div>
        
        {/* Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400"
        >
          <option value="all">All Tasks</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {filteredTasks.length > 0 ? (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <div key={task._id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">{task.title}</h3>
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      task.status === 'approved' ? 'bg-green-100 text-green-800' :
                      task.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                      task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                      task.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.status.replace('-', ' ')}
                    </span>
                    {task.priority && (
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        task.priority === 'high' ? 'bg-red-100 text-red-800' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-600 mb-3">{task.description || 'No description provided'}</p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Team: {task.team?.name || 'Unknown Team'}</span>
                    <span>•</span>
                    <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
                    {task.dueDate && (
                      <>
                        <span>•</span>
                        <span className={new Date(task.dueDate) < new Date() ? 'text-red-600' : ''}>
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No tasks found</h3>
          <p className="text-gray-500">
            {filter === 'all' ? 'No tasks assigned yet' : `No ${filter.replace('-', ' ')} tasks`}
          </p>
        </div>
      )}
    </div>
  );
}

// Calendar Tab Component
function CalendarTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Calendar</h2>
        <p className="text-gray-600">Manage your schedule and deadlines</p>
      </div>
      
      <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">Calendar Integration</h3>
        <p className="text-gray-500">Coming soon - Full calendar integration with task deadlines</p>
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
        <p className="text-gray-600">Team communication and discussions</p>
      </div>
      
      <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
        <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">No messages yet</h3>
        <p className="text-gray-500">Start conversations with your team members</p>
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

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-800">Email Notifications</h4>
              <p className="text-sm text-gray-600">Get notified about task updates</p>
            </div>
            <button className="w-12 h-6 bg-purple-500 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 transition-transform duration-200"></div>
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-800">Push Notifications</h4>
              <p className="text-sm text-gray-600">Receive push notifications on mobile</p>
            </div>
            <button className="w-12 h-6 bg-gray-300 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 transition-transform duration-200"></div>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Profile</h3>
        <div className="space-y-4">
          <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200">
            <span className="font-medium text-gray-700">Edit Profile</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
          <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200">
            <span className="font-medium text-gray-700">Change Password</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;