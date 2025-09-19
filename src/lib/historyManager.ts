// History Manager for robust undo/redo functionality
import { Action, CanvasState, TransformState } from '../types/actions';

export interface HistoryInfo {
  undoCount: number;
  redoCount: number;
  canUndo: boolean;
  canRedo: boolean;
  currentBatchId?: string;
}

export class HistoryManager {
  private undoStack: Action[] = [];
  private redoStack: Action[] = [];
  private maxStackSize: number = 50;
  private currentState: CanvasState;
  private currentBatchId: string | null = null;
  private batchActions: Action[] = [];
  private listeners: Set<(info: HistoryInfo) => void> = new Set();

  constructor(initialState: CanvasState) {
    this.currentState = this.deepCloneState(initialState);
  }

  // Core undo/redo methods
  pushAction(action: Action): void {
    // If we're in a batch, add to batch instead of stack
    if (this.currentBatchId) {
      this.batchActions.push(action);
      this.notifyListeners();
      return;
    }

    // Clear redo stack when new action is pushed
    this.redoStack = [];
    
    // Add to undo stack
    this.undoStack.push(action);
    
    // Maintain stack size limit
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }

    this.notifyListeners();
  }

  undo(): boolean {
    if (this.undoStack.length === 0) {
      return false;
    }

    const action = this.undoStack.pop()!;
    this.redoStack.push(action);
    
    // Execute undo logic
    this.executeUndoAction(action);
    
    this.notifyListeners();
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) {
      return false;
    }

    const action = this.redoStack.pop()!;
    this.undoStack.push(action);
    
    // Execute redo logic
    this.executeRedoAction(action);
    
    this.notifyListeners();
    return true;
  }

  // Batch operations
  startBatch(description: string): string {
    this.currentBatchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    this.batchActions = [];
    this.notifyListeners();
    return this.currentBatchId;
  }

  endBatch(): Action | null {
    if (!this.currentBatchId || this.batchActions.length === 0) {
      this.currentBatchId = null;
      this.batchActions = [];
      this.notifyListeners();
      return null;
    }

    const batchAction: Action = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      type: 'BATCH',
      timestamp: Date.now(),
      description: `Batch operation (${this.batchActions.length} actions)`,
      batchId: this.currentBatchId,
      actions: [...this.batchActions]
    };

    this.currentBatchId = null;
    this.batchActions = [];
    
    this.pushAction(batchAction);
    return batchAction;
  }

  // State management
  updateState(newState: CanvasState): void {
    this.currentState = this.deepCloneState(newState);
  }

  getCurrentState(): CanvasState {
    return this.deepCloneState(this.currentState);
  }

  // Query methods
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getHistoryInfo(): HistoryInfo {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      currentBatchId: this.currentBatchId || undefined
    };
  }

  // Memory management
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.currentBatchId = null;
    this.batchActions = [];
    this.notifyListeners();
  }

  setMaxStackSize(size: number): void {
    this.maxStackSize = Math.max(1, size);
    
    // Trim stacks if needed
    while (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    while (this.redoStack.length > this.maxStackSize) {
      this.redoStack.shift();
    }
  }

  // Event listeners
  addListener(listener: (info: HistoryInfo) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (info: HistoryInfo) => void): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const info = this.getHistoryInfo();
    this.listeners.forEach(listener => listener(info));
  }

  // Action execution
  private executeUndoAction(action: Action): void {
    switch (action.type) {
      case 'ADD_IMAGE':
        this.removeImageFromState(action.item.id);
        break;
      case 'ADD_VIDEO':
        this.removeVideoFromState(action.item.id);
        break;
      case 'ADD_TEXT':
        this.removeTextFromState(action.item.id);
        break;
      case 'ADD_STROKE':
        this.removeStrokeFromState(action.item.id);
        break;
      case 'DELETE_IMAGE':
        this.addImageToState(action.item);
        break;
      case 'DELETE_VIDEO':
        this.addVideoToState(action.item);
        break;
      case 'DELETE_TEXT':
        this.addTextToState(action.item);
        break;
      case 'DELETE_STROKE':
        this.addStrokeToState(action.item);
        break;
      case 'TRANSFORM_IMAGE':
        this.updateImageTransform(action.itemId, action.oldTransform);
        break;
      case 'TRANSFORM_VIDEO':
        this.updateVideoTransform(action.itemId, action.oldTransform);
        break;
      case 'TRANSFORM_TEXT':
        this.updateTextTransform(action.itemId, action.oldTransform);
        break;
      case 'TRANSFORM_STROKE':
        this.updateStrokeTransform(action.itemId, action.oldTransform);
        break;
      case 'EDIT_TEXT':
        this.updateTextContent(action.itemId, action.oldText);
        break;
      case 'SELECT_ITEMS':
        this.updateSelection(action.oldSelection);
        break;
      case 'BATCH':
        // Execute batch actions in reverse order
        for (let i = action.actions.length - 1; i >= 0; i--) {
          this.executeUndoAction(action.actions[i]);
        }
        break;
    }
  }

  private executeRedoAction(action: Action): void {
    switch (action.type) {
      case 'ADD_IMAGE':
        this.addImageToState(action.item);
        break;
      case 'ADD_VIDEO':
        this.addVideoToState(action.item);
        break;
      case 'ADD_TEXT':
        this.addTextToState(action.item);
        break;
      case 'ADD_STROKE':
        this.addStrokeToState(action.item);
        break;
      case 'DELETE_IMAGE':
        this.removeImageFromState(action.itemId);
        break;
      case 'DELETE_VIDEO':
        this.removeVideoFromState(action.itemId);
        break;
      case 'DELETE_TEXT':
        this.removeTextFromState(action.itemId);
        break;
      case 'DELETE_STROKE':
        this.removeStrokeFromState(action.itemId);
        break;
      case 'TRANSFORM_IMAGE':
        this.updateImageTransform(action.itemId, action.newTransform);
        break;
      case 'TRANSFORM_VIDEO':
        this.updateVideoTransform(action.itemId, action.newTransform);
        break;
      case 'TRANSFORM_TEXT':
        this.updateTextTransform(action.itemId, action.newTransform);
        break;
      case 'TRANSFORM_STROKE':
        this.updateStrokeTransform(action.itemId, action.newTransform);
        break;
      case 'EDIT_TEXT':
        this.updateTextContent(action.itemId, action.newText);
        break;
      case 'SELECT_ITEMS':
        this.updateSelection(action.newSelection);
        break;
      case 'BATCH':
        // Execute batch actions in order
        action.actions.forEach(subAction => {
          this.executeRedoAction(subAction);
        });
        break;
    }
  }

  // State manipulation methods
  private addImageToState(item: any): void {
    this.currentState.images = [...this.currentState.images, item];
  }

  private removeImageFromState(itemId: string): void {
    this.currentState.images = this.currentState.images.filter(img => img.id !== itemId);
  }

  private addVideoToState(item: any): void {
    this.currentState.videos = [...this.currentState.videos, item];
  }

  private removeVideoFromState(itemId: string): void {
    this.currentState.videos = this.currentState.videos.filter(vid => vid.id !== itemId);
  }

  private addTextToState(item: any): void {
    this.currentState.texts = [...this.currentState.texts, item];
  }

  private removeTextFromState(itemId: string): void {
    this.currentState.texts = this.currentState.texts.filter(text => text.id !== itemId);
  }

  private addStrokeToState(item: any): void {
    this.currentState.strokes = [...this.currentState.strokes, item];
  }

  private removeStrokeFromState(itemId: string): void {
    this.currentState.strokes = this.currentState.strokes.filter(stroke => stroke.id !== itemId);
  }

  private updateImageTransform(itemId: string, transform: TransformState): void {
    this.currentState.images = this.currentState.images.map(img => 
      img.id === itemId 
        ? { ...img, x: transform.x, y: transform.y, width: transform.width, height: transform.height, rotation: transform.rotation }
        : img
    );
  }

  private updateVideoTransform(itemId: string, transform: TransformState): void {
    this.currentState.videos = this.currentState.videos.map(vid => 
      vid.id === itemId 
        ? { ...vid, x: transform.x, y: transform.y, width: transform.width, height: transform.height, rotation: transform.rotation }
        : vid
    );
  }

  private updateTextTransform(itemId: string, transform: TransformState): void {
    this.currentState.texts = this.currentState.texts.map(text => 
      text.id === itemId 
        ? { ...text, x: transform.x, y: transform.y, rotation: transform.rotation }
        : text
    );
  }

  private updateStrokeTransform(itemId: string, transform: TransformState): void {
    this.currentState.strokes = this.currentState.strokes.map(stroke => 
      stroke.id === itemId 
        ? { ...stroke, x: transform.x, y: transform.y, width: transform.width, height: transform.height, rotation: transform.rotation }
        : stroke
    );
  }

  private updateTextContent(itemId: string, text: string): void {
    this.currentState.texts = this.currentState.texts.map(t => 
      t.id === itemId ? { ...t, text } : t
    );
  }

  private updateSelection(selection: Array<{ id: string; type: 'frame' | 'image' | 'stroke' | 'text' | 'video' }>): void {
    this.currentState.selectedIds = [...selection];
  }

  // Utility methods
  private deepCloneState(state: CanvasState): CanvasState {
    return {
      images: state.images.map(img => ({ ...img })),
      videos: state.videos.map(vid => ({ ...vid })),
      texts: state.texts.map(text => ({ ...text })),
      strokes: state.strokes.map(stroke => ({ ...stroke, points: [...stroke.points] })),
      selectedIds: state.selectedIds.map(sel => ({ ...sel }))
    };
  }

  // Debug methods
  getUndoStack(): Action[] {
    return [...this.undoStack];
  }

  getRedoStack(): Action[] {
    return [...this.redoStack];
  }

  getCurrentBatchActions(): Action[] {
    return [...this.batchActions];
  }
}
