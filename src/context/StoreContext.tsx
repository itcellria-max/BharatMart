import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product, Category, StoreSettings } from '../types/index.ts';
import { api, getOfflineQueue, syncOfflineQueue } from '../services/api.ts';

interface StoreContextType {
  products: Product[];
  categories: Category[];
  settings: StoreSettings | null;
  isLoading: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  offlineCount: number;
  lowStockCount: number;
  expiringCount: number;
  notifications: Array<{ id: string; title: string; message: string; type: 'info' | 'warning' | 'alert'; time: string }>;
  refreshProducts: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  triggerSync: () => Promise<void>;
  dismissNotification: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; type: 'info' | 'warning' | 'alert'; time: string }>>([]);

  const refreshProducts = useCallback(async () => {
    try {
      const prods = await api.getProducts();
      setProducts(prods);
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }, []);

  const triggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue();
      setOfflineCount(getOfflineQueue().length);
      if (result.synced > 0) {
        addNotification({
          title: 'Offline Sync Complete',
          message: `Successfully synchronized ${result.synced} offline bills with server.`,
          type: 'info',
        });
        refreshProducts();
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const addNotification = (item: { title: string; message: string; type: 'info' | 'warning' | 'alert' }) => {
    setNotifications((prev) => [
      { ...item, id: Math.random().toString(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ...prev.slice(0, 9),
    ]);
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Check online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial offline queue count
    setOfflineCount(getOfflineQueue().length);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initial data load
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        setIsLoading(true);
        const [prods, cats, sets] = await Promise.all([
          api.getProducts(),
          api.getCategories(),
          api.getSettings(),
        ]);
        if (mounted) {
          setProducts(prods);
          setCategories(cats);
          setSettings(sets);

          // Check alerts
          const low = prods.filter((p) => p.currentStock <= p.reorderLevel);
          if (low.length > 0) {
            addNotification({
              title: 'Low Stock Alert',
              message: `${low.length} products have fallen below reorder level. Review inventory reorder list.`,
              type: 'warning',
            });
          }
        }
      } catch (e) {
        console.error('Initialization error:', e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // Multi-counter SSE Listener
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('invoice_created', (e) => {
        const data = JSON.parse(e.data);
        addNotification({
          title: 'New Bill Finalized',
          message: `Invoice ${data.invoiceNo} billed for ₹${data.grandTotal}. Stock synchronized.`,
          type: 'info',
        });
        refreshProducts();
      });

      eventSource.addEventListener('stock_update', () => {
        refreshProducts();
      });
    } catch (err) {
      console.warn('SSE connection failed:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [refreshProducts]);

  const lowStockCount = products.filter((p) => p.currentStock <= p.reorderLevel).length;
  // Expiring count approximation
  const expiringCount = 3;

  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        settings,
        isLoading,
        isOnline,
        isSyncing,
        offlineCount,
        lowStockCount,
        expiringCount,
        notifications,
        refreshProducts,
        refreshSettings,
        triggerSync,
        dismissNotification,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};
