import { useEffect, useState } from 'react';
import { supabase } from '../main';

// Data synchronization service for offline support
export default function useDataSyncService() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load sync queue from IndexedDB when component mounts
  useEffect(() => {
    loadSyncQueue();
  }, []);

  // Process sync queue when online
  useEffect(() => {
    if (isOnline && syncQueue.length > 0 && !isSyncing) {
      processSyncQueue();
    }
  }, [isOnline, syncQueue, isSyncing]);

  // Load sync queue from IndexedDB
  const loadSyncQueue = async () => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const request = store.getAll();

      request.onsuccess = () => {
        setSyncQueue(request.result || []);
      };

      request.onerror = () => {
        console.error('Error loading sync queue:', request.error);
        setError('Failed to load sync queue from local storage');
      };
    } catch (error) {
      console.error('Error opening database:', error);
      setError('Failed to open local database');
    }
  };

  // Save sync queue to IndexedDB
  const saveSyncQueue = async (queue: any[]) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      // Clear existing queue
      store.clear();
      
      // Add all items
      queue.forEach(item => {
        store.add(item);
      });
      
      transaction.oncomplete = () => {
        setSyncQueue(queue);
      };
      
      transaction.onerror = () => {
        console.error('Error saving sync queue:', transaction.error);
        setError('Failed to save sync queue to local storage');
      };
    } catch (error) {
      console.error('Error opening database:', error);
      setError('Failed to open local database');
    }
  };

  // Open IndexedDB database
  const openDatabase = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('courierPwaOfflineDB', 1);
      
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('offlineData')) {
          db.createObjectStore('offlineData', { keyPath: 'key' });
        }
      };
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  // Add an operation to the sync queue
  const addToSyncQueue = async (operation: {
    table: string;
    type: 'insert' | 'update' | 'delete';
    data: any;
    id?: string;
    timestamp: number;
  }) => {
    const newQueue = [...syncQueue, operation];
    await saveSyncQueue(newQueue);
    
    // Try to process immediately if online
    if (isOnline && !isSyncing) {
      processSyncQueue();
    }
  };

  // Process the sync queue
  const processSyncQueue = async () => {
    if (syncQueue.length === 0 || isSyncing) return;
    
    setIsSyncing(true);
    setError(null);
    
    const queue = [...syncQueue];
    const successfulOperations: number[] = [];
    
    for (let i = 0; i < queue.length; i++) {
      const operation = queue[i];
      
      try {
        switch (operation.type) {
          case 'insert':
            await supabase.from(operation.table).insert(operation.data);
            successfulOperations.push(i);
            break;
            
          case 'update':
            if (!operation.id) throw new Error('ID is required for update operations');
            await supabase.from(operation.table).update(operation.data).eq('id', operation.id);
            successfulOperations.push(i);
            break;
            
          case 'delete':
            if (!operation.id) throw new Error('ID is required for delete operations');
            await supabase.from(operation.table).delete().eq('id', operation.id);
            successfulOperations.push(i);
            break;
            
          default:
            console.error('Unknown operation type:', operation.type);
        }
      } catch (error) {
        console.error(`Error processing operation ${i}:`, error);
        // Continue with next operation
      }
    }
    
    // Remove successful operations from queue
    const newQueue = queue.filter((_, index) => !successfulOperations.includes(index));
    await saveSyncQueue(newQueue);
    
    setLastSyncTime(new Date());
    setIsSyncing(false);
  };

  // Save data for offline use
  const saveOfflineData = async (key: string, data: any) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      
      store.put({
        key,
        data,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error saving offline data:', error);
      setError('Failed to save data for offline use');
    }
  };

  // Load data for offline use
  const loadOfflineData = async (key: string): Promise<any> => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(['offlineData'], 'readonly');
      const store = transaction.objectStore('offlineData');
      
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        
        request.onsuccess = () => {
          resolve(request.result?.data || null);
        };
        
        request.onerror = () => {
          console.error('Error loading offline data:', request.error);
          reject('Failed to load offline data');
        };
      });
    } catch (error) {
      console.error('Error opening database:', error);
      setError('Failed to open local database');
      return null;
    }
  };

  // Perform a database operation with offline support
  const performOperation = async (
    table: string,
    type: 'insert' | 'update' | 'delete',
    data: any,
    id?: string
  ) => {
    // If online, try to perform the operation directly
    if (isOnline) {
      try {
        let result;
        
        switch (type) {
          case 'insert':
            result = await supabase.from(table).insert(data).select().single();
            return result.data;
            
          case 'update':
            if (!id) throw new Error('ID is required for update operations');
            result = await supabase.from(table).update(data).eq('id', id).select().single();
            return result.data;
            
          case 'delete':
            if (!id) throw new Error('ID is required for delete operations');
            await supabase.from(table).delete().eq('id', id);
            return { success: true };
        }
      } catch (error) {
        console.error('Error performing operation:', error);
        
        // If operation fails, add to sync queue
        await addToSyncQueue({
          table,
          type,
          data,
          id,
          timestamp: Date.now()
        });
        
        throw error;
      }
    } else {
      // If offline, add to sync queue
      await addToSyncQueue({
        table,
        type,
        data,
        id,
        timestamp: Date.now()
      });
      
      // For insert operations, generate a temporary ID
      if (type === 'insert') {
        return {
          ...data,
          id: `temp_${Date.now()}`,
          _isOffline: true
        };
      }
      
      return { success: true, _isOffline: true };
    }
  };

  return {
    isOnline,
    isSyncing,
    syncQueue,
    lastSyncTime,
    error,
    addToSyncQueue,
    processSyncQueue,
    saveOfflineData,
    loadOfflineData,
    performOperation
  };
}
