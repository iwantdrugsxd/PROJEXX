import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import TaskCreator from './TaskManagement/TaskCreator';

const QuickTaskCreator = ({ onTaskCreated, className = "" }) => {
  const [showModal, setShowModal] = useState(false);

  const handleTaskCreated = (task) => {
    setShowModal(false);
    if (onTaskCreated) {
      onTaskCreated(task);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl ${className}`}
      >
        <Plus className="w-4 h-4" />
        <span>Create Task</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Create New Task</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <TaskCreator 
              onTaskCreated={handleTaskCreated}
              isModal={true}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default QuickTaskCreator;