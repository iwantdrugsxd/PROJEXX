 
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
  Clock,
  Award,
  Activity,
  MessageSquare,
  FileText,
  ChevronRight,
  Star
} from 'lucide-react';

function StudentDashboard() {
  const { user, setUser, setCurrentView } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    // Fetch student teams and projects
    // This would be implemented with real API calls
    setTeams([
      {
        id: 1,
        name: "Web Development Team Alpha",
        project: "E-Commerce Platform",
        members: 4,
        progress: 75,
        status: "In Progress",
        dueDate: "2024-02-15",
        avatar: "🚀"
      },
      {
        id: 2,
        name: "AI Research Group",
        project: "Machine Learning Model",
        members: 6,
        progress: 45,
        status: "In Progress",
        dueDate: "2024-03-01",
        avatar: "🤖"
      },
      {
        id: 3,
        name: "Mobile App Developers",
        project: "Student Portal App",
        members: 3,
        progress: 90,
        status: "Review",
        dueDate: "2024-01-30",
        avatar: "📱"
      }
    ]);

    setNotifications([
      {
        id: 1,
        type: "assignment",
        title: "New assignment posted",
        message: "Web Development Team Alpha has a new task",
        time: "2 hours ago",
        unread: true
      },
      {
        id: 2,
        type: "team",
        title: "Team meeting scheduled",
        message: "AI Research Group meeting tomorrow at 2 PM",
        time: "5 hours ago",
        unread: true
      },
      {
        id: 3,
        type: "achievement",
        title: "Milestone completed",
        message: "You completed 'Database Design' milestone",
        time: "1 day ago",
        unread: false
      }
    ]);
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
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'teams', label: 'My Teams', icon: Users },
    { id: 'projects', label: 'Projects', icon: BookOpen },
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
                <p className="text-sm text-gray-600">Student Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search..."
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
                  <p className="text-sm font-medium text-gray-700">{user?.name || 'Student'}</p>
                  <p className="text-xs text-gray-500">Student</p>
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
          {activeTab === 'overview' && <OverviewTab teams={teams} notifications={notifications} />}
          {activeTab === 'teams' && <TeamsTab teams={teams} />}
          {activeTab === 'projects' && <ProjectsTab />}
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
function OverviewTab({ teams, notifications }) {
  const stats = [
    {
      label: "Active Teams",
      value: teams.length,
      icon: Users,
      color: "purple",
      change: "+2 this month"
    },
    {
      label: "Completed Projects",
      value: "8",
      icon: Award,
      color: "green",
      change: "+3 this month"
    },
    {
      label: "Overall Progress",
      value: "73%",
      icon: TrendingUp,
      color: "blue",
      change: "+12% this week"
    },
    {
      label: "Hours Logged",
      value: "124",
      icon: Clock,
      color: "orange",
      change: "+8 this week"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Welcome back! 👋</h2>
            <p className="text-purple-100 text-lg">Ready to continue your learning journey?</p>
          </div>
          <div className="hidden md:block">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
              <Target className="w-10 h-10 text-white" />
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
            green: 'bg-green-100 text-green-600',
            blue: 'bg-blue-100 text-blue-600',
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
        {/* Active Teams */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Active Teams</h3>
            <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">View All</button>
          </div>
          <div className="space-y-4">
            {teams.slice(0, 3).map((team) => (
              <div key={team.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
                <div className="text-2xl">{team.avatar}</div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{team.name}</h4>
                  <p className="text-sm text-gray-600">{team.project}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Users className="w-3 h-3" />
                      <span>{team.members} members</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-purple-500 h-1.5 rounded-full transition-all duration-300" 
                          style={{ width: `${team.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{team.progress}%</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            ))}
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
  );
}

// Teams Tab Component
function TeamsTab({ teams }) {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">My Teams</h2>
          <p className="text-gray-600">Collaborate with your teammates on exciting projects</p>
        </div>
        <button
          onClick={() => setShowJoinModal(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          <span>Join Team</span>
        </button>
      </div>

      {/* Join Team Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Join a Team</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Team Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                  placeholder="Enter team code"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300">
                  Join Team
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <div key={team.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 transform hover:scale-105 cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="text-3xl">{team.avatar}</div>
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                team.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                team.status === 'Review' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {team.status}
              </span>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">{team.name}</h3>
            <p className="text-gray-600 text-sm mb-4">{team.project}</p>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Progress</span>
                <span className="text-xs text-gray-500">{team.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${team.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">{team.members} members</span>
              </div>
              <span className="text-xs text-gray-500">Due: {team.dueDate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Projects Tab Component
function ProjectsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Projects</h2>
        <p className="text-gray-600">All projects you're involved in</p>
      </div>
      
      <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
        <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">No individual projects yet</h3>
        <p className="text-gray-500 mb-4">Your team projects will appear here</p>
      </div>
    </div>
  );
}

// Assignments Tab Component  
function AssignmentsTab() {
  const assignments = [
    {
      id: 1,
      title: "Database Design Document",
      course: "Web Development",
      dueDate: "2024-02-20",
      status: "pending",
      priority: "high"
    },
    {
      id: 2,
      title: "UI/UX Prototype",
      course: "Design Thinking",
      dueDate: "2024-02-25",
      status: "in-progress",
      priority: "medium"
    },
    {
      id: 3,
      title: "API Documentation",
      course: "Backend Development",
      dueDate: "2024-03-01",
      status: "completed",
      priority: "low"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Assignments</h2>
        <p className="text-gray-600">Track your academic assignments</p>
      </div>

      <div className="grid gap-4">
        {assignments.map((assignment) => (
          <div key={assignment.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="font-semibold text-gray-800">{assignment.title}</h3>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                    assignment.priority === 'high' ? 'bg-red-100 text-red-800' :
                    assignment.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {assignment.priority}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-1">{assignment.course}</p>
                <p className="text-gray-500 text-xs">Due: {assignment.dueDate}</p>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                  assignment.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {assignment.status.replace('-', ' ')}
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
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
        <p className="text-gray-600">Manage your schedule and deadlines</p>
      </div>
      
      <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">Calendar Integration</h3>
        <p className="text-gray-500">Coming soon - Full calendar integration</p>
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
        <p className="text-gray-500">Start a conversation with your team</p>
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
        <p className="text-gray-600">Manage your account preferences</p>
      </div>

      <div className="grid gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Profile Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">Display Name</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                placeholder="Your display name"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Email</label>
              <input
                type="email"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                placeholder="Your email address"
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
                <p className="text-sm text-gray-600">Receive email updates about your teams</p>
              </div>
              <button className="w-12 h-6 bg-purple-500 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 transition-transform duration-200"></div>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800">Push Notifications</h4>
                <p className="text-sm text-gray-600">Get notified about team activities</p>
              </div>
              <button className="w-12 h-6 bg-gray-300 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 transition-transform duration-200"></div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;