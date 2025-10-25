import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, MapPin, Phone, Mail, FileText, ChevronLeft, ChevronRight, Plus, X, Save, Trash2, AlertCircle, Menu, CreditCard } from 'lucide-react';
import './App.css';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { it } from 'date-fns/locale';
import { registerLocale } from 'react-datepicker';

registerLocale('it', it);

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
  const [allAppointments, setAllAppointments] = useState([]); // ← QUESTA RIGA DEVE ESSERCI

  const config = window.ameliaCalendarData || {};
  const apiUrl = config.restUrl || '/amelia-api.php';
  console.log('🔧 API URL configurato:', apiUrl);

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
    // PRIORITÀ 1: Appuntamenti (bloccante)
    await loadAppointments();
    
    // PRIORITÀ 2: Services + Customers + Locations + STATS (background parallelo)
    Promise.all([
      fetchAPI('services').then(d => setServices(d.data || [])),
      fetchAPI('customers').then(d => setCustomers(d.data || [])),
      fetchAPI('locations').then(d => setLocations(d.data || [])),
      fetchAPI('stats').then(d => setStats(d.data || null))  // ← QUESTA RIGA DEVE ESSERCI
    ]).catch(err => console.error('Background load:', err));
    
  } catch (err) {
    setError(err.message || 'Errore caricamento dati');
  } finally {
    setLoading(false);
  }
};

  const loadAppointments = async () => {
  try {
    const { startDate, endDate } = getDateRange();
    const appointmentsData = await fetchAPI(`appointments?start_date=${formatAPIDate(startDate)}&end_date=${formatAPIDate(endDate)}`);
    
    const allData = appointmentsData.data || [];
    
    setAllAppointments(allData); // ← DEVE esserci
    
    const activeAppointments = allData.filter(apt => apt.status !== 'canceled');
    setAppointments(activeAppointments); // ← DEVE esserci
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
        fetchAPI(`appointments?start_date=${formatAPIDate(startDate)}&end_date=${formatAPIDate(endDate)}`),
        fetchAPI('services'),
        fetchAPI('customers'),
        fetchAPI('locations'),
        fetchAPI('stats')
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

  // MODIFICA 2: Cache sessionStorage in fetchAPI
  const fetchAPI = async (endpoint, options = {}, retries = 2) => {
    const cacheKey = `apc_cache_${endpoint}`;
    
    // Cache per GET requests
    if (!options.method || options.method === 'GET') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 120000) { // 2 minuti
            return data;
          }
        } catch (e) {
          sessionStorage.removeItem(cacheKey);
        }
      }
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout 5s

      let url;
