import streamlit as st
import sqlite3
import math
from datetime import datetime
import os

# Set page configuration for a premium, wide dashboard layout
st.set_page_config(
    page_title="PARKSYNC // Smart Parking",
    page_icon="🅿️",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom Obsidian-dark and Glassmorphic styling injected via CSS
st.markdown("""
    <style>
    /* Dark theme overrides */
    .stApp {
        background: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #030712 70%) !important;
        color: #f3f4f6 !important;
    }
    
    /* Header style */
    .header-container {
        margin-bottom: 2rem;
    }
    .main-title {
        font-size: 2.2rem;
        font-weight: 800;
        background: linear-gradient(135deg, #a78bfa 0%, #f472b6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
        letter-spacing: -0.025em;
    }
    .sub-title {
        color: #9ca3af;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-top: 0.25rem;
    }

    /* Glassmorphism Panels */
    .glass-panel {
        background: rgba(17, 24, 39, 0.6) !important;
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-radius: 20px;
        padding: 1.5rem;
        margin-bottom: 1rem;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }
    
    /* Specific Vehicle Card styles */
    .card-bike {
        background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(8, 145, 178, 0.05) 100%) !important;
        border: 1px solid rgba(6, 182, 212, 0.3) !important;
        border-radius: 16px;
        padding: 1.25rem;
    }
    .card-car {
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.05) 100%) !important;
        border: 1px solid rgba(139, 92, 246, 0.3) !important;
        border-radius: 16px;
        padding: 1.25rem;
    }
    .card-truck {
        background: linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(234, 88, 12, 0.05) 100%) !important;
        border: 1px solid rgba(249, 115, 22, 0.3) !important;
        border-radius: 16px;
        padding: 1.25rem;
    }
    
    .card-title {
        font-weight: 700;
        font-size: 1.1rem;
        margin: 0;
    }
    .card-slots {
        font-size: 1.5rem;
        font-weight: 800;
        margin: 0.5rem 0 0.25rem 0;
    }
    .card-meta {
        font-size: 0.75rem;
        color: #9ca3af;
    }
    
    /* Paper Ticket visual design */
    .paper-ticket {
        background: #111827;
        border: 1px dashed rgba(255, 255, 255, 0.25);
        border-radius: 16px;
        padding: 1.5rem;
        max-width: 320px;
        margin: 0 auto;
        font-family: monospace;
        position: relative;
    }
    
    .barcode-container {
        display: flex;
        gap: 2px;
        justify-content: center;
        background: white;
        padding: 8px;
        border-radius: 4px;
        height: 45px;
        overflow: hidden;
        margin-top: 1rem;
    }
    .stamp-paid {
        border: 2px solid rgba(16, 185, 129, 0.5);
        color: #34d399;
        font-weight: 900;
        text-transform: uppercase;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 0.8rem;
        display: inline-block;
        margin-top: 0.5rem;
        transform: rotate(-3deg);
    }
    </style>
    """, unsafe_allow_html=True)

DB_PATH = "parking_lot.db"
LIMITS = {'bike': 5, 'car': 5, 'truck': 2}

# --- DATABASE OPERATIONS ---
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tickets (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_id      VARCHAR(20) UNIQUE NOT NULL,
          vehicle_number VARCHAR(20) NOT NULL,
          vehicle_type   VARCHAR(10) NOT NULL,
          entry_time     DATETIME NOT NULL,
          exit_time      DATETIME DEFAULT NULL,
          amount         DECIMAL(6,2) DEFAULT NULL,
          status         VARCHAR(10) NOT NULL DEFAULT 'parked'
        );
    """)
    conn.commit()
    conn.close()

init_db()

# Fetch live parking occupancy stats
def get_parking_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT vehicle_type, COUNT(*) as count FROM tickets WHERE status = 'parked' GROUP BY vehicle_type")
    rows = cursor.fetchall()
    conn.close()
    
    stats = {
        'bike': {'total': LIMITS['bike'], 'available': LIMITS['bike']},
        'car': {'total': LIMITS['car'], 'available': LIMITS['car']},
        'truck': {'total': LIMITS['truck'], 'available': LIMITS['truck']}
    }
    
    for row in rows:
        v_type = row['vehicle_type']
        if v_type in stats:
            stats[v_type]['available'] = max(0, stats[v_type]['total'] - row['count'])
            
    return stats

# Helper to calculate parking fee
def calculate_fare(entry_time_str, exit_time_str):
    try:
        # Standard formats
        entry_time = datetime.fromisoformat(entry_time_str.replace("Z", "+00:00"))
        exit_time = datetime.fromisoformat(exit_time_str.replace("Z", "+00:00"))
    except Exception:
        entry_time = datetime.strptime(entry_time_str.split('.')[0], "%Y-%m-%dT%H:%M:%S")
        exit_time = datetime.strptime(exit_time_str.split('.')[0], "%Y-%m-%dT%H:%M:%S")
        
    duration = exit_time - entry_time
    seconds = duration.total_seconds()
    hours = max(1, math.ceil(seconds / 3600.0))
    
    if hours <= 3:
        return 30, hours
    elif hours <= 6:
        return 85, hours
    else:
        return 120, hours

# --- SIDE-EFFECT CONTAINERS FOR TICKET GRAPHICS ---
if 'last_ticket' not in st.session_state:
    st.session_state.last_ticket = None
if 'last_receipt' not in st.session_state:
    st.session_state.last_receipt = None

# --- RENDER WEB INTERFACE ---
st.markdown("""
<div class="header-container">
    <h1 class="main-title">PARKSYNC //</h1>
    <div class="sub-title">Smart Parking Management System (Streamlit Deployment)</div>
</div>
""", unsafe_allow_html=True)

# Fetch stats
stats = get_parking_stats()

# 1. Availability Cards
col1, col2, col3 = st.columns(3)

with col1:
    avail = stats['bike']['available']
    total = stats['bike']['total']
    badge = '<span style="color: #f87171; font-weight: bold; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); padding: 2px 8px; border-radius: 20px; font-size:0.75rem;">FULL</span>' if avail == 0 else f'<span style="color: #22d3ee; font-weight: bold;">{avail} Free</span>'
    st.markdown(f"""
    <div class="card-bike">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size: 1.5rem;">🏍️</span>
            {badge}
        </div>
        <div class="card-title text-bike" style="margin-top:0.5rem; color:#22d3ee;">Two Wheeler</div>
        <div class="card-slots">{avail} <span style="font-size: 1rem; color:#6b7280;">/ {total}</span></div>
        <div class="card-meta">Maximum Capacity: {total}</div>
    </div>
    """, unsafe_allow_html=True)

with col2:
    avail = stats['car']['available']
    total = stats['car']['total']
    badge = '<span style="color: #f87171; font-weight: bold; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); padding: 2px 8px; border-radius: 20px; font-size:0.75rem;">FULL</span>' if avail == 0 else f'<span style="color: #a78bfa; font-weight: bold;">{avail} Free</span>'
    st.markdown(f"""
    <div class="card-car">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size: 1.5rem;">🚗</span>
            {badge}
        </div>
        <div class="card-title text-car" style="margin-top:0.5rem; color:#a78bfa;">Four Wheeler</div>
        <div class="card-slots">{avail} <span style="font-size: 1rem; color:#6b7280;">/ {total}</span></div>
        <div class="card-meta">Maximum Capacity: {total}</div>
    </div>
    """, unsafe_allow_html=True)

with col3:
    avail = stats['truck']['available']
    total = stats['truck']['total']
    badge = '<span style="color: #f87171; font-weight: bold; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); padding: 2px 8px; border-radius: 20px; font-size:0.75rem;">FULL</span>' if avail == 0 else f'<span style="color: #f97316; font-weight: bold;">{avail} Free</span>'
    st.markdown(f"""
    <div class="card-truck">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size: 1.5rem;">🚚</span>
            {badge}
        </div>
        <div class="card-title text-truck" style="margin-top:0.5rem; color:#f97316;">Heavy Vehicle</div>
        <div class="card-slots">{avail} <span style="font-size: 1rem; color:#6b7280;">/ {total}</span></div>
        <div class="card-meta">Maximum Capacity: {total}</div>
    </div>
    """, unsafe_allow_html=True)

st.write("")

# 2. Main forms and visual previews
form_col, ticket_col = st.columns([3, 2])

with form_col:
    # Park Form
    st.markdown('<div class="glass-panel">', unsafe_allow_html=True)
    st.subheader("Park a Vehicle")
    
    with st.form("park_form", clear_on_submit=True):
        vehicle_num = st.text_input("Vehicle Plate Number", placeholder="e.g. KA01AB1234")
        v_type_selected = st.selectbox("Vehicle Type", ["bike", "car", "truck"], format_func=lambda x: x.upper())
        submit_park = st.form_submit_button("Generate Parking Ticket")
        
        if submit_park:
            clean_num = vehicle_num.strip().upper()
            if not clean_num:
                st.error("Please enter a vehicle plate number.")
            else:
                # DB checks
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Duplicate check
                cursor.execute("SELECT id FROM tickets WHERE vehicle_number = ? AND status = 'parked'", (clean_num,))
                already_parked = cursor.fetchone()
                
                if already_parked:
                    st.error(f"Vehicle {clean_num} is already parked in the lot.")
                    conn.close()
                else:
                    # Capacity check
                    cursor.execute("SELECT COUNT(*) as count FROM tickets WHERE vehicle_type = ? AND status = 'parked'", (v_type_selected,))
                    occupied = cursor.fetchone()['count']
                    
                    if occupied >= LIMITS[v_type_selected]:
                        st.error("Parking Full")
                        conn.close()
                    else:
                        # Success insert
                        cursor.execute("SELECT MAX(id) as maxId FROM tickets")
                        max_row = cursor.fetchone()
                        next_id = (max_row['maxId'] if max_row['maxId'] else 0) + 1
                        tkt_id = f"TKT-{1000 + next_id}"
                        now_str = datetime.now().isoformat()
                        
                        cursor.execute(
                            "INSERT INTO tickets (ticket_id, vehicle_number, vehicle_type, entry_time, status) VALUES (?, ?, ?, ?, 'parked')",
                            (tkt_id, clean_num, v_type_selected, now_str)
                        )
                        conn.commit()
                        conn.close()
                        
                        st.success(f"Ticket generated for {clean_num}!")
                        st.session_state.last_ticket = {
                            'ticketId': tkt_id,
                            'vehicleNumber': clean_num,
                            'vehicleType': v_type_selected,
                            'entryTime': now_str
                        }
                        st.session_state.last_receipt = None
                        st.rerun()
                        
    st.markdown('</div>', unsafe_allow_html=True)
    
    # Exit Form
    st.markdown('<div class="glass-panel">', unsafe_allow_html=True)
    st.subheader("Checkout & Exit")
    
    with st.form("exit_form", clear_on_submit=True):
        exit_input = st.text_input("Ticket ID or Vehicle Plate", placeholder="e.g. TKT-1001 or KA01AB1234")
        submit_exit = st.form_submit_button("Process Checkout")
        
        if submit_exit:
            clean_exit = exit_input.strip().upper()
            if not clean_exit:
                st.error("Please enter a Ticket ID or Vehicle Number.")
            else:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Query matches
                if clean_exit.startswith("TKT-"):
                    cursor.execute("SELECT * FROM tickets WHERE ticket_id = ? AND status = 'parked'", (clean_exit,))
                else:
                    cursor.execute("SELECT * FROM tickets WHERE vehicle_number = ? AND status = 'parked' ORDER BY entry_time DESC LIMIT 1", (clean_exit,))
                    
                ticket = cursor.fetchone()
                
                if not ticket:
                    st.error("Ticket not found or already exited.")
                    conn.close()
                else:
                    now_str = datetime.now().isoformat()
                    fare, duration_hr = calculate_fare(ticket['entry_time'], now_str)
                    
                    cursor.execute(
                        "UPDATE tickets SET exit_time = ?, amount = ?, status = 'exited' WHERE id = ?",
                        (now_str, fare, ticket['id'])
                    )
                    conn.commit()
                    conn.close()
                    
                    st.success(f"Checkout complete! Fare due: ₹{fare}")
                    st.session_state.last_receipt = {
                        'ticketId': ticket['ticket_id'],
                        'vehicleNumber': ticket['vehicle_number'],
                        'durationHours': duration_hr,
                        'amount': fare,
                        'exitTime': now_str
                    }
                    st.session_state.last_ticket = None
                    st.rerun()
                    
    st.markdown('</div>', unsafe_allow_html=True)

with ticket_col:
    st.markdown('<div class="glass-panel" style="height: 100%; display: flex; flex-direction: column;">', unsafe_allow_html=True)
    st.subheader("Document Preview")
    
    if st.session_state.last_ticket:
        tkt = st.session_state.last_ticket
        st.markdown(f"""
        <div class="paper-ticket">
            <div style="text-align: center; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 8px;">
                <span style="font-size: 0.75rem; color: #a78bfa; font-weight: bold;">PARKSYNC ENTRY</span>
                <h3 style="margin: 4px 0 0 0; color: white;">{tkt['ticketId']}</h3>
            </div>
            <div style="padding: 16px 0; font-size: 0.85rem; line-height: 1.6;">
                <div style="display:flex; justify-content:space-between;"><span>PLATE:</span><strong>{tkt['vehicleNumber']}</strong></div>
                <div style="display:flex; justify-content:space-between;"><span>TYPE:</span><strong>{tkt['vehicleType'].upper()}</strong></div>
                <div style="display:flex; justify-content:space-between;"><span>ENTRY:</span><strong>{tkt['entryTime'][11:19]}</strong></div>
            </div>
            <div style="border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 12px; text-align: center;">
                <div class="barcode-container">
                    <div style="background: black; width: 4px; height: 100%;"></div>
                    <div style="background: black; width: 1px; height: 100%;"></div>
                    <div style="background: black; width: 3px; height: 100%;"></div>
                    <div style="background: black; width: 6px; height: 100%;"></div>
                    <div style="background: black; width: 1px; height: 100%;"></div>
                    <div style="background: black; width: 4px; height: 100%;"></div>
                    <div style="background: black; width: 2px; height: 100%;"></div>
                    <div style="background: black; width: 5px; height: 100%;"></div>
                    <div style="background: black; width: 1px; height: 100%;"></div>
                </div>
                <span style="font-size: 0.65rem; color:#6b7280;">SCAN AT EXIT TERMINAL</span>
            </div>
        </div>
        """, unsafe_allow_html=True)
        if st.button("Dismiss Ticket"):
            st.session_state.last_ticket = None
            st.rerun()
            
    elif st.session_state.last_receipt:
        rcpt = st.session_state.last_receipt
        st.markdown(f"""
        <div class="paper-ticket">
            <div style="text-align: center; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 8px;">
                <span style="font-size: 0.75rem; color: #34d399; font-weight: bold;">PAYMENT RECEIPT</span>
                <h3 style="margin: 4px 0 0 0; color: white;">{rcpt['ticketId']}</h3>
            </div>
            <div style="padding: 16px 0; font-size: 0.85rem; line-height: 1.6;">
                <div style="display:flex; justify-content:space-between;"><span>PLATE:</span><strong>{rcpt['vehicleNumber']}</strong></div>
                <div style="display:flex; justify-content:space-between;"><span>STAY TIME:</span><strong>{rcpt['durationHours']} hr(s)</strong></div>
                <div style="display:flex; justify-content:space-between;"><span>TOTAL FARE:</span><strong style="color: #34d399;">₹{rcpt['amount']}.00</strong></div>
            </div>
            <div style="border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 12px; text-align: center;">
                <div class="stamp-paid">PAID / VERIFIED</div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        if st.button("Dismiss Receipt"):
            st.session_state.last_receipt = None
            st.rerun()
            
    else:
        st.markdown("""
        <div style="text-align: center; padding: 3rem 1rem; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px;">
            <div style="font-size: 2.5rem; filter: grayscale(1); margin-bottom: 1rem;">🎫</div>
            <div style="font-weight: 600; color: #9ca3af; font-size: 0.9rem;">No Document Selected</div>
            <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;">Active parking tickets and paid checkout slips will be visualized here.</div>
        </div>
        """, unsafe_allow_html=True)
        
    st.markdown('</div>', unsafe_allow_html=True)

# 3. Active Parked Vehicles Grid
st.markdown('<div class="glass-panel">', unsafe_allow_html=True)
st.subheader("Currently Parked Vehicles")

conn = get_db_connection()
cursor = conn.cursor()
cursor.execute("SELECT ticket_id, vehicle_number, vehicle_type, entry_time FROM tickets WHERE status = 'parked' ORDER BY entry_time DESC")
parked_rows = cursor.fetchall()
conn.close()

if not parked_rows:
    st.info("No vehicles currently parked.")
else:
    # Custom interactive grid rendering instead of st.dataframe so we can have quick checkout buttons
    # Header
    cols = st.columns([2, 3, 2, 3, 2])
    cols[0].markdown("**Ticket ID**")
    cols[1].markdown("**Vehicle Number**")
    cols[2].markdown("**Type**")
    cols[3].markdown("**Entry Time**")
    cols[4].markdown("**Action**")
    
    st.markdown("<hr style='margin: 0.5rem 0; opacity: 0.1;'>", unsafe_allow_html=True)
    
    for row in parked_rows:
        cols = st.columns([2, 3, 2, 3, 2])
        t_id = row['ticket_id']
        plate = row['vehicle_number']
        vtype = row['vehicle_type'].upper()
        
        # Format Entry Time nicely
        try:
            dt = datetime.fromisoformat(row['entry_time'].replace("Z", "+00:00"))
            time_str = dt.strftime("%b %d, %I:%M:%S %p")
        except Exception:
            time_str = row['entry_time']
            
        cols[0].markdown(f"**`{t_id}`**")
        cols[1].markdown(f"`{plate}`")
        
        # Nice colors for types
        type_color = "#22d3ee" if vtype == 'BIKE' else ("#a78bfa" if vtype == 'CAR' else "#f97316")
        cols[2].markdown(f"<span style='color: {type_color}; font-weight: bold;'>{vtype}</span>", unsafe_allow_html=True)
        cols[3].markdown(f"<span style='font-size: 0.85rem; color:#9ca3af;'>{time_str}</span>", unsafe_allow_html=True)
        
        # Checkout action trigger
        if cols[4].button("Checkout", key=f"btn_{t_id}"):
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (t_id,))
            t_row = cursor.fetchone()
            
            if t_row:
                now_str = datetime.now().isoformat()
                fare, duration_hr = calculate_fare(t_row['entry_time'], now_str)
                cursor.execute(
                    "UPDATE tickets SET exit_time = ?, amount = ?, status = 'exited' WHERE id = ?",
                    (now_str, fare, t_row['id'])
                )
                conn.commit()
                st.session_state.last_receipt = {
                    'ticketId': t_row['ticket_id'],
                    'vehicleNumber': t_row['vehicle_number'],
                    'durationHours': duration_hr,
                    'amount': fare,
                    'exitTime': now_str
                }
                st.session_state.last_ticket = None
                conn.close()
                st.success(f"Checkout complete for {t_row['vehicle_number']}! Fare: ₹{fare}")
                st.rerun()
            else:
                conn.close()

st.markdown('</div>', unsafe_allow_html=True)
