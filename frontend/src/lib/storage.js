/**
 * storage.js — IndexedDB-backed storage for Pixabel generation history.
 *
 * Base64 images are 1-2 MB each and localStorage only holds ~5 MB,
 * so we use IndexedDB which can store hundreds of megabytes.
 */

const DB_NAME = 'PixableDB';
const DB_VERSION = 1;
const STORE_NAME = 'generations';

let _db = null;
let _ready = null;

function openDB() {
  if (_ready) return _ready;

  _ready = new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not supported in this environment'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('favorite', 'favorite', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        _db = e.target.result;
        resolve(_db);
      };

      request.onerror = (e) => {
        console.warn('[Storage] IndexedDB open failed:', e.target.error);
        reject(e.target.error);
      };
    } catch (err) {
      console.warn('[Storage] IndexedDB not available:', err);
      reject(err);
    }
  });

  return _ready;
}

// Eagerly initialize
if (typeof window !== 'undefined') {
  openDB().catch(() => {});
}

async function getStore(mode = 'readonly') {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, mode);
  return tx.objectStore(STORE_NAME);
}

function req(idbRequest) {
  return new Promise((resolve, reject) => {
    idbRequest.onsuccess = () => resolve(idbRequest.result);
    idbRequest.onerror = () => reject(idbRequest.error);
  });
}

/**
 * Save a generation record.
 * @param {Object} record
 * @returns {Promise<Object|null>}
 */
export async function saveGeneration(record) {
  try {
    const entry = {
      id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
      image: record.image,
      prompt: record.prompt || '',
      negativePrompt: record.negativePrompt || '',
      model: record.model || '',
      style: record.style || 'none',
      width: record.width || 1024,
      height: record.height || 1024,
      type: record.type || 'generate',
      parentId: record.parentId || null,
      editPrompt: record.editPrompt || '',
      favorite: false,
      createdAt: Date.now(),
    };

    const store = await getStore('readwrite');
    await req(store.put(entry));
    return entry;
  } catch (err) {
    console.warn('[Storage] saveGeneration failed:', err);
    return null;
  }
}

/**
 * Get all generation records, newest first.
 * @returns {Promise<Array>}
 */
export async function getAllGenerations() {
  try {
    const store = await getStore('readonly');
    const all = await req(store.getAll());
    all.sort((a, b) => b.createdAt - a.createdAt);
    return all;
  } catch (err) {
    console.warn('[Storage] getAllGenerations failed:', err);
    return [];
  }
}

/**
 * Delete a single generation by id.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteGeneration(id) {
  try {
    const store = await getStore('readwrite');
    await req(store.delete(id));
    return true;
  } catch (err) {
    console.warn('[Storage] deleteGeneration failed:', err);
    return false;
  }
}

/**
 * Toggle the favorite flag on a record.
 * @param {string} id
 * @returns {Promise<boolean|null>}
 */
export async function toggleFavorite(id) {
  try {
    const store = await getStore('readwrite');
    const record = await req(store.get(id));
    if (!record) return null;

    record.favorite = !record.favorite;
    await req(store.put(record));
    return record.favorite;
  } catch (err) {
    console.warn('[Storage] toggleFavorite failed:', err);
    return null;
  }
}

/**
 * Clear all history. By default keeps favorites.
 * @param {boolean} includeFavorites — if true, deletes everything
 * @returns {Promise<boolean>}
 */
export async function clearAll(includeFavorites = false) {
  try {
    if (includeFavorites) {
      const store = await getStore('readwrite');
      await req(store.clear());
    } else {
      const all = await getAllGenerations();
      const store = await getStore('readwrite');
      for (const record of all) {
        if (!record.favorite) {
          store.delete(record.id);
        }
      }
      await new Promise((resolve, reject) => {
        store.transaction.oncomplete = resolve;
        store.transaction.onerror = reject;
      });
    }
    return true;
  } catch (err) {
    console.warn('[Storage] clearAll failed:', err);
    return false;
  }
}

/**
 * Get a single record by id.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getGeneration(id) {
  try {
    const store = await getStore('readonly');
    const record = await req(store.get(id));
    return record || null;
  } catch (err) {
    console.warn('[Storage] getGeneration failed:', err);
    return null;
  }
}

export const Storage = {
  saveGeneration,
  getAllGenerations,
  deleteGeneration,
  toggleFavorite,
  clearAll,
  getGeneration,
};
