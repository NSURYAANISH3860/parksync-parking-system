# ParkSync: Smart Parking Management System

A complete, working Parking Lot System built with **Node.js (Express)**, **React (Vite)**, and **SQLite (SQL)**. It displays live slot availability, issues print-ready digital tickets upon vehicle entry, and automatically computes parking fares upon vehicle checkout.

---

## Tech Stack
* **Frontend**: React (Vite, custom Obsidian-dark theme, glassmorphism UI, Lucide icons)
* **Backend**: Node.js & Express (ES Modules)
* **Database**: SQLite (SQL database, persisted locally in `backend/data/database.sqlite`)

---

## Rules & Configuration
* **Slot Limits** (defined in backend logic):
  * **Bike (Two Wheeler)**: 5 slots
  * **Car (Four Wheeler)**: 5 slots
  * **Truck (Heavy Vehicle)**: 2 slots
* **Pricing/Fares**:
  * **Up to 3 hours**: ₹30
  * **More than 3 and up to 6 hours**: ₹85
  * **More than 6 hours**: ₹120
  * *Note: Stay duration is rounded up to the nearest full hour.*

---

## Directory Structure
```text
parking-lot-system/
├── backend/
│   ├── config/
│   │   └── db.js            # SQLite connection and helper promise wrappers
│   ├── data/
│   │   └── database.sqlite  # Local SQL database file
│   ├── routes/
│   │   └── tickets.js       # Express routes for tickets & business rules
│   ├── index.js             # Server startup & middleware setup
│   └── package.json         # Backend manifest
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React container with full application state
│   │   ├── index.css        # Theme styles, gradients, glassmorphism, animations
│   │   └── main.jsx         # React mounting
│   ├── index.html           # Document template (with SEO title & description)
│   ├── package.json         # Frontend manifest
│   └── vite.config.js       # Vite build config
├── schema.sql               # Database schema definition file
└── README.md                # This manual
```

---

## Setup & Running Locally

### Prerequisites
* [Node.js](https://nodejs.org/) (tested on v24)
* npm (tested on v11)

### 1. Start the Backend Server
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Express server:
   ```bash
   npm start
   ```
   The backend will bootstrap, initialize the SQLite database, and run on `http://localhost:5000`.

### 2. Start the Frontend Dev Server
1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:3000`. Open this address in your browser to view the application.

---

## API Documentation

### 1. Get Live Slots
* **Method**: `GET`
* **URL**: `/api/slots`
* **Response (200)**:
  ```json
  {
    "bike":  { "total": 5, "available": 5 },
    "car":   { "total": 5, "available": 5 },
    "truck": { "total": 2, "available": 2 }
  }
  ```

### 2. Park a Vehicle
* **Method**: `POST`
* **URL**: `/api/park`
* **Request Body**:
  ```json
  {
    "vehicleNumber": "KA01AB1234",
    "vehicleType": "car"
  }
  ```
* **Success Response (201)**:
  ```json
  {
    "success": true,
    "ticket": {
      "ticketId": "TKT-1001",
      "vehicleNumber": "KA01AB1234",
      "vehicleType": "car",
      "entryTime": "2026-07-11T11:15:00.000Z"
    }
  }
  ```
* **Error Response (409 - Slots Full)**:
  ```json
  {
    "success": false,
    "message": "Parking Full"
  }
  ```
* **Error Response (400 - Duplicate Vehicle)**:
  ```json
  {
    "success": false,
    "message": "Vehicle KA01AB1234 is already parked"
  }
  ```

### 3. Exit a Vehicle & Calculate Fare
* **Method**: `POST`
* **URL**: `/api/exit`
* **Request Body** (supports ticket ID or vehicle number):
  ```json
  { "ticketId": "TKT-1001" }
  ```
  *or*
  ```json
  { "vehicleNumber": "KA01AB1234" }
  ```
* **Success Response (200)**:
  ```json
  {
    "success": true,
    "receipt": {
      "ticketId": "TKT-1001",
      "vehicleNumber": "KA01AB1234",
      "entryTime": "2026-07-11T10:15:00.000Z",
      "exitTime": "2026-07-11T11:15:00.000Z",
      "durationHours": 1,
      "amount": 30
    }
  }
  ```

### 4. Get Parked Vehicles
* **Method**: `GET`
* **URL**: `/api/parked`
* **Response (200)**:
  ```json
  [
    {
      "ticketId": "TKT-1001",
      "vehicleNumber": "KA01AB1234",
      "vehicleType": "car",
      "entryTime": "2026-07-11T10:15:00.000Z"
    }
  ]
  ```
