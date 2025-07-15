// frontend/src/components/Calendar/CalendarView.jsx
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../App';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  BookOpen,
  AlertCircle,
  Edit,
  Trash2,
  Filter,
  MapPin,
  Video
} from 'lucide-react';

function CalendarView({ userRole, userId }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // month, week, day
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadCalendarData();
  }, [currentDate, view]);

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      
      // Load events
      const eventsResponse = await fetch(
        `${API_BASE}/calendar/events?start=${getViewStartDate()}&end=${getViewEndDate()}`,
        { credentials: 'include' }
      );
      
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setEvents(eventsData.events || []);
      }

      // Load tasks with due dates
      const tasksResponse = await fetch(
        `${API_BASE}/taskRoutes/${userRole === 'faculty' ? 'faculty-tasks' : 'student-tasks'}`,
        { credentials: 'include' }
      );
      
      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json();
        setTasks(tasksData.tasks?.filter(task => task.dueDate) || []);
      }
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getViewStartDate = () => {
    const start = new Date(currentDate);
    if (view === 'month') {
      start.setDate(1);
      start.setDate(start.getDate() - start.getDay());
    } else if (view === 'week') {
      start.setDate(start.getDate() - start.getDay());
    }
    return start.toISOString();
  };

  const getViewEndDate = () => {
    const end = new Date(currentDate);
    if (view === 'month') {
      end.setMonth(end.getMonth() + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay()));
    } else if (view === 'week') {
      end.setDate(end.getDate() + (6 - end.getDay()));
    } else {
      end.setDate(end.getDate() + 1);
    }
    return end.toISOString();
  };

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else {
      newDate.setDate(newDate.getDate() + direction);
    }
    setCurrentDate(newDate);
  };

  const formatDateRange = () => {
    if (view === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const getEventsForDate = (date) => {
    const dateStr = date.toDateString();
    
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate.toDateString() === dateStr;
    });

    const dayTasks = tasks.filter(task => {
      const taskDate = new Date(task.dueDate);
      return taskDate.toDateString() === dateStr;
    });

    return { events: dayEvents, tasks: dayTasks };
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    return event.type === filter;
  });

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'tasks') return true;
    return false;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Calendar</h2>
          <p className="text-gray-600">Manage your schedule and track deadlines</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Items</option>
              <option value="meeting">Meetings</option>
              <option value="deadline">Deadlines</option>
              <option value="task">Tasks</option>
              <option value="reminder">Reminders</option>
            </select>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-300"
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigateDate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-semibold text-gray-800 min-w-[200px] text-center">
              {formatDateRange()}
            </h3>
            
            <button
              onClick={() => navigateDate(1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
            >
              Today
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            {['month', 'week', 'day'].map((viewType) => (
              <button
                key={viewType}
                onClick={() => setView(viewType)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  view === viewType
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Grid */}
        {view === 'month' && (
          <MonthView 
            currentDate={currentDate}
            events={filteredEvents}
            tasks={filteredTasks}
            onEventClick={setSelectedEvent}
            getEventsForDate={getEventsForDate}
          />
        )}
        
        {view === 'week' && (
          <WeekView 
            currentDate={currentDate}
            events={filteredEvents}
            tasks={filteredTasks}
            onEventClick={setSelectedEvent}
          />
        )}
        
        {view === 'day' && (
          <DayView 
            currentDate={currentDate}
            events={filteredEvents}
            tasks={filteredTasks}
            onEventClick={setSelectedEvent}
          />
        )}
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Upcoming Events</h3>
        <UpcomingEvents events={events} tasks={tasks} onEventClick={setSelectedEvent} />
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <CreateEventModal
          userRole={userRole}
          onClose={() => setShowCreateModal(false)}
          onEventCreated={() => {
            loadCalendarData();
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          userRole={userRole}
          onClose={() => setSelectedEvent(null)}
          onEventUpdated={loadCalendarData}
        />
      )}
    </div>
  );
}

// Month View Component
function MonthView({ currentDate, events, tasks, onEventClick, getEventsForDate }) {
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Previous month days
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false
      });
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true
      });
    }
    
    // Next month days
    const totalCells = 42; // 6 rows × 7 days
    const remainingCells = totalCells - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false
      });
    }
    
    return days;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const days = getDaysInMonth();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="grid grid-cols-7 gap-1">
      {/* Header */}
      {weekDays.map(day => (
        <div key={day} className="p-3 text-center font-medium text-gray-600 bg-gray-50 rounded-lg">
          {day}
        </div>
      ))}
      
      {/* Days */}
      {days.map((day, index) => {
        const { events: dayEvents, tasks: dayTasks } = getEventsForDate(day.date);
        const hasItems = dayEvents.length > 0 || dayTasks.length > 0;
        
        return (
          <div
            key={index}
            className={`min-h-[120px] p-2 border border-gray-100 rounded-lg transition-colors duration-200 hover:bg-gray-50 ${
              !day.isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'
            } ${isToday(day.date) ? 'ring-2 ring-purple-500' : ''}`}
          >
            <div className={`text-sm font-medium mb-1 ${
              isToday(day.date) ? 'text-purple-600' : day.isCurrentMonth ? 'text-gray-800' : 'text-gray-400'
            }`}>
              {day.date.getDate()}
            </div>
            
            {hasItems && (
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((event, idx) => (
                  <div
                    key={idx}
                    onClick={() => onEventClick(event)}
                    className="text-xs p-1 rounded bg-purple-100 text-purple-700 cursor-pointer hover:bg-purple-200 truncate"
                  >
                    {event.title}
                  </div>
                ))}
                
                {dayTasks.slice(0, 1).map((task, idx) => (
                  <div
                    key={idx}
                    onClick={() => onEventClick({ ...task, type: 'task' })}
                    className="text-xs p-1 rounded bg-orange-100 text-orange-700 cursor-pointer hover:bg-orange-200 truncate"
                  >
                    📋 {task.title}
                  </div>
                ))}
                
                {(dayEvents.length + dayTasks.length) > 3 && (
                  <div className="text-xs text-gray-500">
                    +{(dayEvents.length + dayTasks.length) - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Week View Component
function WeekView({ currentDate, events, tasks, onEventClick }) {
  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = getWeekDays();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="grid grid-cols-8 gap-1">
      {/* Time column header */}
      <div className="p-3 text-center font-medium text-gray-600 bg-gray-50 rounded-lg">
        Time
      </div>
      
      {/* Day headers */}
      {weekDays.map(day => (
        <div key={day.toISOString()} className="p-3 text-center bg-gray-50 rounded-lg">
          <div className="font-medium text-gray-800">
            {day.toLocaleDateString('en-US', { weekday: 'short' })}
          </div>
          <div className="text-sm text-gray-600">
            {day.getDate()}
          </div>
        </div>
      ))}
      
      {/* Time slots */}
      {hours.map(hour => (
        <React.Fragment key={hour}>
          <div className="p-2 text-xs text-gray-500 border-r border-gray-100">
            {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
          </div>
          
          {weekDays.map(day => {
            const dayEvents = events.filter(event => {
              const eventDate = new Date(event.startDate);
              return eventDate.toDateString() === day.toDateString() &&
                     eventDate.getHours() === hour;
            });
            
            return (
              <div key={`${day.toISOString()}-${hour}`} className="min-h-[60px] border border-gray-100 p-1">
                {dayEvents.map((event, idx) => (
                  <div
                    key={idx}
                    onClick={() => onEventClick(event)}
                    className="text-xs p-1 mb-1 rounded bg-purple-100 text-purple-700 cursor-pointer hover:bg-purple-200 truncate"
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

// Day View Component
function DayView({ currentDate, events, tasks, onEventClick }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const dayEvents = events.filter(event => {
    const eventDate = new Date(event.startDate);
    return eventDate.toDateString() === currentDate.toDateString();
  });
  
  const dayTasks = tasks.filter(task => {
    const taskDate = new Date(task.dueDate);
    return taskDate.toDateString() === currentDate.toDateString();
  });

  return (
    <div className="space-y-4">
      {/* All-day events */}
      {(dayEvents.length > 0 || dayTasks.length > 0) && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-2">All Day & Due Today</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {dayEvents.map((event, idx) => (
              <div
                key={idx}
                onClick={() => onEventClick(event)}
                className="p-2 bg-purple-100 text-purple-700 rounded cursor-pointer hover:bg-purple-200"
              >
                <div className="font-medium">{event.title}</div>
                {event.location && (
                  <div className="text-xs flex items-center mt-1">
                    <MapPin className="w-3 h-3 mr-1" />
                    {event.location}
                  </div>
                )}
              </div>
            ))}
            
            {dayTasks.map((task, idx) => (
              <div
                key={idx}
                onClick={() => onEventClick({ ...task, type: 'task' })}
                className="p-2 bg-orange-100 text-orange-700 rounded cursor-pointer hover:bg-orange-200"
              >
                <div className="font-medium">📋 {task.title}</div>
                <div className="text-xs">Due: {new Date(task.dueDate).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Hourly schedule */}
      <div className="grid grid-cols-1 gap-1">
        {hours.map(hour => {
          const hourEvents = dayEvents.filter(event => {
            const eventDate = new Date(event.startDate);
            return eventDate.getHours() === hour;
          });
          
          return (
            <div key={hour} className="flex border-b border-gray-100">
              <div className="w-20 p-2 text-sm text-gray-500 text-right">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              <div className="flex-1 min-h-[60px] p-2">
                {hourEvents.map((event, idx) => (
                  <div
                    key={idx}
                    onClick={() => onEventClick(event)}
                    className="p-2 mb-1 bg-purple-100 text-purple-700 rounded cursor-pointer hover:bg-purple-200"
                  >
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs">
                      {new Date(event.startDate).toLocaleTimeString()} - {new Date(event.endDate).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Upcoming Events Component
function UpcomingEvents({ events, tasks, onEventClick }) {
  const now = new Date();
  const upcomingEvents = events
    .filter(event => new Date(event.startDate) > now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .slice(0, 5);
    
  const upcomingTasks = tasks
    .filter(task => new Date(task.dueDate) > now)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);

  const allUpcoming = [
    ...upcomingEvents.map(event => ({ ...event, type: 'event' })),
    ...upcomingTasks.map(task => ({ ...task, type: 'task' }))
  ].sort((a, b) => {
    const dateA = new Date(a.startDate || a.dueDate);
    const dateB = new Date(b.startDate || b.dueDate);
    return dateA - dateB;
  }).slice(0, 6);

  if (allUpcoming.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <CalendarIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>No upcoming events or deadlines</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allUpcoming.map((item, index) => (
        <div
          key={index}
          onClick={() => onEventClick(item)}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200"
        >
          <div className="flex items-center space-x-3">
            <div className={`w-2 h-2 rounded-full ${
              item.type === 'task' ? 'bg-orange-500' : 'bg-purple-500'
            }`}></div>
            <div>
              <div className="font-medium text-gray-800">
                {item.type === 'task' ? '📋 ' : ''}{item.title}
              </div>
              <div className="text-sm text-gray-500">
                {item.type === 'task' 
                  ? `Due: ${new Date(item.dueDate).toLocaleDateString()}`
                  : new Date(item.startDate).toLocaleDateString()
                }
              </div>
            </div>
          </div>
          
          <div className="text-sm text-gray-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Create Event Modal Component
function CreateEventModal({ userRole, onClose, onEventCreated }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'meeting',
    startDate: '',
    endDate: '',
    location: '',
    isVirtual: false,
    meetingLink: '',
    attendees: [],
    reminders: [15], // minutes before
    isRecurring: false,
    recurrenceRule: '',
    priority: 'medium'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/calendar/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (data.success) {
        onEventCreated();
        alert('Event created successfully!');
      } else {
        alert(data.message || 'Failed to create event');
      }
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-800 mb-6">Create New Event</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Event Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
              placeholder="e.g., Team Meeting"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
              rows={3}
              placeholder="Event description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">Event Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
              >
                <option value="meeting">Meeting</option>
                <option value="deadline">Deadline</option>
                <option value="reminder">Reminder</option>
                <option value="presentation">Presentation</option>
                <option value="workshop">Workshop</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">Start Date & Time</label>
              <input
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">End Date & Time</label>
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                required
              />
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.isVirtual}
                onChange={(e) => setFormData(prev => ({ ...prev, isVirtual: e.target.checked }))}
                className="rounded border-gray-300 focus:ring-purple-500"
              />
              <span className="text-gray-700">Virtual Event</span>
            </label>
          </div>

          {formData.isVirtual ? (
            <div>
              <label className="block text-gray-700 font-medium mb-2">Meeting Link</label>
              <input
                type="url"
                value={formData.meetingLink}
                onChange={(e) => setFormData(prev => ({ ...prev, meetingLink: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                placeholder="https://zoom.us/j/..."
              />
            </div>
          ) : (
            <div>
              <label className="block text-gray-700 font-medium mb-2">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-400"
                placeholder="e.g., Conference Room A"
              />
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Event Details Modal Component
function EventDetailsModal({ event, userRole, onClose, onEventUpdated }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteEvent = async () => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;

    setDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/calendar/events/${event._id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        onEventUpdated();
        onClose();
        alert('Event deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{event.title}</h3>
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 ${
              event.type === 'task' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {event.type === 'task' ? 'Task Due' : event.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {event.description && (
            <div>
              <h4 className="font-medium text-gray-800 mb-1">Description</h4>
              <p className="text-gray-600">{event.description}</p>
            </div>
          )}

          <div>
            <h4 className="font-medium text-gray-800 mb-1">
              {event.type === 'task' ? 'Due Date' : 'Date & Time'}
            </h4>
            <div className="flex items-center space-x-2 text-gray-600">
              <Clock className="w-4 h-4" />
              <span>
                {event.type === 'task' 
                  ? formatDateTime(event.dueDate)
                  : `${formatDateTime(event.startDate)} - ${formatDateTime(event.endDate)}`
                }
              </span>
            </div>
          </div>

          {(event.location || event.meetingLink) && (
            <div>
              <h4 className="font-medium text-gray-800 mb-1">Location</h4>
              <div className="flex items-center space-x-2 text-gray-600">
                {event.meetingLink ? (
                  <>
                    <Video className="w-4 h-4" />
                    <a 
                      href={event.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-700 underline"
                    >
                      Join Virtual Meeting
                    </a>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    <span>{event.location}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {event.team && (
            <div>
              <h4 className="font-medium text-gray-800 mb-1">Team</h4>
              <div className="flex items-center space-x-2 text-gray-600">
                <Users className="w-4 h-4" />
                <span>{event.team.name}</span>
              </div>
            </div>
          )}
        </div>

        {userRole === 'faculty' && event.type !== 'task' && (
          <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => setEditing(true)}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors duration-200"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
            <button
              onClick={deleteEvent}
              disabled={deleting}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors duration-200 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{deleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CalendarView;

// backend/routes/calendarRoutes.js
const express = require("express");
const router = express.Router();
const Event = require("../models/eventSchema");
const verifyToken = require("../middleware/verifyToken");

console.log("🔧 calendarRoutes.js loaded");

// ✅ Create new event
router.post("/events", verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      startDate,
      endDate,
      location,
      isVirtual,
      meetingLink,
      attendees,
      reminders,
      isRecurring,
      recurrenceRule,
      priority
    } = req.body;

    // Validation
    if (!title || !startDate || !endDate) {
      return res.status(400).json({
        message: "Title, start date, and end date are required",
        success: false
      });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        message: "End date must be after start date",
        success: false
      });
    }

    const event = new Event({
      title: title.trim(),
      description: description?.trim() || "",
      type: type || "meeting",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      location: location?.trim() || "",
      isVirtual: isVirtual || false,
      meetingLink: meetingLink?.trim() || "",
      createdBy: req.user.id,
      creatorModel: req.user.role === "faculty" ? "Faculty" : "Student",
      attendees: attendees || [],
      reminders: reminders || [15],
      isRecurring: isRecurring || false,
      recurrenceRule: recurrenceRule || "",
      priority: priority || "medium"
    });

    await event.save();

    const populatedEvent = await Event.findById(event._id)
      .populate("createdBy", "firstName lastName email");

    res.status(201).json({
      message: "Event created successfully",
      success: true,
      event: populatedEvent
    });
  } catch (err) {
    console.error("Error creating event:", err);
    res.status(500).json({
      message: "Failed to create event",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
      success: false
    });
  }
});

// ✅ Get events for user
router.get("/events", verifyToken, async (req, res) => {
  try {
    const { start, end, type } = req.query;

    // Build query
    const query = {
      $or: [
        { createdBy: req.user.id },
        { attendees: req.user.id }
      ]
    };

    // Add date range filter
    if (start && end) {
      query.startDate = {
        $gte: new Date(start),
        $lte: new Date(end)
      };
    }

    // Add type filter
    if (type && type !== 'all') {
      query.type = type;
    }

    const events = await Event.find(query)
      .populate("createdBy", "firstName lastName email")
      .populate("attendees", "firstName lastName email")
      .sort({ startDate: 1 });

    res.status(200).json({
      success: true,
      events,
      count: events.length
    });
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({
      message: "Failed to fetch events",
      success: false
    });
  }
});

// ✅ Get single event
router.get("/events/:eventId", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId)
      .populate("createdBy", "firstName lastName email")
      .populate("attendees", "firstName lastName email");

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
        success: false
      });
    }

    // Check access permissions
    const isCreator = event.createdBy._id.toString() === req.user.id;
    const isAttendee = event.attendees.some(attendee => attendee._id.toString() === req.user.id);

    if (!isCreator && !isAttendee) {
      return res.status(403).json({
        message: "Access denied",
        success: false
      });
    }

    res.status(200).json({
      success: true,
      event
    });
  } catch (err) {
    console.error("Error fetching event:", err);
    res.status(500).json({
      message: "Failed to fetch event",
      success: false
    });
  }
});

// ✅ Update event
router.put("/events/:eventId", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        message: "Event not found",
        success: false
      });
    }

    // Check permissions - only creator can update
    if (event.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Only event creator can update the event",
        success: false
      });
    }

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.createdBy;
    delete updateData.createdAt;

    // Validate dates if provided
    if (updateData.startDate && updateData.endDate) {
      if (new Date(updateData.startDate) >= new Date(updateData.endDate)) {
        return res.status(400).json({
          message: "End date must be after start date",
          success: false
        });
      }
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      updateData,
      { new: true }
    ).populate("createdBy", "firstName lastName email")
     .populate("attendees", "firstName lastName email");

    res.status(200).json({
      message: "Event updated successfully",
      success: true,
      event: updatedEvent
    });
  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({
      message: "Failed to update event",
      success: false
    });
  }
});

// ✅ Delete event
router.delete("/events/:eventId", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        message: "Event not found",
        success: false
      });
    }

    // Check permissions - only creator can delete
    if (event.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Only event creator can delete the event",
        success: false
      });
    }

    await Event.findByIdAndDelete(eventId);

    res.status(200).json({
      message: "Event deleted successfully",
      success: true
    });
  } catch (err) {
    console.error("Error deleting event:", err);
    res.status(500).json({
      message: "Failed to delete event",
      success: false
    });
  }
});

// ✅ Get upcoming events
router.get("/upcoming", verifyToken, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const now = new Date();

    const events = await Event.find({
      $or: [
        { createdBy: req.user.id },
        { attendees: req.user.id }
      ],
      startDate: { $gt: now }
    })
      .populate("createdBy", "firstName lastName email")
      .sort({ startDate: 1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      events
    });
  } catch (err) {
    console.error("Error fetching upcoming events:", err);
    res.status(500).json({
      message: "Failed to fetch upcoming events",
      success: false
    });
  }
});

console.log("🔧 All calendar routes defined successfully");

module.exports = router;

// backend/models/eventSchema.js
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ""
  },
  type: {
    type: String,
    enum: ['meeting', 'deadline', 'reminder', 'presentation', 'workshop', 'other'],
    default: 'meeting'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    default: ""
  },
  isVirtual: {
    type: Boolean,
    default: false
  },
  meetingLink: {
    type: String,
    default: ""
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'creatorModel'
  },
  creatorModel: {
    type: String,
    required: true,
    enum: ['Student', 'Faculty']
  },
  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'attendeeModel'
  }],
  attendeeModel: {
    type: String,
    enum: ['Student', 'Faculty'],
    default: 'Student'
  },
  reminders: [{
    type: Number, // minutes before event
    default: 15
  }],
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrenceRule: {
    type: String,
    default: ""
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add indexes for better performance
eventSchema.index({ createdBy: 1, startDate: 1 });
eventSchema.index({ attendees: 1, startDate: 1 });
eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ type: 1 });

module.exports = mongoose.model("Event", eventSchema);