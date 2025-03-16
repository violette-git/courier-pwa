import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../main';
import './DispatchDashboard.css';

interface Delivery {
  id: string;
  tracking_number: string;
  status: string;
  assigned_courier: string | null;
  courier_name?: string;
  pickup_location: any;
  dropoff_location: any;
  scheduled_pickup: string;
  scheduled_dropoff: string;
  actual_pickup: string | null;
  actual_dropoff: string | null;
  package_size: string;
  priority: string;
  customer_reference: string;
  notes: string;
}

interface Courier {
  id: string;
  full_name: string;
  current_status: string;
  last_location_lat: number | null;
  last_location_lng: number | null;
  last_location_timestamp: string | null;
}

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options: any;
  required: boolean;
  applies_to: string;
}

export default function DispatchDashboard() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewDeliveryForm, setShowNewDeliveryForm] = useState(false);
  const [newDelivery, setNewDelivery] = useState({
    tracking_number: '',
    pickup_address: '',
    pickup_lat: '',
    pickup_lng: '',
    dropoff_address: '',
    dropoff_lat: '',
    dropoff_lng: '',
    scheduled_pickup: '',
    scheduled_dropoff: '',
    package_size: 'medium',
    priority: 'standard',
    customer_reference: '',
    notes: '',
    assigned_courier: ''
  });
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch deliveries
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

        // Fetch courier names for assigned deliveries
        const deliveriesWithCouriers = await Promise.all((data || []).map(async (delivery) => {
          if (delivery.assigned_courier) {
            const { data: courierData, error: courierError } = await supabase
              .from('users')
              .select('full_name')
              .eq('id', delivery.assigned_courier)
              .single();
            
            if (!courierError && courierData) {
              return { ...delivery, courier_name: courierData.full_name };
            }
          }
          return delivery;
        }));

        setDeliveries(deliveriesWithCouriers || []);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveries();
  }, [user]);

  // Fetch couriers
  useEffect(() => {
    if (!user) return;

    const fetchCouriers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select(`
            id,
            full_name,
            courier_profiles:courier_profiles(
              current_status,
              last_location_lat,
              last_location_lng,
              last_location_timestamp
            )
          `)
          .eq('user_role', 'courier');

        if (error) throw error;

        const formattedCouriers = (data || []).map(user => ({
          id: user.id,
          full_name: user.full_name,
          current_status: user.courier_profiles?.current_status || 'offline',
          last_location_lat: user.courier_profiles?.last_location_lat || null,
          last_location_lng: user.courier_profiles?.last_location_lng || null,
          last_location_timestamp: user.courier_profiles?.last_location_timestamp || null
        }));

        setCouriers(formattedCouriers);
      } catch (error: any) {
        console.error('Error fetching couriers:', error);
      }
    };

    fetchCouriers();
  }, [user]);

  // Fetch custom fields
  useEffect(() => {
    if (!user) return;

    const fetchCustomFields = async () => {
      try {
        const { data, error } = await supabase
          .from('custom_field_definitions')
          .select('*')
          .eq('active', true);

        if (error) throw error;

        setCustomFields(data || []);
      } catch (error: any) {
        console.error('Error fetching custom fields:', error);
      }
    };

    fetchCustomFields();
  }, [user]);

  // Handle delivery selection
  const handleSelectDelivery = async (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    
    // Fetch custom field values for this delivery
    try {
      const { data, error } = await supabase
        .from('custom_field_values')
        .select('field_id, value')
        .eq('delivery_id', delivery.id);
      
      if (error) throw error;
      
      const values: Record<string, any> = {};
      (data || []).forEach(item => {
        values[item.field_id] = item.value;
      });
      
      setCustomFieldValues(values);
    } catch (error: any) {
      console.error('Error fetching custom field values:', error);
    }
  };

  // Handle new delivery form submission
  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // First, create pickup location
      const { data: pickupData, error: pickupError } = await supabase
        .from('locations')
        .insert([
          {
            address: newDelivery.pickup_address,
            lat: parseFloat(newDelivery.pickup_lat),
            lng: parseFloat(newDelivery.pickup_lng)
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
            address: newDelivery.dropoff_address,
            lat: parseFloat(newDelivery.dropoff_lat),
            lng: parseFloat(newDelivery.dropoff_lng)
          }
        ])
        .select('id')
        .single();

      if (dropoffError) throw dropoffError;

      // Create the delivery
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('deliveries')
        .insert([
          {
            tracking_number: newDelivery.tracking_number || `DEL-${Date.now()}`,
            status: 'pending',
            assigned_courier: newDelivery.assigned_courier || null,
            dispatcher: user.id,
            pickup_location: pickupData.id,
            dropoff_location: dropoffData.id,
            scheduled_pickup: newDelivery.scheduled_pickup,
            scheduled_dropoff: newDelivery.scheduled_dropoff,
            package_size: newDelivery.package_size,
            priority: newDelivery.priority,
            customer_reference: newDelivery.customer_reference,
            notes: newDelivery.notes
          }
        ])
        .select('id')
        .single();

      if (deliveryError) throw deliveryError;

      // If courier is assigned, update status to 'assigned'
      if (newDelivery.assigned_courier) {
        await supabase
          .from('deliveries')
          .update({ status: 'assigned' })
          .eq('id', deliveryData.id);
      }

      // Save custom field values
      const customFieldEntries = Object.entries(customFieldValues);
      if (customFieldEntries.length > 0) {
        const customFieldInserts = customFieldEntries.map(([fieldId, value]) => ({
          field_id: fieldId,
          delivery_id: deliveryData.id,
          value: value?.toString() || ''
        }));

        const { error: customFieldError } = await supabase
          .from('custom_field_values')
          .insert(customFieldInserts);

        if (customFieldError) throw customFieldError;
      }

      // Reset form and refresh deliveries
      setShowNewDeliveryForm(false);
      setNewDelivery({
        tracking_number: '',
        pickup_address: '',
        pickup_lat: '',
        pickup_lng: '',
        dropoff_address: '',
        dropoff_lat: '',
        dropoff_lng: '',
        scheduled_pickup: '',
        scheduled_dropoff: '',
        package_size: 'medium',
        priority: 'standard',
        customer_reference: '',
        notes: '',
        assigned_courier: ''
      });
      setCustomFieldValues({});

      // Refresh deliveries list
      window.location.reload();

    } catch (error: any) {
      setError(`Error creating delivery: ${error.message}`);
    }
  };

  // Handle delivery assignment
  const handleAssignCourier = async (deliveryId: string, courierId: string) => {
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ 
          assigned_courier: courierId,
          status: 'assigned'
        })
        .eq('id', deliveryId);

      if (error) throw error;

      // Update local state
      setDeliveries(deliveries.map(d => {
        if (d.id === deliveryId) {
          const assignedCourier = couriers.find(c => c.id === courierId);
          return { 
            ...d, 
            assigned_courier: courierId,
            courier_name: assignedCourier?.full_name || 'Unknown',
            status: 'assigned'
          };
        }
        return d;
      }));

      if (selectedDelivery?.id === deliveryId) {
        const assignedCourier = couriers.find(c => c.id === courierId);
        setSelectedDelivery({
          ...selectedDelivery,
          assigned_courier: courierId,
          courier_name: assignedCourier?.full_name || 'Unknown',
          status: 'assigned'
        });
      }

    } catch (error: any) {
      setError(`Error assigning courier: ${error.message}`);
    }
  };

  // Handle input change for new delivery form
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewDelivery({
      ...newDelivery,
      [name]: value
    });
  };

  // Handle custom field input change
  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setCustomFieldValues({
      ...customFieldValues,
      [fieldId]: value
    });
  };

  // Filter deliveries by status
  const filteredDeliveries = filterStatus === 'all' 
    ? deliveries 
    : deliveries.filter(d => d.status === filterStatus);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading dispatch dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dispatch-dashboard">
      <div className="dispatch-header">
        <h2>Dispatch Dashboard</h2>
        <button 
          className="new-delivery-button"
          onClick={() => setShowNewDeliveryForm(true)}
        >
          Create New Delivery
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="dashboard-content">
        <div className="deliveries-panel">
          <div className="filter-controls">
            <label htmlFor="status-filter">Filter by Status:</label>
            <select 
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Deliveries</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="delivery-list">
            {filteredDeliveries.length === 0 ? (
              <p className="no-deliveries">No deliveries found</p>
            ) : (
              filteredDeliveries.map(delivery => (
                <div 
                  key={delivery.id}
                  className={`delivery-item ${selectedDelivery?.id === delivery.id ? 'selected' : ''}`}
                  onClick={() => handleSelectDelivery(delivery)}
                >
                  <div className="delivery-item-header">
                    <span className={`status-badge ${delivery.status}`}>
                      {delivery.status.replace('_', ' ')}
                    </span>
                    <span className="tracking-number">
                      #{delivery.tracking_number}
                    </span>
                  </div>
                  <div className="delivery-item-details">
                    <p>From: {delivery.pickup_location?.address}</p>
                    <p>To: {delivery.dropoff_location?.address}</p>
                    {delivery.courier_name ? (
                      <p className="courier-name">Courier: {delivery.courier_name}</p>
                    ) : (
                      <p className="unassigned">Unassigned</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="details-panel">
          {selectedDelivery ? (
            <div className="delivery-details">
              <h3>Delivery Details</h3>
              <div className="detail-card">
                <div className="detail-header">
                  <span className={`status-badge ${selectedDelivery.status}`}>
                    {selectedDelivery.status.replace('_', ' ')}
                  </span>
                  <span className="tracking-number">
                    #{selectedDelivery.tracking_number}
                  </span>
                </div>

                <div className="detail-section">
                  <h4>Locations</h4>
                  <div className="location-details">
                    <div className="location pickup">
                      <h5>Pickup</h5>
                      <p>{selectedDelivery.pickup_location?.address}</p>
                      <p>Scheduled: {new Date(selectedDelivery.scheduled_pickup).toLocaleString()}</p>
                      {selectedDelivery.actual_pickup && (
                        <p>Actual: {new Date(selectedDelivery.actual_pickup).toLocaleString()}</p>
                      )}
                    </div>
                    
                    <div className="location dropoff">
                      <h5>Dropoff</h5>
                      <p>{selectedDelivery.dropoff_location?.address}</p>
                      <p>Scheduled: {new Date(selectedDelivery.scheduled_dropoff).toLocaleString()}</p>
                      {selectedDelivery.actual_dropoff && (
                        <p>Actual: {new Date(selectedDelivery.actual_dropoff).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Package Information</h4>
                  <p><strong>Size:</strong> {selectedDelivery.package_size}</p>
                  <p><strong>Priority:</strong> {selectedDelivery.priority}</p>
                  {selectedDelivery.customer_reference && (
                    <p><strong>Customer Reference:</strong> {selectedDelivery.customer_reference}</p>
                  )}
                  {selectedDelivery.notes && (
                    <p><strong>Notes:</strong> {selectedDelivery.notes}</p>
                  )}
                </div>

                {/* Custom Fields */}
                {customFields.length > 0 && (
                  <div className="detail-section">
                    <h4>Custom Fields</h4>
                    {customFields.map(field => (
                      <p key={field.id}>
                        <strong>{field.name}:</strong> {customFieldValues[field.id] || 'Not set'}
                      </p>
                    ))}
                  </div>
                )}

                <div className="detail-section">
                  <h4>Courier Assignment</h4>
                  {selectedDelivery.courier_name ? (
                    <p>Assigned to: {selectedDelivery.courier_name}</p>
                  ) : (
                    <div className="courier-assignment">
                      <p>Not assigned</p>
                      <select 
                        onChange={(e) => handleAssignCourier(selectedDelivery.id, e.target.value)}
                        defaultValue=""
                      >
                        <option value="" disabled>Select a courier</option>
                        {couriers.map(courier => (
                          <option key={courier.id} value={courier.id}>
                            {courier.full_name} ({courier.current_status})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <p>Select a delivery to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* New Delivery Form Modal */}
      {showNewDeliveryForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Delivery</h3>
              <button 
                className="close-button"
                onClick={() => setShowNewDeliveryForm(false)}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleCreateDelivery}>
              <div className="form-section">
                <h4>Basic Information</h4>
                <div className="form-group">
                  <label htmlFor="tracking_number">Tracking Number (optional)</label>
                  <input
                    id="tracking_number"
                    name="tracking_number"
                    type="text"
                    value={newDelivery.tracking_number}
                    onChange={handleInputChange}
                    placeholder="Auto-generated if empty"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="package_size">Package Size</label>
                  <select
                    id="package_size"
                    name="package_size"
                    value={newDelivery.package_size}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="extra_large">Extra Large</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="priority">Priority</label>
                  <select
                    id="priority"
                    name="priority"
                    value={newDelivery.priority}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="standard">Standard</option>
                    <option value="express">Express</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="customer_reference">Customer Reference</label>
                  <input
                    id="customer_reference"
                    name="customer_reference"
                    type="text"
                    value={newDelivery.customer_reference}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              
              <div className="form-section">
                <h4>Pickup Information</h4>
                <div className="form-group">
                  <label htmlFor="pickup_address">Pickup Address</label>
                  <input
                    id="pickup_address"
                    name="pickup_address"
                    type="text"
                    value={newDelivery.pickup_address}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="pickup_lat">Latitude</label>
                    <input
                      id="pickup_lat"
                      name="pickup_lat"
                      type="text"
                      value={newDelivery.pickup_lat}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="pickup_lng">Longitude</label>
                    <input
                      id="pickup_lng"
                      name="pickup_lng"
                      type="text"
                      value={newDelivery.pickup_lng}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="scheduled_pickup">Scheduled Pickup Time</label>
                  <input
                    id="scheduled_pickup"
                    name="scheduled_pickup"
                    type="datetime-local"
                    value={newDelivery.scheduled_pickup}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              
              <div className="form-section">
                <h4>Dropoff Information</h4>
                <div className="form-group">
                  <label htmlFor="dropoff_address">Dropoff Address</label>
                  <input
                    id="dropoff_address"
                    name="dropoff_address"
                    type="text"
                    value={newDelivery.dropoff_address}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="dropoff_lat">Latitude</label>
                    <input
                      id="dropoff_lat"
                      name="dropoff_lat"
                      type="text"
                      value={newDelivery.dropoff_lat}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="dropoff_lng">Longitude</label>
                    <input
                      id="dropoff_lng"
                      name="dropoff_lng"
                      type="text"
                      value={newDelivery.dropoff_lng}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="scheduled_dropoff">Scheduled Dropoff Time</label>
                  <input
                    id="scheduled_dropoff"
                    name="scheduled_dropoff"
                    type="datetime-local"
                    value={newDelivery.scheduled_dropoff}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              
              <div className="form-section">
                <h4>Additional Information</h4>
                <div className="form-group">
                  <label htmlFor="notes">Notes</label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={newDelivery.notes}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="assigned_courier">Assign Courier (optional)</label>
                  <select
                    id="assigned_courier"
                    name="assigned_courier"
                    value={newDelivery.assigned_courier}
                    onChange={handleInputChange}
                  >
                    <option value="">Unassigned</option>
                    {couriers.map(courier => (
                      <option key={courier.id} value={courier.id}>
                        {courier.full_name} ({courier.current_status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Custom Fields */}
              {customFields.length > 0 && (
                <div className="form-section">
                  <h4>Custom Fields</h4>
                  {customFields.map(field => (
                    <div className="form-group" key={field.id}>
                      <label htmlFor={`custom_${field.id}`}>{field.name}</label>
                      {field.field_type === 'text' && (
                        <input
                          id={`custom_${field.id}`}
                          type="text"
                          value={customFieldValues[field.id] || ''}
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                          required={field.required}
                        />
                      )}
                      {field.field_type === 'number' && (
                        <input
                          id={`custom_${field.id}`}
                          type="number"
                          value={customFieldValues[field.id] || ''}
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                          required={field.required}
                        />
                      )}
                      {field.field_type === 'boolean' && (
                        <select
                          id={`custom_${field.id}`}
                          value={customFieldValues[field.id] || ''}
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                          required={field.required}
                        >
                          <option value="">Select</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      )}
                      {field.field_type === 'date' && (
                        <input
                          id={`custom_${field.id}`}
                          type="date"
                          value={customFieldValues[field.id] || ''}
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                          required={field.required}
                        />
                      )}
                      {field.field_type === 'select' && field.options && (
                        <select
                          id={`custom_${field.id}`}
                          value={customFieldValues[field.id] || ''}
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                          required={field.required}
                        >
                          <option value="">Select</option>
                          {field.options.map((option: string, index: number) => (
                            <option key={index} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowNewDeliveryForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  Create Delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
