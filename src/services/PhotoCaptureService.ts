import { useState } from 'react';
import { supabase } from '../main';

interface PhotoCaptureServiceProps {
  userId: string;
}

export default function usePhotoCaptureService({ userId }: PhotoCaptureServiceProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle photo capture and upload
  const captureAndUploadPhoto = async (
    photoDataUrl: string, 
    location: GeolocationPosition | null, 
    deliveryId: string,
    photoType: 'pickup' | 'dropoff' | 'damage' | 'other',
    notes: string = ''
  ) => {
    if (!userId || !deliveryId) {
      setError('Missing required information');
      return null;
    }

    try {
      setUploading(true);
      setError(null);

      // Convert base64 to Blob
      const photoBlob = base64ToBlob(photoDataUrl);
      
      // Generate a unique filename
      const fileName = `${userId}/${deliveryId}/${photoType}_${Date.now()}.jpg`;
      
      // Upload the photo to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('delivery_photos')
        .upload(fileName, photoBlob, {
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: urlData } = await supabase.storage
        .from('delivery_photos')
        .getPublicUrl(fileName);

      if (!urlData || !urlData.publicUrl) throw new Error('Failed to get public URL');

      // Save photo record to database
      const { data: photoData, error: photoError } = await supabase
        .from('delivery_photos')
        .insert([
          {
            delivery_id: deliveryId,
            photo_url: urlData.publicUrl,
            photo_type: photoType,
            taken_by: userId,
            lat: location?.coords.latitude,
            lng: location?.coords.longitude,
            notes: notes || `${photoType === 'pickup' ? 'Pickup' : photoType === 'dropoff' ? 'Dropoff' : 'Other'} photo`
          }
        ])
        .select()
        .single();

      if (photoError) throw photoError;

      // Update delivery status based on photo type
      if (photoType === 'pickup' || photoType === 'dropoff') {
        const newStatus = photoType === 'pickup' ? 'in_transit' : 'delivered';
        const statusField = photoType === 'pickup' ? 'actual_pickup' : 'actual_dropoff';
        
        const { error: updateError } = await supabase
          .from('deliveries')
          .update({
            status: newStatus,
            [statusField]: new Date().toISOString()
          })
          .eq('id', deliveryId);

        if (updateError) throw updateError;

        // Record status update
        await supabase
          .from('delivery_status_updates')
          .insert([
            {
              delivery_id: deliveryId,
              status: newStatus,
              updated_by: userId,
              lat: location?.coords.latitude,
              lng: location?.coords.longitude,
              notes: `${photoType === 'pickup' ? 'Picked up' : 'Delivered'} package`
            }
          ]);
      }

      return photoData;
    } catch (err: any) {
      setError(err.message || 'Error uploading photo');
      return null;
    } finally {
      setUploading(false);
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

  return {
    captureAndUploadPhoto,
    uploading,
    error
  };
}
