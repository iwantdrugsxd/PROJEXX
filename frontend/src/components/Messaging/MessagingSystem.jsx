// frontend/src/components/Messaging/MessagingSystem.jsx
import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../App';
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  Users,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Hash,
  User,
  X,
  Check,
  CheckCheck,
  Clock
} from 'lucide-react';
import io from 'socket.io-client';

function MessagingSystem({ userRole, userId, user }) {
  const [selectedChat, setSelectedChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typing, setTyping] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [socket, setSocket] = useState(null);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(API_BASE, {
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      newSocket.emit('join', { userId, userRole });
    });

    newSocket.on('newMessage', (message) => {
      if (selectedChat && message.chatId === selectedChat._id) {
        setMessages(prev => [...prev, message]);
      }
      updateChatLastMessage(message);
    });

    newSocket.on('messageRead', ({ messageId, readBy }) => {
      setMessages(prev => prev.map(msg => 
        msg._id === messageId 
          ? { ...msg, readBy: [...(msg.readBy || []), readBy] }
          : msg
      ));
    });

    newSocket.on('userTyping', ({ userId: typingUserId, chatId, isTyping, userName }) => {
      if (selectedChat && chatId === selectedChat._id) {
        setTyping(prev => ({
          ...prev,
          [typingUserId]: isTyping ? userName : undefined
        }));
      }
    });

    newSocket.on('onlineUsers', (users) => {
      setOnlineUsers(users);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userId, userRole, selectedChat]);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat._id);
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChats = async () => {
    try {
      const response = await fetch(`${API_BASE}/messaging/chats`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setChats(data.chats || []);
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId) => {
    try {
      const response = await fetch(`${API_BASE}/messaging/chats/${chatId}/messages`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        
        // Mark messages as read
        if (data.messages.length > 0) {
          await fetch(`${API_BASE}/messaging/chats/${chatId}/read`, {
            method: 'POST',
            credentials: 'include'
          });
        }
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    const messageData = {
      chatId: selectedChat._id,
      content: newMessage.trim(),
      type: 'text'
    };

    try {
      const response = await fetch(`${API_BASE}/messaging/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(messageData)
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data.message]);
        setNewMessage('');
        updateChatLastMessage(data.message);
        
        // Emit socket event
        if (socket) {
          socket.emit('sendMessage', data.message);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const updateChatLastMessage = (message) => {
    setChats(prev => prev.map(chat => 
      chat._id === message.chatId 
        ? { ...chat, lastMessage: message, updatedAt: new Date() }
        : chat
    ));
  };

  const handleTyping = () => {
    if (socket && selectedChat) {
      socket.emit('typing', {
        chatId: selectedChat._id,
        isTyping: true,
        userName: `${user.firstName} ${user.lastName}`
      });

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', {
          chatId: selectedChat._id,
          isTyping: false
        });
      }, 2000);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredChats = chats.filter(chat => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    return chat.name?.toLowerCase().includes(searchLower) ||
           chat.participants?.some(p => 
             `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchLower)
           );
  });

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date) => {
    const today = new Date();
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return messageDate.toLocaleDateString();
  };

  const isOnline = (userId) => {
    return onlineUsers.includes(userId);
  };

  const getTypingText = () => {
    const typingUsers = Object.values(typing).filter(Boolean);
    if (typingUsers.length === 0) return '';
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return `${typingUsers.length} people are typing...`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="flex h-full">
        {/* Chat List Sidebar */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Messages</h2>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                <ChatListItem
                  key={chat._id}
                  chat={chat}
                  isSelected={selectedChat?._id === chat._id}
                  isOnline={isOnline}
                  onClick={() => setSelectedChat(chat)}
                  currentUserId={userId}
                />
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No conversations yet</p>
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="mt-2 text-purple-600 hover:text-purple-700"
                >
                  Start a conversation
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                        {selectedChat.type === 'direct' ? (
                          <User className="w-6 h-6 text-white" />
                        ) : (
                          <Users className="w-6 h-6 text-white" />
                        )}
                      </div>
                      {selectedChat.type === 'direct' && (
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                          isOnline(selectedChat.participants?.find(p => p._id !== userId)?._id) 
                            ? 'bg-green-500' : 'bg-gray-400'
                        }`}></div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {selectedChat.name || selectedChat.participants
                          ?.filter(p => p._id !== userId)
                          ?.map(p => `${p.firstName} ${p.lastName}`)
                          ?.join(', ')
                        }
                      </h3>
                      <p className="text-sm text-gray-500">
                        {selectedChat.type === 'direct' 
                          ? isOnline(selectedChat.participants?.find(p => p._id !== userId)?._id) 
                            ? 'Online' : 'Offline'
                          : `${selectedChat.participants?.length || 0} members`
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                      <Phone className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                      <Video className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => {
                  const showDate = index === 0 || 
                    formatDate(message.createdAt) !== formatDate(messages[index - 1].createdAt);
                  
                  return (
                    <div key={message._id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                            {formatDate(message.createdAt)}
                          </span>
                        </div>
                      )}
                      
                      <MessageBubble
                        message={message}
                        isOwn={message.sender._id === userId}
                        showAvatar={index === 0 || messages[index - 1].sender._id !== message.sender._id}
                        formatTime={formatTime}
                      />
                    </div>
                  );
                })}
                
                {/* Typing indicator */}
                {getTypingText() && (
                  <div className="flex items-center space-x-2 text-gray-500 text-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span>{getTypingText()}</span>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200">
                <form onSubmit={sendMessage} className="flex items-center space-x-2">
                  <button
                    type="button"
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      placeholder="Type a message..."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-800"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* No Chat Selected */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Select a conversation</h3>
                <p className="text-gray-500">Choose from your existing conversations or start a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <NewChatModal
          userRole={userRole}
          onClose={() => setShowNewChatModal(false)}
          onChatCreated={(newChat) => {
            setChats(prev => [newChat, ...prev]);
            setSelectedChat(newChat);
            setShowNewChatModal(false);
          }}
        />
      )}
    </div>
  );
}

// Chat List Item Component
function ChatListItem({ chat, isSelected, isOnline, onClick, currentUserId }) {
  const getLastMessageText = () => {
    if (!chat.lastMessage) return 'No messages yet';
    
    const { content, sender, type } = chat.lastMessage;
    const senderName = sender._id === currentUserId ? 'You' : sender.firstName;
    
    if (type === 'file') return `${senderName} sent a file`;
    if (type === 'image') return `${senderName} sent an image`;
    
    return `${senderName}: ${content}`;
  };

  const formatLastMessageTime = () => {
    if (!chat.lastMessage) return '';
    
    const messageDate = new Date(chat.lastMessage.createdAt);
    const now = new Date();
    const diffInHours = (now - messageDate) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const otherParticipant = chat.participants?.find(p => p._id !== currentUserId);

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-gray-100 cursor-pointer transition-colors duration-200 hover:bg-gray-50 ${
        isSelected ? 'bg-purple-50 border-r-4 border-r-purple-500' : ''
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className="relative">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
            {chat.type === 'direct' ? (
              <User className="w-6 h-6 text-white" />
            ) : (
              <Users className="w-6 h-6 text-white" />
            )}
          </div>
          {chat.type === 'direct' && isOnline(otherParticipant?._id) && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-800 truncate">
              {chat.name || (chat.type === 'direct' 
                ? `${otherParticipant?.firstName} ${otherParticipant?.lastName}`
                : 'Group Chat'
              )}
            </h4>
            <span className="text-xs text-gray-500">
              {formatLastMessageTime()}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 truncate">
            {getLastMessageText()}
          </p>
        </div>
        
        {chat.unreadCount > 0 && (
          <div className="w-5 h-5 bg-purple-600 text-white text-xs rounded-full flex items-center justify-center">
            {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
          </div>
        )}
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message, isOwn, showAvatar, formatTime }) {
  const getMessageStatus = () => {
    if (!isOwn) return null;
    
    if (message.readBy?.length > 1) {
      return <CheckCheck className="w-4 h-4 text-blue-500" />;
    } else if (message.delivered) {
      return <CheckCheck className="w-4 h-4 text-gray-400" />;
    } else {
      return <Check className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-xs lg:max-w-md ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isOwn && showAvatar && (
          <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center mr-2">
            <User className="w-4 h-4 text-white" />
          </div>
        )}
        {!isOwn && !showAvatar && <div className="w-10"></div>}
        
        <div
          className={`px-4 py-2 rounded-lg ${
            isOwn
              ? 'bg-purple-600 text-white rounded-br-none'
              : 'bg-gray-100 text-gray-800 rounded-bl-none'
          }`}
        >
          {!isOwn && showAvatar && (
            <p className="text-xs font-medium mb-1">
              {message.sender.firstName} {message.sender.lastName}
            </p>
          )}
          
          <p className="text-sm">{message.content}</p>
          
          <div className={`flex items-center justify-end space-x-1 mt-1 ${
            isOwn ? 'text-purple-100' : 'text-gray-500'
          }`}>
            <span className="text-xs">{formatTime(message.createdAt)}</span>
            {getMessageStatus()}
          </div>
        </div>
      </div>
    </div>
  );
}

// New Chat Modal Component
function NewChatModal({ userRole, onClose, onChatCreated }) {
  const [chatType, setChatType] = useState('direct');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
    if (userRole === 'faculty') {
      loadTeams();
    }
  }, []);

  const loadUsers = async () => {
    try {
      const endpoint = userRole === 'faculty' ? '/student/all' : '/faculty/all';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || data.students || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadTeams = async () => {
    try {
      const response = await fetch(`${API_BASE}/teamRoutes/faculty-teams`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  };

  const handleCreateChat = async () => {
    if (chatType === 'direct' && selectedUsers.length !== 1) {
      alert('Please select exactly one user for direct chat');
      return;
    }
    
    if (chatType === 'group' && (selectedUsers.length < 2 || !groupName.trim())) {
      alert('Please select at least 2 users and enter a group name');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/messaging/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: chatType,
          participants: selectedUsers.map(u => u._id),
          name: chatType === 'group' ? groupName.trim() : undefined
        })
      });

      const data = await response.json();
      
      if (data.success) {
        onChatCreated(data.chat);
      } else {
        alert(data.message || 'Failed to create chat');
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
      alert('Failed to create chat');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u._id === user._id);
      if (isSelected) {
        return prev.filter(u => u._id !== user._id);
      } else {
        return chatType === 'direct' ? [user] : [...prev, user];
      }
    });
  };

  const filteredUsers = users.filter(user =>
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800">New Conversation</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Chat Type Selection */}
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => {
              setChatType('direct');
              setSelectedUsers([]);
            }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200 ${
              chatType === 'direct'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Direct Message
          </button>
          <button
            onClick={() => {
              setChatType('group');
              setSelectedUsers([]);
            }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200 ${
              chatType === 'group'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Group Chat
          </button>
        </div>

        {/* Group Name Input */}
        {chatType === 'group' && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        )}

        {/* Search Users */}
        <div className="mb-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Selected:</p>
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map(user => (
                <span
                  key={user._id}
                  className="inline-flex items-center space-x-1 bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs"
                >
                  <span>{user.firstName} {user.lastName}</span>
                  <button
                    onClick={() => toggleUserSelection(user)}
                    className="hover:bg-purple-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* User List */}
        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
          {filteredUsers.length > 0 ? (
            filteredUsers.map(user => (
              <div
                key={user._id}
                onClick={() => toggleUserSelection(user)}
                className={`p-3 border-b border-gray-100 cursor-pointer transition-colors duration-200 hover:bg-gray-50 ${
                  selectedUsers.some(u => u._id === user._id) ? 'bg-purple-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  
                  {selectedUsers.some(u => u._id === user._id) && (
                    <Check className="w-5 h-5 text-purple-600" />
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">
              <p>No users found</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateChat}
            disabled={loading || selectedUsers.length === 0}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {loading ? 'Creating...' : 'Create Chat'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MessagingSystem;