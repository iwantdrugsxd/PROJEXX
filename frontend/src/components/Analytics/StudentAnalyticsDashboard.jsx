// frontend/src/components/Analytics/StudentAnalyticsDashboard.jsx - CORRECTED VERSION
import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Target,
  Award,
  Clock,
  CheckCircle,
  Calendar,
  Users,
  FileText,
  PieChart,
  LineChart,
  Activity,
  Star,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Download,
  Filter,
  Eye,
  AlertCircle
} from 'lucide-react';

const StudentAnalyticsDashboard = ({ analytics, tasks, teams, onRefresh }) => {
  const [timeRange, setTimeRange] = useState('month');
  const [selectedMetric, setSelectedMetric] = useState('grades');
  const [chartData, setChartData] = useState({});

  useEffect(() => {
    if (analytics && tasks) {
      generateChartData();
    }
  }, [analytics, tasks, timeRange]);

  const generateChartData = () => {
    // Process data for charts based on timeRange
    const now = new Date();
    const timeRanges = {
      week: 7,
      month: 30,
      semester: 120,
      year: 365
    };

    const daysBack = timeRanges[timeRange] || 30;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Filter tasks and submissions within time range
    const recentTasks = tasks.filter(task => 
      new Date(task.createdAt) >= startDate
    );

    const recentSubmissions = tasks
      .flatMap(task => task.submissions || [])
      .filter(sub => sub.student === analytics.currentStudentId && new Date(sub.submittedAt) >= startDate);

    // Generate grade trend data
    const gradeTrend = generateGradeTrend(recentSubmissions);
    
    // Generate submission timeline
    const submissionTimeline = generateSubmissionTimeline(recentSubmissions);
    
    // Generate performance distribution
    const performanceDistribution = generatePerformanceDistribution();

    setChartData({
      gradeTrend,
      submissionTimeline,
      performanceDistribution
    });
  };

  const generateGradeTrend = (submissions) => {
    const gradeData = submissions
      .filter(sub => sub.grade !== undefined)
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
      .map(sub => ({
        date: new Date(sub.submittedAt).toLocaleDateString(),
        grade: sub.grade,
        maxPoints: sub.maxPoints || 100
      }));

    return gradeData;
  };

  const generateSubmissionTimeline = (submissions) => {
    const timeline = {};
    
    submissions.forEach(sub => {
      const date = new Date(sub.submittedAt).toDateString();
      if (!timeline[date]) {
        timeline[date] = 0;
      }
      timeline[date]++;
    });

    return Object.entries(timeline).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString(),
      submissions: count
    }));
  };

  const generatePerformanceDistribution = () => {
    if (!analytics.gradeDistribution) return [];

    return [
      { grade: 'A (90-100)', count: analytics.gradeDistribution.A || 0, color: '#10B981' },
      { grade: 'B (80-89)', count: analytics.gradeDistribution.B || 0, color: '#3B82F6' },
      { grade: 'C (70-79)', count: analytics.gradeDistribution.C || 0, color: '#F59E0B' },
      { grade: 'D (60-69)', count: analytics.gradeDistribution.D || 0, color: '#EF4444' },
      { grade: 'F (0-59)', count: analytics.gradeDistribution.F || 0, color: '#6B7280' }
    ];
  };

  // Performance Insights
  const getPerformanceInsights = () => {
    const insights = [];
    
    if (analytics.averageGrade >= 90) {
      insights.push({
        type: 'positive',
        title: 'Excellent Performance',
        description: 'You\'re maintaining outstanding grades! Keep up the great work.',
        icon: Star,
        color: 'text-green-600 bg-green-100'
      });
    } else if (analytics.averageGrade >= 80) {
      insights.push({
        type: 'positive',
        title: 'Good Performance',
        description: 'You\'re doing well! Consider reviewing areas where you can improve.',
        icon: TrendingUp,
        color: 'text-blue-600 bg-blue-100'
      });
    } else if (analytics.averageGrade >= 70) {
      insights.push({
        type: 'warning',
        title: 'Room for Improvement',
        description: 'Focus on understanding course materials better and seek help when needed.',
        icon: Target,
        color: 'text-yellow-600 bg-yellow-100'
      });
    } else {
      insights.push({
        type: 'alert',
        title: 'Needs Attention',
        description: 'Consider meeting with instructors and utilizing study resources.',
        icon: AlertCircle,
        color: 'text-red-600 bg-red-100'
      });
    }

    if (analytics.onTimeRate >= 90) {
      insights.push({
        type: 'positive',
        title: 'Excellent Time Management',
        description: 'You consistently submit assignments on time!',
        icon: Clock,
        color: 'text-green-600 bg-green-100'
      });
    } else if (analytics.onTimeRate < 70) {
      insights.push({
        type: 'warning',
        title: 'Time Management Focus',
        description: 'Try setting earlier personal deadlines to avoid late submissions.',
        icon: Calendar,
        color: 'text-orange-600 bg-orange-100'
      });
    }

    if (analytics.completionRate >= 95) {
      insights.push({
        type: 'positive',
        title: 'Outstanding Completion Rate',
        description: 'You\'re completing almost all assignments!',
        icon: CheckCircle,
        color: 'text-green-600 bg-green-100'
      });
    }

    return insights;
  };

  // Metric Cards Component
  const MetricCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Average Grade</p>
            <p className="text-3xl font-bold text-gray-900">{analytics.averageGrade || 0}%</p>
            <div className="flex items-center mt-2">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">+2.5% from last month</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Award className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Completion Rate</p>
            <p className="text-3xl font-bold text-gray-900">{analytics.completionRate || 0}%</p>
            <div className="flex items-center mt-2">
              <ArrowUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">On track</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">On-Time Submissions</p>
            <p className="text-3xl font-bold text-gray-900">{analytics.onTimeSubmissions || 0}</p>
            <div className="flex items-center mt-2">
              <Clock className="w-4 h-4 text-blue-500 mr-1" />
              <span className="text-sm text-blue-600">{analytics.onTimeRate || 0}% on time</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Teams</p>
            <p className="text-3xl font-bold text-gray-900">{analytics.teamsCount || 0}</p>
            <div className="flex items-center mt-2">
              <Users className="w-4 h-4 text-orange-500 mr-1" />
              <span className="text-sm text-orange-600">Collaborative projects</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-orange-600" />
          </div>
        </div>
      </div>
    </div>
  );

  // Grade Distribution Chart
  const GradeDistributionChart = () => {
    const data = generatePerformanceDistribution();
    const total = data.reduce((sum, item) => sum + item.count, 0);

    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Grade Distribution</h3>
          <PieChart className="w-5 h-5 text-gray-400" />
        </div>
        
        {total > 0 ? (
          <div className="space-y-4">
            {data.map((item, index) => {
              const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-sm font-medium text-gray-700">{item.grade}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: item.color 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">
                      {item.count} ({percentage}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No graded assignments yet</p>
          </div>
        )}
      </div>
    );
  };

  // Performance Timeline
  const PerformanceTimeline = () => (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Performance Timeline</h3>
        <LineChart className="w-5 h-5 text-gray-400" />
      </div>
      
      {chartData.gradeTrend?.length > 0 ? (
        <div className="space-y-4">
          <div className="h-64 flex items-end justify-between space-x-2">
            {chartData.gradeTrend.slice(-10).map((point, index) => {
              const height = (point.grade / (point.maxPoints || 100)) * 100;
              return (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div className="w-full bg-gray-200 rounded-t relative" style={{ height: '200px' }}>
                    <div 
                      className="w-full bg-blue-500 rounded-t absolute bottom-0 transition-all duration-300"
                      style={{ height: `${height}%` }}
                      title={`${point.grade}/${point.maxPoints || 100} (${Math.round(height)}%)`}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-left">
                    {point.date}
                  </span>
                </div>
              );
            })}
          </div>
          
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Recent Performance</span>
            <span>Trend: {chartData.gradeTrend.length > 1 ? 'Improving' : 'Getting Started'}</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <LineChart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Complete assignments to see performance trends</p>
        </div>
      )}
    </div>
  );

  // Team Performance Breakdown
  const TeamPerformanceBreakdown = () => (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Team Performance</h3>
        <Users className="w-5 h-5 text-gray-400" />
      </div>
      
      {analytics.teamBreakdown?.length > 0 ? (
        <div className="space-y-4">
          {analytics.teamBreakdown.map((team, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{team.teamName}</h4>
                <span className="text-sm text-gray-500">{team.membersCount} members</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Server: {team.serverCode}</span>
                <span className="text-gray-600">
                  Joined: {new Date(team.joinedAt).toLocaleDateString()}
                </span>
              </div>
              
              <div className="mt-3 flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">Active</span>
                </div>
                <div className="flex items-center space-x-1">
                  <FileText className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-600">Team projects available</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Join teams to see collaborative performance</p>
        </div>
      )}
    </div>
  );

  // Performance Insights
  const PerformanceInsights = () => {
    const insights = getPerformanceInsights();
    
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Performance Insights</h3>
          <Activity className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="space-y-4">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <div key={index} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${insight.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">{insight.title}</h4>
                  <p className="text-sm text-gray-600">{insight.description}</p>
                </div>
              </div>
            );
          })}
          
          {insights.length === 0 && (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Complete more assignments to get personalized insights</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Upcoming Deadlines Widget
  const UpcomingDeadlines = () => {
    const upcomingTasks = tasks
      .filter(task => {
        const hasSubmission = task.submissions?.some(sub => sub.student === analytics.currentStudentId);
        return !hasSubmission && new Date(task.dueDate) > new Date();
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5);

    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h3>
          <Calendar className="w-5 h-5 text-gray-400" />
        </div>
        
        {upcomingTasks.length > 0 ? (
          <div className="space-y-3">
            {upcomingTasks.map(task => {
              const dueDate = new Date(task.dueDate);
              const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
              const isUrgent = daysLeft <= 2;
              
              return (
                <div key={task._id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${isUrgent ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                    <div>
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <p className="text-sm text-gray-500">
                        {daysLeft === 0 ? 'Due today' : 
                         daysLeft === 1 ? 'Due tomorrow' : 
                         `${daysLeft} days left`}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    isUrgent ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {task.priority || 'Medium'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
            <p className="text-green-600 font-medium">All caught up!</p>
            <p className="text-sm text-gray-500">No upcoming deadlines</p>
          </div>
        )}
      </div>
    );
  };

  // Study Habits Analysis
  const StudyHabitsAnalysis = () => {
    const submissionTimes = tasks
      .flatMap(task => task.submissions || [])
      .filter(sub => sub.student === analytics.currentStudentId)
      .map(sub => new Date(sub.submittedAt).getHours());

    const timeDistribution = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      submissions: submissionTimes.filter(h => h === hour).length
    }));

    const peakHours = timeDistribution
      .filter(t => t.submissions > 0)
      .sort((a, b) => b.submissions - a.submissions)
      .slice(0, 3);

    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Study Habits</h3>
          <Clock className="w-5 h-5 text-gray-400" />
        </div>
        
        {peakHours.length > 0 ? (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Most Active Hours</h4>
              <div className="space-y-2">
                {peakHours.map((time, index) => (
                  <div key={time.hour} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {time.hour === 0 ? '12 AM' : 
                       time.hour === 12 ? '12 PM' :
                       time.hour > 12 ? `${time.hour - 12} PM` : `${time.hour} AM`}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${(time.submissions / Math.max(...peakHours.map(p => p.submissions))) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500 w-8">{time.submissions}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Productivity Insights</h4>
              <div className="space-y-2 text-sm text-gray-600">
                {peakHours[0].hour >= 6 && peakHours[0].hour <= 11 && (
                  <p>📅 You're most productive in the morning hours</p>
                )}
                {peakHours[0].hour >= 12 && peakHours[0].hour <= 17 && (
                  <p>☀️ You prefer working during afternoon hours</p>
                )}
                {peakHours[0].hour >= 18 && peakHours[0].hour <= 23 && (
                  <p>🌙 You tend to work during evening hours</p>
                )}
                {peakHours[0].hour >= 0 && peakHours[0].hour <= 5 && (
                  <p>🦉 You're a night owl - consider planning ahead to avoid late submissions</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">Submit assignments to analyze your study patterns</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Track your academic progress and performance insights</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="semester">This Semester</option>
            <option value="year">This Year</option>
          </select>
          
          <button
            onClick={onRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <MetricCards />

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Timeline */}
        <div className="lg:col-span-1">
          <PerformanceTimeline />
        </div>

        {/* Grade Distribution */}
        <div className="lg:col-span-1">
          <GradeDistributionChart />
        </div>

        {/* Performance Insights */}
        <div className="lg:col-span-1">
          <PerformanceInsights />
        </div>

        {/* Upcoming Deadlines */}
        <div className="lg:col-span-1">
          <UpcomingDeadlines />
        </div>

        {/* Team Performance */}
        <div className="lg:col-span-1">
          <TeamPerformanceBreakdown />
        </div>

        {/* Study Habits */}
        <div className="lg:col-span-1">
          <StudyHabitsAnalysis />
        </div>
      </div>

      {/* Additional Insights Section */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">Performance Trend</h4>
            <p className="text-sm text-gray-600">
              {analytics.averageGrade >= 85 ? 'Excellent trajectory' : 
               analytics.averageGrade >= 75 ? 'Good progress' : 
               'Focus on improvement'}
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Target className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">Goal Achievement</h4>
            <p className="text-sm text-gray-600">
              {analytics.completionRate >= 90 ? 'Exceeding expectations' :
               analytics.completionRate >= 80 ? 'Meeting goals' :
               'Room for improvement'}
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Award className="w-8 h-8 text-purple-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">Recognition</h4>
            <p className="text-sm text-gray-600">
              {analytics.onTimeRate >= 95 ? 'Punctuality master' :
               analytics.onTimeRate >= 80 ? 'Reliable submitter' :
               'Time management focus'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAnalyticsDashboard;