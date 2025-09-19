// React hook for history management
import { useState, useEffect, useCallback, useRef } from 'react';
import { HistoryManager, HistoryInfo } from '../lib/historyManager';
import { Action, CanvasState } from '../types/actions';

export interface UseHistoryReturn {
  historyManager: HistoryManager;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  undo: () => boolean;
  redo: () => boolean;
  pushAction: (action: Action) => void;
  startBatch: (description: string) => string;
  endBatch: () => Action | null;
  clear: () => void;
  updateState: (state: CanvasState) => void;
  getCurrentState: () => CanvasState;
}

export function useHistory(initialState: CanvasState): UseHistoryReturn {
  const [historyInfo, setHistoryInfo] = useState<HistoryInfo>({
    undoCount: 0,
    redoCount: 0,
    canUndo: false,
    canRedo: false
  });

  const historyManagerRef = useRef<HistoryManager | null>(null);

  // Initialize history manager
  if (!historyManagerRef.current) {
    historyManagerRef.current = new HistoryManager(initialState);
  }

  const historyManager = historyManagerRef.current;

  // Set up listener for history changes
  useEffect(() => {
    const listener = (info: HistoryInfo) => {
      setHistoryInfo(info);
    };

    historyManager.addListener(listener);
    
    // Initialize with current state
    setHistoryInfo(historyManager.getHistoryInfo());

    return () => {
      historyManager.removeListener(listener);
    };
  }, [historyManager]);

  // Wrapper functions
  const undo = useCallback((): boolean => {
    const result = historyManager.undo();
    return result;
  }, [historyManager]);

  const redo = useCallback((): boolean => {
    const result = historyManager.redo();
    return result;
  }, [historyManager]);

  const pushAction = useCallback((action: Action): void => {
    historyManager.pushAction(action);
  }, [historyManager]);

  const startBatch = useCallback((description: string): string => {
    return historyManager.startBatch(description);
  }, [historyManager]);

  const endBatch = useCallback((): Action | null => {
    return historyManager.endBatch();
  }, [historyManager]);

  const clear = useCallback((): void => {
    historyManager.clear();
  }, [historyManager]);

  const updateState = useCallback((state: CanvasState): void => {
    historyManager.updateState(state);
  }, [historyManager]);

  const getCurrentState = useCallback((): CanvasState => {
    return historyManager.getCurrentState();
  }, [historyManager]);

  return {
    historyManager,
    canUndo: historyInfo.canUndo,
    canRedo: historyInfo.canRedo,
    undoCount: historyInfo.undoCount,
    redoCount: historyInfo.redoCount,
    undo,
    redo,
    pushAction,
    startBatch,
    endBatch,
    clear,
    updateState,
    getCurrentState
  };
}
