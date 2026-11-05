import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types/index.ts';

interface AuthContextType {
  currentUser: User | null;
  role: UserRole;
  isLoggedIn: boolean;
  login: (username: string, role?: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  hasPermission: (permission: string) => boolean;
}

const DEFAULT_USERS: Record<UserRole, User> = {
  SUPER_ADMIN: {
    id: 'usr-1',
    username: 'admin',
    name: 'Ramesh Sharma',
    email: 'admin@bharatmart.in',
    role: 'SUPER_ADMIN',
    active: true,
  },
  STORE_MANAGER: {
    id: 'usr-2',
    username: 'manager',
    name: 'Vikram Patel',
    email: 'manager@bharatmart.in',
    role: 'STORE_MANAGER',
    active: true,
  },
  CASHIER: {
    id: 'usr-3',
    username: 'cashier1',
    name: 'Priya Verma',
    email: 'priya@bharatmart.in',
    role: 'CASHIER',
    active: true,
    assignedCounterId: 'cnt-1',
  },
  INVENTORY_MANAGER: {
    id: 'usr-5',
    username: 'inventory',
    name: 'Sanjay Gupta',
    email: 'sanjay@bharatmart.in',
    role: 'INVENTORY_MANAGER',
    active: true,
  },
  ACCOUNTANT: {
    id: 'usr-6',
    username: 'accountant',
    name: 'Anjali Nair',
    email: 'anjali@bharatmart.in',
    role: 'ACCOUNTANT',
    active: true,
  },
  HR_MANAGER: {
    id: 'usr-7',
    username: 'hr',
    name: 'Sneha Kulkarni',
    email: 'sneha@bharatmart.in',
    role: 'HR_MANAGER',
    active: true,
  },
  AUDITOR: {
    id: 'usr-8',
    username: 'auditor',
    name: 'Kailash Mehra',
    email: 'kailash@bharatmart.in',
    role: 'AUDITOR',
    active: true,
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('bharatmart_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_USERS.SUPER_ADMIN;
      }
    }
    return DEFAULT_USERS.SUPER_ADMIN;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('bharatmart_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('bharatmart_current_user');
    }
  }, [currentUser]);

  const role = currentUser?.role || 'CASHIER';

  const login = (username: string, preferredRole?: UserRole) => {
    const foundRole = preferredRole || 'SUPER_ADMIN';
    const user = DEFAULT_USERS[foundRole] || DEFAULT_USERS.CASHIER;
    setCurrentUser(user);
  };

  const switchRole = (newRole: UserRole) => {
    const user = DEFAULT_USERS[newRole];
    if (user) {
      setCurrentUser(user);
    }
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const hasPermission = (permission: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;

    switch (permission) {
      case 'VIEW_DASHBOARD':
        return true;
      case 'POS_BILLING':
        return ['SUPER_ADMIN', 'STORE_MANAGER', 'CASHIER'].includes(currentUser.role);
      case 'MANAGE_PRODUCTS':
      case 'INVENTORY_CONTROL':
        return ['SUPER_ADMIN', 'STORE_MANAGER', 'INVENTORY_MANAGER'].includes(currentUser.role);
      case 'MANAGE_GST':
      case 'FINANCIAL_REPORTS':
        return ['SUPER_ADMIN', 'STORE_MANAGER', 'ACCOUNTANT'].includes(currentUser.role);
      case 'STAFF_MANAGEMENT':
        return ['SUPER_ADMIN', 'STORE_MANAGER', 'HR_MANAGER'].includes(currentUser.role);
      case 'VIEW_AUDIT_LOGS':
        return ['SUPER_ADMIN', 'STORE_MANAGER', 'AUDITOR'].includes(currentUser.role);
      case 'MODIFY_PURCHASE_COST':
      case 'MANAGE_USERS':
      case 'SYSTEM_SETTINGS':
        return ['SUPER_ADMIN'].includes(currentUser.role);
      case 'PROCESS_RETURNS':
        return ['SUPER_ADMIN', 'STORE_MANAGER'].includes(currentUser.role);
      default:
        return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        isLoggedIn: !!currentUser,
        login,
        logout,
        switchRole,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
