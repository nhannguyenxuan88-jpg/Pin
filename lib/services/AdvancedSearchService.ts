/**
 * Advanced Search & Filter Service
 * Provides fuzzy search, saved filters, and advanced filtering capabilities
 */

export interface SearchHistory {
  id: string;
  query: string;
  timestamp: string;
  resultCount: number;
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  filters: any;
  createdAt: string;
  lastUsed?: string;
}

export interface AdvancedSearchService {
  // Fuzzy search
  fuzzySearch: <T>(items: T[], query: string, keys: (keyof T)[]) => T[];

  // Search history
  addToHistory: (query: string, resultCount: number) => void;
  getSearchHistory: () => SearchHistory[];
  clearHistory: () => void;

  // Saved filters
  saveFilter: (name: string, filters: any, description?: string) => void;
  getSavedFilters: () => SavedFilter[];
  loadFilter: (id: string) => SavedFilter | null;
  deleteFilter: (id: string) => void;

  // Advanced date filtering
  filterByDateRange: <T>(
    items: T[],
    dateKey: keyof T,
    from?: Date,
    to?: Date
  ) => T[];

  // Multi-field search
  multiFieldSearch: <T>(
    items: T[],
    queries: Partial<Record<keyof T, string>>
  ) => T[];
}

export function createAdvancedSearchService(): AdvancedSearchService {
  const HISTORY_KEY = "pincorp-search-history";
  const FILTERS_KEY = "pincorp-saved-filters";
  const MAX_HISTORY = 20;

  // Levenshtein distance for fuzzy matching
  const levenshteinDistance = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[len1][len2];
  };

  const normalizeVietnamese = (str: string): string => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  const fuzzyScore = (str1: string, str2: string): number => {
    const norm1 = normalizeVietnamese(str1);
    const norm2 = normalizeVietnamese(str2);

    // Exact match
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return 100;
    }

    // Levenshtein similarity
    const distance = levenshteinDistance(norm1, norm2);
    const maxLen = Math.max(norm1.length, norm2.length);
    const similarity = 1 - distance / maxLen;

    return similarity * 100;
  };

  return {
    fuzzySearch: <T>(items: T[], query: string, keys: (keyof T)[]): T[] => {
      if (!query.trim()) return items;

      const normalizedQuery = normalizeVietnamese(query.trim());
      const threshold = 30; // Minimum score to be considered a match

      const scored = items.map((item) => {
        let maxScore = 0;

        keys.forEach((key) => {
          const value = item[key];
          if (typeof value === "string") {
            const score = fuzzyScore(value, normalizedQuery);
            maxScore = Math.max(maxScore, score);
          } else if (typeof value === "number") {
            const strValue = String(value);
            if (strValue.includes(query)) {
              maxScore = 100;
            }
          }
        });

        return { item, score: maxScore };
      });

      return scored
        .filter((s) => s.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .map((s) => s.item);
    },

    addToHistory: (query: string, resultCount: number) => {
      try {
        const history = JSON.parse(
          localStorage.getItem(HISTORY_KEY) || "[]"
        ) as SearchHistory[];

        // Don't add duplicates
        const existing = history.findIndex((h) => h.query === query);
        if (existing > -1) {
          history.splice(existing, 1);
        }

        history.unshift({
          id: `search-${Date.now()}`,
          query,
          timestamp: new Date().toISOString(),
          resultCount,
        });

        // Keep only latest MAX_HISTORY items
        if (history.length > MAX_HISTORY) {
          history.splice(MAX_HISTORY);
        }

        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      } catch (error) {
        console.error("Failed to save search history:", error);
      }
    },

    getSearchHistory: () => {
      try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      } catch {
        return [];
      }
    },

    clearHistory: () => {
      localStorage.removeItem(HISTORY_KEY);
    },

    saveFilter: (name: string, filters: any, description?: string) => {
      try {
        const saved = JSON.parse(
          localStorage.getItem(FILTERS_KEY) || "[]"
        ) as SavedFilter[];

        saved.push({
          id: `filter-${Date.now()}`,
          name,
          description,
          filters,
          createdAt: new Date().toISOString(),
        });

        localStorage.setItem(FILTERS_KEY, JSON.stringify(saved));
      } catch (error) {
        console.error("Failed to save filter:", error);
      }
    },

    getSavedFilters: () => {
      try {
        return JSON.parse(localStorage.getItem(FILTERS_KEY) || "[]");
      } catch {
        return [];
      }
    },

    loadFilter: (id: string) => {
      try {
        const filters = JSON.parse(
          localStorage.getItem(FILTERS_KEY) || "[]"
        ) as SavedFilter[];
        const filter = filters.find((f) => f.id === id);

        if (filter) {
          filter.lastUsed = new Date().toISOString();
          localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
          return filter;
        }

        return null;
      } catch {
        return null;
      }
    },

    deleteFilter: (id: string) => {
      try {
        const filters = JSON.parse(
          localStorage.getItem(FILTERS_KEY) || "[]"
        ) as SavedFilter[];
        const updated = filters.filter((f) => f.id !== id);
        localStorage.setItem(FILTERS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to delete filter:", error);
      }
    },

    filterByDateRange: <T>(
      items: T[],
      dateKey: keyof T,
      from?: Date,
      to?: Date
    ): T[] => {
      return items.filter((item) => {
        const dateValue = item[dateKey];
        if (!dateValue) return false;

        const itemDate = new Date(dateValue as any);

        if (from && itemDate < from) return false;
        if (to && itemDate > to) return false;

        return true;
      });
    },

    multiFieldSearch: <T>(
      items: T[],
      queries: Partial<Record<keyof T, string>>
    ): T[] => {
      return items.filter((item) => {
        return Object.entries(queries).every(([key, value]) => {
          if (!value) return true;

          const itemValue = item[key as keyof T];
          if (typeof itemValue === "string") {
            return normalizeVietnamese(itemValue).includes(
              normalizeVietnamese(value as string)
            );
          } else if (typeof itemValue === "number") {
            return String(itemValue).includes(value as string);
          }

          return false;
        });
      });
    },
  };
}
