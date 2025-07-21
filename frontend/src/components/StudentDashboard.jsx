// Updated StudentDashboard.jsx with enhanced team management
import React, { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, 
  Users, 
  FileText, 
  Calendar, 
  Award, 
  Target, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Plus, 
  Search, 
  Bell, 
  Settings, 
  BarChart3,
  Activity,
  PieChart,
  LineChart,
  Loader2,
  User,
  Upload,
  Download,
  Eye,
  Star,
  ArrowUp,
  ArrowDown,
  Filter,
  RefreshCw,
  Server,
  ChevronRight,
  ChevronLeft,
  Edit,
  Trash2,
  Share2,
  ExternalLink,
  MessageCircle,
  Heart,
  Bookmark,
  Flag,
  MapPin,
  Phone,
  Mail,
  Globe,
  UserPlus,
  Crown,
  Calendar as CalendarIcon
} from 'lucide-react';
import { AuthContext } from '../App';
import TaskSubmission from './TaskManagement/TaskSubmission';
import StudentTaskViewer from './TaskManagement/StudentTaskViewer';
import TeamCreator from './team/TeamCreator';
import JoinServerByCode from './servers/JoinServerByCode';
import { API_BASE } from '../App';

const StudentDashboard = () => {
  const { user, setCurrentView } = React.useContext(AuthContext);
  
  // State Management
  const [activeTab, setActiveTab] = useState('overview');
  const [servers, setServers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskSubmission, setShowTaskSubmission] = useState(false);
  const [showTaskViewer, setShowTaskViewer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');

  // Modal States
  const [showJoinServerModal, setShowJoinServerModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);

  // Team-specific states
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');

  // Calendar specific states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('month');
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  // Analytics specific states
  const [analyticsData, setAnalyticsData] = useState({
    performanceData: [],
    submissionTrends: [],
    gradeDistribution: [],
    taskCompletionRate: 0,
    weeklyProgress: [],
    monthlyStats: {}
  });

  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState({
    totalServers: 0,
    totalTeams: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    averageGrade: 0,
    completionRate: 0,
    onTimeSubmissions: 0,
    totalPoints: 0,
    earnedPoints: 0
  });

  // ✅ AUTHENTICATION GUARD
  useEffect(() => {
    console.log('🔍 Dashboard Auth Check:', {
      hasUser: !!user,
      userRole: user?.role,
      userId: user?.id || user?._id
    });
    
    if (!user || !user.role || user.role !== 'student') {
      console.error('❌ No authenticated student user - redirecting to login');
      setCurrentView('login');
      return;
    }
    
    // Initialize dashboard only if authenticated
    initializeDashboard();
  }, [user, setCurrentView]);

  // Don't render if not authenticated
  if (!user || user.role !== 'student') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-600">Authentication Required</h2>
          <p className="text-gray-600 mt-2">You must log in as a student to access this dashboard</p>
          <button 
            onClick={() => setCurrentView('login')}
            className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ✅ INITIALIZE DASHBOARD
  const initializeDashboard = async () => {
    console.log('🔄 Initializing dashboard for student:', user?.id || user?._id);
    setLoading(true);
    setError('');
    
    try {
      const results = await Promise.allSettled([
        fetchServers(),
        fetchTeams(),
        fetchTasks(),
        fetchAnalytics(),
        fetchNotifications(),
        fetchCalendarData()
      ]);

      results.forEach((result, index) => {
        const names = ['Servers', 'Teams', 'Tasks', 'Analytics', 'Notifications', 'Calendar'];
        if (result.status === 'rejected') {
          console.error(`❌ ${names[index]} failed:`, result.reason);
        } else {
          console.log(`✅ ${names[index]} loaded successfully`);
        }
      });

    } catch (error) {
      console.error('❌ Dashboard initialization failed:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FETCH SERVERS
  const fetchServers = async () => {
    try {
      console.log('📡 Fetching servers...');
      
      const userId = user?.id || user?._id;
      if (!userId) {
        throw new Error('User ID not available');
      }
      
      const response = await fetch(`${API_BASE}/projectServers/student-servers?studentId=${userId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Server response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Network error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('📡 Server data received:', data);
      
      if (data.success) {
        setServers(data.servers || []);
        setDashboardStats(prev => ({ ...prev, totalServers: data.servers?.length || 0 }));
        
        if (!selectedServer && data.servers?.length > 0) {
          setSelectedServer(data.servers[0]);
        }
        
        console.log('✅ Servers loaded successfully:', data.servers?.length || 0);
      } else {
        throw new Error(data.message || 'Failed to fetch servers');
      }
    } catch (error) {
      console.error('❌ Failed to fetch servers:', error.message);
      setServers([]);
      setDashboardStats(prev => ({ ...prev, totalServers: 0 }));
    }
  };

  // ✅ FETCH TEAMS - Enhanced version
  const fetchTeams = async () => {
    try {
      console.log('👥 Fetching teams...');
      
      const userId = user?.id || user?._id;
      if (!userId) {
        throw new Error('User ID not available');
      }
      
      const response = await fetch(`${API_BASE}/teams/student-teams?studentId=${userId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('👥 Teams response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Network error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('👥 Teams data received:', data);
      
      if (data.success) {
        const teamsWithDetails = (data.teams || []).map(team => ({
          ...team,
          memberCount: team.members?.length || 0,
          isLeader: team.leader === (user?.id || user?._id),
          joinedDate: team.joinedAt || team.createdAt,
          serverName: servers.find(server => server._id === team.projectServer)?.title || 'Unknown Server'
        }));
        
        setTeams(teamsWithDetails);
        setDashboardStats(prev => ({ ...prev, totalTeams: teamsWithDetails.length }));
        console.log('✅ Teams loaded successfully:', teamsWithDetails.length);
      } else {
        throw new Error(data.message || 'Failed to fetch teams');
      }
    } catch (error) {
      console.error('❌ Failed to fetch teams:', error.message);
      setTeams([]);
      setDashboardStats(prev => ({ ...prev, totalTeams: 0 }));
    }
  };

  // ✅ FETCH TASKS
  const fetchTasks = async () => {
    try {
      console.log('📝 Fetching tasks...');
      
      const userId = user?.id || user?._id;
      if (!userId) {
        throw new Error('User ID not available');
      }
      
      const response = await fetch(`${API_BASE}/tasks/student-tasks?studentId=${userId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📝 Tasks response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Network error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('📝 Tasks data received:', data);
      
      if (data.success) {
        const taskList = data.tasks || [];
        setTasks(taskList);
        
        // Calculate comprehensive task statistics
        const completed = taskList.filter(task => task.hasSubmission || task.submissionStatus === 'submitted').length;
        const pending = taskList.filter(task => !task.hasSubmission && task.submissionStatus !== 'submitted').length;
        const overdue = taskList.filter(task => {
          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
          const notSubmitted = !task.hasSubmission && task.submissionStatus !== 'submitted';
          return isOverdue && notSubmitted;
        }).length;
        
        // Calculate grade statistics
        const gradedTasks = taskList.filter(task => task.grade !== null && task.grade !== undefined);
        const averageGrade = gradedTasks.length > 0 ? 
          gradedTasks.reduce((sum, task) => sum + (task.grade || 0), 0) / gradedTasks.length : 0;
        
        // Calculate points
        const totalPoints = taskList.reduce((sum, task) => sum + (task.maxPoints || 0), 0);
        const earnedPoints = taskList.reduce((sum, task) => sum + (task.grade || 0), 0);
        
        setDashboardStats(prev => ({
          ...prev,
          totalTasks: taskList.length,
          completedTasks: completed,
          pendingTasks: pending,
          overdueTasks: overdue,
          completionRate: taskList.length > 0 ? Math.round((completed / taskList.length) * 100) : 0,
          averageGrade: Math.round(averageGrade * 100) / 100,
          totalPoints: totalPoints,
          earnedPoints: earnedPoints
        }));
        
        console.log('✅ Tasks loaded successfully:', {
          total: taskList.length,
          completed,
          pending,
          overdue
        });
      } else {
        throw new Error(data.message || 'Failed to fetch tasks');
      }
    } catch (error) {
      console.error('❌ Failed to fetch tasks:', error.message);
      setTasks([]);
      setDashboardStats(prev => ({
        ...prev,
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        completionRate: 0
      }));
    }
  };

  // ✅ FETCH ANALYTICS
  const fetchAnalytics = async () => {
    try {
      console.log('📊 Loading analytics...');
      
      if (tasks.length > 0) {
        const performanceData = tasks.map((task, index) => ({
          name: `Task ${index + 1}`,
          grade: task.grade || 0,
          maxGrade: task.maxPoints || 100,
          date: task.dueDate
        }));

        const submissionTrends = tasks.reduce((acc, task) => {
          const month = task.dueDate ? new Date(task.dueDate).toLocaleString('default', { month: 'short' }) : 'Unknown';
          const existing = acc.find(item => item.month === month);
          if (existing) {
            existing.submitted += task.hasSubmission ? 1 : 0;
            existing.total += 1;
          } else {
            acc.push({
              month: month,
              submitted: task.hasSubmission ? 1 : 0,
              total: 1
            });
          }
          return acc;
        }, []);

        const gradeRanges = [
          { range: '90-100', count: 0 },
          { range: '80-89', count: 0 },
          { range: '70-79', count: 0 },
          { range: '60-69', count: 0 },
          { range: 'Below 60', count: 0 }
        ];

        tasks.forEach(task => {
          if (task.grade !== null && task.grade !== undefined) {
            if (task.grade >= 90) gradeRanges[0].count++;
            else if (task.grade >= 80) gradeRanges[1].count++;
            else if (task.grade >= 70) gradeRanges[2].count++;
            else if (task.grade >= 60) gradeRanges[3].count++;
            else gradeRanges[4].count++;
          }
        });

        const weeklyProgress = generateWeeklyProgress();

        setAnalyticsData({
          performanceData,
          submissionTrends,
          gradeDistribution: gradeRanges,
          taskCompletionRate: dashboardStats.completionRate,
          weeklyProgress,
          monthlyStats: {
            tasksCompleted: dashboardStats.completedTasks,
            averageGrade: dashboardStats.averageGrade,
            onTimeRate: Math.round(((dashboardStats.completedTasks - dashboardStats.overdueTasks) / Math.max(dashboardStats.totalTasks, 1)) * 100)
          }
        });
      }
      
      console.log('✅ Analytics loaded successfully');
    } catch (error) {
      console.error('❌ Failed to fetch analytics:', error);
      setAnalyticsData({
        performanceData: [],
        submissionTrends: [],
        gradeDistribution: [],
        taskCompletionRate: 0,
        weeklyProgress: [],
        monthlyStats: {}
      });
    }
  };

  // ✅ FETCH CALENDAR DATA
  const fetchCalendarData = async () => {
    try {
      console.log('📅 Loading calendar data...');
      
      const events = tasks.map(task => ({
        id: task._id,
        title: task.title,
        date: task.dueDate,
        type: task.hasSubmission ? 'completed' : 'pending',
        description: task.description,
        priority: task.priority || 'medium'
      })).filter(event => event.date);

      setCalendarEvents(events);
      console.log('✅ Calendar data loaded:', events.length, 'events');
    } catch (error) {
      console.error('❌ Failed to fetch calendar data:', error);
      setCalendarEvents([]);
    }
  };

  // ✅ FETCH NOTIFICATIONS
  const fetchNotifications = async () => {
    try {
      console.log('🔔 Loading notifications...');
      
      const taskNotifications = tasks.filter(task => {
        const dueDate = new Date(task.dueDate);
        const now = new Date();
        const daysDiff = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        return daysDiff <= 3 && daysDiff >= 0 && !task.hasSubmission;
      }).map(task => ({
        id: task._id,
        type: 'deadline',
        title: `Task Due Soon: ${task.title}`,
        message: `Due in ${Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24))} days`,
        timestamp: new Date(),
        read: false,
        priority: 'high'
      }));

      setNotifications(taskNotifications);
      console.log('✅ Notifications loaded:', taskNotifications.length);
    } catch (error) {
      console.error('❌ Failed to fetch notifications:', error);
      setNotifications([]);
    }
  };

  // ✅ HELPER FUNCTIONS
  const generateWeeklyProgress = () => {
    const weeks = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7));
      
      const weekTasks = tasks.filter(task => {
        if (!task.submittedAt) return false;
        const submittedDate = new Date(task.submittedAt);
        return submittedDate >= weekStart && submittedDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      });

      weeks.push({
        week: `Week ${7-i}`,
        completed: weekTasks.length,
        target: Math.ceil(dashboardStats.totalTasks / 7)
      });
    }
    
    return weeks;
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // ✅ EVENT HANDLERS
  const handleRefresh = async () => {
    console.log('🔄 Refreshing dashboard...');
    setRefreshing(true);
    await initializeDashboard();
    setRefreshing(false);
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    const hasSubmission = task.hasSubmission || task.submissionStatus === 'submitted';
    
    if (hasSubmission) {
      setShowTaskViewer(true);
    } else {
      setShowTaskSubmission(true);
    }
  };

  const handleTaskSubmitted = () => {
    setShowTaskSubmission(false);
    setSelectedTask(null);
    fetchTasks();
    fetchAnalytics();
    fetchCalendarData();
  };

  // ✅ TEAM EVENT HANDLERS
  const handleTeamCreated = (team) => {
    console.log('✅ Team created successfully:', team);
    setShowCreateTeamModal(false);
    fetchTeams(); // Refresh teams list
  };

  const handleServerJoined = (server) => {
    console.log('✅ Server joined successfully:', server);
    setShowJoinServerModal(false);
    fetchServers(); // Refresh servers list
  };

  // ✅ ENHANCED TEAMS TAB
  const TeamsTab = () => {
    const filteredTeams = teams.filter(team =>
      team.name?.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
      team.description?.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
      team.serverName?.toLowerCase().includes(teamSearchQuery.toLowerCase())
    );

    return (
      <div className="p-6 space-y-6">
        {/* Teams Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Teams</h2>
            <p className="text-gray-600">Collaborate with your classmates on projects</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search teams..."
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>
            
            {/* Create Team Button */}
            <button
              onClick={() => setShowCreateTeamModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Team
            </button>
          </div>
        </div>

        {/* Teams Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Teams</p>
                <p className="text-2xl font-bold text-gray-900">{teams.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Crown className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Teams You Lead</p>
                <p className="text-2xl font-bold text-gray-900">
                  {teams.filter(team => team.isLeader).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <UserPlus className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Members</p>
                <p className="text-2xl font-bold text-gray-900">
                  {teams.reduce((sum, team) => sum + team.memberCount, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Teams Grid */}
        {filteredTeams.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredTeams.map(team => (
              <div
                key={team._id}
                onClick={() => setSelectedTeam(team)}
                className={`bg-white rounded-xl border-2 transition-all cursor-pointer hover:shadow-lg ${
                  selectedTeam?._id === team._id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="p-6">
                  {/* Team Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">{team.name}</h3>
                        {team.isLeader && (
                          <Crown className="w-4 h-4 text-yellow-500" title="You are the leader" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{team.description}</p>
                    </div>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {team.memberCount} members
                    </span>
                  </div>
                  
                  {/* Team Details */}
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <Server className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{team.serverName}</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <CalendarIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span>Joined {new Date(team.joinedDate).toLocaleDateString()}</span>
                    </div>
                    
                    {/* Team Members Preview */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex -space-x-2">
                        {team.members?.slice(0, 4).map((member, index) => (
                          <div
                            key={index}
                            className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center border-2 border-white text-xs font-medium text-white"
                            title={`${member.firstName} ${member.lastName}`}
                          >
                            {member.firstName?.[0]}{member.lastName?.[0]}
                          </div>
                        ))}
                        {team.memberCount > 4 && (
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center border-2 border-white text-xs font-medium text-gray-600">
                            +{team.memberCount - 4}
                          </div>
                        )}
                      </div>
                      
                      {selectedTeam?._id === team._id && (
                        <CheckCircle className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    
                    {/* Team Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        View Details
                      </button>
                      <button className="text-sm text-gray-500 hover:text-gray-700">
                        <MessageCircle className="w-4 h-4" title="Team Chat" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            {teamSearchQuery ? (
              <>
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No teams found</h3>
                <p className="text-gray-500">Try adjusting your search terms</p>
              </>
            ) : (
              <>
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No teams yet</h3>
                <p className="text-gray-500 mb-6">Create or join a team to start collaborating</p>
                <div className="flex items-center justify-center space-x-4">
                  <button
                    onClick={() => setShowCreateTeamModal(true)}
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Team
                  </button>
                  <button
                    onClick={() => setShowJoinServerModal(true)}
                    className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors"
                  >
                    <Server className="w-4 h-4 mr-2" />
                    Join Server
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Selected Team Details */}
        {selectedTeam && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-semibold text-gray-900">{selectedTeam.name}</h3>
                    {selectedTeam.isLeader && (
                      <Crown className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  <p className="text-gray-600">{selectedTeam.description}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTeam(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Team Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Server:</span>
                    <span className="font-medium">{selectedTeam.serverName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Members:</span>
                    <span className="font-medium">{selectedTeam.memberCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span className="font-medium">
                      {new Date(selectedTeam.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Your Role:</span>
                    <span className="font-medium">
                      {selectedTeam.isLeader ? 'Leader' : 'Member'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Team Members</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedTeam.members?.map((member, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                        {member.firstName?.[0]}{member.lastName?.[0]}
                      </div>
                      <span className="text-sm text-gray-900">
                        {member.firstName} {member.lastName}
                        {member._id === selectedTeam.leader && (
                          <Crown className="w-3 h-3 text-yellow-500 inline ml-1" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ✅ HEADER COMPONENT
  const DashboardHeader = () => (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName || user?.username}! 👋
          </h1>
          <p className="text-gray-600 mt-1">
            Track your progress and manage your assignments
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Notifications */}
          <div className="relative">
            <button className="p-2 text-gray-400 hover:text-gray-600 relative">
              <Bell className="w-5 h-5" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Error Alert */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 font-medium">Error Loading Data</span>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );

  // ✅ NAVIGATION TABS
  const NavigationTabs = () => (
    <div className="bg-white border-b border-gray-200">
      <nav className="px-6">
        <div className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Target },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'tasks', label: 'Tasks', icon: FileText },
            { id: 'teams', label: 'Teams', icon: Users },
            { id: 'servers', label: 'Servers', icon: Server },
            { id: 'calendar', label: 'Calendar', icon: Calendar },
            { id: 'profile', label: 'Profile', icon: User }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.id === 'teams' && teams.length > 0 && (
                    <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                      {teams.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );

  // ✅ OVERVIEW TAB (keeping existing implementation with minor updates)
  const OverviewTab = () => (
    <div className="p-6 space-y-6">
      {/* Enhanced Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Project Servers</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalServers}</p>
              <p className="text-xs text-green-600 mt-1">Active projects</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Server className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Teams</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalTeams}</p>
              <p className="text-xs text-blue-600 mt-1">Active collaborations</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalTasks}</p>
              <p className="text-xs text-orange-600 mt-1">Assignments</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.completedTasks}</p>
              <p className="text-xs text-green-600 mt-1">{dashboardStats.completionRate}% complete</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Tasks</h3>
              <button 
                onClick={() => setActiveTab('tasks')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View All
              </button>
            </div>
          </div>
          <div className="p-6">
            {tasks.length > 0 ? (
              <div className="space-y-4">
                {tasks.slice(0, 5).map(task => {
                  const hasSubmission = task.hasSubmission || task.submissionStatus === 'submitted';
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !hasSubmission;
                  
                  return (
                    <div 
                      key={task._id}
                      onClick={() => handleTaskClick(task)}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          hasSubmission ? 'bg-green-500' : isOverdue ? 'bg-red-500' : 'bg-yellow-500'
                        }`}></div>
                        <div>
                          <p className="font-medium text-gray-900">{task.title}</p>
                          <p className="text-sm text-gray-500">
                            {task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}
                          </p>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        hasSubmission ? 'bg-green-100 text-green-800' :
                        isOverdue ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {hasSubmission ? 'Submitted' : isOverdue ? 'Overdue' : 'Pending'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No tasks available</p>
              </div>
            )}
          </div>
        </div>

        {/* Performance Overview */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Performance Overview</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Completion Rate</span>
              <span className="font-semibold text-gray-900">{dashboardStats.completionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${dashboardStats.completionRate}%` }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Average Grade</span>
              <span className="font-semibold text-gray-900">{dashboardStats.averageGrade}%</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">On-Time Submissions</span>
              <span className="font-semibold text-gray-900">{dashboardStats.onTimeSubmissions}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Points Earned</span>
              <span className="font-semibold text-gray-900">{dashboardStats.earnedPoints}/{dashboardStats.totalPoints}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">View Analytics</h3>
              <p className="text-blue-100 text-sm">Track your progress and performance</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-200" />
          </div>
          <button 
            onClick={() => setActiveTab('analytics')}
            className="mt-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            View Analytics
          </button>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">Calendar</h3>
              <p className="text-green-100 text-sm">Check upcoming deadlines</p>
            </div>
            <Calendar className="w-8 h-8 text-green-200" />
          </div>
          <button 
            onClick={() => setActiveTab('calendar')}
            className="mt-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            View Calendar
          </button>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">Teams</h3>
              <p className="text-purple-100 text-sm">Collaborate with classmates</p>
            </div>
            <Users className="w-8 h-8 text-purple-200" />
          </div>
          <button 
            onClick={() => setActiveTab('teams')}
            className="mt-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            View Teams
          </button>
        </div>
      </div>
    </div>
  );

  // ✅ TASKS TAB (keeping existing implementation)
  const TasksTab = () => {
    const filteredTasks = tasks.filter(task => {
      const matchesSearch = task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           task.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (filterStatus === 'all') return matchesSearch;
      
      const hasSubmission = task.hasSubmission || task.submissionStatus === 'submitted';
      if (filterStatus === 'completed') return matchesSearch && hasSubmission;
      if (filterStatus === 'pending') return matchesSearch && !hasSubmission;
      
      return matchesSearch;
    });

    return (
      <div className="p-6 space-y-6">
        {/* Task Filters */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Your Tasks</h2>
            <p className="text-gray-600">Manage your assignments and submissions</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Tasks</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Tasks Grid */}
        {filteredTasks.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredTasks.map(task => {
              const hasSubmission = task.hasSubmission || task.submissionStatus === 'submitted';
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !hasSubmission;
              
              return (
                <div
                  key={task._id}
                  onClick={() => handleTaskClick(task)}
                  className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-2">{task.title}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        task.priority === 'high' ? 'bg-red-100 text-red-800' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority || 'Medium'}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Due Date:</span>
                        <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Max Points:</span>
                        <span className="font-medium text-gray-900">{task.maxPoints || 'N/A'}</span>
                      </div>
                      
                      {task.grade !== null && task.grade !== undefined && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Your Grade:</span>
                          <span className="font-medium text-green-600">
                            {task.grade}/{task.maxPoints}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          hasSubmission ? 'bg-green-100 text-green-800' :
                          isOverdue ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {hasSubmission ? 'Submitted' : isOverdue ? 'Overdue' : 'Pending'}
                        </span>
                        
                        <div className="flex items-center space-x-2">
                          {task.allowFileUpload && (
                            <Upload className="w-4 h-4 text-gray-400" />
                          )}
                          <Clock className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No tasks found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try adjusting your search criteria' : 'No tasks available at the moment'}
            </p>
          </div>
        )}
      </div>
    );
  };

  // ✅ SERVERS TAB (keeping existing implementation with join button)
  const ServersTab = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Project Servers</h2>
          <p className="text-gray-600">Access your course servers and projects</p>
        </div>
        <button
          onClick={() => setShowJoinServerModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Join Server
        </button>
      </div>

      {servers.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {servers.map(server => (
            <div 
              key={server._id} 
              onClick={() => setSelectedServer(server)}
              className={`bg-white rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                selectedServer?._id === server._id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{server.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{server.description}</p>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                    Active
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    {server.studentCount || 0} students enrolled
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-600">
                    <FileText className="w-4 h-4 mr-2" />
                    Code: {server.code}
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-gray-500">
                      Joined {new Date(server.joinedAt || server.createdAt).toLocaleDateString()}
                    </span>
                    {selectedServer?._id === server._id && (
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No servers joined</h3>
          <p className="text-gray-500 mb-6">Join a server to access courses and assignments</p>
          <button
            onClick={() => setShowJoinServerModal(true)}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Join Your First Server
          </button>
        </div>
      )}
    </div>
  );

  // ✅ LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your dashboard...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
        </div>
      </div>
    );
  }

  // ✅ MAIN RENDER
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <NavigationTabs />
      
      <main className="max-w-7xl mx-auto">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'analytics' && <div className="p-6"><p className="text-gray-500">Analytics component would go here...</p></div>}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'teams' && <TeamsTab />}
        {activeTab === 'servers' && <ServersTab />}
        {activeTab === 'calendar' && <div className="p-6"><p className="text-gray-500">Calendar component would go here...</p></div>}
        {activeTab === 'profile' && <div className="p-6"><p className="text-gray-500">Profile component would go here...</p></div>}
      </main>

      {/* Modals */}
      {showTaskSubmission && selectedTask && (
        <TaskSubmission
          task={selectedTask}
          onClose={() => {
            setShowTaskSubmission(false);
            setSelectedTask(null);
          }}
          onSubmitted={handleTaskSubmitted}
        />
      )}

      {showTaskViewer && selectedTask && (
        <StudentTaskViewer
          task={selectedTask}
          onClose={() => {
            setShowTaskViewer(false);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Team Creation Modal */}
      {showCreateTeamModal && (
        <TeamCreator
          user={user}
          onTeamCreated={handleTeamCreated}
          onClose={() => setShowCreateTeamModal(false)}
        />
      )}

      {/* Join Server Modal */}
      {showJoinServerModal && (
        <JoinServerByCode
          user={user}
          onServerJoined={handleServerJoined}
          onClose={() => setShowJoinServerModal(false)}
        />
      )}

      {/* Quick Action Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 flex items-center justify-center disabled:opacity-50"
          title="Refresh Dashboard"
        >
          <RefreshCw className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};

export default StudentDashboard;