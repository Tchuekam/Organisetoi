import { useState, useCallback, useEffect } from 'react';

export interface AppNotification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: { label: string; onClick: () => void };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = useCallback((params: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...params,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50)); // Keep last 50
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotification,
    unreadCount
  };
}
