import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportingApi } from '../api/supabaseApi';
import DailyReportTemplate from './DailyReportTemplate';
import './ReportingDashboard.css';

export default function ReportingDashboard() {
  const { user, userRole } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Fetch reports for the current user
  useEffect(() => {
    if (!user) return;

    const fetchReports = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const reportData = await reportingApi.getCourierReports(user.id);
        setReports(reportData);
        
        // Select the most recent report by default if available
        if (reportData.length > 0) {
          setSelectedReport(reportData[0].id);
        }
      } catch (error: any) {
        setError(error.message || 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [user]);

  // Generate a new report
  const handleGenerateReport = async () => {
    if (!user) return;
    
    try {
      setGeneratingReport(true);
      setError(null);
      
      const report = await reportingApi.generateDailyReport(user.id, selectedDate);
      
      // Add the new report to the list and select it
      setReports([report, ...reports.filter(r => r.id !== report.id)]);
      setSelectedReport(report.id);
    } catch (error: any) {
      setError(error.message || 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Handle report selection
  const handleReportSelect = (reportId: string) => {
    setSelectedReport(reportId);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && reports.length === 0) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="reporting-dashboard">
      <div className="dashboard-header">
        <h2>Delivery Reports</h2>
      </div>

      {error && (
        <div className="error-container">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="dashboard-content">
        <div className="reports-sidebar">
          <div className="generate-report-section">
            <h3>Generate New Report</h3>
            <div className="date-selector">
              <label htmlFor="report-date">Select Date:</label>
              <input
                id="report-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <button
              className="generate-button"
              onClick={handleGenerateReport}
              disabled={generatingReport}
            >
              {generatingReport ? 'Generating...' : 'Generate Report'}
            </button>
          </div>

          <div className="reports-list">
            <h3>Your Reports</h3>
            {reports.length === 0 ? (
              <p className="no-reports">No reports available</p>
            ) : (
              <ul>
                {reports.map(report => (
                  <li
                    key={report.id}
                    className={selectedReport === report.id ? 'selected' : ''}
                    onClick={() => handleReportSelect(report.id)}
                  >
                    <div className="report-item">
                      <span className="report-date">{formatDate(report.report_date)}</span>
                      <div className="report-stats">
                        <span>{report.total_deliveries} deliveries</span>
                        <span>{report.total_distance.toFixed(1)} km</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="report-display">
          {selectedReport ? (
            <DailyReportTemplate reportId={selectedReport} />
          ) : (
            <div className="no-report-selected">
              <p>Select a report to view or generate a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
