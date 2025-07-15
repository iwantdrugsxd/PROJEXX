import React from 'react';
import { BookOpen } from 'lucide-react';

function TaskList({ userRole, userId }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Tasks</h2>
        <p className="text-gray-600">
          {userRole === 'faculty' 
            ? 'Manage and track student assignments'
            : 'View and complete your assignments'
          }
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Task System Active</h3>
          <p className="text-gray-500">Full task management system will be implemented next</p>
          <p className="text-sm text-gray-400 mt-2">User: {userRole} | ID: {userId}</p>
        </div>
      </div>
    </div>
  );
}

export default TaskList;