if (endpoint.includes('?')) {
  // Se ha già parametri (es: appointments?start_date=...)
  const [action, params] = endpoint.split('?');
  url = `${apiUrl}?action=${action}&${params}`;
} else if (endpoint.includes('/') && !endpoint.startsWith('/')) {
  // Se contiene uno slash (es: appointments/123)
  const [action, id] = endpoint.split('/');
  url = `${apiUrl}?action=${action}&id=${id}`;
} else {
  // Endpoint semplice (es: services)
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  url = `${apiUrl}?action=${cleanEndpoint}`;
}
console.log('🔧 API Call:', url);
const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': config.nonce,
        ...options.headers
        }
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if ((response.status === 508 || response.status === 503) && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 300)); // 300ms;
          return fetchAPI(endpoint, options, retries - 1);
        }
        const errorData = await response.json().catch(() => ({ message: 'Errore API' }));
        throw new Error(errorData.message || `Errore ${response.status}`);
      }
      
      const data = await response.json();
      
      // Salva cache solo GET
      if (!options.method || options.method === 'GET') {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data,
            timestamp: Date.now()
          }));
        } catch (e) {} // Quota exceeded
      }
      
      return data;
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

  const handleCreateAppointment = async () => {
  try {
    setLoading(true);
    
    setShowCreateModal(false);
    setCreateModalTime(null);
    await loadAppointments();
    await fetchAPI('stats').then(d => setStats(d.data || null));
    
  } catch (err) {
    console.error('Errore reload:', err);
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
      await loadAppointments();
      await fetchAPI('stats').then(d => setStats(d.data || null));
      
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
      await loadAppointments();
      await fetchAPI('stats').then(d => setStats(d.data || null));
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
      return allAppointments.filter(apt => 
        apt.bookingStart.startsWith(today) && apt.status === 'approved'
      );
    case 'total':
      return allAppointments; // ✅ 
    case 'approved':
      return allAppointments.filter(apt => apt.status === 'approved');
    case 'pending':
      return allAppointments.filter(apt => apt.status === 'pending');
    case 'canceled':
      return allAppointments.filter(apt => apt.status === 'canceled'); // ✅
    case 'rejected':
      return allAppointments.filter(apt => apt.status === 'rejected');
    default:
      return allAppointments;
  }
};

  if (loading && appointments.length === 0) {
    return (
      <div className="fantastical-app">
        <div className="fantastical-header" style={{ opacity: 0.5 }}>
          <div style={{ height: '100px', background: 'var(--gray-100)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }}></div>
        </div>
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
          setCustomers={setCustomers}  // ← AGGIUNGI QUESTA RIGA 
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
        <div className="time-header"></div>

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

        <div className="time-column" ref={timeColumnRef}>
          {hours.map(hour => (
            <div key={hour} className="calendar-time-slot">
              {`${hour}:00`}
            </div>
          ))}
        </div>

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
        <div className="time-header"></div>

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

        <div className="time-column" ref={timeColumnRef}>
          {hours.map(hour => (
            <div key={hour} className="calendar-time-slot">
              {`${hour}:00`}
            </div>
          ))}
        </div>

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
 
// SOSTITUISCI la funzione CreateAppointmentModal in App.jsx con questa versione

function CreateAppointmentModal({ onClose, onCreate, services, customers, setCustomers, locations, initialDateTime }) {
  const [formData, setFormData] = useState({ 
    customerId: '', 
    serviceId: '', 
    locationId: '', 
    bookingStart: initialDateTime ? initialDateTime.toISOString().slice(0, 16).replace('T', ' ') + ':00' : '', 
    bookingEnd: '', 
    internalNotes: '', 
    status: 'approved',
    requirePayment: false
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
  
  const [paymentLink, setPaymentLink] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDateTime || null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [availableDays, setAvailableDays] = useState([]);
  const [availableDaysCache, setAvailableDaysCache] = useState({});

  
  const config = window.ameliaCalendarData || {};
  const apiUrl = config.restUrl || '/amelia-api.php';

// Dove viene chiamato loadAvailableDays
useEffect(() => {
  console.log('🔄 Location/Service cambiato:', {
    locationId: formData.locationId,
    serviceId: formData.serviceId
  });
  
  if (formData.serviceId && formData.locationId) {
    loadAvailableDays();
  }
}, [formData.serviceId, formData.locationId]);

  const loadAvailableDays = async () => {
  if (!formData.serviceId || !formData.locationId) return;
  
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  
  const cacheKey = `${year}-${month}-${formData.serviceId}-${formData.locationId}`;
  
  // Check cache
  if (availableDaysCache[cacheKey]) {
    console.log('📦 Cache hit:', cacheKey);
    setAvailableDays(availableDaysCache[cacheKey]);
    return;
  }
  
  try {
    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
      service_id: formData.serviceId,
      location_id: formData.locationId  // ← VERIFICA che questo sia corretto
    });
    
    console.log('🔍 Fetch API:', params.toString());
    
    const response = await fetch(`${apiUrl}/availability/days?${params}`, {
      headers: {
        'X-WP-Nonce': config.nonce,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      const days = result.data || [];
      
      console.log('✅ Giorni ricevuti:', days);
      
      setAvailableDays(days);
      setAvailableDaysCache(prev => ({
        ...prev,
        [cacheKey]: days
      }));
    }
  } catch (err) {
    console.error('❌ Errore caricamento giorni:', err);
  }
};

// 3. Modifica handleMonthChange con cache
const handleMonthChange = async (date) => {
  if (!formData.serviceId || !formData.locationId) return;
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const cacheKey = `${year}-${month}-${formData.serviceId}-${formData.locationId}`;
  
  // ✅ Check cache
  if (availableDaysCache[cacheKey]) {
    setAvailableDays(availableDaysCache[cacheKey]);
    return;
  }
  
  const params = new URLSearchParams({
    year: year.toString(),
    month: month.toString(),
    service_id: formData.serviceId,
    location_id: formData.locationId
  });
  
  try {
    const response = await fetch(`${apiUrl}/availability/days?${params}`, {
      headers: {
        'X-WP-Nonce': config.nonce,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      const days = result.data || [];
      
      setAvailableDays(days);
      setAvailableDaysCache(prev => ({
        ...prev,
        [cacheKey]: days
      }));
    }
  } catch (err) {
    console.error('Errore cambio mese:', err);
  }
};
  // Carica slot quando cambiano servizio, location o data
  useEffect(() => {
    if (formData.serviceId && selectedDate) {
      loadAvailableSlots();
    }
  }, [formData.serviceId, formData.locationId, selectedDate]);

  const loadAvailableSlots = async (date) => {
  console.log('🎰 loadAvailableSlots chiamata per:', date);
  console.log('🎰 formData:', {
    serviceId: formData.serviceId,
    locationId: formData.locationId,
    providerId: config.providerId
  });
  
  if (!date || !formData.serviceId || !formData.locationId) {
    console.log('❌ Mancano parametri per loadAvailableSlots');
    return;
  }
  
  try {
    setLoadingSlots(true);
    
    const params = new URLSearchParams({
      start_date: date,
      end_date: date,
      service_id: formData.serviceId,
      location_id: formData.locationId
    });
    
    console.log('🔍 API Slots URL:', `${apiUrl}/availability/slots?${params}`);
    
    const response = await fetch(`${apiUrl}/availability/slots?${params}`, {
      headers: {
        'X-WP-Nonce': config.nonce,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📥 Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Slots ricevuti:', result);
      
      const slots = result.data?.[date] || [];
      console.log('🎰 Slots per', date, ':', slots);
      
      setAvailableSlots(slots);
      setShowTimePicker(slots.length > 0);
    } else {
      const errorText = await response.text();
      console.error('❌ Errore response:', errorText);
      setAvailableSlots([]);
      setShowTimePicker(false);
    }
  } catch (error) {
    console.error('❌ Errore loadAvailableSlots:', error);
    setAvailableSlots([]);
    setShowTimePicker(false);
  } finally {
    setLoadingSlots(false);
  }
};

  const handleTimeSelect = (datetime) => {
  // ✅ FIX: Forza timezone locale italiano
  const localDate = new Date(datetime);
  
  // Formatta in 'YYYY-MM-DD HH:MM:SS' locale (non UTC)
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  
  const bookingStartLocal = `${year}-${month}-${day} ${hours}:${minutes}:00`;
  
  setFormData(prev => {
    const newData = { ...prev, bookingStart: bookingStartLocal };
    
    // Calcola automaticamente bookingEnd
    if (prev.serviceId) {
      const service = services.find(s => String(s.id) === String(prev.serviceId));
      if (service && service.duration) {
        const endDate = new Date(localDate.getTime() + (service.duration * 60 * 1000));
        
        const endYear = endDate.getFullYear();
        const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
        const endDay = String(endDate.getDate()).padStart(2, '0');
        const endHours = String(endDate.getHours()).padStart(2, '0');
        const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
        
        newData.bookingEnd = `${endYear}-${endMonth}-${endDay} ${endHours}:${endMinutes}:00`;
      }
    }
    
    console.log('🔧 Slot selezionato:', {
      input: datetime,
      bookingStart: bookingStartLocal,
      bookingEnd: newData.bookingEnd
    });
    
    return newData;
  });
  
  setShowTimePicker(false);
};

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  console.log('🚀 handleSubmit chiamato');
  console.log('📋 FormData:', formData);
  
  if (!formData.customerId || !formData.serviceId || !formData.bookingStart) {
    alert('Completa tutti i campi obbligatori');
    return;
  }
  
  try {
    setSaving(true);
    
    const appointmentData = {
      customerId: formData.customerId,
      serviceId: formData.serviceId,
      locationId: formData.locationId,
      bookingStart: formData.bookingStart,
      bookingEnd: formData.bookingEnd,
      internalNotes: formData.internalNotes
    };
    
    console.log('📤 Invio dati:', appointmentData);
    console.log('🔗 URL:', `${apiUrl}/appointments`);
    
    const response = await fetch(`${apiUrl}/appointments`, {
      method: 'POST',
      headers: {
        'X-WP-Nonce': config.nonce,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(appointmentData)
    });
    
    console.log('📥 Response status:', response.status);
    
    const result = await response.json();
    console.log('📥 Response data:', result);
    
    if (response.ok && result.success) {
      alert('Appuntamento creato con successo!');
      setShowModal(false);
      loadAppointments();
      resetForm();
    } else {
      console.error('❌ Errore dal server:', result);
      alert('Errore: ' + (result.message || 'Creazione appuntamento fallita'));
    }
  } catch (error) {
    console.error('❌ Errore catch:', error);
    alert('Errore creazione appuntamento: ' + error.message);
  } finally {
    setSaving(false);
  }
};
  
  const handleServiceChange = (serviceId) => { 
  const service = services.find(s => String(s.id) === String(serviceId)); 
  
  setFormData(prev => { 
    const newData = { ...prev, serviceId, bookingStart: '', bookingEnd: '' };
    return newData; 
  });
  
  setSelectedDate(null);
  setAvailableSlots([]);
  setShowTimePicker(false);
};

const handleDateChange = (date) => {
  console.log('📅 Data selezionata RAW:', date);
  
  setSelectedDate(date);
  
  // Fix timezone: usa date locale invece di ISO
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  
  console.log('📅 Data formattata:', formattedDate);
  
  setFormData(prev => ({
    ...prev,
    bookingStart: formattedDate,
    bookingEnd: ''
  }));
  
  // Carica gli slot disponibili per questa data
  loadAvailableSlots(formattedDate);
};

// ✅ Funzione filterDate per DatePicker
const filterDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  
  const isAvailable = availableDays.includes(dateStr);
  
  console.log('🔍 filterDate:', {
    date: dateStr,
    dayName: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][date.getDay()],
    isAvailable: isAvailable,
    availableDaysCount: availableDays.length,
    firstAvailableDays: availableDays.slice(0, 3)
  });
  
  return isAvailable;
};

const handleCreateCustomer = async () => {
  if (!newCustomerData.firstName || !newCustomerData.lastName || !newCustomerData.email || !newCustomerData.phone) {
    alert('Compila tutti i campi obbligatori (Nome, Cognome, Email, Telefono)');
    return;
  }
    
    try {
      const response = await fetch(`${apiUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': config.nonce
        },
        body: JSON.stringify({
          firstName: newCustomerData.firstName,
          lastName: newCustomerData.lastName,
          email: newCustomerData.email,
          phone: newCustomerData.phone,
          gender: newCustomerData.gender || 'not-specified',
          birthday: newCustomerData.dateOfBirth || null,
          note: newCustomerData.note || ''
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Errore creazione cliente');
      }
      
      const result = await response.json();
      
      const newCustomer = {
        id: result.data.id,
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        email: result.data.email,
        phone: result.data.phone,
        name: `${result.data.firstName} ${result.data.lastName}`
      };
      
      setCustomers(prev => {
        const exists = prev.find(c => c.id === newCustomer.id);
        if (exists) {
          return prev;
        }
        return [...prev, newCustomer];
      });
      
      setFormData(prev => ({ ...prev, customerId: newCustomer.id }));
      
      setNewCustomerData({ 
        firstName: '', 
        lastName: '', 
        email: '', 
        phone: '', 
        gender: '', 
        dateOfBirth: '', 
        note: '' 
      });
      setShowNewCustomer(false);
      
      const message = result.message || 'Paziente pronto per la prenotazione!';
      alert(message);
      
    } catch (error) {
      console.error('Errore creazione cliente:', error);
      
      if (error.message.includes('user_type_conflict') || error.message.includes('professionista')) {
        alert('ATTENZIONE: Questa email appartiene già a un professionista.\n\nPer prenotare appuntamenti, usa un\'email cliente diversa.');
      } else if (error.message.includes('Email già registrata')) {
        alert('Questa email è già registrata come paziente.\n\nProva a cercarla nella lista esistente.');
      } else {
        alert('Errore durante la creazione del paziente: ' + error.message);
      }
    }
  };

  // Raggruppa slot per periodo del giorno
  const groupSlotsByPeriod = () => {
    const periods = {
      morning: { label: 'Mattina (07:00-12:00)', slots: [] },
      afternoon: { label: 'Pomeriggio (12:00-18:00)', slots: [] },
      evening: { label: 'Sera (18:00-21:00)', slots: [] }
    };

    availableSlots.forEach(slot => {
      const hour = parseInt(slot.time.split(':')[0]);
      
      if (hour < 12) {
        periods.morning.slots.push(slot);
      } else if (hour < 18) {
        periods.afternoon.slots.push(slot);
      } else {
        periods.evening.slots.push(slot);
      }
    });

    return periods;
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
          {paymentLink ? (
            // Mostra Payment Link
            <div style={{ textAlign: 'center' }}>
              {/* ... codice payment link esistente ... */}
            </div>
          ) : (
            <>
              {/* Cliente */}
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
                    // FORM crea paziente COMPLETO:
<div className="new-customer-form">
  <h3>Crea Nuovo Paziente</h3>
  
  <div className="customer-form-row">
    <div className="form-group">
      <label>Nome *</label>
      <input
        type="text"
        value={newCustomerData.firstName}
        onChange={(e) => setNewCustomerData(prev => ({ ...prev, firstName: e.target.value }))}
        placeholder="Nome"
        required
      />
    </div>
    
    <div className="form-group">
      <label>Cognome *</label>
      <input
        type="text"
        value={newCustomerData.lastName}
        onChange={(e) => setNewCustomerData(prev => ({ ...prev, lastName: e.target.value }))}
        placeholder="Cognome"
        required
      />
    </div>
  </div>
  
  <div className="customer-form-row">
    <div className="form-group">
      <label>Email *</label>
      <input
        type="email"
        value={newCustomerData.email}
        onChange={(e) => setNewCustomerData(prev => ({ ...prev, email: e.target.value }))}
        placeholder="email@esempio.com"
        required
      />
    </div>
    
    <div className="form-group">
      <label>Telefono *</label>
      <input
        type="tel"
        value={newCustomerData.phone}
        onChange={(e) => setNewCustomerData(prev => ({ ...prev, phone: e.target.value }))}
        placeholder="+39 000 000 0000"
        required
      />
    </div>
  </div>
  
  <div className="customer-form-row">
    <div className="form-group">
      <label>Genere</label>
      <select
        value={newCustomerData.gender}
        onChange={(e) => setNewCustomerData(prev => ({ ...prev, gender: e.target.value }))}
      >
        <option value="">Seleziona genere</option>
        <option value="male">Maschio</option>
        <option value="female">Femmina</option>
        <option value="other">Altro</option>
        <option value="not-specified">Non specificato</option>
      </select>
    </div>
    
    <div className="form-group">
      <label>Data di nascita</label>
      <input
        type="date"
        value={newCustomerData.dateOfBirth}
        onChange={(e) => setNewCustomerData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
      />
    </div>
  </div>
  
  <div className="form-group">
    <label>Note</label>
    <textarea
      value={newCustomerData.note}
      onChange={(e) => setNewCustomerData(prev => ({ ...prev, note: e.target.value }))}
      placeholder="Note aggiuntive sul paziente..."
      rows="3"
    />
  </div>
  
  <div className="customer-form-actions">
    <button
      type="button"
      className="btn-cancel"
      onClick={() => setShowNewCustomer(false)}
    >
      Annulla
    </button>
    <button
      type="button"
      className="btn-create-customer"
      onClick={handleCreateCustomer}
    >
      <User size={16} />
      Crea Paziente
    </button>
  </div>
</div>
                  </div>
                )}
              </div>
              
              {/* Servizio */}
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
              
              {/* Location */}
<div className="form-group">
  <label>Luogo *</label>
  <select 
    value={formData.locationId} 
    onChange={(e) => {
      setFormData(prev => ({ 
        ...prev, 
        locationId: e.target.value, 
        bookingStart: '', 
        bookingEnd: '' 
      }));
      setSelectedDate(null);
      setAvailableDays([]);
      setAvailableDaysCache({});
    }}
    required
  >
    <option value="">Seleziona un luogo</option>
    {locations.map(location => (
      <option key={location.id} value={location.id}>
        {location.name}
      </option>
    ))}
  </select>
</div>
              
{/* Date Picker */}
{formData.serviceId && formData.locationId && (
  <div className="form-group">
    <label>Seleziona Data *</label>
    <DatePicker
      selected={selectedDate}
      onChange={handleDateChange}
      onMonthChange={handleMonthChange}
      dateFormat="dd/MM/yyyy"
      locale="it"
      minDate={new Date()}
      filterDate={filterDate}
      highlightDates={availableDays.map(d => new Date(d + 'T12:00:00'))}
      inline
    />
  </div>
)}
              {/* Time Picker con Slot Disponibili */}
              {selectedDate && formData.serviceId && formData.locationId && (
                <div className="form-group">
                  <label>Orario Disponibile *</label>
                  
                  {loadingSlots ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <div className="loading-spinner"></div>
                      <p>Caricamento orari disponibili...</p>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div style={{ 
                      padding: '20px', 
                      background: '#fef2f2', 
                      borderRadius: '8px', 
                      textAlign: 'center',
                      color: '#dc2626'
                    }}>
                      <AlertCircle size={24} style={{ margin: '0 auto 10px' }} />
                      <p>Nessuno slot disponibile per questa data</p>
                      <small>Seleziona un'altra data</small>
                    </div>
                  ) : (
                    <div className="time-slots-container">
                      {Object.entries(groupSlotsByPeriod()).map(([key, period]) => {
                        if (period.slots.length === 0) return null;

                        return (
                          <div key={key} className="time-period">
                            <div className="period-label">{period.label}</div>
                            <div className="slots-grid">
                              {period.slots.map((slot, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className={`time-slot ${formData.bookingStart === slot.datetime ? 'selected' : ''}`}
                                  onClick={() => handleTimeSelect(slot.datetime)}
                                >
                                  {slot.time}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {formData.bookingStart && (
                    <div style={{ 
                      marginTop: '15px', 
                      padding: '12px', 
                      background: '#dcfce7', 
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Clock size={18} style={{ color: '#16a34a' }} />
                      <span style={{ color: '#15803d', fontWeight: '600' }}>
                        Orario selezionato: {new Date(formData.bookingStart).toLocaleString('it-IT', {
                          day: '2-digit',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Checkbox Pagamento */}
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <input
                    type="checkbox"
                    checked={formData.requirePayment}
                    onChange={(e) => setFormData(prev => ({ ...prev, requirePayment: e.target.checked }))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: '500', color: '#374151' }}>
                    <CreditCard size={18} style={{ display: 'inline', marginRight: '8px' }} />
                    Richiedi pagamento Stripe (genera link per il cliente)
                  </span>
                </label>
              </div>
              
              {/* Note Interne */}
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
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={!formData.bookingStart || !formData.customerId || !formData.serviceId}
                >
                  <Save size={18} /> {formData.requirePayment ? 'Crea e Genera Link' : 'Crea Appuntamento'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
      
      <style jsx>{`
        .time-slots-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-height: 400px;
          overflow-y: auto;
          padding: 10px;
          background: #f9fafb;
          border-radius: 8px;
        }
        
        .time-period {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .period-label {
          font-size: 13px;
          font-weight: 600;
          color: #4b5563;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .slots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 8px;
        }
        
        .time-slot {
          padding: 12px;
          min-height: 50px; /* AGGIUNGI: altezza = larghezza */
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          background: #fff;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          display: flex; /* AGGIUNGI */
          align-items: center; /* AGGIUNGI */
          justify-content: center; /* AGGIUNGI */
        }
        
        .time-slot:hover {
          border-color: #1A5367;
          background: #f0f9ff;
          transform: translateY(-2px);
        }
        
        .time-slot.selected {
          border-color: #1A5367;
          background: #1A5367;
          color: #fff;
        }
        
        .loading-spinner {
          width: 30px;
          height: 30px;
          border: 3px solid #e5e7eb;
          border-top-color: #1A5367;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}