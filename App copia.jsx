import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, MapPin, Phone, Mail, FileText, ChevronLeft, ChevronRight, Plus, X, Save, Trash2, AlertCircle, Menu } from 'lucide-react';
import './App.css';

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState('week');
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalTime, setCreateModalTime] = useState(null);
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stats, setStats] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [filterStatus, setFilterStatus] = useState(null);
  const [showFilteredList, setShowFilteredList] = useState(false);

  const config = window.ameliaCalendarData || {};
  const apiUrl = config.restUrl || '/wp-json/amelia-calendar/v1';

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setSidebarOpen(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [selectedDate, view]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [servicesData, customersData, locationsData, statsData] = await Promise.all([
        fetchAPI('/services').catch(() => ({ data: [] })),
        fetchAPI('/customers').catch(() => ({ data: [] })),
        fetchAPI('/locations').catch(() => ({ data: [] })),
        fetchAPI('/stats').catch(() => ({ data: null }))
      ]);
      setServices(servicesData.data || []);
      setCustomers(customersData.data || []);
      setLocations(locationsData.data || []);
      setStats(statsData.data || null);
      
      await loadAppointments();
    } catch (err) {
      setError(err.message || 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async () => {
    try {
      const { startDate, endDate } = getDateRange();
      const appointmentsData = await fetchAPI(`/appointments?start_date=${formatAPIDate(startDate)}&end_date=${formatAPIDate(endDate)}`);
      setAppointments(appointmentsData.data || []);
    } catch (err) {
      console.error('Errore caricamento appuntamenti:', err);
      setError(err.message || 'Errore caricamento appuntamenti');
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange();
      const [appointmentsData, servicesData, customersData, locationsData, statsData] = await Promise.all([
        fetchAPI(`/appointments?start_date=${formatAPIDate(startDate)}&end_date=${formatAPIDate(endDate)}`),
        fetchAPI('/services'),
        fetchAPI('/customers'),
        fetchAPI('/locations'),
        fetchAPI('/stats')
      ]);
      setAppointments(appointmentsData.data || []);
      setServices(servicesData.data || []);
      setCustomers(customersData.data || []);
      setLocations(locationsData.data || []);
      setStats(statsData.data || null);
    } catch (err) {
      setError(err.message || 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  const fetchAPI = async (endpoint, options = {}, retries = 2) => {
    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': config.nonce, ...options.headers }
      });
      
      if (!response.ok) {
        if ((response.status === 508 || response.status === 503) && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchAPI(endpoint, options, retries - 1);
        }
        
        const errorData = await response.json().catch(() => ({ message: 'Errore API' }));
        throw new Error(errorData.message || `Errore ${response.status}`);
      }
      return response.json();
    } catch (error) {
      if (retries > 0 && (error.message.includes('508') || error.message.includes('503'))) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchAPI(endpoint, options, retries - 1);
      }
      throw error;
    }
  };

  const formatAPIDate = (date) => {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };

  const getDateRange = () => {
    if (view === 'day') {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    } else if (view === 'week') {
      return { startDate: getWeekStart(selectedDate), endDate: getWeekEnd(selectedDate) };
    } else {
      return { startDate: getMonthStart(selectedDate), endDate: getMonthEnd(selectedDate) };
    }
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - (day === 0 ? 6 : day - 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getWeekEnd = (date) => {
    const d = getWeekStart(date);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const getMonthStart = (date) => {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getMonthEnd = (date) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const getWeekDays = () => {
    const days = [];
    const start = getWeekStart(selectedDate);
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const navigate = (direction) => {
    const newDate = new Date(selectedDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      approved: { label: 'Confermato', color: 'bg-green-100' },
      pending: { label: 'In Attesa', color: 'bg-yellow-100' },
      canceled: { label: 'Annullato', color: 'bg-gray-100' },
      rejected: { label: 'Rifiutato', color: 'bg-gray-100' },
      'no-show': { label: 'Assente', color: 'bg-orange-100' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <span className={`status-badge ${config.color}`}>{config.label}</span>;
  };

  const handleCreateAppointment = async (formData) => {
    try {
      setLoading(true);
      
      const ameliaFormData = {
        ...formData,
        notifyParticipants: 1,
        sendNotification: true,
        type: 'appointment'
      };
      
      await fetchAPI('/appointments', { 
        method: 'POST', 
        body: JSON.stringify(ameliaFormData) 
      });
      
      setShowCreateModal(false);
      setCreateModalTime(null);
      await loadAllData();
      
      alert('Appuntamento creato con successo!\n\nIl cliente e il fornitore riceveranno una email di conferma.');
    } catch (err) {
      alert('Errore creazione appuntamento: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAppointment = async (appointmentId, updateData) => {
    try {
      setLoading(true);
      
      const ameliaUpdateData = {
        ...updateData,
        notifyParticipants: 1,
        sendNotification: true,
        type: 'appointment'
      };
      
      await fetchAPI(`/appointments/${appointmentId}`, { 
        method: 'PUT', 
        body: JSON.stringify(ameliaUpdateData) 
      });
      
      setSelectedAppointment(null);
      await loadAllData();
      
      if (updateData.bookingStart || updateData.bookingEnd) {
        alert('Appuntamento riprogrammato con successo!\n\nIl cliente e il fornitore riceveranno una email di notifica.');
      } else if (updateData.status) {
        alert('Stato appuntamento aggiornato con successo!\n\nIl cliente riceverà una email di notifica.');
      } else {
        alert('Appuntamento aggiornato con successo!');
      }
    } catch (err) {
      alert('Errore aggiornamento: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!confirm('Sei sicuro di voler cancellare questo appuntamento?')) return;
    try {
      setLoading(true);
      await fetchAPI(`/appointments/${appointmentId}`, { method: 'DELETE' });
      setSelectedAppointment(null);
      await loadAllData();
      alert('Appuntamento cancellato con successo!');
    } catch (err) {
      alert('Errore cancellazione: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (day, hour) => {
    const slotDate = new Date(day);
    slotDate.setHours(hour, 0, 0, 0);
    setCreateModalTime(slotDate);
    setShowCreateModal(true);
  };

  const handleStatCardClick = (status) => {
    setFilterStatus(status);
    setShowFilteredList(true);
  };

  const getFilteredAppointments = () => {
    const today = new Date().toISOString().split('T')[0];
    
    switch(filterStatus) {
      case 'today':
        return appointments.filter(apt => 
          apt.bookingStart.startsWith(today) && apt.status === 'approved'
        );
      case 'total':
        return appointments;
      case 'approved':
        return appointments.filter(apt => apt.status === 'approved');
      case 'pending':
        return appointments.filter(apt => apt.status === 'pending');
      case 'canceled':
        return appointments.filter(apt => apt.status === 'canceled');
      case 'rejected':
        return appointments.filter(apt => apt.status === 'rejected');
      default:
        return appointments;
    }
  };

  if (loading && appointments.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Caricamento agenda...</p>
      </div>
    );
  }

  return (
    <div className="fantastical-app">
      <Header 
        stats={stats} 
        onNewAppointment={() => setShowCreateModal(true)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onStatCardClick={handleStatCardClick}
      />

      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <div>
            <p className="error-title">Errore</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="fantastical-layout">
        {sidebarOpen && window.innerWidth <= 1024 && (
          <div 
            className="sidebar-overlay" 
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        <Sidebar 
          currentDate={currentDate}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onNavigateMonth={(direction) => {
            const newDate = new Date(currentDate);
            newDate.setMonth(newDate.getMonth() + direction);
            setCurrentDate(newDate);
          }}
          onToday={goToToday}
          isOpen={sidebarOpen}
        />

        <MainContent 
          view={view}
          setView={setView}
          selectedDate={selectedDate}
          weekDays={getWeekDays()}
          appointments={appointments}
          onAppointmentClick={setSelectedAppointment}
          onSlotClick={handleSlotClick}
          onNavigate={navigate}
          getStatusBadge={getStatusBadge}
        />
      </div>

      {showFilteredList && (
        <FilteredAppointmentsList
          appointments={getFilteredAppointments()}
          filterStatus={filterStatus}
          onClose={() => setShowFilteredList(false)}
          onAppointmentClick={(apt) => {
            setShowFilteredList(false);
            setSelectedAppointment(apt);
          }}
          getStatusBadge={getStatusBadge}
        />
      )}

      {selectedAppointment && (
        <AppointmentDetailModal 
          appointment={selectedAppointment} 
          onClose={() => setSelectedAppointment(null)} 
          onUpdate={handleUpdateAppointment} 
          onCancel={handleCancelAppointment} 
          getStatusBadge={getStatusBadge} 
        />
      )}
      
      {showCreateModal && (
        <CreateAppointmentModal 
          onClose={() => {
            setShowCreateModal(false);
            setCreateModalTime(null);
          }}
          onCreate={handleCreateAppointment} 
          services={services} 
          customers={customers} 
          locations={locations}
          initialDateTime={createModalTime}
        />
      )}
    </div>
  );
}

function Header({ stats, onNewAppointment, sidebarOpen, onToggleSidebar, onStatCardClick }) {
  const todayApprovedCount = stats?.todayApproved || 0;
  
  return (
    <div className="fantastical-header">
      <div className="header-top">
        <div className="header-left">
          <button onClick={onToggleSidebar} className="sidebar-toggle">
            <Menu size={20} />
          </button>
          <div className="brand">
            <div className="brand-icon">
              <Calendar size={24} />
            </div>
            <div>
              <h1>Agenda Appuntamenti</h1>
              <p>Gestisci i tuoi appuntamenti</p>
            </div>
          </div>
        </div>
        <button onClick={onNewAppointment} className="btn-primary">
          <Plus size={20} /> Nuovo Appuntamento
        </button>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card stat-today clickable" onClick={() => onStatCardClick('today')}>
            <div className="stat-value">{todayApprovedCount}</div>
            <div className="stat-label">Oggi</div>
          </div>
          <div className="stat-card clickable" onClick={() => onStatCardClick('total')}>
            <div className="stat-value">{stats.total || 0}</div>
            <div className="stat-label">Totali</div>
          </div>
          <div className="stat-card stat-approved clickable" onClick={() => onStatCardClick('approved')}>
            <div className="stat-value">{stats.approved || 0}</div>
            <div className="stat-label">Confermati</div>
          </div>
          <div className="stat-card stat-pending clickable" onClick={() => onStatCardClick('pending')}>
            <div className="stat-value">{stats.pending || 0}</div>
            <div className="stat-label">In Attesa</div>
          </div>
          <div className="stat-card stat-canceled clickable" onClick={() => onStatCardClick('canceled')}>
            <div className="stat-value">{stats.canceled || 0}</div>
            <div className="stat-label">Annullati</div>
          </div>
          <div className="stat-card clickable" onClick={() => onStatCardClick('rejected')}>
            <div className="stat-value">{stats.rejected || 0}</div>
            <div className="stat-label">Rifiutati</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ currentDate, selectedDate, onSelectDate, onNavigateMonth, onToday, isOpen }) {
  const generateMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];
    
    for (let i = 0; i < (startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1); i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const isSelected = (day) => {
    if (!day) return false;
    return day === selectedDate.getDate() && 
           currentDate.getMonth() === selectedDate.getMonth() && 
           currentDate.getFullYear() === selectedDate.getFullYear();
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    onSelectDate(newDate);
  };

  return (
    <div className={`fantastical-sidebar ${isOpen ? 'open' : 'closed'}`} onClick={(e) => e.stopPropagation()}>
      <div className="mini-calendar">
        <div className="mini-calendar-header">
          <button onClick={() => onNavigateMonth(-1)} className="mini-nav-btn">
            <ChevronLeft size={18} />
          </button>
          <h3>
            {currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={() => onNavigateMonth(1)} className="mini-nav-btn">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mini-weekdays">
          {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day, i) => (
            <div key={i} className="mini-weekday">{day}</div>
          ))}
        </div>

        <div className="mini-days-grid">
          {generateMonthDays().map((day, index) => (
            <div 
              key={index} 
              className={`mini-day ${day ? 'has-day' : ''} ${isSelected(day) ? 'selected' : ''} ${isToday(day) ? 'today' : ''}`}
              onClick={() => handleDayClick(day)}
            >
              {day || ''}
            </div>
          ))}
        </div>
      </div>

      <button onClick={onToday} className="btn-today-sidebar">
        Oggi
      </button>
    </div>
  );
}

function MainContent({ view, setView, selectedDate, weekDays, appointments, onAppointmentClick, onSlotClick, onNavigate, getStatusBadge }) {
  return (
    <div className="main-content">
      <div className="main-header">
        <div className="view-nav-container">
          <div className="nav-controls">
            <button onClick={() => onNavigate(-1)} className="nav-arrow">
              <ChevronLeft size={20} />
            </button>
            <h2 className="current-period">
              {view === 'day' && selectedDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {view === 'week' && `${weekDays[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`}
              {view === 'month' && selectedDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={() => onNavigate(1)} className="nav-arrow">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="view-selector">
            <button className={`view-btn ${view === 'day' ? 'active' : ''}`} onClick={() => setView('day')}>
              Giorno
            </button>
            <button className={`view-btn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>
              Settimana
            </button>
            <button className={`view-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>
              Mese
            </button>
          </div>
        </div>
      </div>

      {view === 'day' && (
        <DayView 
          selectedDate={selectedDate}
          appointments={appointments}
          onAppointmentClick={onAppointmentClick}
          onSlotClick={onSlotClick}
        />
      )}

      {view === 'week' && (
        <WeekView 
          weekDays={weekDays}
          appointments={appointments}
          onAppointmentClick={onAppointmentClick}
          onSlotClick={onSlotClick}
        />
      )}

      {view === 'month' && (
        <MonthView 
          selectedDate={selectedDate}
          appointments={appointments}
          onAppointmentClick={onAppointmentClick}
          getStatusBadge={getStatusBadge}
        />
      )}
    </div>
  );
}

function DayView({ selectedDate, appointments, onAppointmentClick, onSlotClick }) {
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);
  const timeColumnRef = React.useRef(null);
  const dayContentRef = React.useRef(null);

  const getAppointmentsForHour = (hour) => {
    const dayStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    
    return appointments.filter(apt => {
      const aptStart = new Date(apt.bookingStart);
      const aptHour = aptStart.getHours();
      const aptDayStr = `${aptStart.getFullYear()}-${String(aptStart.getMonth() + 1).padStart(2, '0')}-${String(aptStart.getDate()).padStart(2, '0')}`;
      
      return aptDayStr === dayStr && aptHour === hour;
    });
  };

  const getAppointmentHeight = (apt) => {
    const start = new Date(apt.bookingStart);
    const end = new Date(apt.bookingEnd);
    const durationMinutes = (end - start) / (1000 * 60);
    return Math.max(durationMinutes * 2.33, 110);
  };

  const getAppointmentTop = (apt) => {
    const aptStart = new Date(apt.bookingStart);
    const minutes = aptStart.getMinutes();
    return (minutes * 2.33);
  };

  // Sincronizza scroll verticale tra time-column e day-content
  React.useEffect(() => {
    const timeColumn = timeColumnRef.current;
    const dayContent = dayContentRef.current;
    
    if (!timeColumn || !dayContent) return;
    
    const syncVerticalScroll = (e) => {
      if (e.target === dayContent) {
        timeColumn.scrollTop = dayContent.scrollTop;
      } else if (e.target === timeColumn) {
        dayContent.scrollTop = timeColumn.scrollTop;
      }
    };
    
    timeColumn.addEventListener('scroll', syncVerticalScroll);
    dayContent.addEventListener('scroll', syncVerticalScroll);
    
    return () => {
      timeColumn.removeEventListener('scroll', syncVerticalScroll);
      dayContent.removeEventListener('scroll', syncVerticalScroll);
    };
  }, []);

  return (
    <div className="week-view-scroll-container">
      <div className="week-grid-container">
        {/* Angolo in alto a sinistra - FISSO */}
        <div className="time-header"></div>

        {/* Header giorno singolo - FISSO */}
        <div className="days-header">
          <div className="day-header today">
            <div className="day-name">
              {selectedDate.toLocaleDateString('it-IT', { weekday: 'short' })}
            </div>
            <div className="day-number">
              {selectedDate.getDate()}
            </div>
          </div>
        </div>

        {/* Colonna orari - FISSA */}
        <div className="time-column" ref={timeColumnRef}>
          {hours.map(hour => (
            <div key={hour} className="time-slot">
              {`${hour}:00`}
            </div>
          ))}
        </div>

        {/* Griglia appuntamenti giorno - SCROLLABILE */}
        <div className="day-content-wrapper" ref={dayContentRef}>
          <div className="day-column">
            {hours.map(hour => {
              const hourAppointments = getAppointmentsForHour(hour);
              return (
                <div 
                  key={hour} 
                  className="day-time-slot"
                  onClick={() => hourAppointments.length === 0 && onSlotClick(selectedDate, hour)}
                >
                  {hourAppointments.map(apt => (
                    <div 
                      key={apt.id}
                      className="appointment-block"
                      style={{
                        backgroundColor: apt.service.color + '20',
                        borderLeftColor: apt.service.color,
                        height: `${getAppointmentHeight(apt)}px`,
                        top: `${getAppointmentTop(apt)}px`
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick(apt);
                      }}
                    >
                      <div className="apt-block-time">
                        {new Date(apt.bookingStart).toLocaleTimeString('it-IT', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                      <div className="apt-block-customer">{apt.customer.name}</div>
                      <div className="apt-block-service">{apt.service.name}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekView({ weekDays, appointments, onAppointmentClick, onSlotClick }) {
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);
  const daysHeaderRef = React.useRef(null);
  const daysContentRef = React.useRef(null);
  const timeColumnRef = React.useRef(null);

  const getAppointmentsForSlot = (day, hour) => {
    const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    
    return appointments.filter(apt => {
      const aptStart = new Date(apt.bookingStart);
      const aptHour = aptStart.getHours();
      const aptDayStr = `${aptStart.getFullYear()}-${String(aptStart.getMonth() + 1).padStart(2, '0')}-${String(aptStart.getDate()).padStart(2, '0')}`;
      
      return aptDayStr === dayStr && aptHour === hour;
    });
  };

  const getAppointmentHeight = (apt) => {
    const start = new Date(apt.bookingStart);
    const end = new Date(apt.bookingEnd);
    const durationMinutes = (end - start) / (1000 * 60);
    return Math.max(durationMinutes * 2.33, 110);
  };

  const getAppointmentTop = (apt) => {
    const aptStart = new Date(apt.bookingStart);
    const minutes = aptStart.getMinutes();
    return (minutes * 2.33);
  };

  // Sincronizza scroll orizzontale tra header e content
  React.useEffect(() => {
    const daysHeader = daysHeaderRef.current;
    const daysContent = daysContentRef.current;
    
    if (!daysHeader || !daysContent) return;
    
    const syncScroll = (e) => {
      if (e.target === daysContent) {
        daysHeader.scrollLeft = daysContent.scrollLeft;
      } else if (e.target === daysHeader) {
        daysContent.scrollLeft = daysHeader.scrollLeft;
      }
    };
    
    daysHeader.addEventListener('scroll', syncScroll);
    daysContent.addEventListener('scroll', syncScroll);
    
    return () => {
      daysHeader.removeEventListener('scroll', syncScroll);
      daysContent.removeEventListener('scroll', syncScroll);
    };
  }, []);

  // Sincronizza scroll verticale tra time-column e days-content
  React.useEffect(() => {
    const timeColumn = timeColumnRef.current;
    const daysContent = daysContentRef.current;
    
    if (!timeColumn || !daysContent) return;
    
    const syncVerticalScroll = (e) => {
      if (e.target === daysContent) {
        timeColumn.scrollTop = daysContent.scrollTop;
      } else if (e.target === timeColumn) {
        daysContent.scrollTop = timeColumn.scrollTop;
      }
    };
    
    timeColumn.addEventListener('scroll', syncVerticalScroll);
    daysContent.addEventListener('scroll', syncVerticalScroll);
    
    return () => {
      timeColumn.removeEventListener('scroll', syncVerticalScroll);
      daysContent.removeEventListener('scroll', syncVerticalScroll);
    };
  }, []);

  return (
    <div className="week-view-scroll-container">
      <div className="week-grid-container">
        {/* Angolo in alto a sinistra - FISSO */}
        <div className="time-header"></div>

        {/* Header giorni - FISSO con scroll orizzontale nascosto */}
        <div className="days-header" ref={daysHeaderRef}>
          {weekDays.map((day, index) => {
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <div key={index} className={`day-header ${isToday ? 'today' : ''}`}>
                <div className="day-name">
                  {day.toLocaleDateString('it-IT', { weekday: 'short' })}
                </div>
                <div className="day-number">
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Colonna orari - FISSA con scroll verticale nascosto */}
        <div className="time-column" ref={timeColumnRef}>
          {hours.map(hour => (
            <div key={hour} className="time-slot">
              {`${hour}:00`}
            </div>
          ))}
        </div>

        {/* Griglia appuntamenti - SCROLLABILE */}
        <div className="days-content" ref={daysContentRef}>
          {weekDays.map((day, dayIndex) => (
            <div key={dayIndex} className="day-column">
              {hours.map(hour => {
                const slotAppointments = getAppointmentsForSlot(day, hour);
                return (
                  <div 
                    key={hour} 
                    className="day-time-slot"
                    onClick={() => slotAppointments.length === 0 && onSlotClick(day, hour)}
                  >
                    {slotAppointments.map(apt => (
                      <div 
                        key={apt.id}
                        className="appointment-block"
                        style={{
                          backgroundColor: apt.service.color + '20',
                          borderLeftColor: apt.service.color,
                          height: `${getAppointmentHeight(apt)}px`,
                          top: `${getAppointmentTop(apt)}px`
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAppointmentClick(apt);
                        }}
                      >
                        <div className="apt-block-time">
                          {new Date(apt.bookingStart).toLocaleTimeString('it-IT', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                        <div className="apt-block-customer">{apt.customer.name}</div>
                        <div className="apt-block-service">{apt.service.name}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthView({ selectedDate, appointments, onAppointmentClick, getStatusBadge }) {
  const generateMonthDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];
    
    for (let i = 0; i < (startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1); i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const getAppointmentsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return appointments.filter(apt => apt.bookingStart.startsWith(dateStr));
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return day === today.getDate() && 
           selectedDate.getMonth() === today.getMonth() && 
           selectedDate.getFullYear() === today.getFullYear();
  };

  return (
    <div className="month-view">
      <div className="weekday-headers">
        {['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].map((day) => (
          <div key={day} className="weekday-header">{day}</div>
        ))}
      </div>
      <div className="month-grid">
        {generateMonthDays().map((day, index) => {
          const dayAppointments = day ? getAppointmentsForDay(day) : [];
          
          return (
            <div key={index} className={`day-cell ${day ? 'has-day' : 'empty'} ${isToday(day) ? 'today' : ''}`}>
              {day && (
                <>
                  <div className="day-number">{day}</div>
                  <div className="day-appointments">
                    {dayAppointments.slice(0, 3).map((apt) => (
                      <div 
                        key={apt.id} 
                        onClick={() => onAppointmentClick(apt)} 
                        className="appointment-item"
                        style={{ 
                          backgroundColor: apt.service.color + '20', 
                          borderLeftColor: apt.service.color
                        }}
                      >
                        <div className="apt-time">{new Date(apt.bookingStart).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="apt-customer">{apt.customer.name}</div>
                      </div>
                    ))}
                    {dayAppointments.length > 3 && (
                      <div className="more-appointments">+{dayAppointments.length - 3} altri</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilteredAppointmentsList({ appointments, filterStatus, onClose, onAppointmentClick, getStatusBadge }) {
  const getTitle = () => {
    switch(filterStatus) {
      case 'today': return 'Appuntamenti di Oggi';
      case 'total': return 'Tutti gli Appuntamenti';
      case 'approved': return 'Appuntamenti Confermati';
      case 'pending': return 'Appuntamenti In Attesa';
      case 'canceled': return 'Appuntamenti Annullati';
      case 'rejected': return 'Appuntamenti Rifiutati';
      default: return 'Appuntamenti';
    }
  };

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('it-IT', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
  const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString('it-IT', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className="modal-overlay">
      <div className="modal-content filtered-list-modal">
        <div className="modal-header">
          <h2>{getTitle()} ({appointments.length})</h2>
          <button onClick={onClose} className="modal-close">
            <X size={24} />
          </button>
        </div>
        
        <div className="filtered-appointments-list">
          {appointments.length === 0 ? (
            <div className="empty-state">
              <Calendar size={48} />
              <p>Nessun appuntamento trovato</p>
            </div>
          ) : (
            appointments.map((apt) => (
              <div 
                key={apt.id} 
                onClick={() => onAppointmentClick(apt)} 
                className="filtered-appointment-card"
                style={{ borderLeftColor: apt.service.color }}
              >
                <div className="apt-header">
                  <div>
                    <div className="apt-name">{apt.customer.name}</div>
                    <div className="apt-service">{apt.service.name}</div>
                  </div>
                  {getStatusBadge(apt.status)}
                </div>
                <div className="apt-meta">
                  <div>
                    <Clock size={14} />
                    {formatDate(apt.bookingStart)} - {formatTime(apt.bookingStart)}
                  </div>
                  {apt.location.name && (
                    <div>
                      <MapPin size={14} />
                      {apt.location.name}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="btn-cancel">Chiudi</button>
        </div>
      </div>
    </div>
  );
}

function AppointmentDetailModal({ appointment, onClose, onUpdate, onCancel, getStatusBadge }) {
  const [editing, setEditing] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(false);
  const [notes, setNotes] = useState(appointment.internalNotes || '');
  const [appointmentData, setAppointmentData] = useState({
    bookingStart: appointment.bookingStart,
    bookingEnd: appointment.bookingEnd,
    status: appointment.status
  });
  
  const handleSaveNotes = () => { 
    onUpdate(appointment.id, { internalNotes: notes }); 
    setEditing(false); 
  };

  const handleSaveAppointment = () => {
    onUpdate(appointment.id, appointmentData);
    setEditingAppointment(false);
  };

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Dettagli Appuntamento</h2>
          <button onClick={onClose} className="modal-close">
            <X size={24} />
          </button>
        </div>
        
        <div className="detail-list">
          <div className="detail-item">
            <User size={20} />
            <div>
              <div className="detail-label">Paziente</div>
              <div className="detail-value">{appointment.customer.name}</div>
            </div>
          </div>
          
          <div className="detail-item">
            <Mail size={20} />
            <div>
              <div className="detail-label">Email</div>
              <div className="detail-value">{appointment.customer.email || 'Non fornita'}</div>
            </div>
          </div>
          
          <div className="detail-item">
            <Phone size={20} />
            <div>
              <div className="detail-label">Telefono</div>
              <div className="detail-value">{appointment.customer.phone || 'Non fornito'}</div>
            </div>
          </div>
          
          <div className="detail-item">
            <Clock size={20} />
            <div style={{ flex: 1 }}>
              <div className="detail-label">Data e Ora</div>
              {editingAppointment ? (
                <div>
                  <div className="form-row" style={{ marginBottom: '0.5rem' }}>
                    <input
                      type="datetime-local"
                      value={appointmentData.bookingStart.replace(' ', 'T').slice(0, 16)}
                      onChange={(e) => setAppointmentData(prev => ({ ...prev, bookingStart: e.target.value.replace('T', ' ') + ':00' }))}
                      style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--sage-muted)', fontSize: '0.875rem' }}
                    />
                    <input
                      type="datetime-local"
                      value={appointmentData.bookingEnd.replace(' ', 'T').slice(0, 16)}
                      onChange={(e) => setAppointmentData(prev => ({ ...prev, bookingEnd: e.target.value.replace('T', ' ') + ':00' }))}
                      style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--sage-muted)', fontSize: '0.875rem' }}
                    />
                  </div>
                  <div className="notes-actions">
                    <button onClick={handleSaveAppointment} className="btn-save">Salva</button>
                    <button onClick={() => { setAppointmentData({ bookingStart: appointment.bookingStart, bookingEnd: appointment.bookingEnd, status: appointment.status }); setEditingAppointment(false); }} className="btn-cancel">Annulla</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="detail-value">
                    {formatDate(appointment.bookingStart)} - {formatTime(appointment.bookingStart)} / {formatTime(appointment.bookingEnd)}
                  </div>
                  <button onClick={() => setEditingAppointment(true)} className="btn-edit">Modifica orario</button>
                </div>
              )}
            </div>
          </div>
          
          <div className="detail-item">
            <MapPin size={20} />
            <div>
              <div className="detail-label">Luogo</div>
              <div className="detail-value">{appointment.location.name}</div>
            </div>
          </div>
          
          {(appointment.internalNotes || editing) && (
            <div className="detail-item">
              <FileText size={20} />
              <div className="detail-notes">
                <div className="detail-label">Note Interne</div>
                {editing ? (
                  <div>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="4" />
                    <div className="notes-actions">
                      <button onClick={handleSaveNotes} className="btn-save">Salva</button>
                      <button onClick={() => { setNotes(appointment.internalNotes || ''); setEditing(false); }} className="btn-cancel">Annulla</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="detail-value">{appointment.internalNotes || 'Nessuna nota'}</div>
                    <button onClick={() => setEditing(true)} className="btn-edit">Modifica note</button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="detail-item">
            <div style={{ width: '20px' }}></div>
            <div style={{ flex: 1 }}>
              <div className="detail-label">Stato</div>
              {editingAppointment ? (
                <select
                  value={appointmentData.status}
                  onChange={(e) => setAppointmentData(prev => ({ ...prev, status: e.target.value }))}
                  style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--sage-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}
                >
                  <option value="approved">Confermato</option>
                  <option value="pending">In Attesa</option>
                  <option value="canceled">Annullato</option>
                  <option value="rejected">Rifiutato</option>
                  <option value="no-show">Assente</option>
                </select>
              ) : (
                <div>{getStatusBadge(appointment.status)}</div>
              )}
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="btn-cancel">Chiudi</button>
          <button onClick={() => onCancel(appointment.id)} className="btn-delete">
            <Trash2 size={18} /> Cancella
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateAppointmentModal({ onClose, onCreate, services, customers, locations, initialDateTime }) {
  const [formData, setFormData] = useState({ 
    customerId: '', 
    serviceId: '', 
    locationId: '', 
    bookingStart: initialDateTime ? initialDateTime.toISOString().slice(0, 16).replace('T', ' ') + ':00' : '', 
    bookingEnd: '', 
    internalNotes: '', 
    status: 'approved' 
  });
  
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    note: ''
  });
  
  const handleSubmit = (e) => { 
    e.preventDefault(); 
    if (!formData.customerId || !formData.serviceId || !formData.bookingStart || !formData.bookingEnd) { 
      alert('Compila tutti i campi obbligatori'); 
      return; 
    } 
    onCreate(formData); 
  };
  
  const handleServiceChange = (serviceId) => { 
    const service = services.find(s => s.id === parseInt(serviceId)); 
    setFormData(prev => { 
      const newData = { ...prev, serviceId }; 
      if (service && prev.bookingStart) { 
        const start = new Date(prev.bookingStart); 
        const end = new Date(start.getTime() + service.duration * 60000); 
        newData.bookingEnd = end.toISOString().slice(0, 16).replace('T', ' ') + ':00'; 
      } 
      return newData; 
    }); 
  };
  
  const handleCreateCustomer = async () => {
    if (!newCustomerData.firstName || !newCustomerData.lastName || !newCustomerData.email || !newCustomerData.phone) {
      alert('Compila tutti i campi obbligatori (Nome, Cognome, Email, Telefono)');
      return;
    }
    
    const newCustomer = {
      id: Date.now(),
      name: `${newCustomerData.firstName} ${newCustomerData.lastName}`,
      email: newCustomerData.email,
      phone: newCustomerData.phone,
      gender: newCustomerData.gender,
      dateOfBirth: newCustomerData.dateOfBirth,
      note: newCustomerData.note
    };
    
    customers.push(newCustomer);
    setFormData(prev => ({ ...prev, customerId: newCustomer.id }));
    setNewCustomerData({ firstName: '', lastName: '', email: '', phone: '', gender: '', dateOfBirth: '', note: '' });
    setShowNewCustomer(false);
    alert('Paziente creato con successo!');
  };
  
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Nuovo Appuntamento</h2>
          <button onClick={onClose} className="modal-close">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <div className="form-label-row">
              <label>Paziente *</label>
              <button 
                type="button"
                className="btn-new-customer"
                onClick={() => setShowNewCustomer(!showNewCustomer)}
              >
                <Plus size={16} />
                Nuovo Paziente
              </button>
            </div>
            
            {!showNewCustomer ? (
              <select 
                value={formData.customerId} 
                onChange={(e) => setFormData(prev => ({ ...prev, customerId: e.target.value }))} 
                required
              >
                <option value="">Seleziona paziente</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            ) : (
              <div className="new-customer-form">
                <h3>Aggiungi Paziente</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Nome *</label>
                    <input
                      type="text"
                      placeholder="Nome"
                      value={newCustomerData.firstName}
                      onChange={(e) => setNewCustomerData(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Cognome *</label>
                    <input
                      type="text"
                      placeholder="Cognome"
                      value={newCustomerData.lastName}
                      onChange={(e) => setNewCustomerData(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      placeholder="Email"
                      value={newCustomerData.email}
                      onChange={(e) => setNewCustomerData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Telefono *</label>
                    <input
                      type="tel"
                      placeholder="Telefono"
                      value={newCustomerData.phone}
                      onChange={(e) => setNewCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Genere</label>
                    <select
                      value={newCustomerData.gender}
                      onChange={(e) => setNewCustomerData(prev => ({ ...prev, gender: e.target.value }))}
                    >
                      <option value="">Seleziona</option>
                      <option value="male">Maschio</option>
                      <option value="female">Femmina</option>
                      <option value="other">Altro</option>
                      <option value="prefer-not-to-say">Preferisco non specificare</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Data di Nascita</label>
                    <input
                      type="date"
                      value={newCustomerData.dateOfBirth}
                      onChange={(e) => setNewCustomerData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Nota</label>
                  <textarea
                    placeholder="Dettagli"
                    value={newCustomerData.note}
                    onChange={(e) => setNewCustomerData(prev => ({ ...prev, note: e.target.value }))}
                    rows="3"
                  />
                </div>
                
                <button 
                  type="button"
                  className="btn-create-customer"
                  onClick={handleCreateCustomer}
                  disabled={!newCustomerData.firstName || !newCustomerData.lastName || !newCustomerData.email || !newCustomerData.phone}
                >
                  <Plus size={16} />
                  Crea Paziente
                </button>
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label>Servizio *</label>
            <select 
              value={formData.serviceId} 
              onChange={(e) => handleServiceChange(e.target.value)} 
              required
            >
              <option value="">Seleziona servizio</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name} ({service.duration} min - €{service.price})
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Data e Ora Inizio *</label>
              <input 
                type="datetime-local" 
                value={formData.bookingStart.replace(' ', 'T').slice(0, 16)} 
                onChange={(e) => setFormData(prev => ({ ...prev, bookingStart: e.target.value.replace('T', ' ') + ':00' }))} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Data e Ora Fine *</label>
              <input 
                type="datetime-local" 
                value={formData.bookingEnd.replace(' ', 'T').slice(0, 16)} 
                onChange={(e) => setFormData(prev => ({ ...prev, bookingEnd: e.target.value.replace('T', ' ') + ':00' }))} 
                required 
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Luogo</label>
            <select 
              value={formData.locationId} 
              onChange={(e) => setFormData(prev => ({ ...prev, locationId: e.target.value }))}
            >
              <option value="">Seleziona luogo (opzionale)</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Stato</label>
            <select 
              value={formData.status} 
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="approved">Confermato</option>
              <option value="pending">In Attesa</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Note Interne</label>
            <textarea 
              value={formData.internalNotes} 
              onChange={(e) => setFormData(prev => ({ ...prev, internalNotes: e.target.value }))} 
              rows="4" 
              placeholder="Aggiungi note per questo appuntamento..." 
            />
          </div>
          
          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">Annulla</button>
            <button type="submit" className="btn-submit">
              <Save size={18} /> Crea Appuntamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}