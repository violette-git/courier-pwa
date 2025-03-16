import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../main';
import './CustomFieldsManager.css';

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options: any;
  required: boolean;
  applies_to: string;
  active: boolean;
}

export default function CustomFieldsManager() {
  const { user } = useAuth();
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewFieldForm, setShowNewFieldForm] = useState(false);
  const [newField, setNewField] = useState({
    name: '',
    field_type: 'text',
    options: '',
    required: false,
    applies_to: 'delivery',
    active: true
  });

  // Fetch custom fields
  useEffect(() => {
    if (!user) return;

    const fetchCustomFields = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('custom_field_definitions')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        setCustomFields(data || []);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomFields();
  }, [user]);

  // Handle input change for new field form
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setNewField({
        ...newField,
        [name]: checked
      });
    } else {
      setNewField({
        ...newField,
        [name]: value
      });
    }
  };

  // Handle new field form submission
  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // Parse options if field type is select
      let parsedOptions = null;
      if (newField.field_type === 'select' && newField.options) {
        parsedOptions = newField.options.split(',').map((option: string) => option.trim());
      }

      const { data, error } = await supabase
        .from('custom_field_definitions')
        .insert([
          {
            name: newField.name,
            field_type: newField.field_type,
            options: parsedOptions,
            required: newField.required,
            applies_to: newField.applies_to,
            active: newField.active,
            created_by: user.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Add new field to state
      setCustomFields([data, ...customFields]);
      
      // Reset form
      setNewField({
        name: '',
        field_type: 'text',
        options: '',
        required: false,
        applies_to: 'delivery',
        active: true
      });
      
      setShowNewFieldForm(false);
    } catch (error: any) {
      setError(`Error creating custom field: ${error.message}`);
    }
  };

  // Toggle field active status
  const toggleFieldStatus = async (field: CustomField) => {
    try {
      const { error } = await supabase
        .from('custom_field_definitions')
        .update({ active: !field.active })
        .eq('id', field.id);

      if (error) throw error;

      // Update state
      setCustomFields(customFields.map(f => 
        f.id === field.id ? { ...f, active: !f.active } : f
      ));
    } catch (error: any) {
      setError(`Error updating field status: ${error.message}`);
    }
  };

  // Delete field
  const deleteField = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('custom_field_definitions')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;

      // Update state
      setCustomFields(customFields.filter(f => f.id !== fieldId));
    } catch (error: any) {
      setError(`Error deleting field: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading custom fields...</p>
      </div>
    );
  }

  return (
    <div className="custom-fields-manager">
      <div className="manager-header">
        <h2>Custom Fields Manager</h2>
        <button 
          className="new-field-button"
          onClick={() => setShowNewFieldForm(true)}
        >
          Create New Field
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="fields-list">
        {customFields.length === 0 ? (
          <p className="no-fields">No custom fields defined yet</p>
        ) : (
          customFields.map(field => (
            <div key={field.id} className={`field-item ${!field.active ? 'inactive' : ''}`}>
              <div className="field-header">
                <h3>{field.name}</h3>
                <div className="field-actions">
                  <button 
                    className={`status-toggle ${field.active ? 'active' : 'inactive'}`}
                    onClick={() => toggleFieldStatus(field)}
                  >
                    {field.active ? 'Active' : 'Inactive'}
                  </button>
                  <button 
                    className="delete-button"
                    onClick={() => deleteField(field.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <div className="field-details">
                <p><strong>Type:</strong> {field.field_type}</p>
                <p><strong>Applies to:</strong> {field.applies_to}</p>
                <p><strong>Required:</strong> {field.required ? 'Yes' : 'No'}</p>
                {field.field_type === 'select' && field.options && (
                  <p>
                    <strong>Options:</strong> {Array.isArray(field.options) ? field.options.join(', ') : field.options}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Field Form Modal */}
      {showNewFieldForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Custom Field</h3>
              <button 
                className="close-button"
                onClick={() => setShowNewFieldForm(false)}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleCreateField}>
              <div className="form-section">
                <div className="form-group">
                  <label htmlFor="name">Field Name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={newField.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="field_type">Field Type</label>
                  <select
                    id="field_type"
                    name="field_type"
                    value={newField.field_type}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Yes/No</option>
                    <option value="date">Date</option>
                    <option value="select">Select (Dropdown)</option>
                    <option value="photo">Photo</option>
                  </select>
                </div>
                
                {newField.field_type === 'select' && (
                  <div className="form-group">
                    <label htmlFor="options">Options (comma separated)</label>
                    <input
                      id="options"
                      name="options"
                      type="text"
                      value={newField.options}
                      onChange={handleInputChange}
                      placeholder="Option 1, Option 2, Option 3"
                      required
                    />
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="applies_to">Applies To</label>
                  <select
                    id="applies_to"
                    name="applies_to"
                    value={newField.applies_to}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="delivery">Delivery</option>
                    <option value="pickup">Pickup</option>
                    <option value="dropoff">Dropoff</option>
                    <option value="courier">Courier</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
                
                <div className="form-group checkbox">
                  <label>
                    <input
                      name="required"
                      type="checkbox"
                      checked={newField.required}
                      onChange={handleInputChange}
                    />
                    Required Field
                  </label>
                </div>
                
                <div className="form-group checkbox">
                  <label>
                    <input
                      name="active"
                      type="checkbox"
                      checked={newField.active}
                      onChange={handleInputChange}
                    />
                    Active
                  </label>
                </div>
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowNewFieldForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  Create Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
