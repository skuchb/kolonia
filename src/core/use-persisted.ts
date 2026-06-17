"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  defaultPersisted,
  loadPersisted,
  savePersisted,
  STORAGE_KEY,
} from "./storage";
import type { Persisted } from "./types";

const listeners = new Set<() => void>();
const serverSnapshot = defaultPersisted();
let clientSnapshot: Persisted | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function readPersistedFromStorage(): Persisted {
  return loadPersisted();
}

function getSnapshot(): Persisted {
  if (!clientSnapshot) {
    clientSnapshot = readPersistedFromStorage();
  }
  return clientSnapshot;
}

function setSnapshot(next: Persisted) {
  clientSnapshot = next;
  savePersisted(next);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) {
      clientSnapshot = null;
      listener();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePersisted(): [Persisted, (updater: Persisted | ((current: Persisted) => Persisted)) => void] {
  const persisted = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);

  const setPersisted = useCallback((updater: Persisted | ((current: Persisted) => Persisted)) => {
    const current = getSnapshot();
    const next = typeof updater === "function" ? updater(current) : updater;
    setSnapshot(next);
  }, []);

  return [persisted, setPersisted];
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
