# Ticket Raising System

A simple, fast, and responsive Ticket Raising System built with **React 18 (Vite)** on the frontend and **Node.js (Express)** on the backend.

---

## Key Features

- **OTP-based Email Authentication**:
  - **Universal Access**: Any user (HR, employee, or customer) can enter their email address on the login page and receive a 6-digit OTP code directly in their inbox.
  - **Email Delivery (Nodemailer)**: Integrates with Gmail SMTP to deliver styled HTML verification emails.
  - **Demo Mode Fallback**: If email credentials are not configured, OTPs are safely logged to the server terminal console so you are never locked out during development.
  - **OTP Security Rules**: 5-minute expiry, maximum 5 wrong attempts (returns `HTTP 429`), and automatic invalidation upon successful verification.
  - **Session Persistence**: Session token is securely stored in `sessionStorage` so refreshing the browser keeps the user logged in.
- **My Tickets Dashboard**:
  - Displays the logged-in email and a **Log out** button in the header.
  - Displays only tickets raised by the currently signed-in email address (strict user isolation), sorted newest first.
  - Ticket details include: Ticket ID (e.g. `T-0001`), Title, Description, Priority badge (`Low`, `Medium`, `High`), Status (`Open`), and formatted creation date/time.
  - Friendly empty state: *"You haven't raised any tickets yet. Select 'Add a ticket' to report a problem."*
- **Add a Ticket**:
  - Clean modal dialog to submit new tickets with Title, Description, and Priority dropdown (default: `Medium`).
  - Validates that Title and Description are non-empty.
  - Automatically appends the new ticket to the top of the list and saves to `server/tickets.json`.
- **UI Design**:
  - Clean, modern, responsive layout styled with plain CSS and a calm teal accent palette (`#0d9488`).
  - Accessible inputs, visible focus rings, and fully readable on mobile and desktop.

---

## Tech Stack & Architecture

- **Frontend**: React 18, Vite, Plain CSS (Port `5173`)
- **Backend**: Node.js, Express, `cors`, `nodemailer`, `dotenv` (Port `5000`)
- **Storage**: `server/tickets.json` (no database setup required)
- **API Proxy**: Vite dev server proxies `/api` calls directly to `http://localhost:5000`

---

## Project Structure

```text
ticket-system/
  server/
    package.json         # Backend dependencies (express, cors, nodemailer, dotenv)
    index.js             # API routes, OTP memory store, sessions, and ticket handlers
    tickets.json         # JSON file storage for all raised tickets
    .env                 # Private email credentials (ignored by Git)
    .env.example         # Example template for email configuration
  client/
    package.json         # Frontend dependencies (React 18, Vite)
    vite.config.js       # Vite dev server and /api proxy configuration
    index.html           # HTML entry point with Inter font
    src/
      main.jsx           # React app mount
      App.jsx            # Authentication and My Tickets dashboard
      styles.css         # Calm teal theme styles and responsive layout
  README.md              # Project documentation
```

---

## Setup & Running the Application

### 1. Terminal 1: Backend Server

```bash
cd server
npm install
npm start
```

The backend server will run on `http://localhost:5000`.

### 2. Terminal 2: Frontend Client

```bash
cd client
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`.

---

## Email Configuration (Send OTP to Real Inboxes)

To send verification OTPs directly to real email inboxes:

1. Open `server/.env` (or copy from `server/.env.example`):
   ```env
   EMAIL_USER=your-sender-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   ```

2. **How to get a Gmail 16-character App Password**:
   - Go to [Google Account Security](https://myaccount.google.com/security) and ensure **2-Step Verification** is turned **ON**.
   - Search for **"App passwords"** in the top search bar.
   - Enter an app name (e.g. `TicketDesk`) and click **Create**.
   - Copy the 16-character code into `EMAIL_PASS` in `server/.env`.

3. Restart the backend server (`npm start`).

> **Note**: `EMAIL_USER` is the system sender account. Any user or HR entering their own email on the website will receive the verification email in their personal inbox!
> Your `.env` file is protected in `.gitignore` and will never be pushed to Git.

---

## Demo Mode (Console Fallback)

If `EMAIL_USER` and `EMAIL_PASS` are left blank, the application automatically runs in **Demo Mode**:
1. Enter any email on the login screen and click **Send OTP**.
2. Check your **Backend Terminal** to view the generated 6-digit OTP:
   ```text
   --------------------------------------------------
   [OTP] Generated for alex@example.com: 123456
   Valid for 5 minutes. Attempts allowed: 5
   --------------------------------------------------
   ```
3. Enter the 6-digit OTP in the browser and sign in.

---

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/send-otp` | Generates and sends a 6-digit OTP | No |
| `POST` | `/api/verify-otp` | Verifies OTP and returns session token | No |
| `GET` | `/api/tickets` | Returns tickets raised by current user | Yes (Bearer Token) |
| `POST` | `/api/tickets` | Creates a new ticket | Yes (Bearer Token) |
| `POST` | `/api/logout` | Invalidates user session | Yes (Bearer Token) |
