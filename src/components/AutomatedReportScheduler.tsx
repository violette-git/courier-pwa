import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportingApi } from '../api/supabaseApi';
import './AutomatedReportScheduler.css';

export default function AutomatedReportScheduler() {
  const { user } = useAuth();
  const [emailAddress, setEmailAddress] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [time, setTime] = useState('18:00');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledReports, setScheduledReports] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      setEmailAddress(user.email || '');
      // In a real implementation, we would fetch existing scheduled reports
      // For now, we'll simulate this with mock data
      setScheduledReports([
        {
          id: '1',
          email: user.email,
          frequency: 'daily',
          time: '18:00',
          active: true
        }
      ]);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // In a real implementation, this would call a Supabase function
      // to schedule automated reports
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Add to scheduled reports
      setScheduledReports([
        ...scheduledReports,
        {
          id: Date.now().toString(),
          email: emailAddress,
          frequency,
          time,
          active: true
        }
      ]);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to schedule report');
    } finally {
      setLoading(false);
    }
  };

  const toggleReportStatus = async (reportId: string, currentStatus: boolean) => {
    try {
      // In a real implementation, this would call a Supabase function
      // to update the report schedule status
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update local state
      setScheduledReports(scheduledReports.map(report => 
        report.id === reportId 
          ? { ...report, active: !currentStatus } 
          : report
      ));
    } catch (error: any) {
      setError(error.message || 'Failed to update report status');
    }
  };

  const deleteScheduledReport = async (reportId: string) => {
    try {
      // In a real implementation, this would call a Supabase function
      // to delete the report schedule
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update local state
      setScheduledReports(scheduledReports.filter(report => report.id !== reportId));
    } catch (error: any) {
      setError(error.message || 'Failed to delete scheduled report');
    }
  };

  return (
    <div className="automated-report-scheduler">
      <div className="scheduler-header">
        <h2>Automated Report Delivery</h2>
        <p>Set up automatic delivery of your daily reports to your email</p>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {success && (
        <div className="success-message">
          <p>Report schedule created successfully!</p>
        </div>
      )}

      <div className="scheduler-content">
        <div className="schedule-form-container">
          <h3>Create New Schedule</h3>
          <form onSubmit={handleSubmit} className="schedule-form">
            <div className="form-group">
              <label htmlFor="email-address">Email Address</label>
              <input
                id="email-address"
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="frequency">Frequency</label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                required
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="time">Time</label>
              <input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
            
            <button 
              type="submit" 
              className="schedule-button"
              disabled={loading}
            >
              {loading ? 'Scheduling...' : 'Schedule Reports'}
            </button>
          </form>
        </div>

        <div className="scheduled-reports-container">
          <h3>Your Scheduled Reports</h3>
          {scheduledReports.length === 0 ? (
            <p className="no-schedules">No scheduled reports</p>
          ) : (
            <ul className="scheduled-reports-list">
              {scheduledReports.map(report => (
                <li key={report.id} className="scheduled-report-item">
                  <div className="report-schedule-details">
                    <div className="schedule-info">
                      <span className="schedule-email">{report.email}</span>
                      <span className="schedule-frequency">
                        {report.frequency.charAt(0).toUpperCase() + report.frequency.slice(1)} at {report.time}
                      </span>
                    </div>
                    <div className="schedule-status">
                      <span className={`status-badge ${report.active ? 'active' : 'inactive'}`}>
                        {report.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="report-schedule-actions">
                    <button
                      className={`toggle-button ${report.active ? 'deactivate' : 'activate'}`}
                      onClick={() => toggleReportStatus(report.id, report.active)}
                    >
                      {report.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => deleteScheduledReport(report.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
