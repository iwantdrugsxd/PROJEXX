import React, { useState, useEffect } from 'react';
import { Upload, File, X, Users, Plus, Check } from 'lucide-react';

const TaskSubmission = ({ task, teamMembers, currentUser, onSubmitted }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [comment, setComment] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const toggleCollaborator = (memberId) => {
    setCollaborators(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to submit');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('comment', comment);
      formData.append('collaborators', JSON.stringify(collaborators));

      const response = await fetch(`${API_BASE}/tasks/${task._id}/submit`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        onSubmitted();
        setSelectedFile(null);
        setComment('');
        setCollaborators([]);
        alert('Task submitted successfully!');
      } else {
        alert(data.message || 'Failed to submit task');
      }
    } catch (error) {
      console.error('Error submitting task:', error);
      alert('Failed to submit task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Submit Your Work *
        </label>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
          {selectedFile ? (
            <div className="flex items-center justify-center space-x-3">
              <File className="w-8 h-8 text-purple-500" />
              <div className="text-left">
                <p className="font-medium text-gray-800">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-red-500 hover:text-red-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <label className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">Click to upload or drag and drop</p>
              <p className="text-sm text-gray-500 mt-1">PDF, DOC, ZIP up to 10MB</p>
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt,.zip,.rar"
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Collaborators */}
      {teamMembers && teamMembers.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Users className="inline w-4 h-4 mr-1" />
            Collaborators (Optional)
          </label>
          <p className="text-sm text-gray-500 mb-3">
            Select team members who helped with this task
          </p>
          <div className="space-y-2">
            {teamMembers.filter(member => member._id !== currentUser?._id).map(member => (
              <label
                key={member._id}
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={collaborators.includes(member._id)}
                  onChange={() => toggleCollaborator(member._id)}
                  className="mr-3"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-800">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{member.email}</p>
                </div>
                {collaborators.includes(member._id) && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Comments (Optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          placeholder="Any notes or comments about your submission..."
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || !selectedFile}
        className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Task'}
      </button>
    </form>
  );
};

export default TaskSubmission;
