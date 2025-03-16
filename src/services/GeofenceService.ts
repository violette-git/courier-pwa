import { useState, useEffect } from 'react';
import { supabase } from '../main';

interface GeofenceServiceProps {
  userId: string;
  deliveryId?: string;
  onGeofenceAlert: (alert: GeofenceAlert) => void;
}

export interface GeofenceAlert {
  id: string;
  name: string;
  type: 'pickup' | 'dropoff';
  distance: number;
}

export default function useGeofenceService({ 
  userId, 
  deliveryId, 
  onGeofenceAlert 
}: GeofenceServiceProps) {
  const [watchId, setWatchId] = useState<number | null>(null);
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<any | null>(null);

  // Fetch active delivery if deliveryId is not provided
  useEffect(() => {
    if (!userId) return;
    
    if (!deliveryId) {
      const fetchActiveDelivery = async () => {
        try {
          const { data, error } = await supabase
            .from('deliveries')
            .select(`
              id,
              status,
              pickup_location:pickup_location(id, address, lat, lng),
              dropoff_location:dropoff_location(id, address, lat, lng)
            `)
            .eq('assigned_courier', userId)
            .in('status', ['assigned', 'in_transit'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (error) throw error;
          
          if (data) {
            setActiveDelivery(data);
          }
        } catch (error: any) {
          console.error('Error fetching active delivery:', error.message);
        }
      };

      fetchActiveDelivery();
    } else {
      // If deliveryId is provided, fetch that specific delivery
      const fetchDelivery = async () => {
        try {
          const { data, error } = await supabase
            .from('deliveries')
            .select(`
              id,
              status,
              pickup_location:pickup_location(id, address, lat, lng),
              dropoff_location:dropoff_location(id, address, lat, lng)
            `)
            .eq('id', deliveryId)
            .single();

          if (error) throw error;
          
          if (data) {
            setActiveDelivery(data);
          }
        } catch (error: any) {
          console.error('Error fetching delivery:', error.message);
        }
      };

      fetchDelivery();
    }
  }, [userId, deliveryId]);

  // Start geofence monitoring
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentPosition(position);
        checkGeofences(position);
      },
      (err) => {
        setError(`Location error: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );

    // Set up continuous location tracking
    const id = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition(position);
        checkGeofences(position);
        recordLocationUpdate(position);
      },
      (err) => {
        setError(`Location tracking error: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );

    setWatchId(id);

    // Clean up
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [activeDelivery]);

  // Check if user is near any geofence zones
  const checkGeofences = (position: GeolocationPosition) => {
    if (!activeDelivery) return;

    const alerts: GeofenceAlert[] = [];
    
    // Check distance to pickup location
    if (activeDelivery.pickup_location && 
        activeDelivery.status === 'assigned' &&
        activeDelivery.pickup_location.lat && 
        activeDelivery.pickup_location.lng) {
      
      const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        activeDelivery.pickup_location.lat,
        activeDelivery.pickup_location.lng
      );
      
      // If within 200 meters of pickup
      if (distance <= 0.2) {
        const alert = {
          id: `pickup-${activeDelivery.id}`,
          name: 'Pickup Location',
          type: 'pickup' as const,
          distance: distance
        };
        
        alerts.push(alert);
        onGeofenceAlert(alert);
        
        // Record geofence event
        recordGeofenceEvent('enter', activeDelivery.pickup_location.id, position);
      }
    }
    
    // Check distance to dropoff location
    if (activeDelivery.dropoff_location && 
        activeDelivery.status === 'in_transit' &&
        activeDelivery.dropoff_location.lat && 
        activeDelivery.dropoff_location.lng) {
      
      const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        activeDelivery.dropoff_location.lat,
        activeDelivery.dropoff_location.lng
      );
      
      // If within 200 meters of dropoff
      if (distance <= 0.2) {
        const alert = {
          id: `dropoff-${activeDelivery.id}`,
          name: 'Dropoff Location',
          type: 'dropoff' as const,
          distance: distance
        };
        
        alerts.push(alert);
        onGeofenceAlert(alert);
        
        // Record geofence event
        recordGeofenceEvent('enter', activeDelivery.dropoff_location.id, position);
      }
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

  // Record geofence event to database
  const recordGeofenceEvent = async (eventType: 'enter' | 'exit', geofenceId: string, position: GeolocationPosition) => {
    if (!userId || !activeDelivery) return;

    try {
      await supabase
        .from('geofence_events')
        .insert([
          {
            courier_id: userId,
            delivery_id: activeDelivery.id,
            geofence_id: geofenceId,
            event_type: eventType,
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        ]);

      // Create notification
      await supabase
        .from('notifications')
        .insert([
          {
            user_id: userId,
            title: `Geofence ${eventType === 'enter' ? 'Entered' : 'Exited'}`,
            message: `You have ${eventType === 'enter' ? 'entered' : 'exited'} a geofence zone.`,
            type: 'geofence',
            related_delivery_id: activeDelivery.id
          }
        ]);

    } catch (error) {
      console.error('Error recording geofence event:', error);
    }
  };

  // Record location update to database
  const recordLocationUpdate = async (position: GeolocationPosition) => {
    if (!userId) return;

    try {
      await supabase
        .from('location_tracking')
        .insert([
          {
            courier_id: userId,
            delivery_id: activeDelivery?.id,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            heading: position.coords.heading,
            battery_level: 100 // Would need to use Battery API for actual level
          }
        ]);

      // Also update courier profile with last location
      await supabase
        .from('courier_profiles')
        .update({
          last_location_lat: position.coords.latitude,
          last_location_lng: position.coords.longitude,
          last_location_timestamp: new Date().toISOString()
        })
        .eq('id', userId);

    } catch (error) {
      console.error('Error recording location:', error);
    }
  };

  return {
    currentPosition,
    error
  };
}
