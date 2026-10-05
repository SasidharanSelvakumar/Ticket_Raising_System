import React, { useState, useEffect } from 'react';

// Format date into human-readable string
function formatDate(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

export default function App() {
  // Session authentication state (persisted in sessionStorage)
  const [auth, setAuth] = useState(() => {
    try {
      const saved = sessionStorage.getItem('ticket_auth');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Login flow states
  const [loginStep, setLoginStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState(() => {
    return sessionStorage.getItem('ticket_otp_token') || '';
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authMessage, setAuthMessage] = useState(null);

  // Tickets state
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState(null);

  // Add ticket modal & form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('Medium');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  // Fetch tickets whenever authenticated
  useEffect(() => {
    if (!auth?.token) return;

    let isMounted = true;
    const fetchTickets = async () => {
      setTicketsLoading(true);
      setTicketsError(null);
      try {
        const res = await fetch('/api/tickets', {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        });

        if (res.status === 401) {
          // Session expired or invalid
          handleLogout();
          setAuthError('Session expired. Please log in again.');
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load tickets.');
        }

        if (isMounted) {
          setTickets(data);
        }
      } catch (err) {
        if (isMounted) {
          setTicketsError(err.message || 'Error fetching tickets.');
        }
      } finally {
        if (isMounted) {
          setTicketsLoading(false);
        }
      }
    };

    fetchTickets();
    return () => {
      isMounted = false;
    };
  }, [auth]);

  // Handle Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setAuthError('Please enter your email.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP.');
      }

      // Store stateless OTP token
      if (data.otpToken) {
        setOtpToken(data.otpToken);
        sessionStorage.setItem('ticket_otp_token', data.otpToken);
      }

      setLoginStep('otp');
      setAuthMessage(data.message || 'OTP sent! Please check your email inbox.');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setAuthError('Please enter the 6-digit OTP.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          otpToken
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed.');
      }

      const sessionData = { token: data.token, email: data.email };
      sessionStorage.setItem('ticket_auth', JSON.stringify(sessionData));
      sessionStorage.removeItem('ticket_otp_token');
      setAuth(sessionData);
      setOtp('');
      setOtpToken('');
      setAuthMessage(null);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    if (auth?.token) {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${auth.token}` }
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    sessionStorage.removeItem('ticket_auth');
    sessionStorage.removeItem('ticket_otp_token');
    setAuth(null);
    setTickets([]);
    setLoginStep('email');
    setOtp('');
    setOtpToken('');
    setAuthError(null);
    setAuthMessage(null);
  };

  // Handle Add Ticket Submit
  const handleAddTicket = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setAddError('Title is required.');
      return;
    }
    if (!newDescription.trim()) {
      setAddError('Description is required.');
      return;
    }

    setAddLoading(true);
    setAddError(null);

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          priority: newPriority
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create ticket.');
      }

      // Add to top of list & close form
      setTickets((prev) => [data, ...prev]);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('Medium');
      setShowAddModal(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // Switch back to email step
  const handleUseDifferentEmail = () => {
    setLoginStep('email');
    setOtp('');
    setOtpToken('');
    sessionStorage.removeItem('ticket_otp_token');
    setAuthError(null);
    setAuthMessage(null);
  };

  // ==========================================================================
  // RENDER: LOGIN VIEW (When not authenticated)
  // ==========================================================================
  if (!auth) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <div className="brand-icon" aria-hidden="true">🎫</div>
            <h1 className="auth-title">Ticket Support Desk</h1>
            <p className="auth-subtitle">
              Sign in with your email to view and report technical issues.
            </p>
          </div>

          {authError && (
            <div className="alert alert-error" role="alert">
              <span>⚠️</span> {authError}
            </div>
          )}

          {authMessage && (
            <div className="alert alert-info" role="status">
              <span>ℹ️</span> {authMessage}
            </div>
          )}

          {loginStep === 'email' ? (
            <form onSubmit={handleSendOtp} className="auth-form">
              <div className="form-group">
                <label htmlFor="login-email">Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={authLoading}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={authLoading}
              >
                {authLoading ? 'Sending OTP...' : 'Send OTP'}
              </button>

              <div className="demo-badge">
                📬 <strong>Verification Code:</strong> The 6-digit OTP will be delivered to your email inbox (or logged in the server console if running in demo mode).
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="auth-form">
              <div className="form-info">
                <span>Code sent to: <strong>{email}</strong></span>
              </div>

              <div className="form-group">
                <label htmlFor="login-otp">Enter 6-digit OTP</label>
                <input
                  id="login-otp"
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={authLoading}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={authLoading}
              >
                {authLoading ? 'Verifying...' : 'Verify and sign in'}
              </button>

              <div className="auth-footer-links">
                <button
                  type="button"
                  onClick={handleUseDifferentEmail}
                  className="link-button"
                  disabled={authLoading}
                >
                  ← Use a different email
                </button>
              </div>

              <div className="demo-badge">
                📬 Check your email inbox for the OTP (or the server console if email credentials aren't configured).
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // RENDER: MY TICKETS VIEW (Authenticated)
  // ==========================================================================
  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="navbar">
        <div className="navbar-brand">
          <span className="brand-logo" aria-hidden="true">🎫</span>
          <span className="brand-name">TicketDesk</span>
        </div>
        <div className="navbar-user">
          <span className="user-email" title={auth.email}>
            {auth.email}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-outline btn-sm"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Tickets</h1>
            <p className="page-description">
              Manage and track support tickets raised under your account.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            + Add a ticket
          </button>
        </div>

        {/* Tickets Error Alert */}
        {ticketsError && (
          <div className="alert alert-error" role="alert">
            <span>⚠️</span> {ticketsError}
          </div>
        )}

        {/* Tickets Loading State */}
        {ticketsLoading ? (
          <div className="loading-state" role="status">
            <div className="spinner" aria-hidden="true"></div>
            <p>Loading your tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          /* Empty State */
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">📋</div>
            <h2 className="empty-title">No tickets found</h2>
            <p className="empty-text">
              You haven't raised any tickets yet. Select 'Add a ticket' to report a problem.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              + Add a ticket
            </button>
          </div>
        ) : (
          /* Tickets List */
          <div className="ticket-list">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="ticket-card">
                <div className="ticket-card-header">
                  <div className="ticket-id-tag">{ticket.id}</div>
                  <div className="ticket-badges">
                    <span className={`priority-badge priority-${ticket.priority?.toLowerCase() || 'medium'}`}>
                      {ticket.priority || 'Medium'} Priority
                    </span>
                    <span className="status-badge status-open">
                      {ticket.status || 'Open'}
                    </span>
                  </div>
                </div>

                <h2 className="ticket-title">{ticket.title}</h2>
                <p className="ticket-description">{ticket.description}</p>

                <div className="ticket-card-footer">
                  <span className="ticket-date">
                    📅 Raised on {formatDate(ticket.createdAt)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Add Ticket Modal */}
      {showAddModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !addLoading) {
              setShowAddModal(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="modal-title" className="modal-title">Raise New Ticket</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => !addLoading && setShowAddModal(false)}
                aria-label="Close dialog"
                disabled={addLoading}
              >
                ✕
              </button>
            </div>

            {addError && (
              <div className="alert alert-error" role="alert">
                <span>⚠️</span> {addError}
              </div>
            )}

            <form onSubmit={handleAddTicket} className="modal-form">
              <div className="form-group">
                <label htmlFor="ticket-title">
                  Title <span className="required">*</span>
                </label>
                <input
                  id="ticket-title"
                  type="text"
                  required
                  placeholder="e.g. Cannot access dashboard analytics"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  disabled={addLoading}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="ticket-description">
                  Description <span className="required">*</span>
                </label>
                <textarea
                  id="ticket-description"
                  required
                  rows={4}
                  placeholder="Describe the issue you are experiencing..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  disabled={addLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="ticket-priority">Priority</label>
                <select
                  id="ticket-priority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  disabled={addLoading}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddModal(false)}
                  disabled={addLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addLoading}
                >
                  {addLoading ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
