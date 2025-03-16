import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import CourierDashboard from '../components/CourierDashboard';
import DispatchDashboard from '../components/DispatchDashboard';
import CameraCapture from '../components/CameraCapture';
import CustomFieldsManager from '../components/CustomFieldsManager';
import DailyReportTemplate from '../components/DailyReportTemplate';
import ReportingDashboard from '../components/ReportingDashboard';
import AutomatedReportScheduler from '../components/AutomatedReportScheduler';

// Mock the Supabase client
jest.mock('../main', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com'
          }
        }
      }),
      onAuthStateChange: jest.fn().mockImplementation((callback) => {
        callback('SIGNED_IN', {
          session: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com'
            }
          }
        });
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      })
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation(callback => callback({ data: [], error: null }))
    }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test.jpg' } })
      })
    }
  }
}));

// Mock the API functions
jest.mock('../api/supabaseApi', () => ({
  deliveryApi: {
    getCourierDeliveries: jest.fn().mockResolvedValue([]),
    getDispatcherDeliveries: jest.fn().mockResolvedValue([]),
    getDeliveryById: jest.fn().mockResolvedValue(null),
    createDelivery: jest.fn().mockResolvedValue({}),
    updateDelivery: jest.fn().mockResolvedValue({}),
    assignCourier: jest.fn().mockResolvedValue({}),
    getDeliveryPhotos: jest.fn().mockResolvedValue([]),
    getDeliveryStatusUpdates: jest.fn().mockResolvedValue([])
  },
  courierApi: {
    getAllCouriers: jest.fn().mockResolvedValue([]),
    getCourierById: jest.fn().mockResolvedValue(null),
    updateCourierProfile: jest.fn().mockResolvedValue({}),
    getCourierLocationHistory: jest.fn().mockResolvedValue([])
  },
  geofenceApi: {
    getAllGeofenceZones: jest.fn().mockResolvedValue([]),
    createGeofenceZone: jest.fn().mockResolvedValue({}),
    recordGeofenceEvent: jest.fn().mockResolvedValue({}),
    getGeofenceEventsForDelivery: jest.fn().mockResolvedValue([])
  },
  customFieldsApi: {
    getAllCustomFields: jest.fn().mockResolvedValue([]),
    getActiveCustomFields: jest.fn().mockResolvedValue([]),
    createCustomField: jest.fn().mockResolvedValue({}),
    updateCustomField: jest.fn().mockResolvedValue({}),
    getCustomFieldValuesForDelivery: jest.fn().mockResolvedValue([]),
    saveCustomFieldValues: jest.fn().mockResolvedValue([])
  },
  reportingApi: {
    getCourierReports: jest.fn().mockResolvedValue([]),
    getReportById: jest.fn().mockResolvedValue({}),
    generateDailyReport: jest.fn().mockResolvedValue({}),
    markReportAsSent: jest.fn().mockResolvedValue({})
  },
  notificationApi: {
    getUserNotifications: jest.fn().mockResolvedValue([]),
    markNotificationAsRead: jest.fn().mockResolvedValue({}),
    createNotification: jest.fn().mockResolvedValue({})
  }
}));

// Mock the services
jest.mock('../services/GeofenceService', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    currentPosition: null,
    error: null
  })
}));

jest.mock('../services/PhotoCaptureService', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    captureAndUploadPhoto: jest.fn().mockResolvedValue({}),
    uploading: false,
    error: null
  })
}));

jest.mock('../services/CustomFieldsService', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    customFields: [],
    fieldValues: {},
    loading: false,
    error: null,
    fetchFieldValues: jest.fn().mockResolvedValue({}),
    saveFieldValues: jest.fn().mockResolvedValue({}),
    createCustomField: jest.fn().mockResolvedValue({}),
    updateCustomField: jest.fn().mockResolvedValue({}),
    deleteCustomField: jest.fn().mockResolvedValue({})
  })
}));

jest.mock('../services/ReportingService', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    reports: [],
    loading: false,
    error: null,
    generateDailyReport: jest.fn().mockResolvedValue({}),
    fetchReportById: jest.fn().mockResolvedValue({}),
    sendReportToEmail: jest.fn().mockResolvedValue(true)
  })
}));

jest.mock('../services/DataSyncService', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    isOnline: true,
    isSyncing: false,
    syncQueue: [],
    lastSyncTime: null,
    error: null,
    addToSyncQueue: jest.fn(),
    processSyncQueue: jest.fn(),
    saveOfflineData: jest.fn(),
    loadOfflineData: jest.fn(),
    performOperation: jest.fn()
  })
}));

// Mock navigator.geolocation
Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    getCurrentPosition: jest.fn().mockImplementation(success => 
      success({ coords: { latitude: 40.7128, longitude: -74.0060 } })),
    watchPosition: jest.fn().mockImplementation(success => {
      success({ coords: { latitude: 40.7128, longitude: -74.0060 } });
      return 1;
    }),
    clearWatch: jest.fn()
  }
});

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
    })
  }
});

// Helper wrapper for components that need context
const renderWithProviders = (ui, { route = '/' } = {}) => {
  window.history.pushState({}, 'Test page', route);
  
  return render(
    <BrowserRouter>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Courier Service PWA Tests', () => {
  // CourierDashboard tests
  describe('CourierDashboard Component', () => {
    test('renders courier dashboard', async () => {
      renderWithProviders(<CourierDashboard />);
      
      expect(screen.getByText(/active deliveries/i)).toBeInTheDocument();
      expect(screen.getByText(/no active deliveries/i)).toBeInTheDocument();
    });
  });

  // DispatchDashboard tests
  describe('DispatchDashboard Component', () => {
    test('renders dispatch dashboard', async () => {
      renderWithProviders(<DispatchDashboard />);
      
      expect(screen.getByText(/deliveries/i)).toBeInTheDocument();
      expect(screen.getByText(/no deliveries found/i)).toBeInTheDocument();
    });
  });

  // CameraCapture tests
  describe('CameraCapture Component', () => {
    test('renders camera capture component', async () => {
      renderWithProviders(<CameraCapture onCapture={() => {}} />);
      
      expect(screen.getByText(/camera/i)).toBeInTheDocument();
    });
  });

  // CustomFieldsManager tests
  describe('CustomFieldsManager Component', () => {
    test('renders custom fields manager', async () => {
      renderWithProviders(<CustomFieldsManager />);
      
      expect(screen.getByText(/custom fields manager/i)).toBeInTheDocument();
      expect(screen.getByText(/create new field/i)).toBeInTheDocument();
    });
  });

  // DailyReportTemplate tests
  describe('DailyReportTemplate Component', () => {
    test('renders daily report template', async () => {
      renderWithProviders(<DailyReportTemplate />);
      
      expect(screen.getByText(/loading report/i)).toBeInTheDocument();
    });
  });

  // ReportingDashboard tests
  describe('ReportingDashboard Component', () => {
    test('renders reporting dashboard', async () => {
      renderWithProviders(<ReportingDashboard />);
      
      expect(screen.getByText(/delivery reports/i)).toBeInTheDocument();
      expect(screen.getByText(/generate new report/i)).toBeInTheDocument();
    });
  });

  // AutomatedReportScheduler tests
  describe('AutomatedReportScheduler Component', () => {
    test('renders automated report scheduler', async () => {
      renderWithProviders(<AutomatedReportScheduler />);
      
      expect(screen.getByText(/automated report delivery/i)).toBeInTheDocument();
      expect(screen.getByText(/create new schedule/i)).toBeInTheDocument();
    });
  });
});
