import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import useDataSyncService from '../services/DataSyncService';

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
      onAuthStateChange: jest.fn()
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation(callback => callback({ data: [], error: null }))
    })
  }
}));

// Mock IndexedDB
const indexedDB = {
  open: jest.fn().mockReturnValue({
    result: {
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          add: jest.fn(),
          put: jest.fn(),
          get: jest.fn().mockReturnValue({
            onsuccess: null,
            result: { data: 'test-data' }
          }),
          getAll: jest.fn().mockReturnValue({
            onsuccess: null,
            result: [{ id: 1, data: 'test-data' }]
          }),
          clear: jest.fn()
        }),
        oncomplete: null,
        onerror: null
      }),
      objectStoreNames: {
        contains: jest.fn().mockReturnValue(true)
      },
      createObjectStore: jest.fn()
    },
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null
  })
};

Object.defineProperty(window, 'indexedDB', {
  value: indexedDB
});

// Mock navigator.onLine
Object.defineProperty(window.navigator, 'onLine', {
  writable: true,
  value: true
});

// Helper component to test DataSyncService
const TestComponent = () => {
  const {
    isOnline,
    isSyncing,
    syncQueue,
    error,
    addToSyncQueue,
    performOperation
  } = useDataSyncService();

  return (
    <div>
      <div data-testid="online-status">{isOnline ? 'Online' : 'Offline'}</div>
      <div data-testid="sync-status">{isSyncing ? 'Syncing' : 'Not Syncing'}</div>
      <div data-testid="queue-length">{syncQueue.length}</div>
      <div data-testid="error">{error || 'No Error'}</div>
      <button 
        data-testid="add-to-queue"
        onClick={() => addToSyncQueue({
          table: 'test-table',
          type: 'insert',
          data: { test: 'data' },
          timestamp: Date.now()
        })}
      >
        Add to Queue
      </button>
      <button 
        data-testid="perform-operation"
        onClick={() => performOperation('test-table', 'insert', { test: 'data' })}
      >
        Perform Operation
      </button>
    </div>
  );
};

describe('Offline Capabilities Tests', () => {
  // DataSyncService tests
  describe('DataSyncService', () => {
    test('renders with initial online state', async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );
      
      expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      expect(screen.getByTestId('sync-status')).toHaveTextContent('Not Syncing');
      expect(screen.getByTestId('queue-length')).toHaveTextContent('0');
      expect(screen.getByTestId('error')).toHaveTextContent('No Error');
    });

    test('handles offline state', async () => {
      // Set navigator.onLine to false
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );
      
      // Trigger offline event
      window.dispatchEvent(new Event('offline'));
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
    });

    test('handles online state transition', async () => {
      // Start offline
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );
      
      // Trigger offline event
      window.dispatchEvent(new Event('offline'));
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
      
      // Then go back online
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: true
      });
      
      // Trigger online event
      window.dispatchEvent(new Event('online'));
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      });
    });
  });
});
