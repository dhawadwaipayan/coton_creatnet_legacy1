// Action Factory for creating and managing actions
import { 
  Action, 
  AddImageAction, 
  AddVideoAction, 
  AddTextAction, 
  AddStrokeAction,
  DeleteImageAction,
  DeleteVideoAction,
  DeleteTextAction,
  DeleteStrokeAction,
  TransformImageAction,
  TransformVideoAction,
  TransformTextAction,
  TransformStrokeAction,
  EditTextAction,
  SelectItemsAction,
  TransformState,
  ACTION_TYPES
} from '../types/actions';

export class ActionFactory {
  private static generateId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Add item actions
  static createAddImageAction(item: any, description?: string): AddImageAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.ADD_IMAGE,
      timestamp: Date.now(),
      description: description || `Add image ${item.id}`,
      item: { ...item }
    };
  }

  static createAddVideoAction(item: any, description?: string): AddVideoAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.ADD_VIDEO,
      timestamp: Date.now(),
      description: description || `Add video ${item.id}`,
      item: { ...item }
    };
  }

  static createAddTextAction(item: any, description?: string): AddTextAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.ADD_TEXT,
      timestamp: Date.now(),
      description: description || `Add text "${item.text.substring(0, 20)}${item.text.length > 20 ? '...' : ''}"`,
      item: { ...item }
    };
  }

  static createAddStrokeAction(item: any, description?: string): AddStrokeAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.ADD_STROKE,
      timestamp: Date.now(),
      description: description || `Add stroke ${item.id}`,
      item: { ...item, points: [...item.points] }
    };
  }

  // Delete item actions
  static createDeleteImageAction(itemId: string, item: any, description?: string): DeleteImageAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.DELETE_IMAGE,
      timestamp: Date.now(),
      description: description || `Delete image ${itemId}`,
      itemId,
      item: { ...item }
    };
  }

  static createDeleteVideoAction(itemId: string, item: any, description?: string): DeleteVideoAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.DELETE_VIDEO,
      timestamp: Date.now(),
      description: description || `Delete video ${itemId}`,
      itemId,
      item: { ...item }
    };
  }

  static createDeleteTextAction(itemId: string, item: any, description?: string): DeleteTextAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.DELETE_TEXT,
      timestamp: Date.now(),
      description: description || `Delete text "${item.text.substring(0, 20)}${item.text.length > 20 ? '...' : ''}"`,
      itemId,
      item: { ...item }
    };
  }

  static createDeleteStrokeAction(itemId: string, item: any, description?: string): DeleteStrokeAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.DELETE_STROKE,
      timestamp: Date.now(),
      description: description || `Delete stroke ${itemId}`,
      itemId,
      item: { ...item, points: [...item.points] }
    };
  }

  // Transform actions
  static createTransformImageAction(
    itemId: string, 
    oldTransform: TransformState, 
    newTransform: TransformState,
    description?: string
  ): TransformImageAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.TRANSFORM_IMAGE,
      timestamp: Date.now(),
      description: description || `Transform image ${itemId}`,
      itemId,
      oldTransform: { ...oldTransform },
      newTransform: { ...newTransform }
    };
  }

  static createTransformVideoAction(
    itemId: string, 
    oldTransform: TransformState, 
    newTransform: TransformState,
    description?: string
  ): TransformVideoAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.TRANSFORM_VIDEO,
      timestamp: Date.now(),
      description: description || `Transform video ${itemId}`,
      itemId,
      oldTransform: { ...oldTransform },
      newTransform: { ...newTransform }
    };
  }

  static createTransformTextAction(
    itemId: string, 
    oldTransform: TransformState, 
    newTransform: TransformState,
    description?: string
  ): TransformTextAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.TRANSFORM_TEXT,
      timestamp: Date.now(),
      description: description || `Transform text ${itemId}`,
      itemId,
      oldTransform: { ...oldTransform },
      newTransform: { ...newTransform }
    };
  }

  static createTransformStrokeAction(
    itemId: string, 
    oldTransform: TransformState, 
    newTransform: TransformState,
    description?: string
  ): TransformStrokeAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.TRANSFORM_STROKE,
      timestamp: Date.now(),
      description: description || `Transform stroke ${itemId}`,
      itemId,
      oldTransform: { ...oldTransform },
      newTransform: { ...newTransform }
    };
  }

  // Text editing action
  static createEditTextAction(
    itemId: string,
    oldText: string,
    newText: string,
    oldCursorPos: number,
    newCursorPos: number,
    description?: string
  ): EditTextAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.EDIT_TEXT,
      timestamp: Date.now(),
      description: description || `Edit text ${itemId}`,
      itemId,
      oldText,
      newText,
      oldCursorPos,
      newCursorPos
    };
  }

  // Selection action
  static createSelectItemsAction(
    oldSelection: Array<{ id: string; type: 'frame' | 'image' | 'stroke' | 'text' | 'video' }>,
    newSelection: Array<{ id: string; type: 'frame' | 'image' | 'stroke' | 'text' | 'video' }>,
    description?: string
  ): SelectItemsAction {
    return {
      id: this.generateId(),
      type: ACTION_TYPES.SELECT_ITEMS,
      timestamp: Date.now(),
      description: description || `Select ${newSelection.length} items`,
      oldSelection: [...oldSelection],
      newSelection: [...newSelection]
    };
  }

  // Utility methods
  static createTransformState(
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
    scaleX?: number,
    scaleY?: number
  ): TransformState {
    return {
      x,
      y,
      width,
      height,
      rotation,
      scaleX: scaleX || 1,
      scaleY: scaleY || 1
    };
  }

  static createTransformStateFromItem(item: any): TransformState {
    return {
      x: item.x || 0,
      y: item.y || 0,
      width: item.width || 0,
      height: item.height || 0,
      rotation: item.rotation || 0,
      scaleX: item.scaleX || 1,
      scaleY: item.scaleY || 1
    };
  }

  // Validation methods
  static validateAction(action: Action): boolean {
    if (!action.id || !action.type || !action.timestamp || !action.description) {
      return false;
    }

    switch (action.type) {
      case ACTION_TYPES.ADD_IMAGE:
      case ACTION_TYPES.ADD_VIDEO:
      case ACTION_TYPES.ADD_TEXT:
      case ACTION_TYPES.ADD_STROKE:
        return !!(action as any).item;
      
      case ACTION_TYPES.DELETE_IMAGE:
      case ACTION_TYPES.DELETE_VIDEO:
      case ACTION_TYPES.DELETE_TEXT:
      case ACTION_TYPES.DELETE_STROKE:
        return !!(action as any).itemId && !!(action as any).item;
      
      case ACTION_TYPES.TRANSFORM_IMAGE:
      case ACTION_TYPES.TRANSFORM_VIDEO:
      case ACTION_TYPES.TRANSFORM_TEXT:
      case ACTION_TYPES.TRANSFORM_STROKE:
        return !!(action as any).itemId && !!(action as any).oldTransform && !!(action as any).newTransform;
      
      case ACTION_TYPES.EDIT_TEXT:
        return !!(action as any).itemId && 
               typeof (action as any).oldText === 'string' && 
               typeof (action as any).newText === 'string';
      
      case ACTION_TYPES.SELECT_ITEMS:
        return Array.isArray((action as any).oldSelection) && Array.isArray((action as any).newSelection);
      
      case ACTION_TYPES.BATCH:
        return Array.isArray((action as any).actions);
      
      default:
        return false;
    }
  }

  // Helper methods for common operations
  static createBatchDescription(actions: Action[]): string {
    const actionCounts = actions.reduce((acc, action) => {
      acc[action.type] = (acc[action.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const descriptions = Object.entries(actionCounts).map(([type, count]) => {
      const typeName = type.replace(/_/g, ' ').toLowerCase();
      return `${count} ${typeName}${count > 1 ? 's' : ''}`;
    });

    return `Batch: ${descriptions.join(', ')}`;
  }

  static getActionDescription(action: Action): string {
    return action.description || `${action.type} at ${new Date(action.timestamp).toLocaleTimeString()}`;
  }

  static isTransformAction(action: Action): boolean {
    return [
      ACTION_TYPES.TRANSFORM_IMAGE,
      ACTION_TYPES.TRANSFORM_VIDEO,
      ACTION_TYPES.TRANSFORM_TEXT,
      ACTION_TYPES.TRANSFORM_STROKE
    ].includes(action.type as any);
  }

  static isAddAction(action: Action): boolean {
    return [
      ACTION_TYPES.ADD_IMAGE,
      ACTION_TYPES.ADD_VIDEO,
      ACTION_TYPES.ADD_TEXT,
      ACTION_TYPES.ADD_STROKE
    ].includes(action.type as any);
  }

  static isDeleteAction(action: Action): boolean {
    return [
      ACTION_TYPES.DELETE_IMAGE,
      ACTION_TYPES.DELETE_VIDEO,
      ACTION_TYPES.DELETE_TEXT,
      ACTION_TYPES.DELETE_STROKE
    ].includes(action.type as any);
  }
}
