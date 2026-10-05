const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 5000;
const TICKETS_FILE = path.join(__dirname, 'tickets.json');

// Middleware
app.use(cors());
app.use(express.json());

// In-memory store for OTPs: email -> { otp, expiresAt, attempts }
// OTP expires in 5 minutes, max 5 wrong attempts
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 5;

// In-memory store for user sessions: token -> { email, createdAt }
const sessions = new Map();

// Helper: Read tickets from JSON file
function readTickets() {
  try {
    if (!fs.existsSync(TICKETS_FILE)) {
      fs.writeFileSync(TICKETS_FILE, JSON.stringify([], null, 2), 'utf8');
      return [];
    }
    const data = fs.readFileSync(TICKETS_FILE, 'utf8');
    return data.trim() ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Error reading tickets.json:', err);
    return [];
  }
}

// Helper: Write tickets to JSON file
function writeTickets(tickets) {
  try {
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing tickets.json:', err);
    throw err;
  }
}

// Helper: Generate next ticket ID (e.g. T-0001)
function getNextTicketId(tickets) {
  let maxNum = 0;
  for (const t of tickets) {
    if (t.id && typeof t.id === 'string') {
      const match = t.id.match(/^T-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }
  const nextNum = maxNum + 1;
  return `T-${String(nextNum).padStart(4, '0')}`;
}

// Helper: Basic email validation regex
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// Authentication Middleware: Checks Bearer token in Authorization header
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  const session = sessions.get(token);

  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  req.user = { email: session.email, token };
  next();
}

// ============================================================================
// ROUTES
// ============================================================================

// 1. POST /api/send-otp
// Generates and sends a 6-digit OTP for the given email
app.post('/api/send-otp', (req, res) => {
  const { email } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Generate a secure 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store in memory with 5-minute expiry and 0 attempts
  otpStore.set(normalizedEmail, {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0
  });

  // ==========================================================================
  // DEMO MODE: Print OTP in the SERVER console
  // Note: For production email delivery, Nodemailer can be configured here:
  //
  //   const nodemailer = require('nodemailer');
  //   const transporter = nodemailer.createTransport({ ... });
  //   await transporter.sendMail({
  //     from: '"Ticket Support" <support@example.com>',
  //     to: normalizedEmail,
  //     subject: 'Your Ticket System Login OTP',
  //     text: `Your OTP is: ${otp}. It will expire in 5 minutes.`
  //   });
  // ==========================================================================
  console.log('--------------------------------------------------');
  console.log(`[DEMO MODE] OTP for ${normalizedEmail}: ${otp}`);
  console.log(`Valid for 5 minutes. Attempts allowed: ${MAX_OTP_ATTEMPTS}`);
  console.log('--------------------------------------------------');

  return res.json({ message: 'OTP sent successfully. Check your server console (Demo Mode).' });
});

// 2. POST /api/verify-otp
// Verifies OTP, creates in-memory session token, and deletes OTP upon success
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedOtp = otp.toString().trim();

  const record = otpStore.get(normalizedEmail);

  if (!record) {
    return res.status(400).json({ error: 'No OTP requested for this email or OTP expired.' });
  }

  // Check if OTP has expired (5 minutes)
  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalizedEmail);
    return res.status(400).json({ error: 'OTP expired. Request a new one.' });
  }

  // Check if maximum wrong attempts reached
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    otpStore.delete(normalizedEmail);
    return res.status(429).json({ error: 'Too many wrong attempts. Please request a new OTP.' });
  }

  // Compare OTP
  if (record.otp !== trimmedOtp) {
    record.attempts += 1;
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      otpStore.delete(normalizedEmail);
      return res.status(429).json({ error: 'Too many wrong attempts. Please request a new OTP.' });
    }
    return res.status(400).json({ error: 'Wrong OTP.' });
  }

  // OTP is correct: delete from store to prevent reuse
  otpStore.delete(normalizedEmail);

  // Generate session token and store in memory
  const token = crypto.randomUUID();
  sessions.set(token, {
    email: normalizedEmail,
    createdAt: Date.now()
  });

  return res.json({
    token,
    email: normalizedEmail
  });
});

// 3. GET /api/tickets
// Returns only the tickets raised by the authenticated user, newest first
app.get('/api/tickets', authenticate, (req, res) => {
  const allTickets = readTickets();
  const userTickets = allTickets.filter(
    (t) => t.email && t.email.toLowerCase() === req.user.email.toLowerCase()
  );

  // Sort newest first by creation timestamp
  userTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(userTickets);
});

// 4. POST /api/tickets
// Creates a new ticket with status 'Open' and adds to tickets.json
app.post('/api/tickets', authenticate, (req, res) => {
  const { title, description, priority } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'Description is required.' });
  }

  // Validate priority, defaulting to 'Medium'
  const validPriorities = ['Low', 'Medium', 'High'];
  const ticketPriority = validPriorities.includes(priority) ? priority : 'Medium';

  const allTickets = readTickets();
  const nextId = getNextTicketId(allTickets);

  const newTicket = {
    id: nextId,
    email: req.user.email,
    title: title.trim(),
    description: description.trim(),
    priority: ticketPriority,
    status: 'Open',
    createdAt: new Date().toISOString()
  };

  allTickets.push(newTicket);
  writeTickets(allTickets);

  return res.status(201).json(newTicket);
});

// 5. POST /api/logout
// Invalidates the current session token
app.post('/api/logout', authenticate, (req, res) => {
  sessions.delete(req.user.token);
  return res.json({ message: 'Logged out successfully.' });
});

// Start Express server on Port 5000
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
