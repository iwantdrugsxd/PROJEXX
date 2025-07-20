import React, { useState } from 'react';
import { UserPlus, Users, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const JoinTeamButton = ({ team, onTeamJoined, disabled }) => {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  const handleJoinTeam = async () => {
    if (!team?._id) {
      setError('Team ID is missing');
      return;
    }

    setJoining(true);
    setError('');
    setSuccess(false);

    try {
      console.log('🚀 Attempting to join team:', team._id);

      const response = await fetch(`${API_BASE}/teams/join/${team._id}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const data = await response.json();
      console.log('📡 Join team response:', data);

      if (response.ok && data.success) {
        console.log('✅ Successfully joined team');
        setSuccess(true);
        onTeamJoined?.(data.team);
        
        // Clear success message after 2 seconds
        setTimeout(() => setSuccess(false), 2000);
      } else {
        // Handle specific error cases
        if (response.status === 400) {
          setError(data.message || 'Cannot join team - you may already be a member or team is full');
        } else if (response.status === 401) {
          setError('Please log in to join a team');
        } else if (response.status === 403) {
          setError('Only students can join teams');
        } else if (response.status === 404) {
          setError('Team not found');
        } else {
          setError(data.message || 'Failed to join team');
        }
      }
    } catch (error) {
      console.error('❌ Join team error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setJoining(false);
    }
  };

  if (success) {
    return (
      <button className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-md">
        <CheckCircle className="h-4 w-4 mr-1" />
        Joined!
      </button>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={handleJoinTeam}
        disabled={disabled || joining}
        className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {joining ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            Joining...
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-1" />
            Join Team
          </>
        )}
      </button>
      
      {error && (
        <div className="mt-1 text-xs text-red-600 flex items-center">
          <AlertCircle className="h-3 w-3 mr-1" />
          {error}
        </div>
      )}
    </div>
  );
};
export default JoinTeamButton