import React, { useState } from 'react';
import { Upload, File, X } from 'lucide-react';

const TaskSubmission = ({ taskId, onSubmitted }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [comment, setComment] = useState('');

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
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

      const response = await fetch(`/api/tasks/${taskId}/submit`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        onSubmitted();
        setSelectedFile(null);
        setComment('');
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Submit Your Work
        </label>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
          {selectedFile ? (
            <div className="flex items-center justify-center space-x-2">
              <File className="w-5 h-5 text-green-600" />
              <span className="text-gray-700">{selectedFile.name}</span>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="p-1 text-red-500 hover:bg-red-50 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div>
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 mb-2">Choose a file to upload</p>
              <input
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                id={`file-upload-${taskId}`}
                accept=".pdf,.docx,.doc,.txt,.zip,.rar,.jpg,.jpeg,.png"
                disabled={isSubmitting}
              />
              <label
                htmlFor={`file-upload-${taskId}`}
                className="inline-block px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 cursor-pointer transition-colors"
              >
                Select File
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Supported: PDF, DOC, DOCX, TXT, ZIP, RAR, JPG, PNG (Max: 10MB)
              </p>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Comments (Optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          rows="3"
          placeholder="Add any comments about your submission..."
          disabled={isSubmitting}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !selectedFile}
        className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Task'}
      </button>
    </form>
  );
};

export default TaskSubmission;