"use client";

import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item) as T);
      }
    } catch {
      console.error(`Error reading localStorage key "${key}"`);
    }
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (mounted) {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch {
        console.error(`Error setting localStorage key "${key}"`);
      }
    },
    [key, storedValue, mounted]
  );

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (mounted) {
        window.localStorage.removeItem(key);
      }
    } catch {
      console.error(`Error removing localStorage key "${key}"`);
    }
  }, [key, initialValue, mounted]);

  return [storedValue, setValue, removeValue];
}
