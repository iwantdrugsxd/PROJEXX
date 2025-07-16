import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Award, X, Server, Users, AlertCircle, UserPlus, Check, RefreshCw } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000/api';

const TaskCreator = ({ onTaskCreated, currentServerId = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingServers, setLoadingServers] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [debugging, setDebugging] = useState(false);
  
  const [servers, setServers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    serverId: currentServerId || '',
    teamIds: [], // Support multiple teams
    assignmentType: 'teams', // 'teams' or 'individuals'
    dueDate: '',
    maxPoints: 100
  });

  // Load servers when component mounts or modal opens
  useEffect(() => {
    if (isOpen) {
      loadServers();
      if (formData.serverId) {
        loadTeamsForServer(formData.serverId);
      }
    }
  }, [isOpen]);

  // Load teams when server changes
  useEffect(() => {
    if (formData.serverId) {
      loadTeamsForServer(formData.serverId);
      setFormData(prev => ({ ...prev, teamIds: [] }));
    } else {
      setTeams([]);
      setSelectedServer(null);
      setDebugInfo(null);
    }
  }, [formData.serverId]);

  const loadServers = async () => {
    setLoadingServers(true);
    try {
      console.log('🔄 Loading servers...');
      const response = await fetch(`${API_BASE}/projectServers/faculty-servers`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Servers loaded:', data.servers?.length || 0);
        setServers(data.servers || []);
      } else {
        console.error('❌ Failed to load servers:', response.status);
        setServers([]);
      }
    } catch (error) {
      console.error('❌ Failed to load servers:', error);
      setServers([]);
    } finally {
      setLoadingServers(false);
    }
  };

  // Enhanced team loading with multiple strategies
  const loadTeamsForServer = async (serverId) => {
    if (!serverId) return;
    
    setLoadingTeams(true);
    setDebugInfo(null);
    
    try {
      console.log('🔄 Loading teams for server:', serverId);
      
      // Find the server info
      const server = servers.find(s => s._id === serverId);
      setSelectedServer(server);
      
      // Try multiple endpoints to find teams
      let teams = [];
      let strategy = '';
      
      // Strategy 1: Try the enhanced endpoint first
      try {
        const enhancedResponse = await fetch(`${API_BASE}/tasks/enhanced/server/${serverId}/teams`, {
          credentials: 'include'
        });
        
        if (enhancedResponse.ok) {
          const enhancedData = await enhancedResponse.json();
          teams = enhancedData.teams || [];
          strategy = enhancedData.strategy || 'enhanced';
          console.log(`✅ Enhanced strategy found ${teams.length} teams using: ${strategy}`);
        }
      } catch (error) {
        console.log('Enhanced endpoint not available, trying standard endpoints...');
      }
      
      // Strategy 2: Try standard task route
      if (teams.length === 0) {
        try {
          const taskResponse = await fetch(`${API_BASE}/tasks/server/${serverId}/teams`, {
            credentials: 'include'
          });
          
          if (taskResponse.ok) {
            const taskData = await taskResponse.json();
            teams = taskData.teams || [];
            strategy = 'task_route';
            console.log(`✅ Task route found ${teams.length} teams`);
          }
        } catch (error) {
          console.log('Task route failed, trying team route...');
        }
      }
      
      // Strategy 3: Try team route
      if (teams.length === 0) {
        try {
          const teamResponse = await fetch(`${API_BASE}/teamRoutes/server/${serverId}/teams`, {
            credentials: 'include'
          });
          
          if (teamResponse.ok) {
            const teamData = await teamResponse.json();
            teams = teamData.teams || [];
            strategy = 'team_route';
            console.log(`✅ Team route found ${teams.length} teams`);
          }
        } catch (error) {
          console.log('Team route failed, trying faculty teams...');
        }
      }
      
      // Strategy 4: Get all faculty teams and filter
      if (teams.length === 0 && server) {
        try {
          const facultyResponse = await fetch(`${API_BASE}/teamRoutes/faculty-teams`, {
            credentials: 'include'
          });
          
          if (facultyResponse.ok) {
            const facultyData = await facultyResponse.json();
            const allTeams = facultyData.teams || [];
            
            // Filter teams for this server (try multiple matching strategies)
            teams = allTeams.filter(team => 
              team.projectServer === server.code ||
              team.projectServer.toLowerCase() === server.code.toLowerCase() ||
              team.projectServer.trim() === server.code.trim()
            );
            
            strategy = 'faculty_filtered';
            console.log(`✅ Faculty teams filtered: ${teams.length} teams from ${allTeams.length} total`);
          }
        } catch (error) {
          console.log('Faculty teams route failed');
        }
      }
      
      setTeams(teams);
      
      // Set debug info
      setDebugInfo({
        strategy,
        teamsFound: teams.length,
        serverCode: server?.code,
        serverTitle: server?.title
      });
      
      console.log(`✅ Final result: ${teams.length} teams using strategy: ${strategy}`);
      
    } catch (error) {
      console.error('❌ Failed to load teams:', error);
      setTeams([]);
      setDebugInfo({
        strategy: 'error',
        error: error.message,
        teamsFound: 0
      });
    } finally {
      setLoadingTeams(false);
    }
  };

  // Debug function to analyze team-server connection
  const runDebugAnalysis = async () => {
    if (!formData.serverId) return;
    
    setDebugging(true);
    try {
      const response = await fetch(`${API_BASE}/tasks/debug/server/${formData.serverId}/teams-analysis`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Debug analysis:', data);
        setDebugInfo(prev => ({
          ...prev,
          analysis: data.analysis,
          recommendations: data.recommendations
        }));
        alert(`Debug Analysis Complete!\n\nTotal teams in database: ${data.analysis.teams.total}\nExact matches: ${data.analysis.teams.exactMatches}\nStudents in server: ${data.analysis.students.inServer}\n\nCheck console for full details.`);
      }
    } catch (error) {
      console.error('Debug analysis failed:', error);
      alert('Debug analysis failed. Check console for details.');
    } finally {
      setDebugging(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Task title is required');
      return;
    }
    
    if (!formData.description.trim()) {
      alert('Task description is required');
      return;
    }
    
    if (!formData.serverId) {
      alert('Please select a project server');
      return;
    }
    
    if (formData.assignmentType === 'teams' && formData.teamIds.length === 0) {
      alert('Please select at least one team or switch to individual assignments');
      return;
    }
    
    if (!formData.dueDate) {
      alert('Due date is required');
      return;
    }

    if (new Date(formData.dueDate) <= new Date()) {
      alert('Due date must be in the future');
      return;
    }

    setLoading(true);

    try {
      console.log('🔄 Creating task with data:', formData);
      
      // Try enhanced endpoint first, fallback to standard
      let endpoint = `${API_BASE}/tasks/create-enhanced`;
      let requestBody = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        serverId: formData.serverId,
        teamIds: formData.teamIds,
        assignmentType: formData.assignmentType,
        dueDate: formData.dueDate,
        maxPoints: parseInt(formData.maxPoints) || 100
      };

      let response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      // Fallback to standard create if enhanced fails
      if (!response.ok && formData.assignmentType === 'teams' && formData.teamIds.length === 1) {
        console.log('Enhanced endpoint failed, trying standard create...');
        endpoint = `${API_BASE}/tasks/create`;
        requestBody = {
          title: formData.title.trim(),
          description: formData.description.trim(),
          serverId: formData.serverId,
          teamId: formData.teamIds[0], // Single team for standard endpoint
          dueDate: formData.dueDate,
          maxPoints: parseInt(formData.maxPoints) || 100
        };

        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(requestBody)
        });
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Task created successfully:', data.tasks || data.task);
        if (onTaskCreated) {
          onTaskCreated(data.tasks || data.task);
        }
        resetForm();
        const taskCount = Array.isArray(data.tasks) ? data.tasks.length : 1;
        alert(`Task created successfully! ${taskCount} assignment(s) created.`);
      } else {
        console.error('❌ Task creation failed:', data.message);
        alert(data.message || 'Failed to create task');
      }
    } catch (error) {
      console.error('❌ Error creating task:', error);
      alert('Failed to create task. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'teamIds') {
      const teamId = value;
      setFormData(prev => ({
        ...prev,
        teamIds: checked 
          ? [...prev.teamIds, teamId]
          : prev.teamIds.filter(id => id !== teamId)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const selectAllTeams = () => {
    setFormData(prev => ({
      ...prev,
      teamIds: teams.map(team => team._id)
    }));
  };

  const clearAllTeams = () => {
    setFormData(prev => ({
      ...prev,
      teamIds: []
    }));
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      serverId: currentServerId || '',
      teamIds: [],
      assignmentType: 'teams',
      dueDate: '',
      maxPoints: 100
    });
    setIsOpen(false);
    setTeams([]);
    setServers([]);
    setSelectedServer(null);
    setDebugInfo(null);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
      >
        <Plus size={20} />
        <span>Create Task</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Create New Task</h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Task Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter task title"
                />
              </div>

              {/* Project Server Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Server size={16} className="inline mr-1" />
                  Project Server *
                </label>
                <select
                  name="serverId"
                  value={formData.serverId}
                  onChange={handleInputChange}
                  required
                  disabled={loadingServers || currentServerId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">
                    {loadingServers ? 'Loading servers...' : 'Select a project server'}
                  </option>
                  {servers.map((server) => (
                    <option key={server._id} value={server._id}>
                      {server.title} ({server.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Server Info and Debug Section */}
              {selectedServer && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-800">Server: {selectedServer.title}</h3>
                      <p className="text-sm text-gray-600">Code: {selectedServer.code}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => loadTeamsForServer(formData.serverId)}
                        disabled={loadingTeams}
                        className="flex items-center space-x-1 px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={loadingTeams ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                      </button>
                      <button
                        type="button"
                        onClick={runDebugAnalysis}
                        disabled={debugging}
                        className="flex items-center space-x-1 px-3 py-1 text-xs bg-yellow-100 text-yellow-600 rounded hover:bg-yellow-200 transition-colors disabled:opacity-50"
                      >
                        <AlertCircle size={12} />
                        <span>{debugging ? 'Analyzing...' : 'Debug'}</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Teams Status */}
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-600">Teams Found: </span>
                      <span className={`font-medium ${teams.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {teams.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Strategy: </span>
                      <span className="font-medium text-blue-600">
                        {debugInfo?.strategy || 'Loading...'}
                      </span>
                    </div>
                  </div>

                  {/* Assignment Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assignment Type *
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="assignmentType"
                          value="teams"
                          checked={formData.assignmentType === 'teams'}
                          onChange={handleInputChange}
                          disabled={teams.length === 0}
                          className="mr-2"
                        />
                        <span className={teams.length === 0 ? 'text-gray-400' : 'text-gray-700'}>
                          Assign to Teams ({teams.length})
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="assignmentType"
                          value="individuals"
                          checked={formData.assignmentType === 'individuals'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        <span className="text-gray-700">
                          Assign to All Students
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Team Selection - Multi-select */}
              {formData.assignmentType === 'teams' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users size={16} className="inline mr-1" />
                    Select Teams * ({formData.teamIds.length} selected)
                  </label>
                  
                  {loadingTeams ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                        <div>
                          <h4 className="text-blue-800 font-medium">Loading Teams...</h4>
                          <p className="text-blue-700 text-sm">Trying multiple strategies to find teams for this server.</p>
                        </div>
                      </div>
                    </div>
                  ) : teams.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                        <div>
                          <h4 className="text-yellow-800 font-medium">No Teams Found</h4>
                          <p className="text-yellow-700 text-sm mt-1">
                            Students need to create teams first. Share these instructions:
                          </p>
                          <ol className="text-yellow-700 text-sm mt-2 list-decimal list-inside space-y-1">
                            <li>Login to student account</li>
                            <li>Go to "Teams" tab</li>
                            <li>Click "Create Team"</li>
                            <li>Enter team name and member emails</li>
                            <li>Use server code: <strong>{selectedServer?.code}</strong></li>
                          </ol>
                          <div className="mt-3 p-2 bg-yellow-100 rounded">
                            <p className="text-yellow-800 text-xs font-medium">
                              💡 Tip: Try clicking "Debug" button above to analyze why teams aren't showing.
                            </p>
                          </div>
                          <p className="text-yellow-700 text-sm mt-2">
                            Or switch to "Assign to All Students" to create individual assignments.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex space-x-2 mb-3">
                        <button
                          type="button"
                          onClick={selectAllTeams}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={clearAllTeams}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                        >
                          Clear All
                        </button>
                      </div>
                      
                      <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg">
                        {teams.map((team) => (
                          <label
                            key={team._id}
                            className="flex items-center p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              name="teamIds"
                              value={team._id}
                              checked={formData.teamIds.includes(team._id)}
                              onChange={handleInputChange}
                              className="mr-3"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-800">{team.name}</div>
                              <div className="text-sm text-gray-600">
                                {team.members?.length || 0} members
                                {team.projectServer && (
                                  <span className="ml-2 text-xs bg-gray-100 px-1 rounded">
                                    {team.projectServer}
                                  </span>
                                )}
                              </div>
                            </div>
                            {formData.teamIds.includes(team._id) && (
                              <Check className="w-4 h-4 text-green-500" />
                            )}
                          </label>
                        ))}
                      </div>

                      <div className="mt-2 text-xs text-gray-500">
                        Found using: {debugInfo?.strategy || 'standard method'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Individual Assignment Info */}
              {formData.assignmentType === 'individuals' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <UserPlus className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <h4 className="text-blue-800 font-medium">Individual Assignment</h4>
                      <p className="text-blue-700 text-sm mt-1">
                        This task will be assigned to all students in the server individually.
                        Each student will have their own submission.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Task Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Describe the task requirements, objectives, and any specific instructions..."
                />
              </div>

              {/* Due Date and Max Points */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar size={16} className="inline mr-1" />
                    Due Date *
                  </label>
                  <input
                    type="datetime-local"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={handleInputChange}
                    required
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Award size={16} className="inline mr-1" />
                    Max Points
                  </label>
                  <input
                    type="number"
                    name="maxPoints"
                    value={formData.maxPoints}
                    onChange={handleInputChange}
                    min="1"
                    max="1000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.serverId || (formData.assignmentType === 'teams' && formData.teamIds.length === 0)}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>
                      Create Task 
                      {formData.assignmentType === 'teams' && formData.teamIds.length > 0 && 
                        ` (${formData.teamIds.length} teams)`}
                      {formData.assignmentType === 'individuals' && 
                        ` (All Students)`}
                    </span>
                  )}
                </button>
              </div>

              {/* Debug Information Panel */}
              {debugInfo && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs">
                  <p><strong>🔍 Debug Info:</strong></p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <p>Strategy: <span className="font-mono">{debugInfo.strategy}</span></p>
                    <p>Teams Found: <span className="font-mono">{debugInfo.teamsFound}</span></p>
                    <p>Server Code: <span className="font-mono">{debugInfo.serverCode}</span></p>
                    <p>Server Title: <span className="font-mono">{debugInfo.serverTitle}</span></p>
                  </div>
                  
                  {debugInfo.analysis && (
                    <div className="mt-3 p-2 bg-white rounded">
                      <p className="font-medium">Analysis Results:</p>
                      <p>Total teams in DB: {debugInfo.analysis.teams.total}</p>
                      <p>Exact matches: {debugInfo.analysis.teams.exactMatches}</p>
                      <p>Students in server: {debugInfo.analysis.students.inServer}</p>
                      {debugInfo.recommendations && debugInfo.recommendations.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium">Recommendations:</p>
                          <ul className="list-disc list-inside">
                            {debugInfo.recommendations.map((rec, index) => (
                              <li key={index} className="text-xs">{rec.issue}: {rec.solution}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {debugInfo.error && (
                    <p className="text-red-600 mt-2">Error: {debugInfo.error}</p>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskCreator;