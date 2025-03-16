-- Database Schema for Courier Service PWA

-- Users Table (Authentication)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_role TEXT NOT NULL CHECK (user_role IN ('courier', 'dispatcher', 'admin')),
  full_name TEXT,
  phone TEXT,
  profile_image_url TEXT,
  device_token TEXT, -- For push notifications
  active BOOLEAN DEFAULT TRUE
);

-- Courier Profiles (extends users)
CREATE TABLE courier_profiles (
  id UUID PRIMARY KEY REFERENCES users(id),
  vehicle_type TEXT,
  license_plate TEXT,
  max_capacity NUMERIC,
  current_status TEXT DEFAULT 'offline' CHECK (current_status IN ('offline', 'available', 'on_delivery')),
  rating NUMERIC DEFAULT 5.0,
  total_deliveries INTEGER DEFAULT 0,
  total_distance NUMERIC DEFAULT 0, -- in kilometers
  last_location_lat NUMERIC,
  last_location_lng NUMERIC,
  last_location_timestamp TIMESTAMP WITH TIME ZONE
);

-- Dispatcher Profiles (extends users)
CREATE TABLE dispatcher_profiles (
  id UUID PRIMARY KEY REFERENCES users(id),
  department TEXT,
  region TEXT,
  assigned_couriers INTEGER DEFAULT 0
);

-- Delivery Locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'USA',
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  contact_name TEXT,
  contact_phone TEXT,
  notes TEXT,
  is_frequent BOOLEAN DEFAULT FALSE
);

-- Geofence Zones
CREATE TABLE geofence_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  center_lat NUMERIC NOT NULL,
  center_lng NUMERIC NOT NULL,
  radius NUMERIC NOT NULL, -- in meters
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  active BOOLEAN DEFAULT TRUE
);

-- Deliveries
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'assigned', 'in_transit', 'delivered', 'failed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_courier UUID REFERENCES users(id),
  dispatcher UUID REFERENCES users(id),
  pickup_location UUID REFERENCES locations(id) NOT NULL,
  dropoff_location UUID REFERENCES locations(id) NOT NULL,
  scheduled_pickup TIMESTAMP WITH TIME ZONE,
  actual_pickup TIMESTAMP WITH TIME ZONE,
  scheduled_dropoff TIMESTAMP WITH TIME ZONE,
  actual_dropoff TIMESTAMP WITH TIME ZONE,
  package_size TEXT CHECK (package_size IN ('small', 'medium', 'large', 'extra_large')),
  package_weight NUMERIC, -- in kg
  priority TEXT DEFAULT 'standard' CHECK (priority IN ('standard', 'express', 'urgent')),
  notes TEXT,
  customer_reference TEXT,
  distance NUMERIC, -- in kilometers
  duration NUMERIC, -- in minutes
  price NUMERIC
);

-- Delivery Photos
CREATE TABLE delivery_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES deliveries(id) NOT NULL,
  photo_url TEXT NOT NULL,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('pickup', 'dropoff', 'damage', 'other')),
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  taken_by UUID REFERENCES users(id) NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  notes TEXT
);

-- Delivery Status Updates
CREATE TABLE delivery_status_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES deliveries(id) NOT NULL,
  status TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  notes TEXT
);

-- Geofence Events
CREATE TABLE geofence_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  courier_id UUID REFERENCES users(id) NOT NULL,
  delivery_id UUID REFERENCES deliveries(id),
  geofence_id UUID REFERENCES geofence_zones(id) NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('enter', 'exit')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL
);

-- Location Tracking
CREATE TABLE location_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  courier_id UUID REFERENCES users(id) NOT NULL,
  delivery_id UUID REFERENCES deliveries(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  accuracy NUMERIC, -- in meters
  speed NUMERIC, -- in km/h
  heading NUMERIC, -- in degrees
  battery_level NUMERIC -- percentage
);

-- Custom Fields Definition
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'select', 'photo')),
  options JSONB, -- For select type fields
  required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  active BOOLEAN DEFAULT TRUE,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('delivery', 'pickup', 'dropoff', 'courier', 'customer'))
);

-- Custom Field Values
CREATE TABLE custom_field_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id UUID REFERENCES custom_field_definitions(id) NOT NULL,
  delivery_id UUID REFERENCES deliveries(id),
  user_id UUID REFERENCES users(id),
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Reports
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  courier_id UUID REFERENCES users(id) NOT NULL,
  report_date DATE NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_deliveries INTEGER DEFAULT 0,
  total_distance NUMERIC DEFAULT 0, -- in kilometers
  total_time NUMERIC DEFAULT 0, -- in minutes
  successful_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  average_delivery_time NUMERIC, -- in minutes
  report_data JSONB, -- Detailed report data
  sent_to_email BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('geofence', 'assignment', 'status_update', 'system')),
  related_delivery_id UUID REFERENCES deliveries(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_deliveries_courier ON deliveries(assigned_courier);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_delivery_photos_delivery ON delivery_photos(delivery_id);
CREATE INDEX idx_geofence_events_courier ON geofence_events(courier_id);
CREATE INDEX idx_geofence_events_delivery ON geofence_events(delivery_id);
CREATE INDEX idx_location_tracking_courier ON location_tracking(courier_id);
CREATE INDEX idx_location_tracking_delivery ON location_tracking(delivery_id);
CREATE INDEX idx_custom_field_values_delivery ON custom_field_values(delivery_id);
CREATE INDEX idx_daily_reports_courier ON daily_reports(courier_id);
CREATE INDEX idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX idx_notifications_user ON notifications(user_id);
