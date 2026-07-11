import express from 'express';
import { query } from '../config/db.js';

const router = express.Router();

const LIMITS = { bike: 5, car: 5, truck: 2 };
const VEHICLE_TYPES = ['bike', 'car', 'truck'];

// Helper to calculate fare based on duration
export function calculateFare(entryTime, exitTime) {
  const ms = new Date(exitTime) - new Date(entryTime);
  const hours = Math.max(1, Math.ceil(ms / (1000 * 60 * 60))); // round up to full hours
 
  if (hours <= 3) return 30;   // up to 3 hours
  if (hours <= 6) return 85;   // 3 to 6 hours
  return 120;                  // more than 6 hours
}

// 1. GET /api/slots
// Returns total and available slots for each vehicle type
router.get('/slots', async (req, res) => {
  try {
    const occupiedRows = await query.all(
      "SELECT vehicle_type, COUNT(*) as count FROM tickets WHERE status = 'parked' GROUP BY vehicle_type"
    );

    const availability = {
      bike: { total: LIMITS.bike, available: LIMITS.bike },
      car: { total: LIMITS.car, available: LIMITS.car },
      truck: { total: LIMITS.truck, available: LIMITS.truck }
    };

    occupiedRows.forEach(row => {
      const type = row.vehicle_type;
      if (availability[type]) {
        availability[type].available = Math.max(0, availability[type].total - row.count);
      }
    });

    res.json(availability);
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 2. POST /api/park
// Parks a vehicle and issues a ticket
router.post('/park', async (req, res) => {
  try {
    const { vehicleNumber, vehicleType } = req.body || {};

    // Check if request body is empty or fields are missing
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: 'Request body is empty' });
    }

    if (!vehicleNumber || typeof vehicleNumber !== 'string' || !vehicleNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Vehicle number is required' });
    }

    if (!vehicleType || !VEHICLE_TYPES.includes(vehicleType)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing vehicle type' });
    }

    const cleanVehicleNumber = vehicleNumber.trim().toUpperCase();

    // Check if the same vehicle number is already parked
    const alreadyParked = await query.get(
      "SELECT id FROM tickets WHERE vehicle_number = ? AND status = 'parked'",
      [cleanVehicleNumber]
    );

    if (alreadyParked) {
      return res.status(400).json({ success: false, message: `Vehicle ${cleanVehicleNumber} is already parked` });
    }

    // Check slot availability for this vehicle type
    const occupiedCountRow = await query.get(
      "SELECT COUNT(*) AS count FROM tickets WHERE vehicle_type = ? AND status = 'parked'",
      [vehicleType]
    );
    const occupied = occupiedCountRow ? occupiedCountRow.count : 0;
    const limit = LIMITS[vehicleType];

    if (occupied >= limit) {
      return res.status(409).json({ success: false, message: 'Parking Full' });
    }

    // Auto-generate ticket ID (using a serialized transaction to ensure uniqueness)
    await query.run("BEGIN IMMEDIATE TRANSACTION");
    try {
      const maxRow = await query.get("SELECT MAX(id) as maxId FROM tickets");
      const nextId = (maxRow && maxRow.maxId ? maxRow.maxId : 0) + 1;
      const ticketId = `TKT-${1000 + nextId}`;
      const entryTime = new Date().toISOString();

      await query.run(
        "INSERT INTO tickets (ticket_id, vehicle_number, vehicle_type, entry_time, status) VALUES (?, ?, ?, ?, 'parked')",
        [ticketId, cleanVehicleNumber, vehicleType, entryTime]
      );
      await query.run("COMMIT");

      res.status(201).json({
        success: true,
        ticket: {
          ticketId,
          vehicleNumber: cleanVehicleNumber,
          vehicleType,
          entryTime
        }
      });
    } catch (insertError) {
      await query.run("ROLLBACK");
      throw insertError;
    }
  } catch (error) {
    console.error('Error parking vehicle:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 3. POST /api/exit
// Exits a vehicle and returns the calculated bill
router.post('/exit', async (req, res) => {
  try {
    const { ticketId, vehicleNumber } = req.body || {};

    if (!req.body || (!ticketId && !vehicleNumber)) {
      return res.status(400).json({ success: false, message: 'Ticket ID or Vehicle Number is required' });
    }

    let ticket;
    if (ticketId) {
      const cleanTicketId = ticketId.trim().toUpperCase();
      ticket = await query.get(
        "SELECT * FROM tickets WHERE ticket_id = ? AND status = 'parked'",
        [cleanTicketId]
      );
    } else if (vehicleNumber) {
      const cleanVehicleNumber = vehicleNumber.trim().toUpperCase();
      ticket = await query.get(
        "SELECT * FROM tickets WHERE vehicle_number = ? AND status = 'parked' ORDER BY entry_time DESC LIMIT 1",
        [cleanVehicleNumber]
      );
    }

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found or already exited' });
    }

    const exitTime = new Date().toISOString();
    const amount = calculateFare(ticket.entry_time, exitTime);
    const ms = new Date(exitTime) - new Date(ticket.entry_time);
    const durationHours = Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));

    await query.run(
      "UPDATE tickets SET exit_time = ?, amount = ?, status = 'exited' WHERE id = ?",
      [exitTime, amount, ticket.id]
    );

    res.json({
      success: true,
      receipt: {
        ticketId: ticket.ticket_id,
        vehicleNumber: ticket.vehicle_number,
        entryTime: ticket.entry_time,
        exitTime,
        durationHours,
        amount
      }
    });
  } catch (error) {
    console.error('Error exiting vehicle:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 4. GET /api/parked
// Returns list of currently parked vehicles
router.get('/parked', async (req, res) => {
  try {
    const rows = await query.all(
      "SELECT ticket_id AS ticketId, vehicle_number AS vehicleNumber, vehicle_type AS vehicleType, entry_time AS entryTime FROM tickets WHERE status = 'parked' ORDER BY entry_time DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching parked list:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
