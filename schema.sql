-- Database Schema for Parking Lot System
-- Compatible with SQLite, MySQL, and PostgreSQL

CREATE TABLE IF NOT EXISTS tickets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id      VARCHAR(20) UNIQUE NOT NULL,        -- e.g. TKT-1001
  vehicle_number VARCHAR(20) NOT NULL,
  vehicle_type   VARCHAR(10) CHECK(vehicle_type IN ('bike', 'car', 'truck')) NOT NULL,
  entry_time     DATETIME NOT NULL,
  exit_time      DATETIME DEFAULT NULL,              -- NULL while parked
  amount         DECIMAL(6,2) DEFAULT NULL,          -- filled in on exit
  status         VARCHAR(10) CHECK(status IN ('parked', 'exited')) NOT NULL DEFAULT 'parked'
);
