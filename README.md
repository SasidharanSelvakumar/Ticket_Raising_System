# Ticket Raising System

A simple, fast, and responsive Ticket Raising System built with **React 18 (Vite)** on the frontend and **Node.js (Express)** on the backend.

---

## Features

- **OTP-based Email Authentication**:
  - Step 1: User enters email and requests a 6-digit OTP.
  - Step 2: User verifies OTP and signs in, or can choose "Use a different email".
  - **Demo Mode**: The backend generates a 6-digit OTP and logs it directly to the server terminal console. A clear comment in `server/index.js` shows where Nodemailer can be configured.
  - **OTP Security Rules**: 5-minute expiry, maximum 5 wrong attempts (returns HTTP 429), and automatic invalidation upon successful verification.
  - **Session Persistence**: Authentication session is saved in `sessionStorage` so refreshing the browser keeps the user logged in.
- **My Tickets Dashboard**:
  - Displays the logged-in email and a "Log out" button.
  - Lists only tickets raised by the current user, sorted newest first.
  - Ticket details include: Ticket ID (e.g. `T-0001`), Title, Description, Priority tag (`Low`, `Medium`, `High`), Status (`Open`), and Creation date/time.
  - Friendly empty state: *"You haven't raised any tickets yet. Select 'Add a ticket' to report a problem."*
- **Add a Ticket**:
  - Clean modal dialog to submit new tickets with Title, Description, and Priority.
  - Validates non-empty title and description.
  - Immediately appends the new ticket to the top of the list and saves to `server/tickets.json`.
- **UI Design**:
  - Clean, modern, responsive layout styled with plain CSS and a calm teal accent palette (`#0d9488`).
  - Accessible inputs, visible focus rings, and readable on both mobile and desktop.

---

## Tech Stack & Architecture

- **Frontend**: React 18, Vite, Plain CSS (Port `5173`)
- **Backend**: Node.js, Express, `cors` (Port `5000`)
- **Storage**: `server/tickets.json` (no external database required)
- **API Proxy**: Vite dev server proxies `/api` calls directly to `http://localhost:5000`

---

## Project Structure

```text
ticket-system/
  server/
    package.json
    index.js
    tickets.json
  client/
    package.json
    vite.config.js
    index.html
    src/
      main.jsx
      App.jsx
      styles.css
  README.md
```

---

## How to Run

### Terminal 1: Backend Server

```bash
cd server && npm install && npm start
```

Backend will start on `http://localhost:5000`.

### Terminal 2: Frontend Client

```bash
cd client && npm install && npm run dev
```

Frontend will be accessible at `http://localhost:5173`.

---

## Demo Login Workflow

1. Open your browser to `http://localhost:5173`.
2. Enter any valid email address (e.g. `alex@example.com`) and click **Send OTP**.
3. Look at **Terminal 1 (Backend)** to view the printed 6-digit OTP:
   ```text
   --------------------------------------------------
   [DEMO MODE] OTP for alex@example.com: 123456
   Valid for 5 minutes. Attempts allowed: 5
   --------------------------------------------------
   ```
4. Enter the 6-digit OTP in the browser and click **Verify and sign in**.
5. You will be taken to **My Tickets** where you can view existing tickets and create new ones.
