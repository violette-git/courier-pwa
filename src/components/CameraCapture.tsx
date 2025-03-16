import { useState, useRef, useEffect } from 'react';
import './CameraCapture.css';

interface CameraCaptureProps {
  onCapture: (photoDataUrl: string, location: GeolocationPosition | null) => void;
  type: 'pickup' | 'dropoff';
}

export default function CameraCapture({ onCapture, type }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(position);
        },
        (err) => {
          setError(`Location error: ${err.message}`);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
    }

    return () => {
      // Clean up stream when component unmounts
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setCapturing(true);
    } catch (err: any) {
      setError(`Camera error: ${err.message}`);
      setCapturing(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCapturing(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/jpeg');
    setPhoto(dataUrl);
    stopCamera();
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  const confirmPhoto = () => {
    if (photo) {
      onCapture(photo, location);
    }
  };

  return (
    <div className="camera-container">
      <h3>{type === 'pickup' ? 'Pickup Photo' : 'Dropoff Photo'}</h3>
      
      {error && <div className="error-message">{error}</div>}
      
      {!capturing && !photo && (
        <button onClick={startCamera} className="camera-button">
          Start Camera
        </button>
      )}
      
      {capturing && (
        <div className="video-container">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="camera-preview"
          />
          <div className="camera-controls">
            <button onClick={capturePhoto} className="capture-button">
              Capture
            </button>
            <button onClick={stopCamera} className="cancel-button">
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {photo && (
        <div className="photo-container">
          <img src={photo} alt="Captured" className="captured-photo" />
          <div className="photo-controls">
            <button onClick={retakePhoto} className="retake-button">
              Retake
            </button>
            <button onClick={confirmPhoto} className="confirm-button">
              Confirm
            </button>
          </div>
        </div>
      )}
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {location && (
        <div className="location-info">
          <p>
            <strong>Location:</strong> {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
          </p>
          <p>
            <strong>Accuracy:</strong> {location.coords.accuracy.toFixed(2)} meters
          </p>
          <p>
            <strong>Time:</strong> {new Date(location.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}
