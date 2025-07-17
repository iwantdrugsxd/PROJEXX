import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, 
  Users, 
  FileText, 
  Calendar, 
  Bell,
  LogOut,
  Home,
  Plus,
  Search,
  Award,
  Clock,
  TrendingUp,
  Download,
  BookOpen,
  Target,
  CheckCircle,
  X,
  Eye,
  Upload,
  Filter,
  Send,
  Copy,
  ExternalLink,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Settings,
  MessageSquare,
  Paperclip
} from 'lucide-react';

// Import the task manager component
import StudentTaskManager from './TaskManagement/StudentTaskManager';

// Utility Functions
const dateUtils = {
  getRelativeTime: (date) => {
    const now = new Date();
    const target = new Date(date);
    const diff = now - target;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  },
  formatDate: (date, format = 'default') => {
    const d = new Date(date);
    const options = {
      default: { month: 'short', day: 'numeric', year: 'numeric' },
      short: { month: 'short', day: 'numeric' },
      long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
      time: { hour: '2-digit', minute: '2-digit' },
      datetime: { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    };
    return d.toLocaleDateString('en-US', options[format] || options.default);
  },
  getTimeRemaining: (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diff = due - now;

    if (diff < 0) {
      const overdue = Math.abs(diff);
      const days = Math.floor(overdue / (1000 * 60 * 60 * 24));
      const hours = Math.floor((overdue % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (days > 0) return `${days} day${days > 1 ? 's' : ''} overdue`;
      else return `${hours} hour${hours > 1 ? 's' : ''} overdue`;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} remaining`;
    else if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
    else return 'Due soon';
  },
  isOverdue: (dueDate) => {
    return new Date() > new Date(dueDate);
  }
};

const colorUtils = {
  getAvatarColor: (name) => {
    const colors = [
      'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-orange-500'
    ];
    const hash = name?.split('').reduce((a, b) => a + b.charCodeAt(0), 0) || 0;
    return colors[hash % colors.length];
  },
  getStatusColor: (status) => {
    const colors = {
      pending: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      submitted: 'text-blue-600 bg-blue-50 border-blue-200',
      graded: 'text-green-600 bg-green-50 border-green-200',
      overdue: 'text-red-600 bg-red-50 border-red-200',
      draft: 'text-gray-600 bg-gray-50 border-gray-200'
    };
    return colors[status] || colors.draft;
  },
  getPriorityColor: (priority) => {
    const colors = {
      low: 'text-green-600 bg-green-50 border-green-200',
      medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      high: 'text-orange-600 bg-orange-50 border-orange-200',
      urgent: 'text-red-600 bg-red-50 border-red-200'
    };
    return colors[priority] || colors.medium;
  }
};

const ProductionStudentDashboard = ({ user, onLogout }) => {
  // Main state
  const [activeTab, setActiveTab] = useState('overview');
  const [teams, setTeams] = useState([]);
  const [servers, setServers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Enhanced state
  const [tasks, setTasks] = useState([]);
  const [personalStats, setPersonalStats] = useState(null);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [showJoinServerModal, setShowJoinServerModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [serverCode, setServerCode] = useState('');
  const [expandedServers, setExpandedServers] = useState(new Set());
  const [calendarEvents, setCalendarEvents] = useState([]);
  
  // Team creation form
  const [teamForm, setTeamForm] = useState({
    name: '',
    projectServerCode: '',
    memberEmails: ['']
  });

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  // Debounced search
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.trim()) {
        try {
          const response = await fetch(`${API_BASE}/search?query=${encodeURIComponent(query)}&type=student`, {
            credentials: 'include'
          });
          const data = await response.json();
          if (data.success) {
            setSearchResults(data.results);
          }
        } catch (error) {
          console.error('Search error:', error);
        }
      } else {
        setSearchResults(null);
      }
    }, 300),
    []
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

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

      // Fetch servers via teams
      const serversResponse = await fetch(`${API_BASE}/projectServers/student-servers`, {
        credentials: 'include'
      });
      const serversData = await serversResponse.json();
      if (serversData.success) {
        setServers(serversData.servers || []);
      }

      // Fetch tasks
      const tasksResponse = await fetch(`${API_BASE}/tasks/student-tasks`, {
        credentials: 'include'
      });
      const tasksData = await tasksResponse.json();
      if (tasksData.success) {
        const tasksList = tasksData.tasks || [];
        setTasks(tasksList);
        
        // Extract upcoming deadlines
        const upcoming = tasksList
          .filter(task => new Date(task.dueDate) > new Date() && task.status !== 'submitted')
          .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
          .slice(0, 5);
        setUpcomingDeadlines(upcoming);

        // Generate calendar events
        const events = tasksList.map(task => ({
          id: task._id,
          title: `${task.title} Due`,
          type: 'task',
          dueDate: task.dueDate,
          priority: task.priority,
          status: task.status
        }));
        setCalendarEvents(events);

        // Calculate personal stats
        const completedTasks = tasksList.filter(t => t.status === 'submitted' || t.status === 'graded');
        const gradedTasks = tasksList.filter(t => t.status === 'graded');
        const onTimeTasks = completedTasks.filter(t => {
          const submission = t.submissions?.find(s => s.student === user?.id);
          return submission && !submission.isLate;
        });
        
        const averageGrade = gradedTasks.length > 0 
          ? gradedTasks.reduce((acc, task) => {
              const submission = task.submissions?.find(s => s.student === user?.id);
              return acc + (submission?.grade || 0);
            }, 0) / gradedTasks.length
          : 0;

        setPersonalStats({
          totalTasks: tasksList.length,
          completedTasks: completedTasks.length,
          pendingTasks: tasksList.filter(t => t.status === 'active').length,
          averageGrade: averageGrade.toFixed(1),
          onTimeSubmissions: onTimeTasks.length,
          completionRate: tasksList.length > 0 ? ((completedTasks.length / tasksList.length) * 100).toFixed(1) : 0
        });
      }

      // Fetch notifications
      try {
        const notificationsResponse = await fetch(`${API_BASE}/notifications`, {
          credentials: 'include'
        });
        const notificationsData = await notificationsResponse.json();
        if (notificationsData.success) {
          setNotifications(notificationsData.notifications || []);
        }
      } catch (error) {
        console.log('Notifications not available:', error);
      }

      // Fetch available teams to join
      try {
        const availableTeamsResponse = await fetch(`${API_BASE}/teamRoutes/available`, {
          credentials: 'include'
        });
        const availableTeamsData = await availableTeamsResponse.json();
        if (availableTeamsData.success) {
          setAvailableTeams(availableTeamsData.teams || []);
        }
      } catch (error) {
        console.log('Available teams not loaded:', error);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinServer = async () => {
    if (!serverCode.trim()) {
      alert('Server code is required');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/projectServers/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: serverCode.trim() })
      });

      const data = await response.json();
      if (data.success) {
        setShowJoinServerModal(false);
        setServerCode('');
        fetchDashboardData();
        alert(`Successfully joined server: ${data.server.title}`);
      } else {
        alert(data.message || 'Failed to join server');
      }
    } catch (error) {
      console.error('Error joining server:', error);
      alert('Network error. Please try again.');
    }
  };

  const createTeam = async () => {
    if (!teamForm.name.trim() || !teamForm.projectServerCode.trim() || teamForm.memberEmails.filter(email => email.trim()).length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/teamRoutes/createTeam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: teamForm.name.trim(),
          projectServerCode: teamForm.projectServerCode.trim(),
          memberEmails: teamForm.memberEmails.filter(email => email.trim())
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateTeamModal(false);
        setTeamForm({ name: '', projectServerCode: '', memberEmails: [''] });
        fetchDashboardData();
        alert(`Team "${teamForm.name}" created successfully!`);
      } else {
        alert(data.message || 'Failed to create team');
      }
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Network error. Please try again.');
    }
  };

  const joinTeam = async (teamId) => {
    try {
      const response = await fetch(`${API_BASE}/teamRoutes/join/${teamId}`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        fetchDashboardData();
        alert('Successfully joined the team!');
      } else {
        alert(data.message || 'Failed to join team');
      }
    } catch (error) {
      console.error('Error joining team:', error);
      alert('Network error. Please try again.');
    }
  };

  const leaveTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to leave this team?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/teamRoutes/leave/${teamId}`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        fetchDashboardData();
        alert('Successfully left the team!');
      } else {
        alert(data.message || 'Failed to leave team');
      }
    } catch (error) {
      console.error('Error leaving team:', error);
      alert('Network error. Please try again.');
    }
  };

  const exportPersonalData = async () => {
    try {
      const data = {
        personalStats,
        tasks: tasks.map(t => ({
          title: t.title,
          status: t.status,
          dueDate: dateUtils.formatDate(t.dueDate),
          priority: t.priority,
          grade: t.submissions?.find(s => s.student === user?.id)?.grade || 'Not graded'
        })),
        teams: teams.map(t => ({
          name: t.name,
          project: t.projectServer,
          membersCount: t.members?.length || 0
        }))
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `student_data_${dateUtils.formatDate(new Date(), 'short')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data');
    }
  };

  const addMemberEmail = () => {
    setTeamForm(prev => ({
      ...prev,
      memberEmails: [...prev.memberEmails, '']
    }));
  };

  const removeMemberEmail = (index) => {
    setTeamForm(prev => ({
      ...prev,
      memberEmails: prev.memberEmails.filter((_, i) => i !== index)
    }));
  };

  const updateMemberEmail = (index, email) => {
    setTeamForm(prev => ({
      ...prev,
      memberEmails: prev.memberEmails.map((e, i) => i === index ? email : e)
    }));
  };

  const toggleServerExpansion = (serverId) => {
    const newExpanded = new Set(expandedServers);
    if (newExpanded.has(serverId)) {
      newExpanded.delete(serverId);
    } else {
      newExpanded.add(serverId);
    }
    setExpandedServers(newExpanded);
  };

  // Debounce function
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'tasks', label: 'My Tasks', icon: FileText },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'servers', label: 'Project Servers', icon: BookOpen },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'analytics', label: 'Progress', icon: TrendingUp },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  // Enhanced Overview Tab Component
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-3">
              Welcome back, {user?.firstName || 'Student'}!
            </h1>
            <p className="text-blue-100 text-lg">
              Track your progress, manage assignments, and collaborate with your teams.
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-200">{dateUtils.formatDate(new Date(), 'long')}</div>
            <div className="text-xs text-blue-300">{dateUtils.formatDate(new Date(), 'time')}</div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-3xl font-bold text-gray-900">{personalStats?.totalTasks || 0}</p>
              <p className="text-xs text-blue-600 mt-1">Assigned to you</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-gray-900">{personalStats?.completedTasks || 0}</p>
              <p className="text-xs text-green-600 mt-1">Successfully submitted</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Grade</p>
              <p className="text-3xl font-bold text-gray-900">{personalStats?.averageGrade || 0}%</p>
              <p className="text-xs text-purple-600 mt-1">Your performance</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Teams Joined</p>
              <p className="text-3xl font-bold text-gray-900">{teams.length}</p>
              <p className="text-xs text-orange-600 mt-1">Active memberships</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines and My Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Deadlines */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h3>
              <button
                onClick={() => setActiveTab('tasks')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </button>
            </div>
          </div>
          <div className="p-6">
            {upcomingDeadlines.length > 0 ? (
              <div className="space-y-4">
                {upcomingDeadlines.map((task, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-3 h-3 rounded-full mt-2 ${colorUtils.getPriorityColor(task.priority).split(' ')[2]}`}></div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{task.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">{dateUtils.getTimeRemaining(task.dueDate)}</p>
                      <p className="text-xs text-gray-400">Due: {dateUtils.formatDate(task.dueDate, 'datetime')}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorUtils.getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No upcoming deadlines</p>
                <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
              </div>
            )}
          </div>
        </div>

        {/* My Teams */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">My Teams</h3>
              <button
                onClick={() => setActiveTab('teams')}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Manage Teams
              </button>
            </div>
          </div>
          <div className="p-6">
            {teams.length > 0 ? (
              <div className="space-y-4">
                {teams.slice(0, 4).map((team, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full ${colorUtils.getAvatarColor(team.name)} flex items-center justify-center text-white text-sm font-medium`}>
                        {team.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{team.name}</h4>
                        <p className="text-sm text-gray-500">{team.members?.length || 0} members • {team.projectServer}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {dateUtils.getRelativeTime(team.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No teams joined yet</p>
                <button
                  onClick={() => setShowCreateTeamModal(true)}
                  className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Create or join a team
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setActiveTab('tasks')}
              className="flex items-center space-x-3 p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors group"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">View All Tasks</p>
                <p className="text-sm text-gray-500">Check pending assignments</p>
              </div>
            </button>

            <button
              onClick={() => setShowCreateTeamModal(true)}
              className="flex items-center space-x-3 p-4 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors group"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Create Team</p>
                <p className="text-sm text-gray-500">Start collaborating with peers</p>
              </div>
            </button>

            <button
              onClick={exportPersonalData}
              className="flex items-center space-x-3 p-4 border-2 border-dashed border-green-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors group"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <Download className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Export Data</p>
                <p className="text-sm text-gray-500">Download your progress</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
const TasksTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-600">View and manage your assignments</p>
        </div>
        <div className="flex space-x-3">
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            {personalStats?.pendingTasks || 0} Pending
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            {personalStats?.completedTasks || 0} Completed
          </span>
        </div>
      </div>

      <StudentTaskManager />
    </div>
  );

  // Teams Tab Component
  const TeamsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
          <p className="text-gray-600">Manage your team memberships and discover new teams</p>
        </div>
        <button
          onClick={() => setShowCreateTeamModal(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors shadow-lg"
        >
          <Plus className="w-4 h-4" />
          <span>Create Team</span>
        </button>
      </div>

      {/* My Teams */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">My Teams ({teams.length})</h2>
        {teams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <div key={team._id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-200">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-xl ${colorUtils.getAvatarColor(team.name)} flex items-center justify-center text-white text-lg font-bold`}>
                        {team.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                        <p className="text-sm text-gray-500">Server: {team.projectServer}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Members</span>
                      <span className="font-medium text-gray-900">{team.members?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Created</span>
                      <span className="font-medium text-gray-900">{dateUtils.getRelativeTime(team.createdAt)}</span>
                    </div>
                  </div>

                  {/* Team Members */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Members:</p>
                    <div className="flex flex-wrap gap-2">
                      {team.members?.slice(0, 3).map((member, index) => (
                        <div key={index} className="flex items-center space-x-2 px-2 py-1 bg-gray-100 rounded-lg">
                          <div className={`w-6 h-6 rounded-full ${colorUtils.getAvatarColor(member.firstName)} flex items-center justify-center text-white text-xs font-medium`}>
                            {member.firstName?.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-gray-700">{member.firstName}</span>
                        </div>
                      ))}
                      {team.members?.length > 3 && (
                        <span className="text-xs text-gray-500 px-2 py-1">+{team.members.length - 3} more</span>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button className="flex-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors text-sm font-medium">
                      <Eye className="w-4 h-4 inline mr-1" />
                      View Details
                    </button>
                    <button 
                      onClick={() => leaveTeam(team._id)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors text-sm font-medium"
                    >
                      Leave
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No teams joined yet</h3>
            <p className="text-gray-500 mb-6">Join or create a team to start collaborating on projects</p>
            <button
              onClick={() => setShowCreateTeamModal(true)}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Your First Team</span>
            </button>
          </div>
        )}
      </div>

      {/* Available Teams */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Discover Teams</h2>
        {availableTeams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableTeams.map((team) => (
              <div key={team._id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-200">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-xl ${colorUtils.getAvatarColor(team.name)} flex items-center justify-center text-white text-lg font-bold`}>
                        {team.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                        <p className="text-sm text-gray-500">Server: {team.projectServer}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>{team.members?.length || 0} members</span>
                    <span>{dateUtils.getRelativeTime(team.createdAt)}</span>
                  </div>

                  <div className="flex space-x-2">
                    <button className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors text-sm font-medium">
                      <Eye className="w-4 h-4 inline mr-1" />
                      View
                    </button>
                    <button 
                      onClick={() => joinTeam(team._id)}
                      className="px-3 py-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors text-sm font-medium"
                    >
                      <Plus className="w-4 h-4 inline mr-1" />
                      Join
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No Available Teams</h3>
            <p className="text-gray-500">Check back later for new team opportunities or create your own team</p>
          </div>
        )}
      </div>
    </div>
  );

  // Servers Tab Component
  const ServersTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Servers</h1>
          <p className="text-gray-600">View servers you have access to through team membership</p>
        </div>
        <button
          onClick={() => setShowJoinServerModal(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
        >
          <Plus className="w-4 h-4" />
          <span>Join Server</span>
        </button>
      </div>

      {servers.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {servers.map((server) => (
            <div key={server._id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-200">
              <div className="p-6">
                {/* Server Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{server.title}</h3>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                        {server.code}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-2">{server.description}</p>
                  </div>
                </div>

                {/* Faculty Info */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Instructor:</p>
                  <p className="font-medium text-gray-900">
                    {server.faculty?.firstName} {server.faculty?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{server.faculty?.email}</p>
                </div>

                {/* My Teams in This Server */}
                <div className="border-t border-gray-100 pt-4">
                  <button
                    onClick={() => toggleServerExpansion(server._id)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <span className="font-medium text-gray-900">My Teams ({server.studentTeams?.length || 0})</span>
                    {expandedServers.has(server._id) ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>

                  {expandedServers.has(server._id) && (
                    <div className="mt-3 space-y-2">
                      {server.studentTeams && server.studentTeams.length > 0 ? (
                        server.studentTeams.map((team) => (
                          <div key={team.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-lg ${colorUtils.getAvatarColor(team.name)} flex items-center justify-center text-white text-sm font-medium`}>
                                {team.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{team.name}</p>
                                <p className="text-sm text-gray-500">{team.members?.length || 0} members</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          No teams in this server yet
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    Joined {dateUtils.getRelativeTime(server.createdAt)}
                  </div>
                  <button
                    onClick={() => setShowCreateTeamModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Team</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Project Servers</h3>
          <p className="text-gray-500 mb-6">Join a server to access courses and projects</p>
          <button
            onClick={() => setShowJoinServerModal(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Join Your First Server</span>
          </button>
        </div>
      )}
    </div>
  );

  // Calendar Tab Component
  const CalendarTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600">View your upcoming deadlines and events</p>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex space-x-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronDown className="w-4 h-4 rotate-90 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronDown className="w-4 h-4 -rotate-90 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Days */}
        <div className="p-6">
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {generateCalendarDays().map((day, index) => (
              <div
                key={index}
                className={`p-2 h-20 border border-gray-100 rounded-lg ${
                  day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${day.isToday ? 'bg-blue-50 border-blue-200' : ''}`}
              >
                <div className={`text-sm ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'} ${day.isToday ? 'font-bold text-blue-600' : ''}`}>
                  {day.date}
                </div>
                <div className="mt-1 space-y-1">
                  {getEventsForDay(day.fullDate).map((event, eventIndex) => (
                    <div
                      key={eventIndex}
                      className={`text-xs px-2 py-1 rounded truncate ${
                        event.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        event.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        event.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h3>
        </div>
        <div className="p-6">
          {calendarEvents.length > 0 ? (
            <div className="space-y-4">
              {calendarEvents
                .filter(event => new Date(event.dueDate) > new Date())
                .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                .slice(0, 10)
                .map((event) => (
                  <div key={event.id} className="flex items-center space-x-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-3 h-3 rounded-full ${
                      event.priority === 'urgent' ? 'bg-red-500' :
                      event.priority === 'high' ? 'bg-orange-500' :
                      event.priority === 'medium' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}></div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                      <p className="text-sm text-gray-500">
                        Due: {dateUtils.formatDate(event.dueDate, 'datetime')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorUtils.getPriorityColor(event.priority)}`}>
                        {event.priority}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {dateUtils.getTimeRemaining(event.dueDate)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No upcoming deadlines</p>
              <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Analytics Tab Component
  const AnalyticsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Progress Analytics</h1>
          <p className="text-gray-600">Track your academic performance and growth</p>
        </div>
        <button
          onClick={exportPersonalData}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export Data</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Academic Performance */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Academic Performance</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Tasks Completed</span>
                <span className="text-xl font-bold text-gray-900">{personalStats?.completedTasks || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Average Grade</span>
                <span className="text-xl font-bold text-gray-900">{personalStats?.averageGrade || 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">On-Time Submissions</span>
                <span className="text-xl font-bold text-green-600">{personalStats?.onTimeSubmissions || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Completion Rate</span>
                <span className="text-xl font-bold text-blue-600">{personalStats?.completionRate || 0}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Collaboration Stats */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Collaboration Stats</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Teams Joined</span>
                <span className="text-xl font-bold text-gray-900">{teams.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Active Projects</span>
                <span className="text-xl font-bold text-gray-900">{servers.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Pending Tasks</span>
                <span className="text-xl font-bold text-yellow-600">{personalStats?.pendingTasks || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Tasks</span>
                <span className="text-xl font-bold text-purple-600">{personalStats?.totalTasks || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="bg-white rounded-xl shadow-sm border lg:col-span-2">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Task Progress Overview</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="w-8 h-8 text-yellow-600" />
                </div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-xl font-bold text-yellow-600">{personalStats?.pendingTasks || 0}</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-sm text-gray-600">Submitted</p>
                <p className="text-xl font-bold text-blue-600">{personalStats?.completedTasks || 0}</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm text-gray-600">Graded</p>
                <p className="text-xl font-bold text-green-600">
                  {tasks.filter(t => t.status === 'graded').length}
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 bg-purple-100 rounded-full flex items-center justify-center">
                  <Award className="w-8 h-8 text-purple-600" />
                </div>
                <p className="text-sm text-gray-600">Avg Grade</p>
                <p className="text-xl font-bold text-purple-600">{personalStats?.averageGrade || 0}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Profile Tab Component
  const ProfileTab = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center space-x-6 mb-6">
              <div className={`w-20 h-20 rounded-full ${colorUtils.getAvatarColor(user?.firstName || 'User')} flex items-center justify-center text-white text-2xl font-bold`}>
                {(user?.firstName?.[0] || 'U').toUpperCase()}
              </div>
              <div>
                <h4 className="text-xl font-semibold text-gray-900">
                  {user?.firstName} {user?.lastName}
                </h4>
                <p className="text-gray-600">{user?.email}</p>
                <p className="text-sm text-gray-500">Student</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  defaultValue={user?.firstName || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  defaultValue={user?.lastName || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  defaultValue={user?.email || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  rows={3}
                  placeholder="Tell us about yourself..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                ></textarea>
              </div>
            </div>
            
            <div className="mt-6">
              <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Academic Stats</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Tasks</span>
                <span className="font-semibold text-gray-900">{personalStats?.totalTasks || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Completed Tasks</span>
                <span className="font-semibold text-gray-900">{personalStats?.completedTasks || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Average Grade</span>
                <span className="font-semibold text-gray-900">{personalStats?.averageGrade || 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Teams Joined</span>
                <span className="font-semibold text-gray-900">{teams.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Preferences</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Email Notifications</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Assignment Reminders</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Grade Notifications</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Helper functions for calendar
  const generateCalendarDays = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startCalendar = new Date(firstDay);
    startCalendar.setDate(startCalendar.getDate() - firstDay.getDay());
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startCalendar);
      currentDate.setDate(startCalendar.getDate() + i);
      
      days.push({
        date: currentDate.getDate(),
        fullDate: new Date(currentDate),
        isCurrentMonth: currentDate.getMonth() === currentMonth,
        isToday: currentDate.toDateString() === today.toDateString()
      });
    }
    
    return days;
  };

  const getEventsForDay = (date) => {
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.dueDate);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  // Search overlay component
  const SearchOverlay = () => {
    if (!searchResults) return null;

    return (
      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1">
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Search Results</h4>
          
          {searchResults.tasks?.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-medium text-gray-700 mb-2">Tasks</h5>
              {searchResults.tasks.slice(0, 3).map(task => (
                <div key={task.id} className="py-2 hover:bg-gray-50 rounded cursor-pointer">
                  <p className="text-sm text-gray-900">{task.title}</p>
                  <p className="text-xs text-gray-500">{task.description}</p>
                </div>
              ))}
            </div>
          )}

          {searchResults.teams?.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-medium text-gray-700 mb-2">Teams</h5>
              {searchResults.teams.slice(0, 3).map(team => (
                <div key={team.id} className="py-2 hover:bg-gray-50 rounded cursor-pointer">
                  <p className="text-sm text-gray-900">{team.name}</p>
                  <p className="text-xs text-gray-500">{team.description}</p>
                </div>
              ))}
            </div>
          )}

          {(!searchResults.tasks?.length && !searchResults.teams?.length) && (
            <p className="text-sm text-gray-500">No results found</p>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Dashboard</h2>
          <p className="text-gray-500">Please wait while we set up your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PF</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">ProjectFlow</h1>
            </div>

            <div className="flex-1 max-w-lg mx-8 relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search tasks, teams, assignments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <SearchOverlay />
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <Bell className="w-5 h-5" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full ${colorUtils.getAvatarColor(user?.firstName || 'User')} flex items-center justify-center text-white text-sm font-medium`}>
                  {(user?.firstName?.[0] || 'U').toUpperCase()}
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-500">Student</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-1 py-4 border-b-2 text-sm font-medium transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'teams' && <TeamsTab />}
        {activeTab === 'servers' && <ServersTab />}
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      {/* Join Server Modal */}
      {showJoinServerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Join Project Server</h3>
              <button
                onClick={() => setShowJoinServerModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); joinServer(); }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Server Code *
                  </label>
                  <input
                    type="text"
                    value={serverCode}
                    onChange={(e) => setServerCode(e.target.value)}
                    placeholder="Enter 6-digit server code (e.g., ABC123)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    required
                    maxLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Get the server code from your instructor
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowJoinServerModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Join Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Create New Team</h3>
              <button
                onClick={() => setShowCreateTeamModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); createTeam(); }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Name *
                  </label>
                  <input
                    type="text"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Team Alpha, Group 1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Server Code *
                  </label>
                  <input
                    type="text"
                    value={teamForm.projectServerCode}
                    onChange={(e) => setTeamForm(prev => ({ ...prev, projectServerCode: e.target.value }))}
                    placeholder="Enter 6-digit server code"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                    required
                    maxLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Member Emails *
                  </label>
                  <div className="space-y-2">
                    {teamForm.memberEmails.map((email, index) => (
                      <div key={index} className="flex space-x-2">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => updateMemberEmail(index, e.target.value)}
                          placeholder="member@example.com"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required={index === 0}
                        />
                        {teamForm.memberEmails.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMemberEmail(index)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addMemberEmail}
                      className="flex items-center space-x-2 text-purple-600 hover:text-purple-700 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Another Member</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Include yourself and all team members
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(true)}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionStudentDashboard;