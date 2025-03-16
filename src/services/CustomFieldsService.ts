import { useState, useEffect } from 'react';
import { supabase } from '../main';

interface CustomFieldsServiceProps {
  deliveryId?: string;
}

export interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options: any;
  required: boolean;
  applies_to: string;
  active: boolean;
}

export default function useCustomFieldsService({ deliveryId }: CustomFieldsServiceProps) {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch custom fields
  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('custom_field_definitions')
          .select('*')
          .eq('active', true);

        if (error) throw error;

        setCustomFields(data || []);
        
        // If deliveryId is provided, fetch field values
        if (deliveryId) {
          await fetchFieldValues(deliveryId);
        }
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomFields();
  }, [deliveryId]);

  // Fetch field values for a specific delivery
  const fetchFieldValues = async (deliveryId: string) => {
    try {
      const { data, error } = await supabase
        .from('custom_field_values')
        .select('field_id, value')
        .eq('delivery_id', deliveryId);
      
      if (error) throw error;
      
      const values: Record<string, any> = {};
      (data || []).forEach(item => {
        values[item.field_id] = item.value;
      });
      
      setFieldValues(values);
    } catch (error: any) {
      setError(`Error fetching field values: ${error.message}`);
    }
  };

  // Save field values for a delivery
  const saveFieldValues = async (
    deliveryId: string, 
    values: Record<string, any>,
    userId?: string
  ) => {
    try {
      setLoading(true);
      
      // Convert values object to array of records
      const fieldEntries = Object.entries(values);
      if (fieldEntries.length === 0) return;
      
      const fieldInserts = fieldEntries.map(([fieldId, value]) => ({
        field_id: fieldId,
        delivery_id: deliveryId,
        user_id: userId,
        value: value?.toString() || ''
      }));

      // First delete any existing values
      await supabase
        .from('custom_field_values')
        .delete()
        .eq('delivery_id', deliveryId);
      
      // Then insert new values
      const { error } = await supabase
        .from('custom_field_values')
        .insert(fieldInserts);

      if (error) throw error;
      
      // Update local state
      setFieldValues(values);
    } catch (error: any) {
      setError(`Error saving field values: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Create a new custom field
  const createCustomField = async (
    name: string,
    fieldType: string,
    appliesTo: string,
    required: boolean,
    options?: string[],
    userId?: string
  ) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .insert([
          {
            name,
            field_type: fieldType,
            options: options || null,
            required,
            applies_to: appliesTo,
            active: true,
            created_by: userId
          }
        ])
        .select()
        .single();

      if (error) throw error;
      
      // Update local state
      setCustomFields([...customFields, data]);
      
      return data;
    } catch (error: any) {
      setError(`Error creating custom field: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Update a custom field
  const updateCustomField = async (
    fieldId: string,
    updates: Partial<CustomField>
  ) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .update(updates)
        .eq('id', fieldId)
        .select()
        .single();

      if (error) throw error;
      
      // Update local state
      setCustomFields(customFields.map(field => 
        field.id === fieldId ? data : field
      ));
      
      return data;
    } catch (error: any) {
      setError(`Error updating custom field: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Delete a custom field
  const deleteCustomField = async (fieldId: string) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('custom_field_definitions')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;
      
      // Update local state
      setCustomFields(customFields.filter(field => field.id !== fieldId));
    } catch (error: any) {
      setError(`Error deleting custom field: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    customFields,
    fieldValues,
    loading,
    error,
    fetchFieldValues,
    saveFieldValues,
    createCustomField,
    updateCustomField,
    deleteCustomField
  };
}
