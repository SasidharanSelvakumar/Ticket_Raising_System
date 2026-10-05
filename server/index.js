require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 5000;

// On Vercel, the local filesystem is read-only except /tmp
const TICKETS_FILE = process.env.VERCEL
  ? path.join('/tmp', 'tickets.json')
  : path.join(__dirname, 'tickets.json');

// Middleware
app.use(cors());
app.use(express.json());

// Configure Nodemailer transporter if email credentials are provided in .env
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log(`Email service configured with sender: ${process.env.EMAIL_USER}`);
} else {
  console.log('No EMAIL_USER / EMAIL_PASS found in server/.env — running in Demo Mode (OTP logged to console).');
}

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
      // If on Vercel, copy initial tickets from project if available
      const localFile = path.join(__dirname, 'tickets.json');
      let initialData = '[]';
      if (fs.existsSync(localFile)) {
        initialData = fs.readFileSync(localFile, 'utf8') || '[]';
      }
      fs.writeFileSync(TICKETS_FILE, initialData, 'utf8');
      return JSON.parse(initialData);
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
app.post('/api/send-otp', async (req, res) => {
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

  // Always log OTP to server console for debugging/demo safety
  console.log('--------------------------------------------------');
  console.log(`[OTP] Generated for ${normalizedEmail}: ${otp}`);
  console.log(`Valid for 5 minutes. Attempts allowed: ${MAX_OTP_ATTEMPTS}`);
  console.log('--------------------------------------------------');

  // If email transporter is configured, send the real email!
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Ticket Support Desk" <${process.env.EMAIL_USER}>`,
        to: normalizedEmail,
        subject: `${otp} is your TicketDesk verification code`,
        text: `Your TicketDesk login OTP is ${otp}. It will expire in 5 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 36px;">🎫</span>
              <h2 style="color: #0d9488; margin: 8px 0 0 0; font-size: 22px;">TicketDesk Support</h2>
            </div>
            <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello,</p>
            <p style="color: #334155; font-size: 15px; line-height: 1.5;">Your one-time login verification code is:</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0f172a; background-color: #f0fdfa; border: 1px solid #99f6e4; padding: 12px 24px; border-radius: 8px;">
                ${otp}
              </span>
            </div>
            <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This code will expire in <strong>5 minutes</strong>. If you did not request this code, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">TicketDesk Help & Support System</p>
          </div>
        `
      });

      console.log(`[SUCCESS] Email successfully delivered to ${normalizedEmail}`);
      return res.json({ message: 'OTP sent! Please check your email inbox.' });
    } catch (mailErr) {
      console.error('[ERROR] Failed to send email via Nodemailer:', mailErr.message);
      // Fallback response with helpful explanation
      return res.json({
        message: 'Could not deliver email. Check server console for OTP (or verify EMAIL_USER/EMAIL_PASS in server/.env).'
      });
    }
  }

  // Fallback when no email credentials provided
  return res.json({
    message: 'OTP generated! (Add EMAIL_USER & EMAIL_PASS in server/.env to send to real inbox).'
  });
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

// Start Express server locally (skipped on Vercel serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

