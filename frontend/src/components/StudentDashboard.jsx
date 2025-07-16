import React, { useState, useEffect } from 'react';
import { 
  User, 
  Users, 
  FileText, 
  Calendar, 
  Settings, 
  Bell,
  LogOut,
  Home,
  Plus,
  Search
} from 'lucide-react';

// Import the task manager component we created
import StudentTaskManager from './TaskManagement/StudentTaskManager';

const StudentDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [teams, setTeams] = useState([]);
  const [servers, setServers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch teams
      const teamsResponse = await fetch(`${API_BASE}/teamRoutes/student-teams`, {
        credentials: 'include'
      });
      const teamsData = await teamsResponse.json();
      if (teamsData.success) {
        setTeams(teamsData.teams || []);
      }

      // Fetch servers (via teams)
      const serversResponse = await fetch(`${API_BASE}/projectServers/student-servers`, {
        credentials: 'include'
      });
      const serversData = await serversResponse.json();
      if (serversData.success) {
        setServers(serversData.servers || []);
      }

      // You can add notifications fetch here if you have that endpoint
      // const notificationsResponse = await fetch(`${API_BASE}/notifications`, {
      //   credentials: 'include'
      // });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'tasks', label: 'My Tasks', icon: FileText },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user?.firstName || 'Student'}!
        </h1>
        <p className="text-blue-100">
          Here's what's happening with your projects and assignments.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">My Teams</p>
              <p className="text-2xl font-bold text-gray-900">{teams.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Projects</p>
              <p className="text-2xl font-bold text-gray-900">{servers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Bell className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Notifications</p>
              <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Teams */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">My Teams</h2>
        </div>
        <div className="p-6">
          {teams.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Teams Yet</h3>
              <p className="text-gray-500 mb-4">Join or create a team to get started</p>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Create Team
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.slice(0, 4).map((team) => (
                <div key={team._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{team.name}</h3>
                    <span className="text-sm text-gray-500">
                      {team.members?.length || 0} members
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Project: {team.projectServer || 'Unknown'}
                  </p>
                  <div className="mt-3 flex items-center space-x-2">
                    {team.members?.slice(0, 3).map((member, index) => (
                      <div
                        key={index}
                        className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs text-gray-600"
                      >
                        {member.firstName?.[0] || 'U'}
                      </div>
                    ))}
                    {team.members?.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{team.members.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const TeamsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Teams</h1>
          <p className="text-gray-600">Manage your team memberships and projects</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Create Team
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Teams Yet</h3>
          <p className="text-gray-500 mb-6">Create or join a team to collaborate on projects</p>
          <div className="space-x-4">
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
              Create Team
            </button>
            <button className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors">
              Join Team
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div key={team._id} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                <span className="text-sm text-gray-500">
                  {team.members?.length || 0} members
                </span>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Project:</strong> {team.projectServer || 'Unknown'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Created:</strong> {new Date(team.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Members:</p>
                <div className="space-y-1">
                  {team.members?.slice(0, 4).map((member, index) => (
                    <div key={index} className="flex items-center text-sm text-gray-600">
                      <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-xs mr-2">
                        {member.firstName?.[0] || 'U'}
                      </div>
                      {member.firstName} {member.lastName}
                    </div>
                  ))}
                  {team.members?.length > 4 && (
                    <p className="text-xs text-gray-500 ml-7">
                      +{team.members.length - 4} more members
                    </p>
                  )}
                </div>
              </div>

              <div className="flex space-x-2">
                <button className="flex-1 bg-blue-50 text-blue-600 py-2 px-3 rounded text-sm hover:bg-blue-100 transition-colors">
                  View Details
                </button>
                <button className="flex-1 border border-gray-300 text-gray-700 py-2 px-3 rounded text-sm hover:bg-gray-50 transition-colors">
                  Leave Team
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

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
            <p className="text-sm text-gray-500">Student</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name
            </label>
            <input
              type="text"
              defaultValue={user?.firstName}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name
            </label>
            <input
              type="text"
              defaultValue={user?.lastName}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              defaultValue={user?.email}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone (Optional)
            </label>
            <input
              type="tel"
              placeholder="Enter phone number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t">
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
              <span className="ml-2 text-sm text-gray-500">Student Portal</span>
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
                      ? 'border-blue-500 text-blue-600'
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
        {activeTab === 'tasks' && <StudentTaskManager userId={user?.id} />}
        {activeTab === 'teams' && <TeamsTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>
    </div>
  );
};

export default StudentDashboard;