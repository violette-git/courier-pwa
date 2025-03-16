import { useState, useEffect } from 'react';
import { supabase } from '../main';

interface ReportingServiceProps {
  userId?: string;
  date?: string; // ISO date string
}

export interface DailyReport {
  id: string;
  courier_id: string;
  report_date: string;
  generated_at: string;
  total_deliveries: number;
  total_distance: number;
  total_time: number;
  successful_deliveries: number;
  failed_deliveries: number;
  average_delivery_time: number;
  report_data: any;
  sent_to_email: boolean;
  sent_at: string | null;
}

export default function useReportingService({ userId, date }: ReportingServiceProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch reports
  useEffect(() => {
    if (!userId) return;

    const fetchReports = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('daily_reports')
          .select('*')
          .order('report_date', { ascending: false });
        
        if (userId) {
          query = query.eq('courier_id', userId);
        }
        
        if (date) {
          query = query.eq('report_date', date);
        }

        const { data, error } = await query;

        if (error) throw error;

        setReports(data || []);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [userId, date]);

  // Generate a daily report for a courier
  const generateDailyReport = async (courierId: string, reportDate: string) => {
    try {
      setLoading(true);
      
      // First, check if a report already exists for this date
      const { data: existingReport, error: checkError } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('courier_id', courierId)
        .eq('report_date', reportDate)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      // If report exists, return it
      if (existingReport) {
        return await fetchReportById(existingReport.id);
      }
      
      // Get all deliveries for the courier on the specified date
      const startOfDay = new Date(reportDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(reportDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select(`
          id,
          status,
          assigned_courier,
          actual_pickup,
          actual_dropoff,
          distance
        `)
        .eq('assigned_courier', courierId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
      
      if (deliveriesError) throw deliveriesError;
      
      // Get location tracking data for the day
      const { data: locationData, error: locationError } = await supabase
        .from('location_tracking')
        .select('lat, lng, timestamp')
        .eq('courier_id', courierId)
        .gte('timestamp', startOfDay.toISOString())
        .lte('timestamp', endOfDay.toISOString())
        .order('timestamp', { ascending: true });
      
      if (locationError) throw locationError;
      
      // Calculate metrics
      const totalDeliveries = deliveries?.length || 0;
      const successfulDeliveries = deliveries?.filter(d => d.status === 'delivered').length || 0;
      const failedDeliveries = deliveries?.filter(d => d.status === 'failed').length || 0;
      
      // Calculate total distance from location tracking
      let totalDistance = 0;
      if (locationData && locationData.length > 1) {
        for (let i = 1; i < locationData.length; i++) {
          const prevPoint = locationData[i - 1];
          const currentPoint = locationData[i];
          
          const distance = calculateDistance(
            prevPoint.lat,
            prevPoint.lng,
            currentPoint.lat,
            currentPoint.lng
          );
          
          totalDistance += distance;
        }
      } else {
        // If no location tracking data, use the sum of delivery distances
        totalDistance = deliveries?.reduce((sum, delivery) => sum + (delivery.distance || 0), 0) || 0;
      }
      
      // Calculate total time and average delivery time
      let totalTime = 0;
      let averageDeliveryTime = 0;
      
      const completedDeliveries = deliveries?.filter(d => 
        d.status === 'delivered' && d.actual_pickup && d.actual_dropoff
      ) || [];
      
      if (completedDeliveries.length > 0) {
        totalTime = completedDeliveries.reduce((sum, delivery) => {
          const pickupTime = new Date(delivery.actual_pickup).getTime();
          const dropoffTime = new Date(delivery.actual_dropoff).getTime();
          return sum + ((dropoffTime - pickupTime) / (1000 * 60)); // Convert to minutes
        }, 0);
        
        averageDeliveryTime = totalTime / completedDeliveries.length;
      }
      
      // Create report data object
      const reportData = {
        deliveries: deliveries?.map(d => ({
          id: d.id,
          status: d.status,
          pickup_time: d.actual_pickup,
          dropoff_time: d.actual_dropoff,
          distance: d.distance
        })),
        location_points: locationData?.length || 0,
        route: locationData
      };
      
      // Insert the report
      const { data: report, error: insertError } = await supabase
        .from('daily_reports')
        .insert([
          {
            courier_id: courierId,
            report_date: reportDate,
            total_deliveries: totalDeliveries,
            total_distance: totalDistance,
            total_time: totalTime,
            successful_deliveries: successfulDeliveries,
            failed_deliveries: failedDeliveries,
            average_delivery_time: averageDeliveryTime,
            report_data: reportData
          }
        ])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Update local state
      setReports([report, ...reports]);
      
      return report;
    } catch (error: any) {
      setError(`Error generating report: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Fetch a specific report by ID
  const fetchReportById = async (reportId: string) => {
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('id', reportId)
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error: any) {
      setError(`Error fetching report: ${error.message}`);
      throw error;
    }
  };

  // Send report to email
  const sendReportToEmail = async (reportId: string, email: string) => {
    try {
      setLoading(true);
      
      // In a real implementation, this would call a serverless function
      // to send the email. For now, we'll just mark it as sent.
      
      const { error } = await supabase
        .from('daily_reports')
        .update({
          sent_to_email: true,
          sent_at: new Date().toISOString()
        })
        .eq('id', reportId);
      
      if (error) throw error;
      
      // Update local state
      setReports(reports.map(report => 
        report.id === reportId 
          ? { ...report, sent_to_email: true, sent_at: new Date().toISOString() } 
          : report
      ));
      
      return true;
    } catch (error: any) {
      setError(`Error sending report: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI/180);
  };

  return {
    reports,
    loading,
    error,
    generateDailyReport,
    fetchReportById,
    sendReportToEmail
  };
}
