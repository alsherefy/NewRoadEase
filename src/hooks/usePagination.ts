import { useState, useCallback } from 'react';

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginationControls {
  state: PaginationState;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setTotalItems: (total: number) => void;
  getRange: () => { from: number; to: number };
  reset: () => void;
}

export const usePagination = (initialPageSize: number = 20): PaginationControls => {
  const [state, setState] = useState<PaginationState>({
    currentPage: 1,
    pageSize: initialPageSize,
    totalItems: 0,
    totalPages: 0,
  });

  const setTotalItems = useCallback((total: number) => {
    setState(prev => ({
      ...prev,
      totalItems: total,
      totalPages: Math.ceil(total / prev.pageSize),
    }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      currentPage: Math.max(1, Math.min(page, prev.totalPages)),
    }));
  }, []);

  const nextPage = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentPage: Math.min(prev.currentPage + 1, prev.totalPages),
    }));
  }, []);

  const prevPage = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentPage: Math.max(prev.currentPage - 1, 1),
    }));
  }, []);

  const getRange = useCallback(() => {
    const from = (state.currentPage - 1) * state.pageSize;
    const to = from + state.pageSize - 1;
    return { from, to };
  }, [state.currentPage, state.pageSize]);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentPage: 1,
      totalItems: 0,
      totalPages: 0,
    }));
  }, []);

  return {
    state,
    goToPage,
    nextPage,
    prevPage,
    setTotalItems,
    getRange,
    reset,
  };
};
