/**
 * storage.js — IndexedDB-backed storage for Pixabel generation history.
 *
 * Base64 images are 1-2 MB each and localStorage only holds ~5 MB,
 * so we use IndexedDB which can store hundreds of megabytes.
 *
 * Every public function wraps IndexedDB calls in try/catch so the app
 * keeps working (just without history) if storage fails.
 */
const Storage = (() => {
  "use strict";

  const DB_NAME = "PixableDB";
  const DB_VERSION = 1;
  const STORE_NAME = "generations";

  let _db = null;
  let _ready = null; // Promise that resolves when DB is open

  // ── Open / initialise the database ───────────────────────
  function _openDB() {
    if (_ready) return _ready;

    _ready = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("createdAt", "createdAt", { unique: false });
            store.createIndex("favorite", "favorite", { unique: false });
          }
        };

        request.onsuccess = (e) => {
          _db = e.target.result;
          resolve(_db);
        };

        request.onerror = (e) => {
          console.warn("[Storage] IndexedDB open failed:", e.target.error);
          reject(e.target.error);
        };
      } catch (err) {
        console.warn("[Storage] IndexedDB not available:", err);
        reject(err);
      }
    });

    return _ready;
  }

  // Eagerly open the DB on load
  _openDB().catch(() => {});

  // ── Helper: get object store in a transaction ────────────
  async function _getStore(mode = "readonly") {
    const db = await _openDB();
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  // ── Helper: promisify an IDB request ─────────────────────
  function _req(idbRequest) {
    return new Promise((resolve, reject) => {
      idbRequest.onsuccess = () => resolve(idbRequest.result);
      idbRequest.onerror = () => reject(idbRequest.error);
    });
  }

  // ── PUBLIC API ───────────────────────────────────────────

  /**
   * Save a generation record.
   * @param {Object} record
   * @param {string} record.image      — base64 data URI
   * @param {string} record.prompt
   * @param {string} record.negativePrompt
   * @param {string} record.model
   * @param {string} record.style
   * @param {number} record.width
   * @param {number} record.height
   * @returns {Object|null} the saved record, or null on failure
   */
  async function saveGeneration(record) {
    try {
      const entry = {
        id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
        image: record.image,
        prompt: record.prompt || "",
        negativePrompt: record.negativePrompt || "",
        model: record.model || "",
        style: record.style || "none",
        width: record.width || 1024,
        height: record.height || 1024,
        type: record.type || "generate",
        parentId: record.parentId || null,
        favorite: false,
        createdAt: Date.now(),
      };

      const store = await _getStore("readwrite");
      await _req(store.put(entry));
      return entry;
    } catch (err) {
      console.warn("[Storage] saveGeneration failed:", err);
      _showStorageWarning();
      return null;
    }
  }

  /**
   * Get all generation records, newest first.
   * @returns {Array} array of records (empty on failure)
   */
  async function getAllGenerations() {
    try {
      const store = await _getStore("readonly");
      const all = await _req(store.getAll());
      // Sort newest first
      all.sort((a, b) => b.createdAt - a.createdAt);
      return all;
    } catch (err) {
      console.warn("[Storage] getAllGenerations failed:", err);
      return [];
    }
  }

  /**
   * Delete a single generation by id.
   * @param {string} id
   * @returns {boolean} true on success
   */
  async function deleteGeneration(id) {
    try {
      const store = await _getStore("readwrite");
      await _req(store.delete(id));
      return true;
    } catch (err) {
      console.warn("[Storage] deleteGeneration failed:", err);
      return false;
    }
  }

  /**
   * Toggle the favorite flag on a record.
   * @param {string} id
   * @returns {boolean|null} new favorite state, or null on failure
   */
  async function toggleFavorite(id) {
    try {
      const store = await _getStore("readwrite");
      const record = await _req(store.get(id));
      if (!record) return null;

      record.favorite = !record.favorite;
      await _req(store.put(record));
      return record.favorite;
    } catch (err) {
      console.warn("[Storage] toggleFavorite failed:", err);
      return null;
    }
  }

  /**
   * Clear all history. By default keeps favorites.
   * @param {boolean} inclueFavorites — if true, deletes everything
   * @returns {boolean} true on success
   */
  async function clearAll(includeFavorites = false) {
    try {
      if (includeFavorites) {
        const store = await _getStore("readwrite");
        await _req(store.clear());
      } else {
        const all = await getAllGenerations();
        const store = await _getStore("readwrite");
        for (const record of all) {
          if (!record.favorite) {
            store.delete(record.id);
          }
        }
        // Wait for the transaction to complete
        await new Promise((resolve, reject) => {
          store.transaction.oncomplete = resolve;
          store.transaction.onerror = reject;
        });
      }
      return true;
    } catch (err) {
      console.warn("[Storage] clearAll failed:", err);
      return false;
    }
  }

  /**
   * Get a single record by id.
   * @param {string} id
   * @returns {Object|null}
   */
  async function getGeneration(id) {
    try {
      const store = await _getStore("readonly");
      const record = await _req(store.get(id));
      return record || null;
    } catch (err) {
      console.warn("[Storage] getGeneration failed:", err);
      return null;
    }
  }

  // ── Storage warning toast ────────────────────────────────
  let _warningShown = false;
  function _showStorageWarning() {
    if (_warningShown) return;
    _warningShown = true;

    const toast = document.createElement("div");
    toast.className = "storage-warning-toast";
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>Storage unavailable — history won't be saved this session.</span>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }, 5000);
  }

  // ── Public interface ─────────────────────────────────────
  return {
    saveGeneration,
    getAllGenerations,
    deleteGeneration,
    toggleFavorite,
    clearAll,
    getGeneration,
  };
})();
