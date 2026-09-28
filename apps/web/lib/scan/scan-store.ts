"use client";

import type { AcceptedCapture, QualityResult, StepId } from "@pore/shared/scan";

const DB_NAME = "pore-scan";
const DB_VERSION = 2;
const STORE = "draft";
const KEY = "current";

export interface DraftShot {
  stepId: StepId;
  source: "camera" | "upload";
  originalBlob: Blob;
  originalMediaType: string;
  analysisBlob: Blob;
  mediaType: "image/jpeg";
  analysisWidth: number;
  analysisHeight: number;
  liveQuality: QualityResult;
  originalQuality: QualityResult;
  acceptance: AcceptedCapture;
  previewPerceptualHash: string;
}

export interface ScanDraft {
  sessionId: string;
  startedAt: number;
  shots: DraftShot[];
  savedAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        // Create-if-absent, never drop-and-recreate: a future DB_VERSION bump
        // would otherwise silently destroy every saved draft on upgrade.
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Drafts hold three full-resolution JPEGs, so a write can genuinely be aborted
 * under storage pressure. Every outcome — including abort and silence — has to
 * settle, or callers await forever behind a disabled button. */
const TRANSACTION_TIMEOUT_MS = 10_000;

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const database = await openDb();
  if (!database) return null;
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        database.close();
      } catch {
        // Already closing.
      }
      resolve(value);
    };
    // A transaction aborted without a bubbling request error (quota eviction,
    // browser-initiated abort) fires neither oncomplete nor onerror.
    const timer = setTimeout(() => settle(null), TRANSACTION_TIMEOUT_MS);
    try {
      const transaction = database.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => settle(request.result ?? null);
      transaction.onerror = () => settle(null);
      transaction.onabort = () => settle(null);
    } catch {
      settle(null);
    }
  });
}

export async function saveDraft(sessionId: string, startedAt: number, shots: DraftShot[]): Promise<boolean> {
  if (!sessionId || !Number.isFinite(startedAt) || shots.length === 0) return false;
  const result = await withStore("readwrite", (store) => store.put({ sessionId, startedAt, shots, savedAt: Date.now() } satisfies ScanDraft, KEY));
  return result !== null;
}

export async function loadDraft(): Promise<ScanDraft | null> {
  const value = await withStore("readonly", (store) => store.get(KEY));
  if (!value || typeof value !== "object") return null;
  const draft = value as ScanDraft;
  return draft.sessionId && Number.isFinite(draft.startedAt) && Array.isArray(draft.shots) && draft.shots.length > 0 ? draft : null;
}

export async function clearDraft(): Promise<void> {
  await withStore("readwrite", (store) => store.delete(KEY));
}
