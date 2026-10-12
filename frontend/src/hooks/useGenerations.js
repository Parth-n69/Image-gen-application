import { useState, useEffect, useCallback } from 'react';
import { Storage } from '../lib/storage';

export function useGenerations() {
  const [generations, setGenerations] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshGenerations = useCallback(async () => {
    try {
      setLoading(true);
      const records = await Storage.getAllGenerations();
      setGenerations(records);
    } catch (err) {
      console.warn('[useGenerations] Failed to load history:', err);
      setGenerations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshGenerations();
  }, [refreshGenerations]);

  const addGeneration = useCallback(async (record) => {
    const saved = await Storage.saveGeneration(record);
    if (saved) {
      setGenerations((prev) => [saved, ...prev]);
    }
    return saved;
  }, []);

  const removeGeneration = useCallback(async (id) => {
    const success = await Storage.deleteGeneration(id);
    if (success) {
      setGenerations((prev) => prev.filter((item) => item.id !== id));
    }
    return success;
  }, []);

  const toggleFav = useCallback(async (id) => {
    const newState = await Storage.toggleFavorite(id);
    if (newState !== null) {
      setGenerations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, favorite: newState } : item))
      );
    }
    return newState;
  }, []);

  const clearGenerations = useCallback(async (includeFavorites = false) => {
    const success = await Storage.clearAll(includeFavorites);
    if (success) {
      if (includeFavorites) {
        setGenerations([]);
      } else {
        setGenerations((prev) => prev.filter((item) => item.favorite));
      }
    }
    return success;
  }, []);

  return {
    generations,
    loading,
    refreshGenerations,
    addGeneration,
    removeGeneration,
    toggleFav,
    clearGenerations,
    totalCount: generations.length,
    favCount: generations.filter((g) => g.favorite).length,
  };
}
