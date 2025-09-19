// Action type definitions for undo/redo system

export interface TransformState {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX?: number;
  scaleY?: number;
}

export interface BaseAction {
  id: string;
  type: string;
  timestamp: number;
  description: string;
  batchId?: string; // For grouping related actions
}

// Item addition actions
export interface AddImageAction extends BaseAction {
  type: 'ADD_IMAGE';
  item: {
    id: string;
    image: HTMLImageElement | null;
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotation?: number;
    timestamp: number;
    error?: boolean;
    loading?: boolean;
    src?: string | null;
  };
}

export interface AddVideoAction extends BaseAction {
  type: 'ADD_VIDEO';
  item: {
    id: string;
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    timestamp: number;
    videoElement: HTMLVideoElement;
    thumbnail?: HTMLImageElement;
  };
}

export interface AddTextAction extends BaseAction {
  type: 'ADD_TEXT';
  item: {
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
    fontSize: number;
    rotation: number;
    timestamp: number;
  };
}

export interface AddStrokeAction extends BaseAction {
  type: 'ADD_STROKE';
  item: {
    id: string;
    points: number[];
    color: string;
    size: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    timestamp: number;
  };
}

// Item deletion actions
export interface DeleteImageAction extends BaseAction {
  type: 'DELETE_IMAGE';
  itemId: string;
  item: {
    id: string;
    image: HTMLImageElement | null;
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotation?: number;
    timestamp: number;
    error?: boolean;
    loading?: boolean;
    src?: string | null;
  };
}

export interface DeleteVideoAction extends BaseAction {
  type: 'DELETE_VIDEO';
  itemId: string;
  item: {
    id: string;
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    timestamp: number;
    videoElement: HTMLVideoElement;
    thumbnail?: HTMLImageElement;
  };
}

export interface DeleteTextAction extends BaseAction {
  type: 'DELETE_TEXT';
  itemId: string;
  item: {
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
    fontSize: number;
    rotation: number;
    timestamp: number;
  };
}

export interface DeleteStrokeAction extends BaseAction {
  type: 'DELETE_STROKE';
  itemId: string;
  item: {
    id: string;
    points: number[];
    color: string;
    size: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    timestamp: number;
  };
}

// Item transformation actions
export interface TransformImageAction extends BaseAction {
  type: 'TRANSFORM_IMAGE';
  itemId: string;
  oldTransform: TransformState;
  newTransform: TransformState;
}

export interface TransformVideoAction extends BaseAction {
  type: 'TRANSFORM_VIDEO';
  itemId: string;
  oldTransform: TransformState;
  newTransform: TransformState;
}

export interface TransformTextAction extends BaseAction {
  type: 'TRANSFORM_TEXT';
  itemId: string;
  oldTransform: TransformState;
  newTransform: TransformState;
}

export interface TransformStrokeAction extends BaseAction {
  type: 'TRANSFORM_STROKE';
  itemId: string;
  oldTransform: TransformState;
  newTransform: TransformState;
}

// Text editing actions
export interface EditTextAction extends BaseAction {
  type: 'EDIT_TEXT';
  itemId: string;
  oldText: string;
  newText: string;
  oldCursorPos: number;
  newCursorPos: number;
}

// Batch operations
export interface BatchAction extends BaseAction {
  type: 'BATCH';
  actions: BaseAction[];
}

// Selection actions
export interface SelectItemsAction extends BaseAction {
  type: 'SELECT_ITEMS';
  oldSelection: Array<{ id: string; type: 'frame' | 'image' | 'stroke' | 'text' | 'video' }>;
  newSelection: Array<{ id: string; type: 'frame' | 'image' | 'stroke' | 'text' | 'video' }>;
}

// Union type for all actions
export type Action = 
  | AddImageAction
  | AddVideoAction
  | AddTextAction
  | AddStrokeAction
  | DeleteImageAction
  | DeleteVideoAction
  | DeleteTextAction
  | DeleteStrokeAction
  | TransformImageAction
  | TransformVideoAction
  | TransformTextAction
  | TransformStrokeAction
  | EditTextAction
  | BatchAction
  | SelectItemsAction;

// Action type constants
export const ACTION_TYPES = {
  ADD_IMAGE: 'ADD_IMAGE',
  ADD_VIDEO: 'ADD_VIDEO',
  ADD_TEXT: 'ADD_TEXT',
  ADD_STROKE: 'ADD_STROKE',
  DELETE_IMAGE: 'DELETE_IMAGE',
  DELETE_VIDEO: 'DELETE_VIDEO',
  DELETE_TEXT: 'DELETE_TEXT',
  DELETE_STROKE: 'DELETE_STROKE',
  TRANSFORM_IMAGE: 'TRANSFORM_IMAGE',
  TRANSFORM_VIDEO: 'TRANSFORM_VIDEO',
  TRANSFORM_TEXT: 'TRANSFORM_TEXT',
  TRANSFORM_STROKE: 'TRANSFORM_STROKE',
  EDIT_TEXT: 'EDIT_TEXT',
  BATCH: 'BATCH',
  SELECT_ITEMS: 'SELECT_ITEMS',
} as const;

// Canvas state interface
export interface CanvasState {
  images: Array<{
    id: string;
    image: HTMLImageElement | null;
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotation?: number;
    timestamp: number;
    error?: boolean;
    loading?: boolean;
    src?: string | null;
  }>;
  videos: Array<{
    id: string;
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    timestamp: number;
    videoElement: HTMLVideoElement;
    thumbnail?: HTMLImageElement;
  }>;
  texts: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
    fontSize: number;
    rotation: number;
    timestamp: number;
  }>;
  strokes: Array<{
    id: string;
    points: number[];
    color: string;
    size: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    timestamp: number;
  }>;
  selectedIds: Array<{ id: string; type: 'frame' | 'image' | 'stroke' | 'text' | 'video' }>;
}
