// frontend/src/components/Settings/Settings.jsx
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../App';
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Palette,
  Download,
  Trash2,
  Camera,
  Eye,
  EyeOff,
  Save,
  X,
  Check,
  AlertCircle,
  Moon,
  Sun,
  Globe,
  Lock,
  Mail,
  Phone,
  MapPin,
  Calendar
} from 'lucide-react';

function Settings({ user, userRole, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'account', label: 'Account', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'privacy', label: 'Privacy', icon: Lock },
    { id: 'data', label: 'Data & Export', icon: Download }
  ];

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      {/* Message Display */}
      {message.text && (
        <div className={`p-4 rounded-lg flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Sidebar */}
          <div className="w-full lg:w-64 bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-200">
            <nav className="p-4 space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6">
            {activeTab === 'profile' && (
              <ProfileTab 
                user={user} 
                userRole={userRole} 
                onUserUpdate={onUserUpdate}
                showMessage={showMessage}
              />
            )}
            {activeTab === 'account' && (
              <AccountTab 
                user={user} 
                showMessage={showMessage}
                onDeleteAccount={() => setShowDeleteModal(true)}
              />
            )}
            {activeTab === 'notifications' && (
              <NotificationsTab showMessage={showMessage} />
            )}
            {activeTab === 'appearance' && (
              <AppearanceTab showMessage={showMessage} />
            )}
            {activeTab === 'privacy' && (
              <PrivacyTab showMessage={showMessage} />
            )}
            {activeTab === 'data' && (
              <DataExportTab user={user} userRole={userRole} showMessage={showMessage} />
            )}
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          showMessage={showMessage}
        />
      )}
    </div>
  );
}

// Profile Tab Component
function ProfileTab({ user, userRole, onUserUpdate, showMessage }) {
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: '',
    location: '',
    bio: '',
    website: '',
    socialLinks: {
      linkedin: '',
      github: '',
      twitter: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        location: user.location || '',
        bio: user.bio || '',
        website: user.website || '',
        socialLinks: user.socialLinks || { linkedin: '', github: '', twitter: '' }
      }));
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = userRole === 'faculty' ? '/faculty/profile' : '/student/profile';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        if (onUserUpdate && data.user) {
          onUserUpdate(data.user);
        }
        showMessage('success', 'Profile updated successfully!');
      } else {
        showMessage('error', data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      showMessage('error', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showMessage('error', 'Image must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showMessage('error', 'Please select an image file');
      return;
    }

    const formDataImg = new FormData();
    formDataImg.append('profileImage', file);

    try {
      const response = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formDataImg
      });

      if (response.ok) {
        const data = await response.json();
        setProfileImage(data.file?.path || URL.createObjectURL(file));
        showMessage('success', 'Profile image updated successfully!');
      } else {
        showMessage('error', 'Failed to upload image');
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      showMessage('error', 'Failed to upload image');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-800">Profile Information</h3>
        <p className="text-gray-600">Update your personal information and profile details</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Image */}
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center overflow-hidden">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-white" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-200">
              <Camera className="w-4 h-4 text-gray-600" />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <h4 className="font-medium text-gray-800">{formData.firstName} {formData.lastName}</h4>
            <p className="text-sm text-gray-600">{userRole === 'faculty' ? 'Faculty' : 'Student'}</p>
            <p className="text-sm text-gray-500 mt-1">Click the camera icon to update your profile photo</p>
          </div>
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-700 font-medium mb-2">First Name</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Last Name</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Email</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-4" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Phone Number</label>
            <div className="relative">
              <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-4" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-gray-700 font-medium mb-2">Location</label>
            <div className="relative">
              <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-4" />
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                placeholder="City, Country"
              />
            </div>
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">Bio</label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
            rows={4}
            placeholder="Tell us about yourself..."
          />
        </div>

        {/* Website */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">Website</label>
          <div className="relative">
            <Globe className="w-5 h-5 text-gray-400 absolute left-3 top-4" />
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
              placeholder="https://yourwebsite.com"
            />
          </div>
        </div>

        {/* Social Links */}
        <div>
          <label className="block text-gray-700 font-medium mb-4">Social Links</label>
          <div className="space-y-4">
            <input
              type="url"
              value={formData.socialLinks?.linkedin || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                socialLinks: { ...prev.socialLinks, linkedin: e.target.value }
              }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
              placeholder="LinkedIn Profile URL"
            />
            <input
              type="url"
              value={formData.socialLinks?.github || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                socialLinks: { ...prev.socialLinks, github: e.target.value }
              }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
              placeholder="GitHub Profile URL"
            />
            <input
              type="url"
              value={formData.socialLinks?.twitter || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                socialLinks: { ...prev.socialLinks, twitter: e.target.value }
              }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
              placeholder="Twitter Profile URL"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            <span>{loading ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// Account Tab Component
function AccountTab({ user, showMessage, onDeleteAccount }) {
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showMessage('error', 'New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showMessage('error', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        showMessage('success', 'Password changed successfully!');
      } else {
        showMessage('error', data.message || 'Failed to change password');
      }
    } catch (error) {
      console.error('Failed to change password:', error);
      showMessage('error', 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-gray-800">Account Security</h3>
        <p className="text-gray-600">Manage your account security and login credentials</p>
      </div>

      {/* Account Information */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h4 className="font-medium text-gray-800 mb-4">Account Details</h4>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Username:</span>
            <span className="font-medium">{user?.username || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Email:</span>
            <span className="font-medium">{user?.email || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Account Type:</span>
            <span className="font-medium capitalize">{user?.role || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Member Since:</span>
            <span className="font-medium">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div>
        <h4 className="font-medium text-gray-800 mb-4">Change Password</h4>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Current Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-4" />
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                className="absolute right-3 top-4 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">New Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-4" />
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                className="absolute right-3 top-4 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Confirm New Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-4" />
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                className="absolute right-3 top-4 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors duration-200"
          >
            {loading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h4 className="font-medium text-red-800 mb-2">Danger Zone</h4>
        <p className="text-red-600 text-sm mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button
          onClick={onDeleteAccount}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Account</span>
        </button>
      </div>
    </div>
  );
}

// Notifications Tab Component
function NotificationsTab({ showMessage }) {
  const [settings, setSettings] = useState({
    email: {
      taskAssignments: true,
      teamInvitations: true,
      deadlineReminders: true,
      systemUpdates: false,
      marketingEmails: false
    },
    browser: {
      taskAssignments: true,
      messages: true,
      deadlineReminders: true,
      teamActivity: true
    },
    mobile: {
      taskAssignments: true,
      messages: true,
      urgentOnly: false
    }
  });
  const [loading, setLoading] = useState(false);

  const updateSetting = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/settings/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        showMessage('success', 'Notification settings saved successfully!');
      } else {
        showMessage('error', 'Failed to save notification settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      showMessage('error', 'Failed to save notification settings');
    } finally {
      setLoading(false);
    }
  };

  const ToggleSwitch = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
    </label>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-800">Notification Preferences</h3>
        <p className="text-gray-600">Choose how you want to be notified about important events</p>
      </div>

      {/* Email Notifications */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-800 flex items-center space-x-2">
          <Mail className="w-5 h-5" />
          <span>Email Notifications</span>
        </h4>
        
        {Object.entries(settings.email).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between py-2">
            <span className="text-gray-700 capitalize">
              {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </span>
            <ToggleSwitch
              checked={value}
              onChange={(e) => updateSetting('email', key, e.target.checked)}
            />
          </div>
        ))}
      </div>

      {/* Browser Notifications */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-800 flex items-center space-x-2">
          <Bell className="w-5 h-5" />
          <span>Browser Notifications</span>
        </h4>
        
        {Object.entries(settings.browser).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between py-2">
            <span className="text-gray-700 capitalize">
              {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </span>
            <ToggleSwitch
              checked={value}
              onChange={(e) => updateSetting('browser', key, e.target.checked)}
            />
          </div>
        ))}
      </div>

      {/* Mobile Notifications */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-800 flex items-center space-x-2">
          <Phone className="w-5 h-5" />
          <span>Mobile Notifications</span>
        </h4>
        
        {Object.entries(settings.mobile).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between py-2">
            <span className="text-gray-700 capitalize">
              {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </span>
            <ToggleSwitch
              checked={value}
              onChange={(e) => updateSetting('mobile', key, e.target.checked)}
            />
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={saveSettings}
          disabled={loading}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{loading ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>
    </div>
  );
}

// Appearance Tab Component
function AppearanceTab({ showMessage }) {
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(false);

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'auto', label: 'Auto', icon: SettingsIcon }
  ];

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/settings/appearance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme, language, timezone })
      });

      if (response.ok) {
        showMessage('success', 'Appearance settings saved successfully!');
      } else {
        showMessage('error', 'Failed to save appearance settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      showMessage('error', 'Failed to save appearance settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-800">Appearance</h3>
        <p className="text-gray-600">Customize how ProjectFlow looks and feels</p>
      </div>

      {/* Theme Selection */}
      <div>
        <h4 className="font-medium text-gray-800 mb-4">Theme</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {themes.map((themeOption) => (
            <button
              key={themeOption.value}
              onClick={() => setTheme(themeOption.value)}
              className={`p-4 border-2 rounded-xl transition-all duration-200 ${
                theme === themeOption.value
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <themeOption.icon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              <span className="block text-sm font-medium">{themeOption.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div>
        <h4 className="font-medium text-gray-800 mb-2">Language</h4>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
        </select>
      </div>

      {/* Timezone */}
      <div>
        <h4 className="font-medium text-gray-800 mb-2">Timezone</h4>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
        >
          <option value="UTC">UTC</option>
          <option value="America/New_York">Eastern Time</option>
          <option value="America/Chicago">Central Time</option>
          <option value="America/Denver">Mountain Time</option>
          <option value="America/Los_Angeles">Pacific Time</option>
          <option value="Europe/London">London</option>
          <option value="Europe/Paris">Paris</option>
          <option value="Asia/Tokyo">Tokyo</option>
        </select>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={saveSettings}
          disabled={loading}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{loading ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>
    </div>
  );
}

// Privacy Tab Component
function PrivacyTab({ showMessage }) {
  const [settings, setSettings] = useState({
    profileVisibility: 'team',
    showOnlineStatus: true,
    allowDirectMessages: true,
    shareActivity: false,
    dataCollection: false
  });
  const [loading, setLoading] = useState(false);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/settings/privacy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        showMessage('success', 'Privacy settings saved successfully!');
      } else {
        showMessage('error', 'Failed to save privacy settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      showMessage('error', 'Failed to save privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const ToggleSwitch = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
    </label>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-800">Privacy Settings</h3>
        <p className="text-gray-600">Control who can see your information and activity</p>
      </div>

      {/* Profile Visibility */}
      <div>
        <h4 className="font-medium text-gray-800 mb-2">Profile Visibility</h4>
        <select
          value={settings.profileVisibility}
          onChange={(e) => updateSetting('profileVisibility', e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
        >
          <option value="public">Public - Anyone can see your profile</option>
          <option value="team">Team Members - Only team members can see your profile</option>
          <option value="private">Private - Only you can see your profile</option>
        </select>
      </div>

      {/* Privacy Toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-gray-800">Show Online Status</span>
            <p className="text-sm text-gray-600">Let others see when you're online</p>
          </div>
          <ToggleSwitch
            checked={settings.showOnlineStatus}
            onChange={(e) => updateSetting('showOnlineStatus', e.target.checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-gray-800">Allow Direct Messages</span>
            <p className="text-sm text-gray-600">Let others send you direct messages</p>
          </div>
          <ToggleSwitch
            checked={settings.allowDirectMessages}
            onChange={(e) => updateSetting('allowDirectMessages', e.target.checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-gray-800">Share Activity Status</span>
            <p className="text-sm text-gray-600">Share your activity with team members</p>
          </div>
          <ToggleSwitch
            checked={settings.shareActivity}
            onChange={(e) => updateSetting('shareActivity', e.target.checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-gray-800">Analytics Data Collection</span>
            <p className="text-sm text-gray-600">Help improve ProjectFlow by sharing usage data</p>
          </div>
          <ToggleSwitch
            checked={settings.dataCollection}
            onChange={(e) => updateSetting('dataCollection', e.target.checked)}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={saveSettings}
          disabled={loading}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{loading ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>
    </div>
  );
}

// Data Export Tab Component
function DataExportTab({ user, userRole, showMessage }) {
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState('all');

  const exportData = async () => {
    setExporting(true);
    try {
      const response = await fetch(`${API_BASE}/export/user-data?type=${exportType}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `projectflow-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showMessage('success', 'Data exported successfully!');
      } else {
        showMessage('error', 'Failed to export data');
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      showMessage('error', 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-800">Data Export</h3>
        <p className="text-gray-600">Download your data from ProjectFlow</p>
      </div>

      {/* Export Options */}
      <div>
        <h4 className="font-medium text-gray-800 mb-4">What would you like to export?</h4>
        <div className="space-y-3">
          <label className="flex items-start space-x-3">
            <input
              type="radio"
              name="exportType"
              value="all"
              checked={exportType === 'all'}
              onChange={(e) => setExportType(e.target.value)}
              className="mt-1 text-purple-600 focus:ring-purple-500"
            />
            <div>
              <span className="font-medium text-gray-800">All Data</span>
              <p className="text-sm text-gray-600">Your complete ProjectFlow data including profile, teams, tasks, and messages</p>
            </div>
          </label>

          <label className="flex items-start space-x-3">
            <input
              type="radio"
              name="exportType"
              value="profile"
              checked={exportType === 'profile'}
              onChange={(e) => setExportType(e.target.value)}
              className="mt-1 text-purple-600 focus:ring-purple-500"
            />
            <div>
              <span className="font-medium text-gray-800">Profile Data Only</span>
              <p className="text-sm text-gray-600">Your profile information and account details</p>
            </div>
          </label>

          <label className="flex items-start space-x-3">
            <input
              type="radio"
              name="exportType"
              value="activity"
              checked={exportType === 'activity'}
              onChange={(e) => setExportType(e.target.value)}
              className="mt-1 text-purple-600 focus:ring-purple-500"
            />
            <div>
              <span className="font-medium text-gray-800">Activity Data</span>
              <p className="text-sm text-gray-600">Your tasks, submissions, and team activities</p>
            </div>
          </label>
        </div>
      </div>

      {/* Data Summary */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h4 className="font-medium text-gray-800 mb-4">Data Summary</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Profile Created:</span>
            <span className="block font-medium">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Last Login:</span>
            <span className="block font-medium">
              {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Teams Joined:</span>
            <span className="block font-medium">{user?.joinedTeams?.length || 0}</span>
          </div>
          <div>
            <span className="text-gray-600">Projects:</span>
            <span className="block font-medium">{user?.joinedServers?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t border-gray-200 space-y-4 sm:space-y-0">
        <div className="text-sm text-gray-600">
          <p>Your data will be exported in JSON format.</p>
          <p>The download will start automatically when ready.</p>
        </div>
        <button
          onClick={exportData}
          disabled={exporting}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50"
        >
          <Download className="w-5 h-5" />
          <span>{exporting ? 'Exporting...' : 'Export Data'}</span>
        </button>
      </div>
    </div>
  );
}

// Delete Account Modal Component
function DeleteAccountModal({ onClose, showMessage }) {
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      showMessage('error', 'Please type "DELETE" to confirm');
      return;
    }

    if (!password) {
      showMessage('error', 'Please enter your password');
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/auth/delete-account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password, confirmation: confirmText })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        showMessage('success', 'Account deleted successfully. You will be logged out.');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        showMessage('error', data.message || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      showMessage('error', 'Failed to delete account');
    } finally {
      setDeleting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-red-800">Delete Account</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-red-700 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Warning</span>
            </div>
            <p className="text-red-600 text-sm">
              This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
            </p>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Type "DELETE" to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-400"
              placeholder="DELETE"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Enter your password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-400"
              placeholder="Your password"
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || confirmText !== 'DELETE' || !password}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {deleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;