import React, { useState, useEffect } from 'react';
import { API_BASE } from '../App';
import { 
  Award, 
  Server, 
  ChevronRight,
  Users, 
  BookOpen, 
  Calendar, 
  MessageSquare, 
  Settings, 
  Plus, 
  Bell, 
  LogOut,
  User,
  TrendingUp,
  Clock,
  CheckCircle,
  Copy,
  ExternalLink,
  UserPlus,
  Trash2
} from 'lucide-react';

 function StudentDashboard({ user, setUser, setCurrentView }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
 
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load student servers using correct endpoint
      const serversResponse = await fetch(`${API_BASE}/projectServers/student-servers`, {
        credentials: 'include'
      });
      
      if (serversResponse.ok) {
        const serversData = await serversResponse.json();
        setServers(serversData.servers || []);
      } else {
        console.error('Failed to load servers:', serversResponse.status);
        setServers([]);
      }

      // Mock data for other sections (replace with real API calls later)
      setTeams([
        { 
          _id: 1, 
          name: "Team Alpha", 
          projectServer: "WEB101", 
          memberCount: 4, 
          status: "active",
          completionRate: 75,
          teamCode: "ALPHA123"
        },
        { 
          _id: 2, 
          name: "Team Beta", 
          projectServer: "MOB201", 
          memberCount: 3, 
          status: "active",
          completionRate: 60,
          teamCode: "BETA456"
        }
      ]);

      setNotifications([
        {
          id: 1,
          type: "task",
          title: "New task assigned",
          message: "Complete the database design for Team Alpha",
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
      // Still logout on frontend even if backend call fails
      setUser(null);
      setCurrentView('landing');
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
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  Welcome, {user?.firstName || 'Student'}!
                </h1>
                <p className="text-sm text-gray-500">Student Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Bell className="w-6 h-6 text-gray-600 cursor-pointer hover:text-purple-600" />
                {notifications.some(n => n.unread) && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notifications.filter(n => n.unread).length}
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
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
        <aside className="w-64 bg-white h-screen sticky top-16 border-r border-gray-200">
          <nav className="p-4">
            <div className="space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-300 ${
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
          {activeTab === 'overview' && <OverviewTab user={user} servers={servers} teams={teams} notifications={notifications} />}
          {activeTab === 'servers' && <ServersTab servers={servers} setServers={setServers} showJoinModal={showJoinModal} setShowJoinModal={setShowJoinModal} handleJoinServer={handleJoinServer} joinCode={joinCode} setJoinCode={setJoinCode} />}
          {activeTab === 'teams' && <TeamsTab teams={teams} setTeams={setTeams} servers={servers} showCreateTeamModal={showCreateTeamModal} setShowCreateTeamModal={setShowCreateTeamModal} />}
 {/*
  {activeTab === 'tasks' && <TasksTab />}
  {activeTab === 'calendar' && <CalendarTab />}
  {activeTab === 'messages' && <MessagesTab />}
*/}
          {activeTab === 'settings' && <SettingsTab user={user} />}
        </main>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ user, servers, teams, notifications }) {
  const stats = [
    { label: 'Project Servers', value: servers.length, icon: Server, color: 'from-blue-500 to-cyan-500' },
    { label: 'Teams Joined', value: teams.length, icon: Users, color: 'from-green-500 to-emerald-500' },
    { label: 'Tasks Pending', value: '3', icon: Clock, color: 'from-yellow-500 to-orange-500' },
    { label: 'Tasks Completed', value: '12', icon: CheckCircle, color: 'from-purple-500 to-indigo-500' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Dashboard Overview</h2>
        <p className="text-gray-600">Here's what's happening with your projects</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Notifications */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Notifications</h3>
          <div className="space-y-4">
            {notifications.slice(0, 3).map((notification) => (
              <div key={notification.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-xl">
                <div className={`w-3 h-3 rounded-full mt-2 ${notification.unread ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{notification.title}</h4>
                  <p className="text-sm text-gray-600">{notification.message}</p>
                  <span className="text-xs text-gray-500">{notification.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center space-x-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors duration-200">
              <Plus className="w-5 h-5 text-purple-600" />
              <span className="text-purple-600 font-medium">Join New Server</span>
            </button>
            <button className="w-full flex items-center space-x-3 p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors duration-200">
              <Users className="w-5 h-5 text-green-600" />
              <span className="text-green-600 font-medium">Create Team</span>
            </button>
            <button className="w-full flex items-center space-x-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors duration-200">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <span className="text-blue-600 font-medium">View Tasks</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Servers Tab Component
function ServersTab({ servers, setServers, showJoinModal, setShowJoinModal, handleJoinServer, joinCode, setJoinCode }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Project Servers</h2>
          <p className="text-gray-600">Manage your joined project servers</p>
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
            <div key={server._id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{server.code}</span>
              </div>
              
              <h3 className="text-lg font-bold text-gray-800 mb-2">{server.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{server.description || 'No description available'}</p>
              
              {server.faculty && (
                <div className="text-sm text-gray-500">
                  <span className="font-medium">Instructor: </span>
                  {server.faculty.firstName} {server.faculty.lastName}
                </div>
              )}
              
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Joined {new Date(server.createdAt).toLocaleDateString()}
                </span>
                <button className="text-purple-600 hover:text-purple-700 transition-colors duration-200">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
          <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Project Servers Yet</h3>
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

  const removeEmailField = (index) => {
    setNewTeam(prev => ({
      ...prev,
      memberEmails: prev.memberEmails.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">My Teams</h2>
          <p className="text-gray-600">Collaborate with your teammates</p>
        </div>
        <button
          onClick={() => setShowCreateTeamModal(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105"
        >
          <UserPlus className="w-5 h-5" />
          <span>Create Team</span>
        </button>
      </div>

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-96 overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Create New Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Team Name</label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400"
                  placeholder="Enter team name"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Project Server Code</label>
                <input
                  type="text"
                  value={newTeam.serverCode}
                  onChange={(e) => setNewTeam(prev => ({ ...prev, serverCode: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400"
                  placeholder="Enter server code"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Member Emails</label>
                {newTeam.memberEmails.map((email, index) => (
                  <div key={index} className="flex space-x-2 mb-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-100 focus:border-green-400"
                      placeholder="member@email.com"
                    />
                    {newTeam.memberEmails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmailField(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEmailField}
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  + Add another member
                </button>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50"
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
            <div key={team._id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{team.teamCode}</span>
              </div>
              
              <h3 className="text-lg font-bold text-gray-800 mb-2">{team.name}</h3>
              <p className="text-gray-600 text-sm mb-4">Project: {team.projectServer}</p>
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-500">{team.memberCount} members</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  team.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {team.status}
                </span>
              </div>
              
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress</span>
                  <span className="text-gray-800 font-medium">{team.completionRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full"
                    style={{ width: `${team.completionRate}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <button className="text-green-600 hover:text-green-700 transition-colors duration-200">
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button className="text-blue-600 hover:text-blue-700 transition-colors duration-200">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Teams Yet</h3>
          <p className="text-gray-500 mb-6">Create or join a team to start collaborating</p>
          <button
            onClick={() => setShowCreateTeamModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300"
          >
            Create Team
          </button>
        </div>
      )}
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

export default StudentDashboard ;