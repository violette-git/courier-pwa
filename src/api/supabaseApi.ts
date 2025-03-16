import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// API functions for deliveries
export const deliveryApi = {
  // Get all deliveries for a courier
  getCourierDeliveries: async (courierId: string) => {
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        id,
        tracking_number,
        status,
        pickup_location:pickup_location(id, address, lat, lng),
        dropoff_location:dropoff_location(id, address, lat, lng),
        scheduled_pickup,
        scheduled_dropoff,
        actual_pickup,
        actual_dropoff,
        package_size,
        priority,
        customer_reference,
        notes
      `)
      .eq('assigned_courier', courierId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get all deliveries for a dispatcher
  getDispatcherDeliveries: async () => {
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        id,
        tracking_number,
        status,
        assigned_courier,
        pickup_location:pickup_location(id, address, lat, lng),
        dropoff_location:dropoff_location(id, address, lat, lng),
        scheduled_pickup,
        scheduled_dropoff,
        actual_pickup,
        actual_dropoff,
        package_size,
        priority,
        customer_reference,
        notes
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get a single delivery by ID
  getDeliveryById: async (deliveryId: string) => {
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        id,
        tracking_number,
        status,
        assigned_courier,
        pickup_location:pickup_location(id, address, lat, lng),
        dropoff_location:dropoff_location(id, address, lat, lng),
        scheduled_pickup,
        scheduled_dropoff,
        actual_pickup,
        actual_dropoff,
        package_size,
        priority,
        customer_reference,
        notes
      `)
      .eq('id', deliveryId)
      .single();

    if (error) throw error;
    return data;
  },

  // Create a new delivery
  createDelivery: async (deliveryData: any) => {
    // First, create pickup location
    const { data: pickupData, error: pickupError } = await supabase
      .from('locations')
      .insert([
        {
          address: deliveryData.pickup_address,
          lat: parseFloat(deliveryData.pickup_lat),
          lng: parseFloat(deliveryData.pickup_lng)
        }
      ])
      .select('id')
      .single();

    if (pickupError) throw pickupError;

    // Then, create dropoff location
    const { data: dropoffData, error: dropoffError } = await supabase
      .from('locations')
      .insert([
        {
          address: deliveryData.dropoff_address,
          lat: parseFloat(deliveryData.dropoff_lat),
          lng: parseFloat(deliveryData.dropoff_lng)
        }
      ])
      .select('id')
      .single();

    if (dropoffError) throw dropoffError;

    // Create the delivery
    const { data, error } = await supabase
      .from('deliveries')
      .insert([
        {
          tracking_number: deliveryData.tracking_number || `DEL-${Date.now()}`,
          status: deliveryData.assigned_courier ? 'assigned' : 'pending',
          assigned_courier: deliveryData.assigned_courier || null,
          dispatcher: deliveryData.dispatcher_id,
          pickup_location: pickupData.id,
          dropoff_location: dropoffData.id,
          scheduled_pickup: deliveryData.scheduled_pickup,
          scheduled_dropoff: deliveryData.scheduled_dropoff,
          package_size: deliveryData.package_size,
          priority: deliveryData.priority,
          customer_reference: deliveryData.customer_reference,
          notes: deliveryData.notes
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update a delivery
  updateDelivery: async (deliveryId: string, updates: any) => {
    const { data, error } = await supabase
      .from('deliveries')
      .update(updates)
      .eq('id', deliveryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Assign a courier to a delivery
  assignCourier: async (deliveryId: string, courierId: string) => {
    const { data, error } = await supabase
      .from('deliveries')
      .update({ 
        assigned_courier: courierId,
        status: 'assigned'
      })
      .eq('id', deliveryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get delivery photos
  getDeliveryPhotos: async (deliveryId: string) => {
    const { data, error } = await supabase
      .from('delivery_photos')
      .select('*')
      .eq('delivery_id', deliveryId)
      .order('taken_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get delivery status updates
  getDeliveryStatusUpdates: async (deliveryId: string) => {
    const { data, error } = await supabase
      .from('delivery_status_updates')
      .select('*')
      .eq('delivery_id', deliveryId)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};

// API functions for couriers
export const courierApi = {
  // Get all couriers
  getAllCouriers: async () => {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        phone,
        user_role,
        courier_profiles:courier_profiles(
          current_status,
          last_location_lat,
          last_location_lng,
          last_location_timestamp,
          vehicle_type,
          license_plate,
          max_capacity,
          rating,
          total_deliveries,
          total_distance
        )
      `)
      .eq('user_role', 'courier');

    if (error) throw error;
    return data || [];
  },

  // Get courier by ID
  getCourierById: async (courierId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        phone,
        user_role,
        courier_profiles:courier_profiles(
          current_status,
          last_location_lat,
          last_location_lng,
          last_location_timestamp,
          vehicle_type,
          license_plate,
          max_capacity,
          rating,
          total_deliveries,
          total_distance
        )
      `)
      .eq('id', courierId)
      .single();

    if (error) throw error;
    return data;
  },

  // Update courier profile
  updateCourierProfile: async (courierId: string, updates: any) => {
    const { data, error } = await supabase
      .from('courier_profiles')
      .update(updates)
      .eq('id', courierId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get courier location history
  getCourierLocationHistory: async (courierId: string, startTime: string, endTime: string) => {
    const { data, error } = await supabase
      .from('location_tracking')
      .select('*')
      .eq('courier_id', courierId)
      .gte('timestamp', startTime)
      .lte('timestamp', endTime)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  }
};

// API functions for geofencing
export const geofenceApi = {
  // Get all geofence zones
  getAllGeofenceZones: async () => {
    const { data, error } = await supabase
      .from('geofence_zones')
      .select('*')
      .eq('active', true);

    if (error) throw error;
    return data || [];
  },

  // Create a geofence zone
  createGeofenceZone: async (zoneData: any) => {
    const { data, error } = await supabase
      .from('geofence_zones')
      .insert([zoneData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Record a geofence event
  recordGeofenceEvent: async (eventData: any) => {
    const { data, error } = await supabase
      .from('geofence_events')
      .insert([eventData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get geofence events for a delivery
  getGeofenceEventsForDelivery: async (deliveryId: string) => {
    const { data, error } = await supabase
      .from('geofence_events')
      .select('*')
      .eq('delivery_id', deliveryId)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};

// API functions for custom fields
export const customFieldsApi = {
  // Get all custom field definitions
  getAllCustomFields: async () => {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get active custom field definitions
  getActiveCustomFields: async () => {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Create a custom field definition
  createCustomField: async (fieldData: any) => {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .insert([fieldData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update a custom field definition
  updateCustomField: async (fieldId: string, updates: any) => {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .update(updates)
      .eq('id', fieldId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get custom field values for a delivery
  getCustomFieldValuesForDelivery: async (deliveryId: string) => {
    const { data, error } = await supabase
      .from('custom_field_values')
      .select(`
        id,
        field_id,
        value,
        created_at,
        updated_at,
        field:field_id(name, field_type, options, required, applies_to)
      `)
      .eq('delivery_id', deliveryId);

    if (error) throw error;
    return data || [];
  },

  // Save custom field values for a delivery
  saveCustomFieldValues: async (deliveryId: string, values: any[], userId?: string) => {
    // First delete any existing values
    await supabase
      .from('custom_field_values')
      .delete()
      .eq('delivery_id', deliveryId);
    
    // Then insert new values
    const { data, error } = await supabase
      .from('custom_field_values')
      .insert(values.map(item => ({
        field_id: item.fieldId,
        delivery_id: deliveryId,
        user_id: userId,
        value: item.value?.toString() || ''
      })))
      .select();

    if (error) throw error;
    return data || [];
  }
};

// API functions for reporting
export const reportingApi = {
  // Get reports for a courier
  getCourierReports: async (courierId: string) => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('courier_id', courierId)
      .order('report_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get a specific report
  getReportById: async (reportId: string) => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error) throw error;
    return data;
  },

  // Generate a daily report for a courier
  generateDailyReport: async (courierId: string, reportDate: string) => {
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
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('id', existingReport.id)
        .single();
      
      if (error) throw error;
      return data;
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
    
    return report;
  },

  // Mark a report as sent to email
  markReportAsSent: async (reportId: string) => {
    const { data, error } = await supabase
      .from('daily_reports')
      .update({
        sent_to_email: true,
        sent_at: new Date().toISOString()
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// API functions for notifications
export const notificationApi = {
  // Get notifications for a user
  getUserNotifications: async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Mark notification as read
  markNotificationAsRead: async (notificationId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Create a notification
  createNotification: async (notificationData: any) => {
    const { data, error } = await supabase
      .from('notifications')
      .insert([notificationData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
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
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}
