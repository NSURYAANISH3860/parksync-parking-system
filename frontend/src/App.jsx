import React, { useState, useEffect } from 'react';
import { 
  Bike, 
  Car, 
  Truck, 
  Search, 
  Ticket as TicketIcon, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  X, 
  Clock 
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

function App() {
  // Application State
  const [slots, setSlots] = useState({
    bike: { total: 5, available: 5 },
    car: { total: 5, available: 5 },
    truck: { total: 2, available: 2 }
  });
  const [parkedVehicles, setParkedVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form inputs
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [exitInput, setExitInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications & Interactive Receipts
  const [notification, setNotification] = useState(null);
  const [lastTicket, setLastTicket] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Clock ticks
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch slot availability and parked list on load
  const fetchData = async () => {
    try {
      setLoading(true);
      const [slotsRes, parkedRes] = await Promise.all([
        fetch(`${API_BASE}/slots`),
        fetch(`${API_BASE}/parked`)
      ]);

      if (slotsRes.ok && parkedRes.ok) {
        const slotsData = await slotsRes.json();
        const parkedData = await parkedRes.json();
        setSlots(slotsData);
        setParkedVehicles(parkedData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      showNotification('error', 'Failed to connect to backend server. Make sure the API is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to trigger notification banners
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // 1. Handle Park Vehicle Form Submit
  const handlePark = async (e) => {
    e.preventDefault();
    if (!vehicleNumber.trim()) {
      showNotification('error', 'Please enter a vehicle plate number.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/park`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleNumber: vehicleNumber.trim().toUpperCase(),
          vehicleType
        })
      });

      const data = await response.json();

      if (response.status === 201) {
        showNotification('success', `Vehicle ${data.ticket.vehicleNumber} successfully parked!`);
        setLastTicket(data.ticket);
        setLastReceipt(null); // Clear previous checkout details
        setVehicleNumber(''); // Reset form
        fetchData(); // Refresh slots and table
      } else {
        showNotification('error', data.message || 'Failed to park vehicle.');
      }
    } catch (err) {
      console.error('Park error:', err);
      showNotification('error', 'Network error. Please try again.');
    }
  };

  // 2. Handle Exit Vehicle Form Submit
  const handleExit = async (e) => {
    if (e) e.preventDefault();
    if (!exitInput.trim()) {
      showNotification('error', 'Please enter a Ticket ID or Vehicle Number.');
      return;
    }

    const cleanInput = exitInput.trim().toUpperCase();
    const payload = cleanInput.startsWith('TKT-') 
      ? { ticketId: cleanInput }
      : { vehicleNumber: cleanInput };

    try {
      const response = await fetch(`${API_BASE}/exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.status === 200) {
        showNotification('success', `Vehicle checked out! Total Fare: ₹${data.receipt.amount}`);
        setLastReceipt(data.receipt);
        setLastTicket(null); // Clear previous park ticket
        setExitInput(''); // Reset form
        fetchData(); // Refresh slots and table
      } else {
        showNotification('error', data.message || 'Ticket or vehicle not found.');
      }
    } catch (err) {
      console.error('Exit error:', err);
      showNotification('error', 'Network error. Please try again.');
    }
  };

  // Direct checkout handler from table rows
  const handleDirectExit = (ticketId) => {
    setExitInput(ticketId);
    // Execute checkout immediately
    setTimeout(() => {
      const cleanInput = ticketId.trim().toUpperCase();
      fetch(`${API_BASE}/exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: cleanInput })
      })
      .then(res => res.json().then(data => ({ status: res.status, data })))
      .then(({ status, data }) => {
        if (status === 200) {
          showNotification('success', `Vehicle checked out! Total Fare: ₹${data.receipt.amount}`);
          setLastReceipt(data.receipt);
          setLastTicket(null);
          setExitInput('');
          fetchData();
        } else {
          showNotification('error', data.message || 'Failed to checkout vehicle.');
        }
      })
      .catch(err => {
        console.error('Direct exit error:', err);
        showNotification('error', 'Network error.');
      });
    }, 50);
  };

  // Format entry dates beautifully
  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return isoString;
    }
  };

  // Calculate percentages for availability gauges
  const getAvailabilityPercent = (type) => {
    const info = slots[type];
    return ((info.available / info.total) * 100).toFixed(0);
  };

  // Filter parked vehicles based on query
  const filteredVehicles = parkedVehicles.filter(v => 
    v.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.ticketId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="app-container">
      {/* 1. Header Section */}
      <header className="dashboard-header">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight m-0 gradient-text">
            PARKSYNC //
          </h1>
          <p className="text-gray-400 text-sm m-0 mt-1 uppercase tracking-wider">
            Smart Parking Management System
          </p>
        </div>
        <div className="glass-panel px-4 py-2 flex items-center gap-3">
          <Clock className="w-5 h-5 text-purple-400" />
          <span className="font-mono text-sm tracking-widest text-gray-300 font-bold">{currentTime}</span>
        </div>
      </header>

      {/* 2. Notification Banners */}
      {notification && (
        <div className={`custom-alert ${notification.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="font-medium">{notification.message}</span>
          <button className="ml-auto bg-transparent border-0 text-current cursor-pointer hover:opacity-80" onClick={() => setNotification(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Availability Cards */}
      <section className="slots-container">
        {/* Bike Card */}
        <div className="glass-panel card-bike p-6 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-cyan-950/50 rounded-xl border border-cyan-800/30">
              <Bike className="w-6 h-6 text-bike" />
            </div>
            {slots.bike.available === 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider pulse-full">Full</span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-cyan-950/80 text-bike border border-cyan-800/50">
                {slots.bike.available} Free
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-gray-100 m-0">Two Wheeler</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">Bike slot limits: {slots.bike.total}</p>
          
          <div className="w-full bg-gray-900 rounded-full h-2">
            <div 
              className="bg-bike h-2 rounded-full transition-all duration-500" 
              style={{ width: `${getAvailabilityPercent('bike')}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center mt-2 text-xs font-semibold text-cyan-400">
            <span>Occupancy</span>
            <span>{100 - getAvailabilityPercent('bike')}%</span>
          </div>
        </div>

        {/* Car Card */}
        <div className="glass-panel card-car p-6 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-950/50 rounded-xl border border-purple-800/30">
              <Car className="w-6 h-6 text-car" />
            </div>
            {slots.car.available === 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider pulse-full">Full</span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-purple-950/80 text-car border border-purple-800/50">
                {slots.car.available} Free
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-gray-100 m-0">Four Wheeler</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">Car slot limits: {slots.car.total}</p>

          <div className="w-full bg-gray-900 rounded-full h-2">
            <div 
              className="bg-car h-2 rounded-full transition-all duration-500" 
              style={{ width: `${getAvailabilityPercent('car')}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center mt-2 text-xs font-semibold text-purple-400">
            <span>Occupancy</span>
            <span>{100 - getAvailabilityPercent('car')}%</span>
          </div>
        </div>

        {/* Truck Card */}
        <div className="glass-panel card-truck p-6 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-950/50 rounded-xl border border-orange-800/30">
              <Truck className="w-6 h-6 text-truck" />
            </div>
            {slots.truck.available === 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider pulse-full">Full</span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-orange-950/80 text-truck border border-orange-800/50">
                {slots.truck.available} Free
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-gray-100 m-0">Heavy Vehicle</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">Truck slot limits: {slots.truck.total}</p>

          <div className="w-full bg-gray-900 rounded-full h-2">
            <div 
              className="bg-truck h-2 rounded-full transition-all duration-500" 
              style={{ width: `${getAvailabilityPercent('truck')}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center mt-2 text-xs font-semibold text-orange-400">
            <span>Occupancy</span>
            <span>{100 - getAvailabilityPercent('truck')}%</span>
          </div>
        </div>
      </section>

      {/* 4. Controls & Ticket Previews */}
      <section className="dashboard-grid mb-8">
        {/* Left Column: Input Forms */}
        <div className="flex flex-col gap-6">
          {/* Park Vehicle Form */}
          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2 mb-4">
              <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
              Park a Vehicle
            </h2>
            <form onSubmit={handlePark} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vehicle Number Plate</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. KA01AB1234"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Select Vehicle Type</label>
                <div className="type-selector">
                  <div 
                    className={`type-option ${vehicleType === 'bike' ? 'selected' : ''}`}
                    onClick={() => setVehicleType('bike')}
                  >
                    <Bike className={`w-5 h-5 mb-1 ${vehicleType === 'bike' ? 'text-bike' : 'text-gray-400'}`} />
                    <span className="text-xs font-bold text-gray-300">Bike</span>
                    <input type="radio" name="vehicleType" checked={vehicleType === 'bike'} onChange={() => {}} />
                  </div>
                  <div 
                    className={`type-option ${vehicleType === 'car' ? 'selected' : ''}`}
                    onClick={() => setVehicleType('car')}
                  >
                    <Car className={`w-5 h-5 mb-1 ${vehicleType === 'car' ? 'text-car' : 'text-gray-400'}`} />
                    <span className="text-xs font-bold text-gray-300">Car</span>
                    <input type="radio" name="vehicleType" checked={vehicleType === 'car'} onChange={() => {}} />
                  </div>
                  <div 
                    className={`type-option ${vehicleType === 'truck' ? 'selected' : ''}`}
                    onClick={() => setVehicleType('truck')}
                  >
                    <Truck className={`w-5 h-5 mb-1 ${vehicleType === 'truck' ? 'text-truck' : 'text-gray-400'}`} />
                    <span className="text-xs font-bold text-gray-300">Truck</span>
                    <input type="radio" name="vehicleType" checked={vehicleType === 'truck'} onChange={() => {}} />
                  </div>
                </div>
              </div>

              <button type="submit" className="gradient-btn py-3 px-4 rounded-xl cursor-pointer text-sm font-bold uppercase tracking-wider mt-2">
                Generate Parking Ticket
              </button>
            </form>
          </div>

          {/* Exit Vehicle Form */}
          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2 mb-4">
              <span className="w-1.5 h-6 bg-red-500 rounded-full"></span>
              Checkout & Exit
            </h2>
            <form onSubmit={handleExit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ticket ID or Vehicle Plate</label>
                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    className="form-input w-full pr-12" 
                    placeholder="e.g. TKT-1001 or KA01AB1234"
                    value={exitInput}
                    onChange={(e) => setExitInput(e.target.value)}
                  />
                  <LogOut className="absolute right-4 w-5 h-5 text-gray-500 pointer-events-none" />
                </div>
              </div>

              <button type="submit" className="gradient-btn glow-btn-exit py-3 px-4 rounded-xl cursor-pointer text-sm font-bold uppercase tracking-wider mt-1">
                Process Checkout & Exit
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Interactive Paper Ticket View */}
        <div className="flex flex-col">
          <div className="glass-panel p-6 flex-1 flex flex-col">
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2 mb-4">
              <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
              Document Preview
            </h2>

            <div className="flex-1 flex flex-col justify-center items-center">
              {lastTicket ? (
                /* Generated Ticket Receipt */
                <div className="ticket-receipt w-full max-w-sm animate-slideIn">
                  <div className="text-center pb-4 border-b border-gray-800 border-dashed">
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest m-0">PARKSYNC RECEIPT</h3>
                    <p className="text-2xl font-black text-gray-100 m-0 mt-1 font-mono tracking-wider">{lastTicket.ticketId}</p>
                  </div>
                  
                  <div className="py-6 flex flex-col gap-3 font-mono text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">PLATE NO:</span>
                      <span className="text-gray-100 font-bold">{lastTicket.vehicleNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">VEHICLE:</span>
                      <span className="text-gray-100 uppercase font-bold">{lastTicket.vehicleType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">ENTRY:</span>
                      <span className="text-gray-100 text-right font-bold" style={{ fontSize: '0.8rem' }}>
                        {formatTime(lastTicket.entryTime)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-gray-800 border-dashed pt-4 flex flex-col items-center">
                    {/* Fake barcode styling */}
                    <div className="flex gap-0.5 justify-center bg-white p-2 rounded h-12 w-full max-w-xs mb-3 overflow-hidden">
                      <div className="bg-black w-2 h-full"></div>
                      <div className="bg-black w-0.5 h-full"></div>
                      <div className="bg-black w-1 h-full"></div>
                      <div className="bg-black w-3 h-full"></div>
                      <div className="bg-black w-0.5 h-full"></div>
                      <div className="bg-black w-2 h-full"></div>
                      <div className="bg-black w-1 h-full"></div>
                      <div className="bg-black w-0.5 h-full"></div>
                      <div className="bg-black w-2 h-full"></div>
                      <div className="bg-black w-3 h-full"></div>
                      <div className="bg-black w-1 h-full"></div>
                      <div className="bg-black w-0.5 h-full"></div>
                    </div>
                    <button 
                      onClick={() => window.print()}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-800 rounded-lg text-xs font-bold uppercase hover:bg-gray-800 cursor-pointer text-gray-400"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Copy
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => setLastTicket(null)}
                    className="absolute top-4 right-4 bg-transparent border-0 text-gray-500 hover:text-gray-300 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : lastReceipt ? (
                /* Generated Bill Receipt */
                <div className="ticket-receipt w-full max-w-sm border-emerald-900/50 animate-slideIn">
                  <div className="text-center pb-4 border-b border-gray-800 border-dashed">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest m-0">PAYMENT RECEIPT</h3>
                    <p className="text-2xl font-black text-gray-100 m-0 mt-1 font-mono tracking-wider">{lastReceipt.ticketId}</p>
                  </div>
                  
                  <div className="py-6 flex flex-col gap-3 font-mono text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">PLATE NO:</span>
                      <span className="text-gray-100 font-bold">{lastReceipt.vehicleNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">DURATION:</span>
                      <span className="text-gray-100 font-bold">{lastReceipt.durationHours} hr{lastReceipt.durationHours > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">AMOUNT DUE:</span>
                      <span className="text-emerald-400 font-extrabold text-lg">₹{lastReceipt.amount}.00</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-900 pt-3">
                      <span className="text-gray-500">CHECKOUT:</span>
                      <span className="text-gray-100 text-right font-bold" style={{ fontSize: '0.8rem' }}>
                        {formatTime(lastReceipt.exitTime)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-gray-800 border-dashed pt-4 flex flex-col items-center">
                    <div className="border-2 border-emerald-500/30 text-emerald-400 rounded px-6 py-1.5 text-xs font-black uppercase tracking-widest transform -rotate-3 select-none mb-3">
                      PAID / SYSTEM VERIFIED
                    </div>
                    <button 
                      onClick={() => setLastReceipt(null)}
                      className="px-4 py-2 bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/30 rounded-lg text-xs font-bold uppercase cursor-pointer"
                    >
                      Dismiss Receipt
                    </button>
                  </div>

                  <button 
                    onClick={() => setLastReceipt(null)}
                    className="absolute top-4 right-4 bg-transparent border-0 text-gray-500 hover:text-gray-300 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                /* No Selection Placeholder */
                <div className="text-center py-12 px-6 flex flex-col items-center justify-center border border-dashed border-gray-800 rounded-2xl w-full">
                  <TicketIcon className="w-12 h-12 text-gray-700 mb-4" />
                  <p className="text-sm font-semibold text-gray-400 m-0">No Document Active</p>
                  <p className="text-xs text-gray-500 max-w-xs mt-1 leading-relaxed">
                    Park a vehicle or process check out to generate digital receipt and barcode here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Live Parked Vehicles Section */}
      <section className="glass-panel p-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2 m-0">
            <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
            Currently Parked Vehicles
          </h2>
          
          <div className="relative max-w-sm flex items-center">
            <input 
              type="text" 
              className="form-input w-full pl-10 py-2 text-xs" 
              placeholder="Search by Plate or Ticket ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500 font-medium">Loading lot details...</div>
        ) : filteredVehicles.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-800 rounded-2xl">
            <p className="text-gray-400 font-semibold m-0">No active vehicles</p>
            <p className="text-xs text-gray-600 mt-1">There are no vehicles currently matching the active search query.</p>
          </div>
        ) : (
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Vehicle Number</th>
                  <th>Type</th>
                  <th>Entry Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.ticketId}>
                    <td className="font-mono font-bold text-purple-400">{vehicle.ticketId}</td>
                    <td className="font-bold tracking-wider">{vehicle.vehicleNumber}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        vehicle.vehicleType === 'bike' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/40' :
                        vehicle.vehicleType === 'car' ? 'bg-purple-950 text-purple-400 border border-purple-800/40' :
                        'bg-orange-950 text-orange-400 border border-orange-800/40'
                      }`}>
                        {vehicle.vehicleType === 'bike' ? <Bike className="w-3 h-3" /> :
                         vehicle.vehicleType === 'car' ? <Car className="w-3 h-3" /> :
                         <Truck className="w-3 h-3" />}
                        {vehicle.vehicleType}
                      </span>
                    </td>
                    <td className="font-mono text-gray-400 text-xs">
                      {formatTime(vehicle.entryTime)}
                    </td>
                    <td>
                      <button 
                        onClick={() => handleDirectExit(vehicle.ticketId)}
                        className="px-3 py-1 bg-red-950/40 border border-red-900/40 hover:bg-red-900/30 hover:border-red-800/50 rounded-lg text-xs font-bold text-red-400 cursor-pointer flex items-center gap-1.5"
                      >
                        <LogOut className="w-3 h-3" /> Checkout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
