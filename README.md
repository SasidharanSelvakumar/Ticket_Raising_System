# Ticket Raising System

A simple, modern, and reliable Ticket Raising System built with **React 18 (Vite)** on the frontend and **Node.js (Express)** on the backend, deployed seamlessly on **Vercel**.

🌐 **Live Application:** [https://ticketraisingsystem.vercel.app/](https://ticketraisingsystem.vercel.app/)  
📂 **GitHub Repository:** [https://github.com/SasidharanSelvakumar/Ticket_Raising_System](https://github.com/SasidharanSelvakumar/Ticket_Raising_System)

---

## Live Demo & How to Use

1. Open the live app: **[https://ticketraisingsystem.vercel.app/](https://ticketraisingsystem.vercel.app/)**
2. Enter your email address (or your HR / colleague's email) and click **Send OTP**.
3. Check your email inbox for the 6-digit verification code sent by **Ticket Support Desk** (valid for 60 seconds).
4. Enter the 6-digit OTP and click **Verify and sign in**.
5. View tickets raised under your email or click **+ Add a ticket** to raise a new support issue!

---

## Key Features

- **OTP-based Email Authentication**:
  - **Universal Access**: Any user can enter their own email address on the login page and receive a 6-digit OTP code directly in their inbox.
  - **Email Delivery (Nodemailer)**: Integrates with Gmail SMTP to deliver styled HTML verification emails.
  - **60-Second Validity**: Configurable OTP timer with stateless cryptographic HMAC token verification ensuring reliable validation across serverless cloud environments (like Vercel).
  - **Demo Mode Fallback**: If email credentials are not set in `.env`, OTPs are safely logged to the server terminal console during local development.
  - **Session Persistence**: Session tokens are securely saved in `sessionStorage` so refreshing the browser keeps the user logged in.
- **My Tickets Dashboard**:
  - Displays the logged-in email and a **Log out** button in the header.
  - Lists only tickets raised by the currently signed-in email address (strict user isolation), sorted newest first.
  - Each ticket shows: Ticket ID (e.g. `T-0001`), Title, Description, Priority badge (`Low`, `Medium`, `High`), Status (`Open`), and formatted creation date/time.
  - Friendly empty state: *"You haven't raised any tickets yet. Select 'Add a ticket' to report a problem."*
- **Add a Ticket**:
  - Clean modal dialog to submit new tickets with Title, Description, and Priority dropdown (default: `Medium`).
  - Validates that Title and Description are non-empty.
  - Immediately appends the new ticket to the top of the list and persists to storage.
- **UI Design**:
  - Clean, modern, responsive layout styled with plain CSS and a calm teal accent palette (`#0d9488`).
  - Accessible inputs, visible focus rings, and fully readable on mobile and desktop.

---

## Tech Stack & Architecture

- **Frontend**: React 18, Vite, Plain CSS
- **Backend**: Node.js, Express, `cors`, `nodemailer`, `dotenv`
- **Deployment Platform**: Vercel (Single full-stack deployment serving React SPA + Express serverless API)
- **Local Dev Port**: Backend on `5000`, Frontend on `5173` (Vite proxies `/api` calls to `5000`)

---

## Project Structure

```text
ticket-system/
  api/
    index.js             # Vercel serverless function entry point
  server/
    package.json         # Backend dependencies
    index.js             # Express API routes, OTP verification, and ticket handlers
    tickets.json         # Local storage file for tickets
    .env                 # Private email credentials (ignored by Git)
    .env.example         # Example template for email configuration
  client/
    package.json         # Frontend dependencies (React 18, Vite)
    vite.config.js       # Vite dev server and /api proxy configuration
    index.html           # HTML entry point with Inter font
    src/
      main.jsx           # React app mount
      App.jsx            # Authentication, OTP verification, and My Tickets dashboard
      styles.css         # Calm teal theme styles and responsive layout
  package.json           # Root build scripts and serverless dependencies
  vercel.json            # Vercel routing, build configuration, and API rewrites
  README.md              # Project documentation
```

---

## Running Locally

### 1. Terminal 1: Backend Server

```bash
cd server
npm install
npm start
```
*Backend runs on `http://localhost:5000`.*

### 2. Terminal 2: Frontend Client

```bash
cd client
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## Email Configuration (Optional for Local Development)

To send real emails locally (already configured on Vercel):

1. Create a `server/.env` file:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   ```

2. **How to generate a Gmail App Password**:
   - Go to [Google Account Security](https://myaccount.google.com/security) and ensure **2-Step Verification** is **ON**.
   - Search for **"App passwords"** in the top search bar.
   - Create one named `TicketDesk` and copy the 16-character code into `EMAIL_PASS`.

3. Restart the server (`npm start`).

---

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/send-otp` | Generates 6-digit OTP and sends email | No |
| `POST` | `/api/verify-otp` | Verifies OTP and returns session token | No |
| `GET` | `/api/tickets` | Returns tickets raised by current user | Yes (Bearer Token) |
| `POST` | `/api/tickets` | Creates a new ticket | Yes (Bearer Token) |
| `POST` | `/api/logout` | Invalidates user session | Yes (Bearer Token) |
