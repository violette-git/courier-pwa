import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportingApi } from '../api/supabaseApi';
import './DailyReportTemplate.css';

interface DailyReportProps {
  reportId?: string;
  courierId?: string;
  date?: string;
  onGenerateReport?: (reportId: string) => void;
}

export default function DailyReportTemplate({ 
  reportId, 
  courierId, 
  date, 
  onGenerateReport 
}: DailyReportProps) {
  const { user } = useAuth();
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let reportData;
        
        if (reportId) {
          // Fetch existing report by ID
          reportData = await reportingApi.getReportById(reportId);
        } else if (courierId && date) {
          // Generate or fetch report for courier and date
          reportData = await reportingApi.generateDailyReport(courierId, date);
          if (onGenerateReport && reportData) {
            onGenerateReport(reportData.id);
          }
        } else {
          throw new Error('Either reportId or both courierId and date must be provided');
        }
        
        setReport(reportData);
      } catch (error: any) {
        setError(error.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId, courierId, date]);

  const handleSendEmail = async (email: string) => {
    if (!report) return;
    
    try {
      setSendingEmail(true);
      await reportingApi.markReportAsSent(report.id);
      // In a real implementation, this would trigger an email sending function
      alert(`Report would be sent to ${email}`);
      
      // Update local state
      setReport({
        ...report,
        sent_to_email: true,
        sent_at: new Date().toISOString()
      });
    } catch (error: any) {
      setError(error.message || 'Failed to send report');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="no-report">
        <p>No report data available</p>
      </div>
    );
  }

  // Format date for display
  const reportDate = new Date(report.report_date);
  const formattedDate = reportDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Calculate additional metrics
  const averageDistance = report.total_deliveries > 0 
    ? (report.total_distance / report.total_deliveries).toFixed(2) 
    : '0';
  
  const successRate = report.total_deliveries > 0 
    ? ((report.successful_deliveries / report.total_deliveries) * 100).toFixed(1) 
    : '0';

  return (
    <div className="daily-report">
      <div className="report-header">
        <h2>Daily Delivery Report</h2>
        <p className="report-date">{formattedDate}</p>
        {report.sent_to_email && (
          <p className="email-sent">
            Email sent on {new Date(report.sent_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="report-summary">
        <div className="summary-card">
          <h3>Deliveries</h3>
          <div className="metric">
            <span className="value">{report.total_deliveries}</span>
            <span className="label">Total</span>
          </div>
          <div className="metric">
            <span className="value">{report.successful_deliveries}</span>
            <span className="label">Successful</span>
          </div>
          <div className="metric">
            <span className="value">{report.failed_deliveries}</span>
            <span className="label">Failed</span>
          </div>
          <div className="metric">
            <span className="value">{successRate}%</span>
            <span className="label">Success Rate</span>
          </div>
        </div>

        <div className="summary-card">
          <h3>Distance</h3>
          <div className="metric">
            <span className="value">{report.total_distance.toFixed(2)}</span>
            <span className="label">Total (km)</span>
          </div>
          <div className="metric">
            <span className="value">{averageDistance}</span>
            <span className="label">Avg per Delivery (km)</span>
          </div>
        </div>

        <div className="summary-card">
          <h3>Time</h3>
          <div className="metric">
            <span className="value">{Math.floor(report.total_time / 60)}</span>
            <span className="label">Hours</span>
          </div>
          <div className="metric">
            <span className="value">{Math.round(report.total_time % 60)}</span>
            <span className="label">Minutes</span>
          </div>
          <div className="metric">
            <span className="value">{report.average_delivery_time.toFixed(0)}</span>
            <span className="label">Avg Minutes per Delivery</span>
          </div>
        </div>
      </div>

      {report.report_data?.deliveries && report.report_data.deliveries.length > 0 && (
        <div className="deliveries-section">
          <h3>Delivery Details</h3>
          <table className="deliveries-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Pickup Time</th>
                <th>Dropoff Time</th>
                <th>Duration</th>
                <th>Distance (km)</th>
              </tr>
            </thead>
            <tbody>
              {report.report_data.deliveries.map((delivery: any, index: number) => {
                const pickupTime = delivery.pickup_time ? new Date(delivery.pickup_time) : null;
                const dropoffTime = delivery.dropoff_time ? new Date(delivery.dropoff_time) : null;
                
                let duration = '-';
                if (pickupTime && dropoffTime) {
                  const durationMinutes = Math.round((dropoffTime.getTime() - pickupTime.getTime()) / (1000 * 60));
                  duration = `${durationMinutes} min`;
                }
                
                return (
                  <tr key={index}>
                    <td className={`status ${delivery.status}`}>
                      {delivery.status.replace('_', ' ')}
                    </td>
                    <td>{pickupTime ? pickupTime.toLocaleTimeString() : '-'}</td>
                    <td>{dropoffTime ? dropoffTime.toLocaleTimeString() : '-'}</td>
                    <td>{duration}</td>
                    <td>{delivery.distance ? delivery.distance.toFixed(2) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {report.report_data?.route && report.report_data.route.length > 0 && (
        <div className="route-section">
          <h3>Route Information</h3>
          <p>Total tracking points: {report.report_data.location_points}</p>
          <div className="route-map">
            {/* In a real implementation, this would render a map with the route */}
            <div className="map-placeholder">
              <p>Map visualization would be displayed here</p>
              <p>Route with {report.report_data.location_points} tracking points</p>
            </div>
          </div>
        </div>
      )}

      <div className="report-actions">
        <button 
          className="print-button"
          onClick={() => window.print()}
        >
          Print Report
        </button>
        
        {!report.sent_to_email && (
          <button 
            className="email-button"
            onClick={() => handleSendEmail(user?.email || '')}
            disabled={sendingEmail}
          >
            {sendingEmail ? 'Sending...' : 'Send to Email'}
          </button>
        )}
      </div>
    </div>
  );
}
