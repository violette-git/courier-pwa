import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../main';
import CameraCapture from './CameraCapture';
import './CourierDashboard.css';

interface Delivery {
  id: string;
  tracking_number: string;
  status: string;
  pickup_location: any;
  dropoff_location: any;
  scheduled_pickup: string;
  scheduled_dropoff: string;
  package_size: string;
  priority: string;
  customer_reference: string;
  notes: string;
}

interface GeofenceAlert {
  id: string;
  name: string;
  type: 'pickup' | 'dropoff';
  distance: number;
}

export default function CourierDashboard() {
  const { user, userProfile } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState<'pickup' | 'dropoff' | null>(null);
  const [geofenceAlerts, setGeofenceAlerts] = useState<GeofenceAlert[]>([]);
  const [currentLocation, setCurrentLocation] = useState<GeolocationPosition | null>(null);
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);

  // Fetch assigned deliveries
  useEffect(() => {
    if (!user) return;

    const fetchDeliveries = async () => {
      try {
        setLoading(true);
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
            package_size,
            priority,
            customer_reference,
            notes
          `)
          .eq('assigned_courier', user.id)
          .in('status', ['assigned', 'in_transit']);

        if (error) throw error;

        setDeliveries(data || []);
        if (data && data.length > 0) {
          setActiveDelivery(data[0]);
        }
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveries();
  }, [user]);

  // Start location tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    // Get initial location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation(position);
        checkGeofences(position);
      },
      (err) => {
        setError(`Location error: ${err.message}`);
      }
    );

    // Set up continuous location tracking
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation(position);
        checkGeofences(position);
        recordLocationUpdate(position);
      },
      (err) => {
        setError(`Location tracking error: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 27000
      }
    );

    setLocationWatchId(watchId);

    // Clean up location tracking
    return () => {
      if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
    };
  }, []);

  // Check if courier is near any geofence zones
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
        alerts.push({
          id: `pickup-${activeDelivery.id}`,
          name: 'Pickup Location',
          type: 'pickup',
          distance: distance
        });
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
        alerts.push({
          id: `dropoff-${activeDelivery.id}`,
          name: 'Dropoff Location',
          type: 'dropoff',
          distance: distance
        });
      }
    }
    
    setGeofenceAlerts(alerts);
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

  // Record location update to database
  const recordLocationUpdate = async (position: GeolocationPosition) => {
    if (!user) return;

    try {
      await supabase
        .from('location_tracking')
        .insert([
          {
            courier_id: user.id,
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
        .eq('id', user.id);

    } catch (error) {
      console.error('Error recording location:', error);
    }
  };

  // Handle photo capture
  const handlePhotoCapture = async (photoDataUrl: string, location: GeolocationPosition | null, type: 'pickup' | 'dropoff') => {
    if (!user || !activeDelivery) return;

    try {
      // First, upload the photo to storage
      const fileName = `${user.id}/${activeDelivery.id}/${type}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('delivery_photos')
        .upload(fileName, base64ToBlob(photoDataUrl), {
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: urlData } = await supabase.storage
        .from('delivery_photos')
        .getPublicUrl(fileName);

      if (!urlData || !urlData.publicUrl) throw new Error('Failed to get public URL');

      // Save photo record to database
      await supabase
        .from('delivery_photos')
        .insert([
          {
            delivery_id: activeDelivery.id,
            photo_url: urlData.publicUrl,
            photo_type: type,
            taken_by: user.id,
            lat: location?.coords.latitude,
            lng: location?.coords.longitude,
            notes: `${type === 'pickup' ? 'Pickup' : 'Dropoff'} photo`
          }
        ]);

      // Update delivery status
      if (type === 'pickup') {
        await supabase
          .from('deliveries')
          .update({
            status: 'in_transit',
            actual_pickup: new Date().toISOString()
          })
          .eq('id', activeDelivery.id);

        // Refresh delivery data
        const updatedDelivery = { ...activeDelivery, status: 'in_transit' };
        setActiveDelivery(updatedDelivery);
        setDeliveries(deliveries.map(d => 
          d.id === activeDelivery.id ? updatedDelivery : d
        ));
      } else if (type === 'dropoff') {
        await supabase
          .from('deliveries')
          .update({
            status: 'delivered',
            actual_dropoff: new Date().toISOString()
          })
          .eq('id', activeDelivery.id);

        // Refresh delivery data
        const updatedDelivery = { ...activeDelivery, status: 'delivered' };
        setActiveDelivery(updatedDelivery);
        setDeliveries(deliveries.map(d => 
          d.id === activeDelivery.id ? updatedDelivery : d
        ));
      }

      // Record status update
      await supabase
        .from('delivery_status_updates')
        .insert([
          {
            delivery_id: activeDelivery.id,
            status: type === 'pickup' ? 'in_transit' : 'delivered',
            updated_by: user.id,
            lat: location?.coords.latitude,
            lng: location?.coords.longitude,
            notes: `${type === 'pickup' ? 'Picked up' : 'Delivered'} package`
          }
        ]);

      // Hide camera after successful capture
      setShowCamera(null);

    } catch (error: any) {
      setError(`Error saving photo: ${error.message}`);
    }
  };

  // Convert base64 to Blob
  const base64ToBlob = (base64: string) => {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], { type: contentType });
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading deliveries...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Error: {error}</p>
        <button onClick={() => setError(null)}>Dismiss</button>
      </div>
    );
  }

  return (
    <div className="courier-dashboard">
      <div className="courier-header">
        <h2>Courier Dashboard</h2>
        <p>Welcome, {userProfile?.full_name || 'Courier'}</p>
      </div>

      {/* Geofence Alerts */}
      {geofenceAlerts.length > 0 && (
        <div className="geofence-alerts">
          {geofenceAlerts.map(alert => (
            <div key={alert.id} className="geofence-alert">
              <div>
                <strong>{alert.name}</strong>
                <p>You are {(alert.distance * 1000).toFixed(0)} meters away</p>
              </div>
              <button 
                onClick={() => setShowCamera(alert.type)}
                className="alert-action-button"
              >
                Take {alert.type === 'pickup' ? 'Pickup' : 'Dropoff'} Photo
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Camera Component */}
      {showCamera && (
        <div className="camera-modal">
          <CameraCapture 
            onCapture={(photo, location) => handlePhotoCapture(photo, location, showCamera)} 
            type={showCamera} 
          />
          <button 
            onClick={() => setShowCamera(null)}
            className="close-camera-button"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Active Delivery */}
      {activeDelivery ? (
        <div className="active-delivery">
          <h3>Active Delivery</h3>
          <div className="delivery-card">
            <div className="delivery-header">
              <span className={`status-badge ${activeDelivery.status}`}>
                {activeDelivery.status.replace('_', ' ')}
              </span>
              <span className="tracking-number">
                #{activeDelivery.tracking_number}
              </span>
            </div>
            
            <div className="delivery-locations">
              <div className="location pickup">
                <h4>Pickup</h4>
                <p>{activeDelivery.pickup_location?.address}</p>
                <p>Scheduled: {new Date(activeDelivery.scheduled_pickup).toLocaleString()}</p>
              </div>
              
              <div className="location dropoff">
                <h4>Dropoff</h4>
                <p>{activeDelivery.dropoff_location?.address}</p>
                <p>Scheduled: {new Date(activeDelivery.scheduled_dropoff).toLocaleString()}</p>
              </div>
            </div>
            
            <div className="delivery-details">
              <p><strong>Package:</strong> {activeDelivery.package_size}</p>
              <p><strong>Priority:</strong> {activeDelivery.priority}</p>
              {activeDelivery.notes && (
                <p><strong>Notes:</strong> {activeDelivery.notes}</p>
              )}
            </div>
            
            <div className="delivery-actions">
              {activeDelivery.status === 'assigned' && (
                <button 
                  onClick={() => setShowCamera('pickup')}
                  className="action-button pickup"
                >
                  Pickup Photo
                </button>
              )}
              
              {activeDelivery.status === 'in_transit' && (
                <button 
                  onClick={() => setShowCamera('dropoff')}
                  className="action-button dropoff"
                >
                  Dropoff Photo
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="no-deliveries">
          <p>No active deliveries assigned to you.</p>
        </div>
      )}

      {/* Delivery List */}
      {deliveries.length > 0 && (
        <div className="delivery-list">
          <h3>Your Deliveries</h3>
          {deliveries.map(delivery => (
            <div 
              key={delivery.id} 
              className={`delivery-item ${activeDelivery?.id === delivery.id ? 'active' : ''}`}
              onClick={() => setActiveDelivery(delivery)}
            >
              <div className="delivery-item-header">
                <span className={`status-badge ${delivery.status}`}>
                  {delivery.status.replace('_', ' ')}
                </span>
                <span className="tracking-number">
                  #{delivery.tracking_number}
                </span>
              </div>
              <p className="delivery-address">
                To: {delivery.dropoff_location?.address}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Current Location */}
      {currentLocation && (
        <div className="current-location">
          <h3>Your Location</h3>
          <p>
            Lat: {currentLocation.coords.latitude.toFixed(6)}, 
            Lng: {currentLocation.coords.longitude.toFixed(6)}
          </p>
          <p>Accuracy: {currentLocation.coords.accuracy.toFixed(2)} meters</p>
          <p>Updated: {new Date(currentLocation.timestamp).toLocaleTimeString()}</p>
        </div>
      )}
    </div>
  );
}
