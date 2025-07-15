import React, { useState, useEffect, useContext } from 'react';
import { AuthContext, API_BASE } from '../App';

import CalendarView from 'Calendar/CalendarView';
import MessagingSystem from 'Messaging/MessagingSystem';
import SettingsPage from 'Settings/SettingsPage';
import { 
  Award, 
  Server, 
  Users, 
  BookOpen, 
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
  ExternalLink,
  X,
  Trash2
} from 'lucide-react';

function StudentDashboard() {
  // ✅ Use logout from context instead of local implementation
  const { user, handleLogout } = useContext(AuthContext);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false); // ✅ Add loading state
// Replace the existing tab content with:

{activeTab === 'calendar' && <CalendarView userRole="faculty" userId={user?.id} />}
{activeTab === 'messages' && <MessagingSystem userRole="faculty" userId={user?.id} user={user} />}
{activeTab === 'settings' && <SettingsPage user={user} userRole="faculty" onUserUpdate={setUser} />}
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      await Promise.all([
        loadServers(),
        loadTeams(),
        loadTasks()
      ]);
      
      // Mock notifications for now
      setNotifications([
        {
          id: 1,
          type: "task",
          title: "New task assigned",
          message: "Complete the database design document",
          time: "2 hours ago",
          unread: true
        },
        {
          id: 2,
          type: "team",
          title: "Team invitation",
          message: "You've been added to Frontend Development team",
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

  const loadServers = async () => {
    try {
      const response = await fetch(`${API_BASE}/projectServers/student-servers`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setServers(data.servers || []);
      } else {
        console.error('Failed to load servers:', response.status);
        setServers([]);
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
      setServers([]);
    }
  };

  const loadTeams = async () => {
    try {
      const response = await fetch(`${API_BASE}/teamRoutes/student-teams`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      } else {
        console.error('Failed to load teams:', response.status);
        setTeams([]);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
      setTeams([]);
    }
  };

  const loadTasks = async () => {
    try {
      const response = await fetch(`${API_BASE}/taskRoutes/student-tasks`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      } else {
        console.error('Failed to load tasks:', response.status);
        setTasks([]);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    }
  };

  // ✅ Enhanced server joining with better validation and UX
  const handleJoinServer = async (e) => {
    e.preventDefault();
    
    if (!joinCode.trim()) {
      alert('Please enter a server code');
      return;
    }

    if (joinCode.trim().length < 3) {
      alert('Server code must be at least 3 characters');
      return;
    }

    setJoining(true);
    
    try {
      const response = await fetch(`${API_BASE}/projectServers/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }) // ✅ Normalize code
      });

      const data = await response.json();
      
      if (data.success) {
        // ✅ Update servers list immediately
        setServers(prev => [data.server, ...prev]);
        setJoinCode('');
        setShowJoinModal(false);
        
        // ✅ Better success message
        alert(`Successfully joined "${data.server.title}"!`);
        
        // ✅ Refresh server list from backend
        await loadServers();
      } else {
        alert(data.message || 'Failed to join server');
      }
    } catch (error) {
      console.error('Failed to join server:', error);
      alert('Failed to join server. Please check your connection.');
    } finally {
      setJoining(false);
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
                <p className="text-gray-600">Ready to work on your projects?</p>
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
              
              {/* ✅ Use context logout function */}
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
          {activeTab === 'overview' && <OverviewTab notifications={notifications} />}
          {activeTab === 'servers' && (
            <ServersTab 
              servers={servers} 
              setServers={setServers}
              showJoinModal={showJoinModal}
              setShowJoinModal={setShowJoinModal}
              handleJoinServer={handleJoinServer}
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              joining={joining}
            />
          )}
          {activeTab === 'teams' && (
            <TeamsTab 
              teams={teams} 
              setTeams={setTeams}
              servers={servers}
              showCreateTeamModal={showCreateTeamModal}
              setShowCreateTeamModal={setShowCreateTeamModal}
              loadTeams={loadTeams}
            />
          )}
          {activeTab === 'tasks' && <TasksTab tasks={tasks} />}
          {activeTab === 'calendar' && <CalendarTab />}
          {activeTab === 'messages' && <MessagesTab />}
          {activeTab === 'settings' && <SettingsTab user={user} />}
        </main>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ notifications }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Overview</h2>
        <p className="text-gray-600">Track your progress and stay updated</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stats Cards */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Active Projects</p>
              <p className="text-3xl font-bold">3</p>
            </div>
            <Server className="w-8 h-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Teams Joined</p>
              <p className="text-3xl font-bold">2</p>
            </div>
            <Users className="w-8 h-8 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Tasks Pending</p>
              <p className="text-3xl font-bold">5</p>
            </div>
            <Clock className="w-8 h-8 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Tasks Completed</p>
              <p className="text-3xl font-bold">12</p>
            </div>
            <CheckCircle className="w-8 h-8 text-orange-200" />
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
                <p className="text-sm font-medium text-gray-800">Joined Web Development Project</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-xl">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Completed Database Design task</p>
                <p className="text-xs text-gray-500">1 day ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-xl">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Created Frontend team</p>
                <p className="text-xs text-gray-500">2 days ago</p>
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

// Servers Tab Component - ✅ Enhanced with better UX
function ServersTab({ servers, setServers, showJoinModal, setShowJoinModal, handleJoinServer, joinCode, setJoinCode, joining }) {
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
                  placeholder="Enter server code (e.g., WEB123)"
                  required
                  disabled={joining}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors duration-200"
                  disabled={joining}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={joining || !joinCode.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joining ? 'Joining...' : 'Join Server'}
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
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                  {server.code}
                </span>
              </div>
              
              <h3 className="text-lg font-bold text-gray-800 mb-2">{server.title}</h3>
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {server.description || 'No description available'}
              </p>
              
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Faculty: {server.faculty?.firstName} {server.faculty?.lastName}</span>
              </div>
              
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

// Teams Tab Component - ✅ Enhanced with better validation
function TeamsTab({ teams, setTeams, servers, showCreateTeamModal, setShowCreateTeamModal, loadTeams }) {
  const [newTeam, setNewTeam] = useState({ name: '', serverCode: '', memberEmails: [''] });
  const [loading, setLoading] = useState(false);

  // ✅ Enhanced team creation with better validation
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    
    // ✅ Enhanced validation
    if (!newTeam.name.trim()) {
      alert('Team name is required');
      return;
    }
    
    if (newTeam.name.trim().length < 2) {
      alert('Team name must be at least 2 characters');
      return;
    }
    
    if (!newTeam.serverCode.trim()) {
      alert('Project server code is required');
      return;
    }

    const validEmails = newTeam.memberEmails.filter(email => email.trim().length > 0);
    
    // ✅ Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = validEmails.filter(email => !emailRegex.test(email.trim()));
    
    if (invalidEmails.length > 0) {
      alert(`Invalid email format: ${invalidEmails.join(", ")}`);
      return;
    }
    
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
          memberEmails: validEmails.map(email => email.trim().toLowerCase())
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setTeams(prev => [data.team, ...prev]);
        setNewTeam({ name: '', serverCode: '', memberEmails: [''] });
        setShowCreateTeamModal(false);
        alert('Team created successfully!');
        
        // ✅ Refresh teams list
        if (loadTeams) loadTeams();
      } else {
        alert(data.message || 'Failed to create team');
      }
    } catch (error) {
      console.error('Failed to create team:', error);
      alert('Failed to create team. Please check your connection.');
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
          <p className="text-gray-600">Collaborate with your team members</p>
        </div>
        <button
          onClick={() => setShowCreateTeamModal(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          <span>Create Team</span>
        </button>
      </div>

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Create New Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Team Name</label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400"
                  placeholder="e.g., Frontend Development Team"
                  required
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">Project Server Code</label>
                <input
                  type="text"
                  value={newTeam.serverCode}
                  onChange={(e) => setNewTeam(prev => ({ ...prev, serverCode: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400"
                  placeholder="e.g., WEB123"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Team Member Emails</label>
                {newTeam.memberEmails.map((email, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400"
                      placeholder="member@email.com"
                      disabled={loading}
                    />
                    {newTeam.memberEmails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmailField(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
                        disabled={loading}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEmailField}
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                  disabled={loading}
                >
                  + Add another email
                </button>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors duration-200"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading || !newTeam.name.trim() || !newTeam.serverCode.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                  {team.members?.length || 0} members
                </span>
              </div>
              
              <h3 className="text-lg font-bold text-gray-800 mb-2">{team.name}</h3>
              <p className="text-gray-600 text-sm mb-4">
                Server: {team.projectServer}
              </p>
              
              <div className="space-y-2 mb-4">
                {team.members?.slice(0, 3).map((member, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                    <span className="text-sm text-gray-600">{member.firstName} {member.lastName}</span>
                  </div>
                ))}
                {team.members?.length > 3 && (
                  <div className="text-xs text-gray-500">
                    +{team.members.length - 3} more members
                  </div>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Created {new Date(team.createdAt).toLocaleDateString()}
                </span>
                <button className="text-green-600 hover:text-green-700 transition-colors duration-200">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Teams Yet</h3>
          <p className="text-gray-500 mb-6">Create your first team to start collaborating</p>
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

// Tasks Tab Component
function TasksTab({ tasks }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Tasks</h2>
        <p className="text-gray-600">Track and manage your assignments</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Tasks Coming Soon</h3>
          <p className="text-gray-500">Task management functionality will be available in the next update</p>
        </div>
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
        <p className="text-gray-600">Manage your schedule and deadlines</p>
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

// Messages Tab Component
function MessagesTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Messages</h2>
        <p className="text-gray-600">Communicate with your team members</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center py-12">
          <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Messages Coming Soon</h3>
          <p className="text-gray-500">Messaging functionality will be available in the next update</p>
        </div>
      </div>
    </div>
  );
}

// Settings Tab Component
function SettingsTab({ user }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center py-12">
          <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Settings Coming Soon</h3>
          <p className="text-gray-500">Account settings will be available in the next update</p>
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;