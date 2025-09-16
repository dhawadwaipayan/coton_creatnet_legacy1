import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect, useCallback } from 'react';
import Konva from 'konva';
import { Stage, Layer, Line, Image as KonvaImage, Transformer, Text as KonvaText, Rect, Group } from 'react-konva';

import { uploadBoardImage, imageElementToBlob } from '../lib/utils';
import { ThumbnailGenerator } from '../lib/thumbnailGenerator';
import { IncrementalLoader } from '../lib/incrementalLoader';
import { MemoryManager } from '../lib/memoryManager';
import { DatabaseOptimizer } from '../lib/databaseOptimizer';
import { PerformanceMonitor } from '../lib/performanceMonitor';
import { AdvancedCache } from '../lib/advancedCache';
import { CollaborationManager } from '../lib/collaborationManager';
// import { LoadBalancer } from '../lib/loadBalancer'; // Disabled to prevent health check issues
import { cdnManager } from '../lib/cdnManager';
import { securityManager } from '../lib/securityManager';
import { productionMonitor } from '../lib/productionMonitor';

// Helper to generate grid lines for a 30000x30000 board
function generateGridLines(size = 30000, gridSize = 20) {
  const lines = [];
  // Vertical lines
  for (let x = 0; x <= size; x += gridSize) {
    lines.push({ points: [x, 0, x, size] });
  }
  // Horizontal lines
  for (let y = 0; y <= size; y += gridSize) {
    lines.push({ points: [0, y, size, y] });
  }
  return lines;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export const Canvas = forwardRef(function CanvasStub(props: any, ref) {
  const stageRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  const boardWidth = 30000;
  const boardHeight = 30000;
  const gridLines = generateGridLines(boardWidth, 20);

  // Get viewport size
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  React.useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hand tool state
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState<{x: number, y: number} | null>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // Temporary pan mode state (for middle mouse button in select mode)
  const [isTemporaryPanMode, setIsTemporaryPanMode] = useState(false);
  const [temporaryPanStart, setTemporaryPanStart] = useState<{x: number, y: number} | null>(null);

  // Alt+drag duplication state
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateStartPos, setDuplicateStartPos] = useState<{x: number, y: number} | null>(null);
  const [duplicateOffset, setDuplicateOffset] = useState<{x: number, y: number} | null>(null);


  // Zoom state - initialize at 80% zoom
  const [zoom, setZoom] = useState(0.8);
  const [zoomCenter, setZoomCenter] = useState({ x: 0, y: 0 });

  // Initialize viewport to center of canvas at 80% zoom (only on mount)
  React.useEffect(() => {
    // Center the viewport on the canvas when component mounts
    const centerCanvas = () => {
      const canvasCenterX = boardWidth / 2;
      const canvasCenterY = boardHeight / 2;
      
      // Use 0.8 zoom for initial centering (default zoom level)
      const initialZoom = 0.8;
      
      // Calculate stage position to center the canvas in the viewport
      const newStagePosX = (viewport.width / 2) - (canvasCenterX * initialZoom);
      const newStagePosY = (viewport.height / 2) - (canvasCenterY * initialZoom);
      
      setStagePos({ x: newStagePosX, y: newStagePosY });
      setZoom(initialZoom); // Set initial zoom
    };
    
    // Wait for viewport to be set before centering
    if (viewport.width > 0 && viewport.height > 0) {
      centerCanvas();
    }
  }, [viewport.width, viewport.height, boardWidth, boardHeight]);

  // Utility function to get current viewport center
  const getViewportCenter = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    
    // Calculate viewport center in world coordinates
    const viewportCenterX = (-stagePos.x + viewport.width / 2) / zoom;
    const viewportCenterY = (-stagePos.y + viewport.height / 2) / zoom;
    
    return { x: viewportCenterX, y: viewportCenterY };
  }, [stagePos, viewport.width, viewport.height, zoom]);

  // Function to smoothly center viewport on an element
  const centerViewportOnElement = useCallback((x: number, y: number, width: number, height: number) => {
    const center = getViewportCenter();
    const targetX = x + width / 2;
    const targetY = y + height / 2;
    
    const deltaX = center.x - targetX;
    const deltaY = center.y - targetY;
    
    // Smoothly animate to center
    const newStagePos = {
      x: stagePos.x + deltaX * zoom,
      y: stagePos.y + deltaY * zoom,
    };
    
    setStagePos(clampStagePos(newStagePos));
  }, [getViewportCenter, stagePos, zoom]);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - stagePos.x) / zoom,
      y: (screenY - stagePos.y) / zoom
    };
  }, [stagePos, zoom]);

  // Convert canvas coordinates to screen coordinates (for textarea positioning)
  const canvasToScreen = useCallback((canvasX: number, canvasY: number) => {
    return {
      x: canvasX * zoom + stagePos.x,
      y: canvasY * zoom + stagePos.y
    };
  }, [zoom, stagePos]);

  // Frames state: white rectangles always rendered below other elements
  const [frames, setFrames] = useState<Array<{ id: string, name?: string, x: number, y: number, width: number, height: number, rotation: number, timestamp: number }>>([]);
  const [frameDrawing, setFrameDrawing] = useState(false);
  const [frameStart, setFrameStart] = useState<{ x: number, y: number } | null>(null);
  const [currentFrame, setCurrentFrame] = useState<{ id: string, x: number, y: number, width: number, height: number } | null>(null);
  const snapThreshold = 8;
  const gridSize = 20;

  // Snap helpers
  const roundToGrid = (val: number) => Math.round(val / gridSize) * gridSize;
  const getFrameEdges = (f: {x:number;y:number;width:number;height:number}) => ({
    left: f.x,
    right: f.x + f.width,
    top: f.y,
    bottom: f.y + f.height,
    cx: f.x + f.width / 2,
    cy: f.y + f.height / 2
  });
  const applySnapToFrame = (proposal: {x:number;y:number;width:number;height:number}, ignoreId?: string) => {
    let { x, y, width, height } = proposal;
    // Grid snap
    const gx = roundToGrid(x);
    const gy = roundToGrid(y);
    if (Math.abs(gx - x) <= snapThreshold) x = gx;
    if (Math.abs(gy - y) <= snapThreshold) y = gy;
    const gxr = roundToGrid(x + width);
    const gyr = roundToGrid(y + height);
    if (Math.abs(gxr - (x + width)) <= snapThreshold) width = Math.max(20, gxr - x);
    if (Math.abs(gyr - (y + height)) <= snapThreshold) height = Math.max(20, gyr - y);
    // Other frames snap
    const currentEdges = getFrameEdges({ x, y, width, height });
    frames.filter(f => f.id !== ignoreId).forEach(f => {
      const e = getFrameEdges(f);
      // Horizontal alignments
      const candidatesX = [e.left, e.right, e.cx];
      candidatesX.forEach(cxVal => {
        // snap left
        if (Math.abs(x - cxVal) <= snapThreshold) x = cxVal;
        // snap right
        if (Math.abs(x + width - cxVal) <= snapThreshold) x = cxVal - width;
        // snap center X
        if (Math.abs(x + width / 2 - cxVal) <= snapThreshold) x = cxVal - width / 2;
      });
      // Vertical alignments
      const candidatesY = [e.top, e.bottom, e.cy];
      candidatesY.forEach(cyVal => {
        // snap top
        if (Math.abs(y - cyVal) <= snapThreshold) y = cyVal;
        // snap bottom
        if (Math.abs(y + height - cyVal) <= snapThreshold) y = cyVal - height;
        // snap center Y
        if (Math.abs(y + height / 2 - cyVal) <= snapThreshold) y = cyVal - height / 2;
      });
    });
    return { x, y, width, height };
  };

  // Images state: store loaded HTMLImageElement
  const [images, setImages] = useState<Array<{ id: string, image: HTMLImageElement | null, x: number, y: number, width?: number, height?: number, rotation?: number, timestamp: number, error?: boolean, loading?: boolean }>>([]);
  // Videos state: store video elements with Konva.js video support
  const [videos, setVideos] = useState<Array<{ id: string, src: string, x: number, y: number, width: number, height: number, rotation: number, timestamp: number, videoElement: HTMLVideoElement, thumbnail?: HTMLImageElement }>>([]);
  
  // Animation for video playback
  const videoAnimationRef = useRef<any>(null);
  
  // Start video animation to continuously update the layer
  const startVideoAnimation = useCallback(() => {
    if (videoAnimationRef.current) {
      videoAnimationRef.current.stop();
    }
    
    const anim = new Konva.Animation(() => {
      // Animation just needs to update the layer for video playback
      if (layerRef.current) {
        layerRef.current.batchDraw();
      }
    }, layerRef.current);
    
    videoAnimationRef.current = anim;
    anim.start();
  }, []);
  
  // Start video animation when videos are added
  useEffect(() => {
    if (videos.length > 0) {
      startVideoAnimation();
    }
    return () => {
      if (videoAnimationRef.current) {
        videoAnimationRef.current.stop();
      }
    };
  }, [videos.length, startVideoAnimation]);
  // Strokes state: freehand lines
  const [strokes, setStrokes] = useState<Array<{ id: string, points: number[], color: string, size: number, x: number, y: number, width: number, height: number, rotation: number, timestamp: number }>>([]);
  const [drawing, setDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ id: string, points: number[], color: string, size: number, x: number, y: number, width: number, height: number, rotation: number, timestamp: number } | null>(null);
  // Replace selection state and logic
  // Remove selectedId, selectedType
  // Use only selectedIds: Array<{ id: string, type: 'frame' | 'image' | 'stroke' | 'text' | 'video' }>
  const [selectedIds, setSelectedIds] = useState<Array<{ id: string, type: 'frame' | 'image' | 'stroke' | 'text' | 'video' }>>([]);
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
  const [groupDragStart, setGroupDragStart] = useState<{ x: number, y: number, items: Array<{ id: string, type: 'image' | 'stroke' | 'text' | 'video', x: number, y: number }> } | null>(null);

  // Add texts state
  const [texts, setTexts] = useState<Array<{ id: string, text: string, x: number, y: number, color: string, fontSize: number, rotation: number, timestamp: number }>>([]);
  // Add state for native canvas text editing
  const [editingText, setEditingText] = useState<null | {
    id: string;
    value: string;
    x: number;
    y: number;
    color: string;
    fontSize: number;
    rotation: number;
    cursorPosition: number;
    selectionStart: number;
    selectionEnd: number;
  }>(null);
  
  // Add state for caret animation
  const [caretVisible, setCaretVisible] = useState(true);
  
  // Caret animation effect
  useEffect(() => {
    if (!editingText) return;
    
    const interval = setInterval(() => {
      setCaretVisible(prev => !prev);
    }, 500); // Blink every 500ms
    
    return () => clearInterval(interval);
  }, [editingText]);
  
  // Native canvas keyboard handling
  useEffect(() => {
    if (!editingText) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentText = editingText.value;
      const cursorPos = editingText.cursorPosition;
      
      // Handle Ctrl+A (Select All)
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setEditingText(prev => prev ? { 
          ...prev, 
          selectionStart: 0, 
          selectionEnd: currentText.length,
          cursorPosition: currentText.length 
        } : null);
        return;
      }
      
      // Handle Ctrl+X (Cut) - same as delete selected
      if (e.ctrlKey && e.key === 'x') {
        e.preventDefault();
        if (editingText.selectionStart !== editingText.selectionEnd) {
          const newText = currentText.slice(0, editingText.selectionStart) + currentText.slice(editingText.selectionEnd);
          setEditingText(prev => prev ? { 
            ...prev, 
            value: newText, 
            cursorPosition: editingText.selectionStart,
            selectionStart: editingText.selectionStart,
            selectionEnd: editingText.selectionStart
          } : null);
          setTexts(prev => prev.map(t => t.id === editingText.id ? { ...t, text: newText } : t));
        }
        return;
      }
      
      // Handle Ctrl+C (Copy) - for future clipboard support
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        // Future: copy selected text to clipboard
        return;
      }
      
      // Handle Ctrl+V (Paste) - for future clipboard support
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        // Future: paste from clipboard
        return;
      }
      
      // Only prevent default for text editing keys, not navigation
      const isTextEditingKey = ['Backspace', 'Delete', 'Enter'].includes(e.key) || 
                               (e.key.length === 1 && !e.ctrlKey && !e.metaKey);
      
      if (isTextEditingKey) {
        e.preventDefault();
      }
      
      switch (e.key) {
        case 'Backspace':
          if (editingText.selectionStart !== editingText.selectionEnd) {
            // Delete selected text
            const newText = currentText.slice(0, editingText.selectionStart) + currentText.slice(editingText.selectionEnd);
            setEditingText(prev => prev ? { 
              ...prev, 
              value: newText, 
              cursorPosition: editingText.selectionStart,
              selectionStart: editingText.selectionStart,
              selectionEnd: editingText.selectionStart
            } : null);
            setTexts(prev => prev.map(t => t.id === editingText.id ? { ...t, text: newText } : t));
          } else if (cursorPos > 0) {
            const newText = currentText.slice(0, cursorPos - 1) + currentText.slice(cursorPos);
            const newCursorPos = cursorPos - 1;
            setEditingText(prev => prev ? { ...prev, value: newText, cursorPosition: newCursorPos } : null);
            setTexts(prev => prev.map(t => t.id === editingText.id ? { ...t, text: newText } : t));
          }
          // Don't exit editing when text is empty - let user continue typing
          break;
          
        case 'Delete':
          if (editingText.selectionStart !== editingText.selectionEnd) {
            // Delete selected text
            const newText = currentText.slice(0, editingText.selectionStart) + currentText.slice(editingText.selectionEnd);
            setEditingText(prev => prev ? { 
              ...prev, 
              value: newText, 
              cursorPosition: editingText.selectionStart,
              selectionStart: editingText.selectionStart,
              selectionEnd: editingText.selectionStart
            } : null);
            setTexts(prev => prev.map(t => t.id === editingText.id ? { ...t, text: newText } : t));
          } else if (cursorPos < currentText.length) {
            const newText = currentText.slice(0, cursorPos) + currentText.slice(cursorPos + 1);
            setEditingText(prev => prev ? { ...prev, value: newText } : null);
            setTexts(prev => prev.map(t => t.id === editingText.id ? { ...t, text: newText } : t));
          }
          break;
          
        case 'ArrowLeft':
          if (e.shiftKey) {
            // Extend selection
            const newPos = Math.max(0, cursorPos - 1);
            setEditingText(prev => prev ? { 
              ...prev, 
              cursorPosition: newPos,
              selectionStart: Math.min(prev.selectionStart, newPos),
              selectionEnd: Math.max(prev.selectionEnd, newPos)
            } : null);
          } else {
            // Move cursor and clear selection
            if (cursorPos > 0) {
              setEditingText(prev => prev ? { 
                ...prev, 
                cursorPosition: cursorPos - 1,
                selectionStart: cursorPos - 1,
                selectionEnd: cursorPos - 1
              } : null);
            }
          }
          break;
          
        case 'ArrowRight':
          if (e.shiftKey) {
            // Extend selection
            const newPos = Math.min(currentText.length, cursorPos + 1);
            setEditingText(prev => prev ? { 
              ...prev, 
              cursorPosition: newPos,
              selectionStart: Math.min(prev.selectionStart, newPos),
              selectionEnd: Math.max(prev.selectionEnd, newPos)
            } : null);
          } else {
            // Move cursor and clear selection
            if (cursorPos < currentText.length) {
              setEditingText(prev => prev ? { 
                ...prev, 
                cursorPosition: cursorPos + 1,
                selectionStart: cursorPos + 1,
                selectionEnd: cursorPos + 1
              } : null);
            }
          }
          break;
          
        case 'ArrowUp':
          if (e.shiftKey) {
            // Extend selection up (simplified - move to previous line start)
            const textLines = currentText.split('\n');
            let currentLine = 0;
            let currentChar = cursorPos;
            
            // Find current line
            for (let i = 0; i < textLines.length; i++) {
              if (currentChar <= textLines[i].length) {
                currentLine = i;
                break;
              }
              currentChar -= textLines[i].length + 1;
            }
            
            if (currentLine > 0) {
              // Move to previous line at same character position
              let newPos = 0;
              for (let i = 0; i < currentLine - 1; i++) {
                newPos += textLines[i].length + 1;
              }
              newPos += Math.min(currentChar, textLines[currentLine - 1].length);
              
              setEditingText(prev => prev ? { 
                ...prev, 
                cursorPosition: newPos,
                selectionStart: Math.min(prev.selectionStart, newPos),
                selectionEnd: Math.max(prev.selectionEnd, newPos)
              } : null);
            }
          } else {
            // Move cursor up (simplified - move to previous line start)
            const textLines = currentText.split('\n');
            let currentLine = 0;
            let currentChar = cursorPos;
            
            // Find current line
            for (let i = 0; i < textLines.length; i++) {
              if (currentChar <= textLines[i].length) {
                currentLine = i;
                break;
              }
              currentChar -= textLines[i].length + 1;
            }
            
            if (currentLine > 0) {
              // Move to previous line at same character position
              let newPos = 0;
              for (let i = 0; i < currentLine - 1; i++) {
                newPos += textLines[i].length + 1;
              }
              newPos += Math.min(currentChar, textLines[currentLine - 1].length);
              
              setEditingText(prev => prev ? { 
                ...prev, 
                cursorPosition: newPos,
                selectionStart: newPos,
                selectionEnd: newPos
              } : null);
            }
          }
          break;
          
        case 'ArrowDown':
          if (e.shiftKey) {
            // Extend selection down (simplified - move to next line start)
            const textLines = currentText.split('\n');
            let currentLine = 0;
            let currentChar = cursorPos;
            
            // Find current line
            for (let i = 0; i < textLines.length; i++) {
              if (currentChar <= textLines[i].length) {
                currentLine = i;
                break;
              }
              currentChar -= textLines[i].length + 1;
            }
            
            if (currentLine < textLines.length - 1) {
              // Move to next line at same character position
              let newPos = 0;
              for (let i = 0; i < currentLine + 1; i++) {
                newPos += textLines[i].length + 1;
              }
              newPos += Math.min(currentChar, textLines[currentLine + 1].length);
              
              setEditingText(prev => prev ? { 
                ...prev, 
                cursorPosition: newPos,
                selectionStart: Math.min(prev.selectionStart, newPos),
                selectionEnd: Math.max(prev.selectionEnd, newPos)
              } : null);
            }
          } else {
            // Move cursor down (simplified - move to next line start)
            const textLines = currentText.split('\n');
            let currentLine = 0;
            let currentChar = cursorPos;
            
            // Find current line
            for (let i = 0; i < textLines.length; i++) {
              if (currentChar <= textLines[i].length) {
                currentLine = i;
                break;
              }
              currentChar -= textLines[i].length + 1;
            }
            
            if (currentLine < textLines.length - 1) {
              // Move to next line at same character position
              let newPos = 0;
              for (let i = 0; i < currentLine + 1; i++) {
                newPos += textLines[i].length + 1;
              }
              newPos += Math.min(currentChar, textLines[currentLine + 1].length);
              
              setEditingText(prev => prev ? { 
                ...prev, 
                cursorPosition: newPos,
                selectionStart: newPos,
                selectionEnd: newPos
              } : null);
            }
          }
          break;
          
        case 'Home':
          if (e.shiftKey) {
            // Select to beginning
            setEditingText(prev => prev ? { 
              ...prev, 
              cursorPosition: 0,
              selectionStart: 0,
              selectionEnd: Math.max(prev.selectionEnd, 0)
            } : null);
          } else {
            // Move to beginning and clear selection
            setEditingText(prev => prev ? { 
              ...prev, 
              cursorPosition: 0,
              selectionStart: 0,
              selectionEnd: 0
            } : null);
          }
          break;
          
        case 'End':
          if (e.shiftKey) {
            // Select to end
            setEditingText(prev => prev ? { 
              ...prev, 
              cursorPosition: currentText.length,
              selectionStart: Math.min(prev.selectionStart, currentText.length),
              selectionEnd: currentText.length
            } : null);
          } else {
            // Move to end and clear selection
            setEditingText(prev => prev ? { 
              ...prev, 
              cursorPosition: currentText.length,
              selectionStart: currentText.length,
              selectionEnd: currentText.length
            } : null);
          }
          break;
          
        case 'Enter': {
          const newText = currentText.slice(0, cursorPos) + '\n' + currentText.slice(cursorPos);
          const newCursorPos = cursorPos + 1;
          setEditingText(prev => prev ? { 
            ...prev, 
            value: newText, 
            cursorPosition: newCursorPos,
            selectionStart: newCursorPos,
            selectionEnd: newCursorPos
          } : null);
          setTexts(prev => prev.map(t => t.id === editingText.id ? { ...t, text: newText } : t));
          break;
        }
          
        case 'Escape':
          e.preventDefault();
          // Only finish editing if text has content
          if (currentText.trim() !== '') {
            setEditingText(null);
            if (props.onTextAdded) props.onTextAdded();
          }
          break;
          
        case 'Tab':
          e.preventDefault();
          // Finish editing on Tab
          setEditingText(null);
          if (props.onTextAdded) props.onTextAdded();
          break;
          
        default:
          // Handle regular character input
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            let newText;
            let newCursorPos;
            
            if (editingText.selectionStart !== editingText.selectionEnd) {
              // Replace selected text
              newText = currentText.slice(0, editingText.selectionStart) + e.key + currentText.slice(editingText.selectionEnd);
              newCursorPos = editingText.selectionStart + 1;
            } else {
              // Insert at cursor
              newText = currentText.slice(0, cursorPos) + e.key + currentText.slice(cursorPos);
              newCursorPos = cursorPos + 1;
            }
            
            setEditingText(prev => prev ? { 
              ...prev, 
              value: newText, 
              cursorPosition: newCursorPos,
              selectionStart: newCursorPos,
              selectionEnd: newCursorPos
            } : null);
            setTexts(prev => prev.map(t => t.id === editingText.id ? { ...t, text: newText } : t));
          }
          break;
      }
    };
    
    // Add keyboard event listener
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingText, props.onTextAdded]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Undo/Redo stacks
  const [undoStack, setUndoStack] = useState<Array<{ images: typeof images; strokes: typeof strokes; texts: typeof texts; videos: typeof videos }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ images: typeof images; strokes: typeof strokes; texts: typeof texts; videos: typeof videos }>>([]);

  // Debounced saving state
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Use refs to always access the latest state in the debounced function
  const imagesRef = useRef(images);
  const strokesRef = useRef(strokes);
  const textsRef = useRef(texts);
  const videosRef = useRef(videos);
  
  // Update refs whenever state changes
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  
  useEffect(() => {
    textsRef.current = texts;
  }, [texts]);
  
  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);

  // Helper to push current state to undo stack
  const pushToUndoStack = useCallback(() => {
    setUndoStack(prev => {
      const newStack = [...prev, { images: JSON.parse(JSON.stringify(images)), strokes: JSON.parse(JSON.stringify(strokes)), texts: JSON.parse(JSON.stringify(texts)), videos: JSON.parse(JSON.stringify(videos)) }];
      // Limit to 50 entries
      return newStack.length > 50 ? newStack.slice(newStack.length - 50) : newStack;
    });
    setRedoStack([]); // Clear redo stack on new action
  }, [images, strokes, texts, videos]);

  // Debounced save function - saves after 2 seconds of inactivity
  const debouncedSave = useCallback(() => {
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    // Set new timeout for 2 seconds
    const timeout = setTimeout(async () => {
      if (props.onContentChange && props.boardContent) {
        setIsSaving(true);
        try {
          // Use refs to always get the latest state, avoiding stale closures
          await saveBoardContent(imagesRef.current, strokesRef.current, textsRef.current, videosRef.current);
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 2000);
    
    setSaveTimeout(timeout);
  }, [saveTimeout, props.onContentChange, props.boardContent]);

  // Update pushToUndoStack to trigger debounced save
  const pushToUndoStackWithSave = useCallback(() => {
    pushToUndoStack();
    // Trigger debounced save after content changes
    debouncedSave();
  }, [pushToUndoStack, debouncedSave]);

  // Undo handler
  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      setRedoStack(rStack => [{ images, strokes, texts, videos }, ...rStack]);
      const last = prev[prev.length - 1];
      setImages(last.images);
      setStrokes(last.strokes);
      setTexts(last.texts);
      setVideos(last.videos);
      return prev.slice(0, -1);
    });
  }, [images, strokes, texts, videos]);

  // Redo handler
  const handleRedo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      setUndoStack(uStack => [...uStack, { images, strokes, texts, videos }]);
      const next = prev[0];
      setImages(next.images);
      setStrokes(next.strokes);
      setTexts(next.texts);
      setVideos(next.videos);
      return prev.slice(1);
    });
  }, [images, strokes, texts, videos]);
  
  // Delete selected items handler
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    
    pushToUndoStackWithSave();
    
    // Delete selected images
    const selectedImageIds = selectedIds.filter(id => id.type === 'image').map(id => id.id);
    setImages(prev => prev.filter(img => !selectedImageIds.includes(img.id)));
    
    // Delete selected strokes
    const selectedStrokeIds = selectedIds.filter(id => id.type === 'stroke').map(id => id.id);
    setStrokes(prev => prev.filter(stroke => !selectedStrokeIds.includes(stroke.id)));
    
    // Delete selected texts
    const selectedTextIds = selectedIds.filter(id => id.type === 'text').map(id => id.id);
    setTexts(prev => prev.filter(text => !selectedTextIds.includes(text.id)));
    
    // Delete selected videos
    const selectedVideoIds = selectedIds.filter(id => id.type === 'video').map(id => id.id);
    setVideos(prev => prev.filter(video => !selectedVideoIds.includes(video.id)));
    
    // Clear selection
    setSelectedIds([]);
    setSelectionRect(null);
  }, [selectedIds, pushToUndoStackWithSave]);

  // Keyboard event listeners for delete functionality and Alt/Option key detection
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt/Option key detection for duplication (works on both Windows/Linux Alt and Mac Option)
      if (e.key === 'Alt' || e.key === 'Meta' || e.altKey) {
        console.log('Alt/Option key pressed:', { key: e.key, altKey: e.altKey, metaKey: e.metaKey });
        setIsAltPressed(true);
      }
      
      // Delete selected items (Delete or Backspace key)
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        handleDeleteSelected();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Alt/Option key release
      if (e.key === 'Alt' || e.key === 'Meta' || !e.altKey) {
        console.log('Alt/Option key released:', { key: e.key, altKey: e.altKey, metaKey: e.metaKey });
        setIsAltPressed(false);
        // Cancel duplication if Alt is released during drag
        if (isDuplicating) {
          setIsDuplicating(false);
          setDuplicateStartPos(null);
          setDuplicateOffset(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isDuplicating, selectedIds.length, handleDeleteSelected]);

  // Call onSelectedImageSrcChange with the data URL of the selected image (if one image is selected), or null if not
    useEffect(() => {
    if (!props.onSelectedImageSrcChange) return;
    const selectedImageIds = selectedIds.filter(sel => sel.type === 'image');
    if (selectedImageIds.length === 1) {
      const imgObj = images.find(img => img.id === selectedImageIds[0].id);
      if (imgObj && imgObj.image) {
        // Create a canvas to get the data URL
        const canvas = document.createElement('canvas');
        canvas.width = imgObj.width || imgObj.image.width;
        canvas.height = imgObj.height || imgObj.image.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imgObj.image, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          props.onSelectedImageSrcChange(dataUrl);
        } else {
          props.onSelectedImageSrcChange(null);
        }
      } else {
        props.onSelectedImageSrcChange(null);
      }
    } else {
      props.onSelectedImageSrcChange(null);
    }
  }, [selectedIds, images]);

  // Call onSelectedVideoSrcChange with the video source URL (if one video is selected), or null if not
  useEffect(() => {
    if (!props.onSelectedVideoSrcChange) return;
    const selectedVideoIds = selectedIds.filter(sel => sel.type === 'video');
    if (selectedVideoIds.length === 1) {
      const videoObj = videos.find(video => video.id === selectedVideoIds[0].id);
      if (videoObj && videoObj.src) {
        props.onSelectedVideoSrcChange(videoObj.src);
      } else {
        props.onSelectedVideoSrcChange(null);
      }
    } else {
      props.onSelectedVideoSrcChange(null);
    }
  }, [selectedIds, videos]);

  // Add state for Sketch mode bounding box
  const [sketchBox, setSketchBox] = useState<null | { x: number, y: number, width: number, height: number }>(null);
  const [sketchBoxDrawing, setSketchBoxDrawing] = useState(false);
  const [sketchBoxStart, setSketchBoxStart] = useState<{ x: number, y: number } | null>(null);
  const sketchBoxRef = useRef<any>(null);
  const sketchBoxTransformerRef = useRef<any>(null);

  // Add state for Render mode bounding box (completely independent)
  const [renderBox, setRenderBox] = useState<null | { x: number, y: number, width: number, height: number }>(null);
  const [renderBoxDrawing, setRenderBoxDrawing] = useState(false);
  const [renderBoxStart, setRenderBoxStart] = useState<{ x: number, y: number } | null>(null);
  const renderBoxRef = useRef<any>(null);
  const renderBoxTransformerRef = useRef<any>(null);

  // Call onRenderBoundingBoxChange whenever renderBox changes
  useEffect(() => {
    if (props.onRenderBoundingBoxChange) {
      props.onRenderBoundingBoxChange(renderBox);
    }
  }, [renderBox]);

  // Manual save function - upload images to Supabase Storage
  const saveBoardContent = useCallback(async (currentImages = images, currentStrokes = strokes, currentTexts = texts, currentVideos = videos) => {
    console.log('🔄 saveBoardContent called');
    console.log('props.onContentChange exists:', !!props.onContentChange);
    console.log('props.boardContent exists:', !!props.boardContent);
    console.log('Current videos state:', currentVideos);
    
    if (!props.onContentChange || !props.boardContent) {
      console.log('❌ saveBoardContent early return - missing required props');
      return;
    }
    
    try {
      // Upload images to Supabase Storage and get URLs
      const serializedImages = await Promise.all(
        currentImages.map(async (img) => {
          if (img.image && !img.error) {
            try {
              // Convert image to blob and upload to storage
              const blob = await imageElementToBlob(img.image, img.width, img.height);
              const imageUrl = await uploadBoardImage(props.boardContent.user_id, props.boardContent.id, img.id, blob);
              
              return {
                id: img.id,
                x: img.x,
                y: img.y,
                width: img.width,
                height: img.height,
                rotation: img.rotation,
                timestamp: img.timestamp,
                src: imageUrl, // Supabase Storage URL
                error: false
              };
            } catch (uploadError) {
              console.error('Failed to upload image:', uploadError);
              return {
                id: img.id,
                x: img.x,
                y: img.y,
                width: img.width,
                height: img.height,
                rotation: img.rotation,
                timestamp: img.timestamp,
                src: null,
                error: true
              };
            }
          } else {
            // Handle images without HTMLImageElement or with errors
            return {
              id: img.id,
              x: img.x,
              y: img.y,
              width: img.width,
              height: img.height,
              rotation: img.rotation,
              timestamp: img.timestamp,
              src: null,
              error: img.error || true
            };
          }
        })
      );

      const videoData = currentVideos.map(video => ({
        id: video.id,
        src: video.src,
        x: video.x,
        y: video.y,
        width: video.width,
        height: video.height,
        rotation: video.rotation,
        timestamp: video.timestamp
      }));
      
      const content = {
        id: props.boardContent.id,
        images: serializedImages,
        videos: videoData,
        strokes: currentStrokes,
        texts: currentTexts,
        viewport: {
          zoom: zoom,
          stagePos: stagePos
        }
      };
      
      console.log('Saving board content with videos:', currentVideos.length);
      console.log('Video data being saved:', videoData);
      console.log('Full content being saved:', content);
      
      // Generate and store thumbnail for fast previews
      try {
        const thumbnail = await ThumbnailGenerator.generateThumbnailFromContent(
          content,
          props.boardContent.id
        );
        ThumbnailGenerator.storeThumbnail(props.boardContent.id, thumbnail);
        console.log('Thumbnail generated and stored:', thumbnail.id);
        
              // Cache the board content for faster future access
      const cacheKey = `board-content:${props.boardContent.id}`;
      DatabaseOptimizer.cacheQuery(cacheKey, content, 300000); // 5 minutes
      
      // Store in advanced cache with tags for better organization
      AdvancedCache.set(cacheKey, content, {
        ttl: 300000, // 5 minutes
        tags: ['board-content', `board-${props.boardContent.id}`, 'user-content']
      });
      
      // Send collaboration event for real-time updates
      CollaborationManager.sendElementUpdate({
        type: 'board-save',
        boardId: props.boardContent.id,
        userId: props.boardContent.user_id,
        timestamp: Date.now(),
        data: content
      });
      } catch (error) {
        console.warn('Thumbnail generation failed:', error);
      }
      
      console.log('🎬 Manually saving board content with storage URLs:', content);
      console.log('🎬 Content videos array length:', content.videos.length);
      console.log('🎬 About to call props.onContentChange');
      props.onContentChange(content);
      console.log('🎬 props.onContentChange called successfully');
    } catch (error) {
      console.error('Error saving board content:', error);
    }
  }, [images, strokes, texts, props.boardContent, props.onContentChange]);

  // Initialize optimizers
  React.useEffect(() => {
    MemoryManager.initialize();
    DatabaseOptimizer.initialize();
    PerformanceMonitor.initialize();
    AdvancedCache.initialize();
    
    // Initialize collaboration if user is authenticated
    if (props.boardContent?.user_id) {
      CollaborationManager.initialize(
        props.boardContent.user_id,
        'User', // Replace with actual user name
        props.boardContent.id
      );
    }
    
    // Initialize Phase 5 services for production deployment (DISABLED FOR NOW)
    // cdnManager.initialize({
    //   imageOptimization: {
    //     quality: 85,
    //     format: 'auto',
    //     maxWidth: 2048,
    //     maxHeight: 2048
    //   },
    //   cacheStrategy: 'balanced'
    // });
    
    // securityManager.initialize({
    //   rateLimiting: {
    //     enabled: true,
    //     maxRequestsPerMinute: 100,
    //     maxRequestsPerHour: 1000,
    //     blockDuration: 15
    //   },
    //   inputValidation: {
    //     enabled: true,
    //     maxStringLength: 10000,
    //     allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    //     maxFileSize: 10 * 1024 * 1024 // 10MB
    //   }
    // });
    
    // productionMonitor.initialize({
    //   enabled: true,
    //   sampleRate: 0.1, // Sample 10% of users
    //   endpoint: 'https://analytics.cotonai.com/metrics',
    //   batchSize: 50,
    //     flushInterval: 30000, // 30 seconds
    //   enableRealUserMonitoring: true,
    //   enableErrorTracking: true,
    //   enablePerformanceTracking: true
    // });
    
    // Initialize load balancer with minimal config for development
    // LoadBalancer.initialize([]); // Disabled until real servers are available
    
    // Completely disable load balancer for development to prevent health check issues
    // LoadBalancer.initialize([]);
    
    return () => {
      MemoryManager.dispose();
      DatabaseOptimizer.dispose();
      PerformanceMonitor.dispose();
      AdvancedCache.dispose();
      CollaborationManager.dispose();
      // LoadBalancer.dispose(); // Disabled to prevent any health check issues
      // cdnManager.dispose();
      // securityManager.dispose();
      // productionMonitor.dispose();
    };
  }, [props.boardContent?.user_id, props.boardContent?.id]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

  // High-resolution bounding box capture (like Miro/Figma frame export)
  const captureHighResBoundingBox = useCallback((bbox: { x: number, y: number, width: number, height: number }, scaleFactor: number = 2) => {
    console.log('🎯 Capturing high-res bounding box:', bbox, 'scale factor:', scaleFactor);
    
    const stage = stageRef.current;
    if (!stage) {
      console.error('❌ No stage reference available');
      return null;
    }

    // Create a temporary high-resolution canvas
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      console.error('❌ Could not get 2D context for high-res capture');
      return null;
    }

    // Set canvas size to bounding box dimensions scaled up
    const scaledWidth = bbox.width * scaleFactor;
    const scaledHeight = bbox.height * scaleFactor;
    tempCanvas.width = scaledWidth;
    tempCanvas.height = scaledHeight;

    // Clear canvas with transparent background
    tempCtx.clearRect(0, 0, scaledWidth, scaledHeight);

    // Store original stage properties
    const originalScaleX = stage.scaleX();
    const originalScaleY = stage.scaleY();
    const originalX = stage.x();
    const originalY = stage.y();

    try {
      // Temporarily adjust stage to focus on bounding box area
      // Reset zoom to 1 and position to show the bounding box area
      stage.scaleX(1);
      stage.scaleY(1);
      stage.x(-bbox.x);
      stage.y(-bbox.y);

      // Force a redraw to ensure the stage is updated
      stage.batchDraw();

      // Get the stage's canvas element
      const stageCanvas = stage.getCanvas();
      if (!stageCanvas) {
        console.error('❌ Could not get stage canvas');
        return null;
      }

      // Draw the stage content to our high-resolution canvas
      // This captures the entire stage at 1x zoom, then we'll crop to bounding box
      tempCtx.drawImage(
        stageCanvas,
        bbox.x, bbox.y, bbox.width, bbox.height, // Source rectangle (bounding box area)
        0, 0, scaledWidth, scaledHeight // Destination rectangle (scaled up)
      );

      // Restore original stage properties
      stage.scaleX(originalScaleX);
      stage.scaleY(originalScaleY);
      stage.x(originalX);
      stage.y(originalY);
      stage.batchDraw();

      // Convert to base64
      const result = tempCanvas.toDataURL('image/png');
      console.log('✅ High-res bounding box captured successfully, data length:', result.length);
      return result;

    } catch (error) {
      console.error('❌ High-res capture failed:', error);
      
      // Restore original stage properties on error
      stage.scaleX(originalScaleX);
      stage.scaleY(originalScaleY);
      stage.x(originalX);
      stage.y(originalY);
      stage.batchDraw();
      
      return null;
    }
  }, [zoom, stagePos]);

  // WYSIWYG export using Konva Stage API (captures images, texts, strokes, etc.)
  const exportWysiwygFromBox = useCallback((box: { x: number, y: number, width: number, height: number }, scaleFactor: number) => {
    const stage = stageRef.current;
    if (!stage) return null;
    // Save original transforms
    const originalScaleX = stage.scaleX();
    const originalScaleY = stage.scaleY();
    const originalX = stage.x();
    const originalY = stage.y();
    try {
      // Reset transforms so box (canvas coords) aligns with stage coords
      stage.scaleX(1);
      stage.scaleY(1);
      stage.x(0);
      stage.y(0);
      stage.batchDraw();

      const dataUrl = stage.toDataURL({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        pixelRatio: Math.max(1, Math.min(4, scaleFactor)),
        mimeType: 'image/png',
        quality: 1
      });
      // Restore transforms
      stage.scaleX(originalScaleX);
      stage.scaleY(originalScaleY);
      stage.x(originalX);
      stage.y(originalY);
      stage.batchDraw();

      if (dataUrl && dataUrl !== 'data:,' && dataUrl.length > 100) {
        return dataUrl;
      }
      return null;
    } catch (err) {
      // Restore on error
      stage.scaleX(originalScaleX);
      stage.scaleY(originalScaleY);
      stage.x(originalX);
      stage.y(originalY);
      stage.batchDraw();
      console.warn('WYSIWYG export failed (likely tainted canvas). Falling back to image-only export.', err);
      return null;
    }
  }, []);

  // Fallback export method that only exports images (no videos) to avoid CORS issues
  const exportImagesOnlyFromRenderBox = useCallback((box: { x: number, y: number, width: number, height: number }) => {
    console.log('🖼️ Using fallback export method for render box:', box);
    console.log('🖼️ Current zoom:', zoom, 'stagePos:', stagePos);
    
    // Box is already in canvas coordinates, no conversion needed
    const canvasBox = box;
    
    console.log('🖼️ Converted to canvas coordinates:', canvasBox);
    
    // Create a temporary canvas for image-only export
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      console.error('Could not get 2D context for fallback export');
      return null;
    }
    
    // Calculate scale factor for high-resolution capture
    const minScaleFactor = 2;
    const zoomBasedScale = Math.max(minScaleFactor, 1 / Math.max(zoom, 0.1));
    const scaleFactor = Math.min(zoomBasedScale, 4); // Cap at 4x to prevent memory issues
    
    // Set canvas dimensions to match the bounding box scaled up for high resolution
    tempCanvas.width = box.width * scaleFactor;
    tempCanvas.height = box.height * scaleFactor;
    
    // Fill with transparent background
    tempCtx.clearRect(0, 0, box.width * scaleFactor, box.height * scaleFactor);
    
    // Debug: Log all images and their positions
    console.log('🖼️ All images in state:', images.map(img => ({
      id: img.id,
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
      hasImage: !!img.image
    })));
    
    // Find all images that intersect with the bounding box (using canvas coordinates)
    const intersectingImages = images.filter(img => {
      if (!img.image) {
        console.log('🖼️ Image has no image element:', img.id);
        return false;
      }
      
      // Check if image intersects with bounding box (canvas coordinates)
      const imgRight = img.x + (img.width || 0);
      const imgBottom = img.y + (img.height || 0);
      const boxRight = canvasBox.x + canvasBox.width;
      const boxBottom = canvasBox.y + canvasBox.height;
      
      const intersects = !(img.x > boxRight || imgRight < canvasBox.x || img.y > boxBottom || imgBottom < canvasBox.y);
      
      console.log('🖼️ Checking image intersection:', {
        id: img.id,
        imgPos: { x: img.x, y: img.y, width: img.width, height: img.height },
        boxPos: { x: canvasBox.x, y: canvasBox.y, width: canvasBox.width, height: canvasBox.height },
        imgRight,
        imgBottom,
        boxRight,
        boxBottom,
        intersects
      });
      
      return intersects;
    });
    
    console.log('🖼️ Found intersecting images:', intersectingImages.length);
    
    if (intersectingImages.length === 0) {
      console.warn('No images found in bounding box area');
      console.warn('Canvas box:', canvasBox);
      console.warn('Available images:', images.length);
      console.warn('Available videos:', videos.length);
      
      // Check if there are videos in the bounding box area
      const intersectingVideos = videos.filter(video => {
        const videoRight = video.x + video.width;
        const videoBottom = video.y + video.height;
        const boxRight = canvasBox.x + canvasBox.width;
        const boxBottom = canvasBox.y + canvasBox.height;
        
        const intersects = !(video.x > boxRight || videoRight < canvasBox.x || video.y > boxBottom || videoBottom < canvasBox.y);
        
        if (intersects) {
          console.log('🎬 Video intersects with bounding box:', {
            id: video.id,
            videoPos: { x: video.x, y: video.y, width: video.width, height: video.height },
            boxPos: { x: canvasBox.x, y: canvasBox.y, width: canvasBox.width, height: canvasBox.height }
          });
        }
        
        return intersects;
      });
      
      if (intersectingVideos.length > 0) {
        console.warn('⚠️ Bounding box contains videos but no images - cannot export due to CORS restrictions');
        console.warn('Please move the bounding box to an area with images only, or remove videos from the bounding box area');
        
        // Create a warning representation instead of a placeholder
        tempCtx.fillStyle = '#FFE066'; // Light yellow for warning
        tempCtx.fillRect(0, 0, box.width * scaleFactor, box.height * scaleFactor);
        
        // Add a border
        tempCtx.strokeStyle = '#FFA500';
        tempCtx.lineWidth = 2 * scaleFactor;
        tempCtx.strokeRect(0, 0, box.width * scaleFactor, box.height * scaleFactor);
        
        // Add warning text
        tempCtx.fillStyle = '#000000';
        tempCtx.font = `${14 * scaleFactor}px Arial`;
        tempCtx.textAlign = 'center';
        tempCtx.fillText('Cannot export videos', (box.width * scaleFactor) / 2, (box.height * scaleFactor) / 2 - 10 * scaleFactor);
        tempCtx.fillText('(CORS restriction)', (box.width * scaleFactor) / 2, (box.height * scaleFactor) / 2 + 10 * scaleFactor);
        
        try {
          const dataURL = tempCanvas.toDataURL('image/png');
          console.log('🖼️ Warning representation created for video area, data length:', dataURL.length);
          return dataURL;
        } catch (error) {
          console.error('Failed to create warning representation:', error);
          return null;
        }
      }
      
      // No images or videos in bounding box - create white background
      console.log('🖼️ No content found in bounding box area - creating white background export');
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, box.width * scaleFactor, box.height * scaleFactor);
      
      // Add a border to make it visible
      tempCtx.strokeStyle = '#CCCCCC';
      tempCtx.lineWidth = 1 * scaleFactor;
      tempCtx.strokeRect(0, 0, box.width * scaleFactor, box.height * scaleFactor);
      
      // Add text to indicate empty area
      tempCtx.fillStyle = '#666666';
      tempCtx.font = `${14 * scaleFactor}px Arial`;
      tempCtx.textAlign = 'center';
      tempCtx.fillText('No images in this area', (box.width * scaleFactor) / 2, (box.height * scaleFactor) / 2);
      
      try {
        const dataURL = tempCanvas.toDataURL('image/png');
        console.log('🖼️ White background export created, data length:', dataURL.length);
        return dataURL;
      } catch (error) {
        console.error('Failed to create white background export:', error);
        return null;
      }
    }
    
    // Compute scale from canvas-space to high-resolution output space
    const scaleX = (box.width * scaleFactor) / canvasBox.width;
    const scaleY = (box.height * scaleFactor) / canvasBox.height;
    
    // Draw each intersecting image onto the temporary canvas matching on-canvas scaling (WYSIWYG)
    intersectingImages.forEach(img => {
      if (!img.image) return;
      
      // Calculate the intersection area (canvas coordinates)
      const imgRight = img.x + (img.width || 0);
      const imgBottom = img.y + (img.height || 0);
      const boxRight = canvasBox.x + canvasBox.width;
      const boxBottom = canvasBox.y + canvasBox.height;
      
      // Calculate the intersection area (canvas coordinates)
      
      const drawX = Math.max(0, img.x - canvasBox.x);
      const drawY = Math.max(0, img.y - canvasBox.y);
      const drawWidth = Math.min(img.width || 0, boxRight - img.x, imgRight - canvasBox.x);
      const drawHeight = Math.min(img.height || 0, boxBottom - img.y, imgBottom - canvasBox.y);
      
      // Calculate source coordinates for the image in source pixel space using natural size mapping
      const naturalW = (img.image as HTMLImageElement).naturalWidth || img.image.width;
      const naturalH = (img.image as HTMLImageElement).naturalHeight || img.image.height;
      const displayW = img.width || naturalW;
      const displayH = img.height || naturalH;
      const scaleToSourceX = naturalW / Math.max(displayW, 1);
      const scaleToSourceY = naturalH / Math.max(displayH, 1);
      const srcX = Math.max(0, canvasBox.x - img.x) * scaleToSourceX;
      const srcY = Math.max(0, canvasBox.y - img.y) * scaleToSourceY;
      const srcW = Math.max(0, drawWidth * scaleToSourceX);
      const srcH = Math.max(0, drawHeight * scaleToSourceY);

      console.log('🖼️ Drawing image:', {
        id: img.id,
        drawPos: { x: drawX, y: drawY, width: drawWidth, height: drawHeight },
        srcPos: { x: srcX, y: srcY }
      });
      
      try {
        tempCtx.drawImage(
          img.image,
          Math.round(srcX), Math.round(srcY), Math.round(srcW), Math.round(srcH),  // Source (source pixels)
          Math.round(drawX * scaleX), Math.round(drawY * scaleY), Math.round(drawWidth * scaleX), Math.round(drawHeight * scaleY) // Dest (output)
        );
      } catch (error) {
        console.warn('Failed to draw image in fallback export:', error);
      }
    });
    
    // Overlay vector content (texts, strokes, frames, etc.) from Konva, while excluding videos and images (already drawn)
    try {
      const stage = stageRef.current;
      if (stage) {
        // Save transform
        const originalScaleX = stage.scaleX();
        const originalScaleY = stage.scaleY();
        const originalX = stage.x();
        const originalY = stage.y();

        // Hide images and videos and optionally grid and bounding boxes
        const hiddenNodes: Array<{ node: any, prevVisible: boolean }> = [];
        const gridNode = layerRef.current?.findOne('#grid-group');
        if (gridNode) {
          hiddenNodes.push({ node: gridNode, prevVisible: gridNode.visible() });
          gridNode.visible(false);
        }
        if (sketchBoxRef.current) {
          hiddenNodes.push({ node: sketchBoxRef.current, prevVisible: sketchBoxRef.current.visible() });
          sketchBoxRef.current.visible(false);
        }
        if (renderBoxRef.current) {
          hiddenNodes.push({ node: renderBoxRef.current, prevVisible: renderBoxRef.current.visible() });
          renderBoxRef.current.visible(false);
        }
        if (sketchBoxTransformerRef.current) {
          hiddenNodes.push({ node: sketchBoxTransformerRef.current, prevVisible: sketchBoxTransformerRef.current.visible() });
          sketchBoxTransformerRef.current.visible(false);
        }
        if (renderBoxTransformerRef.current) {
          hiddenNodes.push({ node: renderBoxTransformerRef.current, prevVisible: renderBoxTransformerRef.current.visible() });
          renderBoxTransformerRef.current.visible(false);
        }
        images.forEach(img => {
          const node = layerRef.current?.findOne(`#img-${img.id}`);
          if (node) {
            hiddenNodes.push({ node, prevVisible: node.visible() });
            node.visible(false);
          }
        });
        videos.forEach(v => {
          const node = layerRef.current?.findOne(`#video-${v.id}`);
          if (node) {
            hiddenNodes.push({ node, prevVisible: node.visible() });
            node.visible(false);
          }
        });

        // Reset transforms to align canvas coords
        stage.scaleX(1);
        stage.scaleY(1);
        stage.x(0);
        stage.y(0);
        stage.batchDraw();

        // Render only vectors to an offscreen canvas synchronously
        let overlayCanvas: HTMLCanvasElement | null = null;
        try {
          // Prefer toCanvas if available for sync draw
          // @ts-ignore - toCanvas may exist on Konva Stage
          overlayCanvas = stage.toCanvas({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            pixelRatio: Math.min(4, Math.max(1, scaleFactor))
          });
        } catch {}

        // Restore nodes and transforms
        hiddenNodes.forEach(({ node, prevVisible }) => node.visible(prevVisible));
        stage.scaleX(originalScaleX);
        stage.scaleY(originalScaleY);
        stage.x(originalX);
        stage.y(originalY);
        stage.batchDraw();

        if (overlayCanvas) {
          // Draw overlay onto temp export canvas
          tempCtx.drawImage(overlayCanvas, 0, 0, box.width * scaleFactor, box.height * scaleFactor);
        }
      }
    } catch (e) {
      console.warn('Vector overlay render failed, continuing with images only.', e);
    }

    // Return the canvas as a data URL
    try {
      const dataURL = tempCanvas.toDataURL('image/png');
      console.log('🖼️ Fallback export successful, data length:', dataURL.length);
      return dataURL;
    } catch (error) {
      console.error('Failed to create data URL from fallback export:', error);
      return null;
    }
  }, [images, zoom, stagePos]);

  // Expose importImageHelper method on ref
  useImperativeHandle(ref, () => ({
    exportCurrentBoundingBoxAsPng: () => {
      // Use sketchBox for Sketch mode, renderBox for Render mode
      const activeBox = props.renderModeActive ? renderBox : sketchBox;
      if (!activeBox) return null;
      
      console.log('🎯 Exporting bounding box (canvas coordinates):', activeBox);
      console.log('🎯 Current zoom:', zoom, 'stagePos:', stagePos);
      console.log('🎯 Videos present on canvas:', videos.length);
      
      // Calculate optimal scale factor based on current zoom level
      // Ensure minimum 2x resolution for crisp export
      const minScaleFactor = 2;
      const zoomBasedScale = Math.max(minScaleFactor, 1 / Math.max(zoom, 0.1));
      const scaleFactor = Math.min(zoomBasedScale, 4); // Cap at 4x to prevent memory issues
      
      console.log('🎯 Using scale factor for high-res capture:', scaleFactor);
      
      // Single method: images-only export (videos are excluded by design)
      return exportImagesOnlyFromRenderBox(activeBox);
    },
    
    exportCurrentRenderBoxAsPng: () => {
      if (!renderBox) return null;
      
      console.log('🎯 Exporting render box (canvas coordinates):', renderBox);
      console.log('🎯 Current zoom:', zoom, 'stagePos:', stagePos);
      console.log('🎯 Videos present on canvas:', videos.length);
      
      // Calculate optimal scale factor based on current zoom level
      // Ensure minimum 2x resolution for crisp export
      const minScaleFactor = 2;
      const zoomBasedScale = Math.max(minScaleFactor, 1 / Math.max(zoom, 0.1));
      const scaleFactor = Math.min(zoomBasedScale, 4); // Cap at 4x to prevent memory issues
      
      console.log('🎯 Using scale factor for high-res capture:', scaleFactor);
      
      // Single method: images-only export (videos are excluded by design)
      return exportImagesOnlyFromRenderBox(renderBox);
    },
    removeImage: (id: string) => {
      console.log('🎬 Removing image with ID:', id);
      setImages(prev => prev.filter(img => img.id !== id));
      console.log('🎬 Image removed successfully');
    },
    importImageHelper: (src: string, x?: number, y?: number, width?: number, height?: number, onLoadId?: (id: string) => void) => {
      // Security validation (DISABLED FOR NOW)
      // const validation = securityManager.validateInput(src, 'string');
      // if (!validation.valid) {
      //   console.error('Image import validation failed:', validation.errors);
      //   return null;
      // }
      
      pushToUndoStackWithSave();
      const img = new window.Image();
      // Avoid tainted canvas: set CORS mode for cross-origin images
      try {
        const isDataUrl = /^data:/i.test(src);
        const isSameOrigin = (() => {
          try {
            const u = new URL(src, window.location.href);
            return u.origin === window.location.origin;
          } catch {
            return true; // data URLs or invalid URLs
          }
        })();
        if (!isDataUrl && !isSameOrigin) {
          img.crossOrigin = 'anonymous';
        }
      } catch {}
      img.src = src;
      const id = Date.now().toString();
      
      img.onload = () => {
        // Calculate viewport center if no coordinates provided
        let imageX = x;
        let imageY = y;
        
        if (x === undefined || y === undefined) {
          const center = getViewportCenter();
          imageX = center.x - (width || 200) / 2;
          imageY = center.y - (height || 200) / 2;
        }
        
        // Calculate dimensions maintaining aspect ratio if not provided
        let imageWidth = width;
        let imageHeight = height;
        
        if (width === undefined || height === undefined) {
          // Maintain original aspect ratio
          const originalWidth = img.naturalWidth;
          const originalHeight = img.naturalHeight;
          
          if (width === undefined && height === undefined) {
            // Neither provided - use original dimensions
            imageWidth = originalWidth;
            imageHeight = originalHeight;
          } else if (width === undefined) {
            // Only height provided - calculate width maintaining aspect ratio
            imageWidth = (originalWidth / originalHeight) * height;
          } else {
            // Only width provided - calculate height maintaining aspect ratio
            imageHeight = (originalHeight / originalWidth) * width;
          }
        }
        
        setImages(prev => [
          ...prev,
          { 
            id, 
            image: img, 
            x: imageX, 
            y: imageY, 
            width: imageWidth, 
            height: imageHeight, 
            rotation: 0, 
            timestamp: Date.now() 
          }
        ]);
        
        if (onLoadId) onLoadId(id);
        
        // Center viewport on the newly imported image if no specific coordinates were provided
        if (x === undefined || y === undefined) {
          setTimeout(() => {
            centerViewportOnElement(imageX, imageY, width || 200, height || 200);
          }, 100);
        }
      };
      
      img.onerror = () => {
        console.error('Failed to load image:', src);
        
        // Calculate viewport center if no coordinates provided
        let imageX = x;
        let imageY = y;
        
        if (x === undefined || y === undefined) {
          const center = getViewportCenter();
          imageX = center.x - (width || 200) / 2;
          imageY = center.y - (height || 200) / 2;
        }
        
        // Calculate dimensions maintaining aspect ratio if not provided (same logic as success case)
        let imageWidth = width;
        let imageHeight = height;
        
        if (width === undefined || height === undefined) {
          // For error case, we don't have img.naturalWidth/Height, so use default with aspect ratio
          if (width === undefined && height === undefined) {
            // Neither provided - use default dimensions
            imageWidth = 200;
            imageHeight = 200;
          } else if (width === undefined) {
            // Only height provided - use default aspect ratio
            imageWidth = height;
            imageHeight = height;
          } else {
            // Only width provided - use default aspect ratio
            imageWidth = width;
            imageHeight = width;
          }
        }
        
        setImages(prev => [
          ...prev,
          { 
            id, 
            image: null, 
            x: imageX, 
            y: imageY, 
            width: imageWidth, 
            height: imageHeight, 
            rotation: 0, 
            timestamp: Date.now(), 
            error: true 
          }
        ]);
        
        if (onLoadId) onLoadId(id);
      };
      
      return id;
    },
    clearSketchBox: () => setSketchBox(null),
    clearRenderBox: () => setRenderBox(null),
    // Expose current pan offset for correct AI image placement
    get stagePos() { return stagePos; },
    // Expose current zoom level
    get zoom() { return zoom; },
    // Expose current bounding box for correct AI image placement
    get sketchBox() { return sketchBox; },
    get renderBox() { return renderBox; },
    // Expose viewport centering functions
    getViewportCenter,
    centerViewportOnElement,
    // Zoom control functions
    resetZoom: () => {
      setZoom(0.8); // Reset to default 80% zoom
      setStagePos({ x: 0, y: 0 });
    },
    fitToViewport: () => {
      // Set zoom to 50% for fit canvas width
      const newZoom = 0.5;
      
      setZoom(newZoom);
      setStagePos({ x: 0, y: 0 });
    },
    zoomIn: () => {
      const newZoom = Math.min(zoom * 1.05, 5); // 5% zoom steps
      setZoom(newZoom);
    },
    zoomOut: () => {
      // Calculate minimum zoom to fit canvas width in viewport
      const minZoomForWidth = viewport.width / boardWidth;
      const newZoom = Math.max(zoom / 1.05, minZoomForWidth); // 5% zoom steps
      setZoom(newZoom);
    },

    replaceSelectedImage: (newSrc: string) => {
      // Find the currently selected image
      const selectedImage = selectedIds.find(sel => sel.type === 'image');
      if (selectedImage) {
        // Use the existing replaceImageById method
        const id = selectedImage.id;
        setImages(prev => {
          const idx = prev.findIndex(img => img.id === id);
          if (idx === -1) return prev;
          const oldImg = prev[idx];
          const newImg = new window.Image();
          // Avoid tainted canvas when replacing images
          try {
            const isDataUrl = /^data:/i.test(newSrc);
            const isSameOrigin = (() => {
              try {
                const u = new URL(newSrc, window.location.href);
                return u.origin === window.location.origin;
              } catch {
                return true;
              }
            })();
            if (!isDataUrl && !isSameOrigin) {
              newImg.crossOrigin = 'anonymous';
            }
          } catch {}
          newImg.src = newSrc;
          const newImageObj = {
            id,
            image: newImg,
            x: oldImg.x,
            y: oldImg.y,
            width: oldImg.width,
            height: oldImg.height,
            rotation: oldImg.rotation,
            timestamp: Date.now()
          };
          newImg.onload = () => {
            setImages(current => [
              ...current.slice(0, idx),
              newImageObj,
              ...current.slice(idx + 1)
            ]);
          };
          // Remove the old image for now (will be replaced on load)
          return prev.filter((_, i) => i !== idx);
        });
      }
    },
    setSelectedIds: (ids: Array<{ id: string, type: 'image' | 'stroke' | 'text' | 'video' }>) => setSelectedIds(ids),
    // Video methods
    getSelectedImage: () => {
      const selectedImage = selectedIds.find(sel => sel.type === 'image');
      if (selectedImage) {
        return images.find(img => img.id === selectedImage.id);
      }
      return null;
    },
    exportSelectedImageAsPng: () => {
      const selectedImage = selectedIds.find(sel => sel.type === 'image');
      if (!selectedImage) return null;
      
      const image = images.find(img => img.id === selectedImage.id);
      if (!image || !image.image) return null;
      
      // Simply return the image data as is - no need for complex canvas export
      return image.image.src;
    },
    importVideo: (src: string, x: number, y: number, width: number, height: number) => {
      console.log('🎬 importVideo called with:', { src, x, y, width, height });
      pushToUndoStackWithSave();
      const id = Date.now().toString();
      
      // Create video element following Konva.js pattern
      const videoElement = document.createElement('video');
      videoElement.crossOrigin = 'anonymous';
      videoElement.src = src;
      videoElement.preload = 'metadata';
      videoElement.muted = true; // Mute to allow autoplay
      videoElement.loop = true; // Loop video for better UX
      
      // Set video dimensions when metadata loads
      videoElement.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded:', src, 'Dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        
        // IMPORTANT: Don't override the desqueezed dimensions!
        // The AI outputs 9:16, but we want to display it at the original input aspect ratio
        // Keep the dimensions that were passed to importVideo (which are desqueezed)
        console.log('🎬 Keeping desqueezed dimensions:', width, 'x', height);
        console.log('🎬 AI output dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        
        // Only update if dimensions weren't explicitly provided (fallback case)
        if (!width || !height) {
          const actualWidth = videoElement.videoWidth;
          const actualHeight = videoElement.videoHeight;
          console.log('🎬 No dimensions provided, using actual video dimensions:', actualWidth, 'x', actualHeight);
          
          setVideos(prev => prev.map(v => 
            v.id === id ? { ...v, width: actualWidth * DISPLAY_SCALE, height: actualHeight * DISPLAY_SCALE } : v
          ));
        } else {
          console.log('🎬 Using provided desqueezed dimensions:', width, 'x', height);
        }
        
        // Immediately capture first frame as thumbnail
        videoElement.currentTime = 0;
        videoElement.addEventListener('seeked', () => {
          // Create canvas to capture first frame
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            ctx.drawImage(videoElement, 0, 0);
            
                              // Create image from canvas
                  const thumbnailImage = new Image();
                  thumbnailImage.onload = () => {
                    // Update video object with thumbnail immediately
                    setVideos(prev => prev.map(v => 
                      v.id === id 
                        ? { ...v, thumbnail: thumbnailImage }
                        : v
                    ));
                    console.log('🎬 Thumbnail generated and applied immediately');
                  };
                  thumbnailImage.src = canvas.toDataURL('image/png');
          }
        }, { once: true });
        
        // Start video animation after all videos are loaded
        if (layerRef.current) {
          startVideoAnimation();
        }
      });
      
      // Handle video loading errors
      videoElement.addEventListener('error', (e) => {
        console.error('Video loading error:', e, src);
      });
      
      const displayWidth = (width || 764) * DISPLAY_SCALE;
      const displayHeight = (height || 1200) * DISPLAY_SCALE;

      const newVideo = {
        id,
        src,
        x,
        y,
        width: displayWidth,
        height: displayHeight,
        rotation: 0,
        timestamp: Date.now(),
        videoElement
      };
      
      console.log('🎬 Creating new video object:', newVideo);
      
      setVideos(prev => {
        const updatedVideos = [...prev, newVideo];
        console.log('🎬 Updated videos state:', updatedVideos);
        return updatedVideos;
      });
      
      // Save board content after adding video
      setTimeout(() => {
        console.log('🎬 Calling saveBoardContent after video import');
        saveBoardContent(imagesRef.current, strokesRef.current, textsRef.current, videosRef.current);
      }, 100);
      
      return id;
    },
    replaceImageById: (id: string, newSrc: string, isVideo: boolean = false, width?: number, height?: number) => {
      if (isVideo) {
        // Handle video replacement - remove placeholder image and add video
        setImages(prev => {
          const idx = prev.findIndex(img => img.id === id);
          if (idx === -1) return prev;
          const oldImg = prev[idx];
          
          // Use the working importVideo method for proper video creation
          if (newSrc) {
            // Create video element following Konva.js pattern
            const videoElement = document.createElement('video');
            videoElement.crossOrigin = 'anonymous';
            videoElement.src = newSrc;
            videoElement.preload = 'metadata';
            videoElement.muted = true;
            videoElement.loop = true;
            
            // Set video dimensions when metadata loads
            videoElement.addEventListener('loadedmetadata', () => {
              console.log('🎬 Video metadata loaded in replaceImageById:', newSrc, 'Dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
              
              // IMPORTANT: Don't override the desqueezed dimensions!
              // Keep the dimensions that were passed to replaceImageById
              console.log('🎬 Keeping provided dimensions in replaceImageById');
              
              // Note: Dimensions are set when creating the video object below
              console.log('🎬 Video metadata loaded, dimensions will be set from video object');
              
              // Immediately capture first frame as thumbnail
              videoElement.currentTime = 0;
              videoElement.addEventListener('seeked', () => {
                // Create canvas to capture first frame
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  canvas.width = videoElement.videoWidth;
                  canvas.height = videoElement.videoHeight;
                  ctx.drawImage(videoElement, 0, 0);
                  
                  // Create image from canvas
                  const thumbnailImage = new Image();
                  thumbnailImage.onload = () => {
                    // Update video object with thumbnail immediately
                    setVideos(prev => prev.map(v => 
                      v.id === `video-${Date.now()}` 
                        ? { ...v, thumbnail: thumbnailImage }
                        : v
                    ));
                    console.log('🎬 Thumbnail generated and applied in replaceImageById');
                  };
                  thumbnailImage.src = canvas.toDataURL('image/png');
                }
              }, { once: true });
              
              // Start video animation after metadata loads
              if (layerRef.current) {
                startVideoAnimation();
              }
            });
            
            // Handle video loading errors
            videoElement.addEventListener('error', (e) => {
              console.error('🎬 Video loading error in replaceImageById:', e, newSrc);
            });
            
            // Add video to videos array with desqueezed dimensions (apply display scaling)
            setVideos(videos => [
              ...videos,
              {
                id: `video-${Date.now()}`,
                src: newSrc,
                x: oldImg.x,
                y: oldImg.y,
                width: ((width || 764) * DISPLAY_SCALE),  // Use provided width (desqueezed) or fallback
                height: ((height || 1200) * DISPLAY_SCALE), // Use provided height (desqueezed) or fallback
                rotation: oldImg.rotation,
                timestamp: Date.now(),
                videoElement
              }
            ]);
          }
          
          // Remove the placeholder image
          return prev.filter((_, i) => i !== idx);
        });
      } else {
        // Handle image replacement (existing logic)
        setImages(prev => {
          const idx = prev.findIndex(img => img.id === id);
          if (idx === -1) return prev;
          const oldImg = prev[idx];
          const newImg = new window.Image();
          newImg.src = newSrc;
          const newImageObj = {
            id,
            image: newImg,
            x: oldImg.x,
            y: oldImg.y,
            width: width || oldImg.width,  // Use provided width or keep old width
            height: height || oldImg.height, // Use provided height or keep old height
            rotation: oldImg.rotation,
            timestamp: Date.now()
          };
          newImg.onload = () => {
            setImages(current => [
              ...current.slice(0, idx),
              newImageObj,
              ...current.slice(idx + 1)
            ]);
          };
          // Remove the old image for now (will be replaced on load)
          return prev.filter((_, i) => i !== idx);
        });
      }
    },
    // Expose manual save function
    saveBoardContent,
    undo: handleUndo,
    redo: handleRedo,
  }), [sketchBox, renderBox, stageRef, stagePos, zoom, getViewportCenter, centerViewportOnElement, screenToCanvas, props.renderModeActive, saveBoardContent, handleUndo, handleRedo, images, selectedIds, videos]);

  // Only load board content when board ID changes
  const lastBoardIdRef = useRef<string | null>(null);
    useEffect(() => {
    console.log('🎬 Board content useEffect triggered');
    console.log('🎬 props.boardContent:', props.boardContent);
    console.log('🎬 lastBoardIdRef.current:', lastBoardIdRef.current);
    
    if (!props.boardContent) {
      console.log('🎬 No board content, clearing all content');
      // Clear all content when no board is selected (during overlays)
      setImages([]);
      setVideos([]);
      setStrokes([]);
      setTexts([]);
      lastBoardIdRef.current = null;
      return;
    }
    
    // Check if we have a valid board content object with the expected structure
    if (props.boardContent && lastBoardIdRef.current !== props.boardContent.id) {
      console.log('🎬 Loading board content for ID:', props.boardContent.id);
      console.log('🎬 Board content object:', props.boardContent);
      PerformanceMonitor.startBoardLoad();
      
      // Load strokes and texts directly
      setStrokes(props.boardContent.strokes || []);
      setTexts(props.boardContent.texts || []);
      
      // Load images with incremental loading and priority
      const loadImages = async () => {
        PerformanceMonitor.startImageLoad();
        const imageData = props.boardContent.images || [];
        
        // First, set placeholder images for all (fast initial render)
        const placeholderImages = imageData.map(imgData => ({
          id: imgData.id,
          image: null, // Will be loaded lazily
          x: imgData.x,
          y: imgData.y,
          width: imgData.width,
          height: imgData.height,
          rotation: imgData.rotation,
          timestamp: imgData.timestamp,
          error: false,
          loading: true // Mark as loading
        }));
        
        setImages(placeholderImages);
        
        // Use incremental loader for better performance
        if (imageData.length > 10) {
          // Large board - use incremental loading
          const viewportCenter = getViewportCenter();
          
          IncrementalLoader.loadImagesWithPriority(
            imageData,
            viewportCenter,
            (loadedImage, index) => {
              setImages(prev => prev.map((imgItem, i) => 
                i === index ? { ...imgItem, image: loadedImage.image, loading: false, error: loadedImage.error } : imgItem
              ));
            }
          );
        } else {
          // Small board - load normally with delays
          imageData.forEach(async (imgData, index) => {
            if (imgData.src && !imgData.error) {
              try {
                // Use memory manager for image pooling
                const img = MemoryManager.getImage(imgData.id);
                
                img.onload = () => {
                  setImages(prev => prev.map((imgItem, i) => 
                    i === index ? { ...imgItem, image: img, loading: false } : imgItem
                  ));
                };
                
                img.onerror = () => {
                  console.error('Failed to load image from storage:', imgData.src);
                  setImages(prev => prev.map((imgItem, i) => 
                    i === index ? { ...imgItem, error: true, loading: false } : imgItem
                  ));
                  // Return image to pool on error
                  MemoryManager.returnImage(imgData.id);
                };
                
                // Add small delay between loads to prevent overwhelming the browser
                setTimeout(() => {
                  // Use CDN optimization for better performance (DISABLED FOR NOW)
                  // const optimizedSrc = cdnManager.getOptimizedImageUrl(imgData.src, {
                  //   quality: 85,
                  //   format: 'webp'
                  // });
                  // img.src = optimizedSrc;
                  img.src = imgData.src; // Use original source for now
                }, index * 25); // Reduced to 25ms for better performance
                
              } catch (error) {
                console.error('Error loading image:', error);
                setImages(prev => prev.map((imgItem, i) => 
                  i === index ? { ...imgItem, error: true, loading: false } : imgItem
                ));
              }
            } else {
              // Handle images without src or with errors
              setImages(prev => prev.map((imgItem, i) => 
                i === index ? { ...imgItem, error: true, loading: false } : imgItem
              ));
            }
          });
        }
      };
      
      loadImages().finally(() => {
        PerformanceMonitor.endImageLoad();
      });
      
      // Load videos and recreate video elements
      const videoData = props.boardContent.videos || [];
      console.log('🎬 Loading video data from board:', videoData);
      console.log('🎬 Board content videos property:', props.boardContent.videos);
      console.log('🎬 Board content keys:', Object.keys(props.boardContent));
      console.log('🎬 Board content ID:', props.boardContent.id);
      console.log('🎬 Board content type:', typeof props.boardContent.videos);
      console.log('🎬 Board content videos length:', props.boardContent.videos?.length);
      
      if (videoData.length > 0) {
        console.log('🎬 Found video data, creating video elements...');
        const videosWithElements = videoData.map((videoData, index) => {
          console.log(`🎬 Creating video element ${index + 1}:`, videoData);
          
          const videoElement = document.createElement('video');
          videoElement.crossOrigin = 'anonymous';
          videoElement.src = videoData.src;
          videoElement.preload = 'metadata';
          videoElement.muted = true;
          videoElement.loop = true;
          
          // Handle video loading
          videoElement.addEventListener('loadedmetadata', () => {
            console.log('🎬 Video metadata loaded from board:', videoData.src);
            console.log('🎬 Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
            
            // Capture first frame as thumbnail
            videoElement.currentTime = 0;
            videoElement.addEventListener('seeked', () => {
              // Create canvas to capture first frame
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (ctx) {
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                ctx.drawImage(videoElement, 0, 0);
                
                // Create image from canvas
                const thumbnailImage = new Image();
                thumbnailImage.onload = () => {
                  // Update video object with thumbnail
                  setVideos(prev => prev.map(v => 
                    v.id === videoData.id 
                      ? { ...v, thumbnail: thumbnailImage }
                      : v
                  ));
                };
                thumbnailImage.src = canvas.toDataURL('image/png');
              }
            }, { once: true });
            
            // Start animation after all videos are loaded
            if (layerRef.current) {
              startVideoAnimation();
            }
          });
          
          // Handle video errors
          videoElement.addEventListener('error', (e) => {
            console.error('🎬 Video loading error from board:', e, videoData.src);
          });
          
          return { ...videoData, videoElement };
        });
        
        console.log('🎬 Created videos with elements:', videosWithElements);
        setVideos(videosWithElements);
        console.log('🎬 Set videos state with', videosWithElements.length, 'videos');
      } else {
        console.log('🎬 No videos to load from board');
        setVideos([]);
      }
      
      // Restore viewport state if it exists, otherwise center new board
      if (props.boardContent.viewport) {
        // Restore saved viewport position
        setZoom(props.boardContent.viewport.zoom);
        setStagePos(props.boardContent.viewport.stagePos);
        console.log('Restored viewport state:', props.boardContent.viewport);
      } else {
        // New board - use default 80% zoom and center viewport on canvas
        setZoom(0.8); // Always start at 80% zoom
        
        // Center the viewport on the canvas for new boards
        const canvasCenterX = boardWidth / 2;
        const canvasCenterY = boardHeight / 2;
        const newStagePosX = (viewport.width / 2) - (canvasCenterX * 0.8);
        const newStagePosY = (viewport.height / 2) - (canvasCenterY * 0.8);
        
        setStagePos({ x: newStagePosX, y: newStagePosY });
        console.log('New board - using default 80% zoom and centered viewport');
      }
      
      lastBoardIdRef.current = props.boardContent.id;
      PerformanceMonitor.endBoardLoad();
    }
  }, [props.boardContent]);

  // Clamp stage position so you can't pan outside the board
  function clampStagePos(pos: {x: number, y: number}) {
    // Calculate the board size in screen coordinates (considering zoom)
    const boardWidthScaled = boardWidth * zoom;
    const boardHeightScaled = boardHeight * zoom;
    
    // Only clamp when zoomed in (canvas is larger than viewport)
    // When zoomed out, allow free positioning to prevent unwanted centering
    if (boardWidthScaled > viewport.width || boardHeightScaled > viewport.height) {
      // Canvas is larger than viewport - apply bounds to prevent panning outside
      const minX = viewport.width - boardWidthScaled;
      const minY = viewport.height - boardHeightScaled;
      const maxX = 0;
      const maxY = 0;
      
      return {
        x: clamp(pos.x, minX, maxX),
        y: clamp(pos.y, minY, maxY)
      };
    } else {
      // Canvas is smaller than viewport - no need to clamp, allow free positioning
      return pos;
    }
  }

  // Generate unique ID for duplicated items
  const generateUniqueId = useCallback(() => {
    return `duplicate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Duplicate board items function
  const duplicateBoardItems = useCallback((offsetX: number, offsetY: number) => {
    if (selectedIds.length === 0) return;

    const newItems: { images: any[], videos: any[], texts: any[], strokes: any[] } = {
      images: [],
      videos: [],
      texts: [],
      strokes: []
    };

    // Duplicate selected items
    selectedIds.forEach(sel => {
      if (sel.type === 'image') {
        const img = images.find(i => i.id === sel.id);
        if (img) {
          const newImage = {
            ...img,
            id: generateUniqueId(),
            x: img.x + offsetX,
            y: img.y + offsetY,
            timestamp: Date.now()
          };
          newItems.images.push(newImage);
        }
      } else if (sel.type === 'video') {
        const video = videos.find(v => v.id === sel.id);
        if (video) {
          const newVideo = {
            ...video,
            id: generateUniqueId(),
            x: video.x + offsetX,
            y: video.y + offsetY,
            timestamp: Date.now()
          };
          newItems.videos.push(newVideo);
        }
      } else if (sel.type === 'text') {
        const txt = texts.find(t => t.id === sel.id);
        if (txt) {
          const newText = {
            ...txt,
            id: generateUniqueId(),
            x: txt.x + offsetX,
            y: txt.y + offsetY,
            timestamp: Date.now()
          };
          newItems.texts.push(newText);
        }
      } else if (sel.type === 'stroke') {
        const stroke = strokes.find(s => s.id === sel.id);
        if (stroke) {
          const newStroke = {
            ...stroke,
            id: generateUniqueId(),
            x: stroke.x + offsetX,
            y: stroke.y + offsetY,
            timestamp: Date.now()
          };
          newItems.strokes.push(newStroke);
        }
      }
    });

    // Add duplicated items to state
    if (newItems.images.length > 0) {
      setImages(prev => [...prev, ...newItems.images]);
    }
    if (newItems.videos.length > 0) {
      setVideos(prev => [...prev, ...newItems.videos]);
    }
    if (newItems.texts.length > 0) {
      setTexts(prev => [...prev, ...newItems.texts]);
    }
    if (newItems.strokes.length > 0) {
      setStrokes(prev => [...prev, ...newItems.strokes]);
    }

    // Update selection to the new duplicated items
    const newSelectedIds = [
      ...newItems.images.map(img => ({ id: img.id, type: 'image' as const })),
      ...newItems.videos.map(video => ({ id: video.id, type: 'video' as const })),
      ...newItems.texts.map(txt => ({ id: txt.id, type: 'text' as const })),
      ...newItems.strokes.map(stroke => ({ id: stroke.id, type: 'stroke' as const }))
    ];
    setSelectedIds(newSelectedIds);

    console.log('Duplicated items:', newItems);
  }, [selectedIds, images, videos, texts, strokes, generateUniqueId]);

  // Wheel event handler for zooming
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const scaleBy = 1.02; // Set to 1.02 for 2% zoom steps
    const oldScale = zoom;
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // Calculate minimum zoom to fit canvas width in viewport
    const minZoomForWidth = viewport.width / boardWidth;
    
    // Clamp zoom between width-fit minimum and 5x maximum
    const clampedScale = Math.max(minZoomForWidth, Math.min(5, newScale));
    
    // Calculate the point under the mouse in canvas coordinates
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    
    // Calculate new stage position to keep the mouse point in the same screen position
    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };
    
    // Update both zoom and stage position to zoom relative to mouse cursor
    setZoom(clampedScale);
    setStagePos(clampStagePos(newPos));
  };



  // Mouse down: start drawing (brush tool) or panning (hand tool)
  const handleMouseDown = (e: any) => {
    // Check for Alt/Option+drag duplication (check both state and event)
    const isAltHeld = isAltPressed || e.evt.altKey;
    console.log('Mouse down:', { 
      isAltPressed, 
      evtAltKey: e.evt.altKey, 
      isAltHeld, 
      selectedTool: props.selectedTool, 
      selectedIdsLength: selectedIds.length 
    });
    
    if (isAltHeld && props.selectedTool === 'select' && selectedIds.length > 0) {
      const stage = stageRef.current;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      
      console.log('Starting Alt+drag duplication');
      setIsDuplicating(true);
      setDuplicateStartPos({ x: pointer.x, y: pointer.y });
      setDuplicateOffset({ x: 0, y: 0 });
      return;
    }

    if (props.selectedTool === 'hand') {
      setIsDragging(true);
      setLastPos({
        x: e.evt.clientX,
        y: e.evt.clientY
      });
    } else if (props.selectedTool === 'frame') {
      const stage = stageRef.current;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      setFrameDrawing(true);
      const start = screenToCanvas(pointer.x, pointer.y);
      setFrameStart(start);
      const id = Date.now().toString();
      setCurrentFrame({ id, x: start.x, y: start.y, width: 0, height: 0 });
    } else if (props.selectedTool === 'draw') {
      const stage = stageRef.current;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      setDrawing(true);
      const id = Date.now().toString();
      
      // Convert screen coordinates to canvas coordinates
      const canvasPos = screenToCanvas(pointer.x, pointer.y);
      
      setCurrentStroke({
        id,
        points: [canvasPos.x, canvasPos.y],
        color: props.brushColor,
        size: props.brushSize,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        timestamp: Date.now()
      });
    }
  };

  // Mouse move: update stage position (hand tool) or add points (brush tool)
  const handleMouseMove = (e: any) => {
    // Handle Alt+drag duplication
    if (isDuplicating && duplicateStartPos) {
      const stage = stageRef.current;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      
      const offsetX = (pointer.x - duplicateStartPos.x) / zoom;
      const offsetY = (pointer.y - duplicateStartPos.y) / zoom;
      setDuplicateOffset({ x: offsetX, y: offsetY });
      return;
    }

    if (props.selectedTool === 'hand' && isDragging && lastPos) {
      const dx = e.evt.clientX - lastPos.x;
      const dy = e.evt.clientY - lastPos.y;
      setStagePos(prev => clampStagePos({ x: prev.x + dx, y: prev.y + dy }));
      setLastPos({ x: e.evt.clientX, y: e.evt.clientY });
    } else if (props.selectedTool === 'frame' && frameDrawing && frameStart) {
      const stage = stageRef.current;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const pos = screenToCanvas(pointer.x, pointer.y);
      const x = Math.min(frameStart.x, pos.x);
      const y = Math.min(frameStart.y, pos.y);
      const width = Math.abs(pos.x - frameStart.x);
      const height = Math.abs(pos.y - frameStart.y);
      setCurrentFrame(prev => prev ? { ...prev, x, y, width, height } : prev);
    } else if (props.selectedTool === 'draw' && drawing && currentStroke) {
      const stage = stageRef.current;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      
      // Convert screen coordinates to canvas coordinates
      const canvasPos = screenToCanvas(pointer.x, pointer.y);
      
      setCurrentStroke({
        ...currentStroke,
        points: [...currentStroke.points, canvasPos.x, canvasPos.y]
      });
    }
  };

  // Mouse up: stop drawing (brush tool) or panning (hand tool)
  const handleMouseUp = () => {
    // Handle Alt+drag duplication completion
    if (isDuplicating && duplicateOffset) {
      duplicateBoardItems(duplicateOffset.x, duplicateOffset.y);
      setIsDuplicating(false);
      setDuplicateStartPos(null);
      setDuplicateOffset(null);
      return;
    }

    if (props.selectedTool === 'hand') {
      setIsDragging(false);
      setLastPos(null);
    } else if (props.selectedTool === 'frame' && frameDrawing && currentFrame) {
      const width = Math.max(20, currentFrame.width);
      const height = Math.max(20, currentFrame.height);
      const id = currentFrame.id;
      const allTimestamps = [
        ...images.map(i => i.timestamp),
        ...strokes.map(s => s.timestamp),
        ...texts.map(t => t.timestamp),
        ...videos.map(v => v.timestamp)
      ];
      const minExistingTimestamp = allTimestamps.length > 0 ? Math.min(...allTimestamps) : Date.now();
      const frameTimestamp = minExistingTimestamp - 1;
      // Auto-name: Frame N
      const nextIndex = frames.length + 1;
      setFrames(prev => [...prev, { id, name: `Frame ${nextIndex}`, x: currentFrame.x, y: currentFrame.y, width, height, rotation: 0, timestamp: frameTimestamp }]);
      setSelectedIds([{ id, type: 'frame' }]);
      setFrameDrawing(false);
      setFrameStart(null);
      setCurrentFrame(null);
    } else if (props.selectedTool === 'draw' && drawing && currentStroke) {
      // Calculate bounding box for the stroke
      const xs = currentStroke.points.filter((_, i) => i % 2 === 0);
      const ys = currentStroke.points.filter((_, i) => i % 2 === 1);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      
      // Ensure the new stroke gets a timestamp newer than all existing items
      const imageTimestamps = images.map(img => img.timestamp);
      const strokeTimestamps = strokes.map(stroke => stroke.timestamp);
      const allTimestamps = [...imageTimestamps, ...strokeTimestamps];
      
      // If no existing items, use current time, otherwise use max + 1
      const maxTimestamp = allTimestamps.length > 0 ? Math.max(...allTimestamps) : Date.now();
      const newTimestamp = maxTimestamp + 1;
      
      console.log('Adding stroke with timestamp:', newTimestamp, 'max existing:', maxTimestamp);
      
      pushToUndoStackWithSave();
      setStrokes(prev => [
        ...prev,
        {
          ...currentStroke,
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          points: currentStroke.points.map((p, i) => i % 2 === 0 ? p - minX : p - minY),
          timestamp: newTimestamp
        }
      ]);
      setDrawing(false);
      setCurrentStroke(null);
    }
  };

  // Select image (select tool only)
  const handleImageClick = (id: string) => {
    if (props.selectedTool === 'select') {
      setSelectedIds(prev => {
        if (prev.some(sel => sel.id === id && sel.type === 'image')) {
          // Remove from selection
          return prev.filter(sel => !(sel.id === id && sel.type === 'image'));
        } else {
          // Add to selection
          return [...prev, { id, type: 'image' }];
        }
      });
    }
  };

  // Select stroke (select tool only)
  const handleStrokeClick = (id: string) => {
    if (props.selectedTool === 'select') {
      setSelectedIds(prev => {
        if (prev.some(sel => sel.id === id && sel.type === 'stroke')) {
          // Remove from selection
          return prev.filter(sel => !(sel.id === id && sel.type === 'stroke'));
        } else {
          // Add to selection
          return [...prev, { id, type: 'stroke' }];
        }
      });
    }
  };

  // Add text tool logic

  // Selection helpers
  const isSelected = (id: string, type: 'frame' | 'image' | 'stroke' | 'text' | 'video') => selectedIds.some(sel => sel.id === id && sel.type === type);

  // Handle click on image/stroke/text/video
  const handleItemClick = (id: string, type: 'frame' | 'image' | 'stroke' | 'text' | 'video', evt: any) => {
    if (props.selectedTool !== 'select') return;
    const isMulti = evt.evt.shiftKey || evt.evt.ctrlKey || evt.evt.metaKey;
    if (isMulti) {
      setSelectedIds(prev => {
        if (prev.some(sel => sel.id === id && sel.type === type)) {
          // Remove from selection
          return prev.filter(sel => !(sel.id === id && sel.type === type));
        } else {
          // Add to selection
          return [...prev, { id, type }];
        }
      });
    } else {
      setSelectedIds([{ id, type }]);
    }
  };

  // Multi-select: start selection rectangle or temporary pan mode
  const handleStageMouseDown = (e: any) => {
    // Check if middle mouse button is pressed (button 1)
    const isMiddleButton = e.evt.button === 1;
    const shouldPan = isMiddleButton;
    
    if (props.selectedTool === 'select' && e.target === e.target.getStage()) {
      if (shouldPan) {
        // Enter temporary pan mode
        setIsTemporaryPanMode(true);
        setTemporaryPanStart({
          x: e.evt.clientX,
          y: e.evt.clientY
        });
        setSelectionStart(null);
        setSelectionRect(null);
      } else {
        // Start selection rectangle
        const stage = stageRef.current;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        
        // Convert screen coordinates to canvas coordinates
        const canvasPos = screenToCanvas(pointer.x, pointer.y);
        
        setSelectionStart(canvasPos);
        setSelectionRect({ x: canvasPos.x, y: canvasPos.y, width: 0, height: 0 });
        setSelectedIds([]);
      }
    } else {
      handleMouseDown(e);
    }
  };

  // Multi-select: update selection rectangle or temporary pan mode
  const handleStageMouseMove = (e: any) => {
    if (isTemporaryPanMode && temporaryPanStart) {
      // Handle temporary pan mode
      const dx = e.evt.clientX - temporaryPanStart.x;
      const dy = e.evt.clientY - temporaryPanStart.y;
      setStagePos(prev => clampStagePos({ x: prev.x + dx, y: prev.y + dy }));
      setTemporaryPanStart({ x: e.evt.clientX, y: e.evt.clientY });
    } else if (selectionStart && selectionRect) {
      // Update selection rectangle
      const stage = stageRef.current;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      
      // Convert screen coordinates to canvas coordinates
      const canvasPos = screenToCanvas(pointer.x, pointer.y);
      
      setSelectionRect({
        x: Math.min(selectionStart.x, canvasPos.x),
        y: Math.min(selectionStart.y, canvasPos.y),
        width: Math.abs(canvasPos.x - selectionStart.x),
        height: Math.abs(canvasPos.y - selectionStart.y)
      });
    } else {
      handleMouseMove(e);
    }
  };

  // Multi-select: finish selection rectangle or exit temporary pan mode
  const handleStageMouseUp = (e: any) => {
    if (isTemporaryPanMode) {
      // Exit temporary pan mode
      setIsTemporaryPanMode(false);
      setTemporaryPanStart(null);
    } else if (selectionRect && selectionStart) {
      // Find all items that intersect the selection rectangle
              const selected: Array<{ id: string, type: 'image' | 'stroke' | 'text' | 'video' }> = [];
      images.forEach(img => {
        if (
          img.x + (img.width || 200) > selectionRect.x &&
          img.x < selectionRect.x + selectionRect.width &&
          img.y + (img.height || 200) > selectionRect.y &&
          img.y < selectionRect.y + selectionRect.height
        ) {
          selected.push({ id: img.id, type: 'image' });
        }
      });
      strokes.forEach(stroke => {
        if (
          stroke.x + stroke.width > selectionRect.x &&
          stroke.x < selectionRect.x + selectionRect.width &&
          stroke.y + stroke.height > selectionRect.y &&
          stroke.y < selectionRect.y + selectionRect.height
        ) {
          selected.push({ id: stroke.id, type: 'stroke' });
        }
      });
      texts.forEach(txt => {
        if (
          txt.x + txt.fontSize > selectionRect.x &&
          txt.x < selectionRect.x + selectionRect.width &&
          txt.y + txt.fontSize > selectionRect.y &&
          txt.y < selectionRect.y + selectionRect.height
        ) {
          selected.push({ id: txt.id, type: 'text' });
        }
      });
      setSelectedIds(selected);
      setSelectionRect(null);
      setSelectionStart(null);
    } else {
      handleMouseUp();
    }
  };

  // Multi-select: drag group
  const handleGroupDragStart = (e: any, id: string, type: 'image' | 'stroke' | 'text' | 'video') => {
    // Prevent normal dragging when Alt/Option is pressed (duplication mode)
    const isAltHeld = isAltPressed || e.evt.altKey;
    if (isAltHeld) {
      e.cancelBubble = true;
      return;
    }
    
    if (props.selectedTool === 'select' && isSelected(id, type)) {
      const items = selectedIds.map(sel => {
        if (sel.type === 'image') {
          const img = images.find(i => i.id === sel.id);
          return img ? { id: sel.id, type: 'image', x: img.x, y: img.y } : null;
        } else if (sel.type === 'stroke') {
          const stroke = strokes.find(s => s.id === sel.id);
          return stroke ? { id: sel.id, type: 'stroke', x: stroke.x, y: stroke.y } : null;
        } else {
          const txt = texts.find(t => t.id === sel.id);
          return txt ? { id: sel.id, type: 'text', x: txt.x, y: txt.y } : null;
        }
              }).filter(Boolean) as Array<{ id: string, type: 'image' | 'stroke' | 'text' | 'video', x: number, y: number }>; 
      setGroupDragStart({ x: e.target.x(), y: e.target.y(), items });
    }
  };
  const handleGroupDragMove = (e: any, id: string, type: 'image' | 'stroke' | 'text' | 'video') => {
    // Prevent normal dragging when Alt/Option is pressed (duplication mode)
    const isAltHeld = isAltPressed || e.evt.altKey;
    if (isAltHeld) {
      e.cancelBubble = true;
      return;
    }
    
    if (groupDragStart) {
      const dx = e.target.x() - groupDragStart.x;
      const dy = e.target.y() - groupDragStart.y;
      setImages(prev => prev.map(img => {
        const sel = selectedIds.find(s => s.id === img.id && s.type === 'image');
        if (sel) {
          const orig = groupDragStart.items.find(i => i.id === img.id && i.type === 'image');
          if (orig) return { ...img, x: orig.x + dx, y: orig.y + dy };
        }
        return img;
      }));
      setStrokes(prev => prev.map(stroke => {
        const sel = selectedIds.find(s => s.id === stroke.id && s.type === 'stroke');
        if (sel) {
          const orig = groupDragStart.items.find(i => i.id === stroke.id && i.type === 'stroke');
          if (orig) return { ...stroke, x: orig.x + dx, y: orig.y + dy };
        }
        return stroke;
      }));
      setTexts(prev => prev.map(txt => {
        const sel = selectedIds.find(s => s.id === txt.id && s.type === 'text');
        if (sel) {
          const orig = groupDragStart.items.find(i => i.id === txt.id && i.type === 'text');
          if (orig) return { ...txt, x: orig.x + dx, y: orig.y + dy };
        }
        return txt;
      }));
    }
  };
  const handleGroupDragEnd = () => {
    // Prevent normal drag end when Alt/Option is pressed (duplication mode)
    if (isAltPressed) {
      return;
    }
    
    // On group drag end, snap selected items
    if (groupDragStart && selectedIds.length > 0) {
      selectedIds.forEach(sel => {
        if (sel.type === 'image') {
          const img = images.find(i => i.id === sel.id);
          if (img) {
            const snapped = applySnapToFrame({ x: img.x, y: img.y, width: img.width || 200, height: img.height || 200 }, undefined);
            setImages(prev => prev.map(i => i.id === img.id ? { ...i, x: snapped.x, y: snapped.y } : i));
          }
        } else if (sel.type === 'text') {
          const txt = texts.find(t => t.id === sel.id);
          if (txt) {
            const snapped = applySnapToFrame({ x: txt.x, y: txt.y, width: measureTextWidth(txt.text, txt.fontSize, "Gilroy, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"), height: txt.fontSize * 1.2 }, undefined);
            setTexts(prev => prev.map(t => t.id === txt.id ? { ...t, x: snapped.x, y: snapped.y } : t));
          }
        } else if (sel.type === 'stroke') {
          const stroke = strokes.find(s => s.id === sel.id);
          if (stroke) {
            const snapped = applySnapToFrame({ x: stroke.x, y: stroke.y, width: stroke.width, height: stroke.height }, undefined);
            setStrokes(prev => prev.map(s => s.id === stroke.id ? { ...s, x: snapped.x, y: snapped.y } : s));
          }
        } else if (sel.type === 'video') {
          const video = videos.find(v => v.id === sel.id);
          if (video) {
            const snapped = applySnapToFrame({ x: video.x, y: video.y, width: video.width, height: video.height }, undefined);
            setVideos(prev => prev.map(v => v.id === video.id ? { ...v, x: snapped.x, y: snapped.y } : v));
          }
        } else if (sel.type === 'frame') {
          const frame = frames.find(f => f.id === sel.id);
          if (frame) {
            const snapped = applySnapToFrame({ x: frame.x, y: frame.y, width: frame.width, height: frame.height }, frame.id);
            setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, x: snapped.x, y: snapped.y } : f));
          }
        }
      });
    }
    setGroupDragStart(null);
  };

  // Update image position/size/rotation after transform
  const handleTransformEndImage = (id: string, node: any) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotation = node.rotation();
    const x = node.x();
    const y = node.y();
    const width = Math.max(20, node.width() * scaleX);
    const height = Math.max(20, node.height() * scaleY);
    const snapped = applySnapToFrame({ x, y, width, height }, undefined);
    setImages(prev => prev.map(img => img.id === id ? { ...img, x: snapped.x, y: snapped.y, width: snapped.width, height: snapped.height, rotation } : img));
    node.scaleX(1);
    node.scaleY(1);
  };

  // Update stroke position/size/rotation after transform
  const handleTransformEndStroke = (id: string, node: any) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotation = node.rotation();
    const x = node.x();
    const y = node.y();
    const newWidth = Math.max(20, node.width() ? node.width() * scaleX : (strokes.find(s => s.id === id)?.width || 20) * scaleX);
    const newHeight = Math.max(20, node.height() ? node.height() * scaleY : (strokes.find(s => s.id === id)?.height || 20) * scaleY);
    const snapped = applySnapToFrame({ x, y, width: newWidth, height: newHeight }, undefined);
    setStrokes(prev => prev.map(stroke => stroke.id === id ? { ...stroke, x: snapped.x, y: snapped.y, width: snapped.width, height: snapped.height, points: stroke.points.map((p, i) => i % 2 === 0 ? p * scaleX : p * scaleY), rotation } : stroke));
    node.scaleX(1);
    node.scaleY(1);
  };

  // Attach Transformer to all selected nodes
  React.useEffect(() => {
    if (transformerRef.current && selectedIds.length > 0) {
      const nodes = selectedIds.map(sel => {
        if (sel.type === 'frame') {
          return layerRef.current.findOne(`#frame-${sel.id}`);
        } else if (sel.type === 'image') {
          return layerRef.current.findOne(`#img-${sel.id}`);
        } else if (sel.type === 'stroke') {
          return layerRef.current.findOne(`#stroke-${sel.id}`);
        } else if (sel.type === 'text') {
          return layerRef.current.findOne(`#text-${sel.id}`);
        } else if (sel.type === 'video') {
          return layerRef.current.findOne(`#video-${sel.id}`);
        }
        return null;
      }).filter(Boolean);
      transformerRef.current.nodes(nodes);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedIds, images, strokes, texts, videos, frames]);

  // Delete selected items
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        pushToUndoStackWithSave();
        setFrames(prev => prev.filter(frame => !selectedIds.some(sel => sel.id === frame.id && sel.type === 'frame')));
        setImages(prev => prev.filter(img => !selectedIds.some(sel => sel.id === img.id && sel.type === 'image')));
        setStrokes(prev => prev.filter(stroke => !selectedIds.some(sel => sel.id === stroke.id && sel.type === 'stroke')));
        setTexts(prev => prev.filter(txt => !selectedIds.some(sel => sel.id === txt.id && sel.type === 'text')));
        setVideos(prev => prev.filter(video => !selectedIds.some(sel => sel.id === video.id && sel.type === 'video')));
        setSelectedIds([]);
      }
      // Allow deleting the bounding box with Delete/Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && sketchBox) {
        setSketchBox(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, sketchBox, pushToUndoStackWithSave]);

  // Debug: log the timestamps
  console.log('All items timestamps:', images.map(item => ({ id: item.id, type: 'image', timestamp: item.timestamp })).concat(strokes.map(item => ({ id: item.id, type: 'stroke', timestamp: item.timestamp }))));

  // Helper function to measure text width more accurately
  const measureTextWidth = (text: string, fontSize: number, fontFamily: string) => {
    // Create a temporary canvas to measure text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return text.length * fontSize * 0.6; // Fallback
    
    context.font = `${fontSize}px ${fontFamily}`;
    return context.measureText(text).width;
  };
  
  // Native canvas text editing - NO HTML overlays!
  const handleTextDblClick = (txt: any) => {
    if (editingText) return; // Only one at a time
    
    // Clear any existing selection
    setSelectedIds([]);
    
    // Set editing state with cursor position at the end
    setEditingText({
      id: txt.id,
      value: txt.text,
      x: txt.x,
      y: txt.y,
      color: txt.color,
      fontSize: txt.fontSize,
      rotation: txt.rotation || 0,
      cursorPosition: txt.text.length, // Start at end of text
      selectionStart: 0,
      selectionEnd: txt.text.length,
    });
    
    // Focus the stage for keyboard input
    const stageForEdit = stageRef.current;
    if (stageForEdit) {
      stageForEdit.container().focus();
    }
  };
  
  // Handle click outside to exit text editing
  const handleStageClick = (e: any) => {
    // If we're editing text and clicked outside the text, exit editing
    if (editingText && e.target === e.target.getStage()) {
      // Only exit if text has content, otherwise keep editing
      if (editingText.value.trim() !== '') {
        setEditingText(null);
        if (props.onTextAdded) props.onTextAdded();
      }
      return;
    }
    
    // If we're editing text and clicked on a different text element, exit current editing
    if (editingText && e.target.id() && e.target.id().startsWith('text-') && e.target.id() !== `text-${editingText.id}`) {
      // Only exit if text has content, otherwise keep editing
      if (editingText.value.trim() !== '') {
        setEditingText(null);
        if (props.onTextAdded) props.onTextAdded();
      }
      // Don't return here, let the click handler continue to select the new text
    }
    
    // Original stage click logic
    if (props.selectedTool === 'text') {
      if (editingText) return;
      const stage = stageRef.current;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const canvasPos = screenToCanvas(pointer.x, pointer.y);
      const id = Date.now().toString();
      pushToUndoStackWithSave();
      setTexts(prev => [
        ...prev,
        {
          id,
          text: '', // Start with blank text
          x: canvasPos.x,
          y: canvasPos.y,
          color: props.textColor || '#FF0000',
          fontSize: 32,
          rotation: 0,
          timestamp: Date.now()
        }
      ]);
      
      // Immediately enter native edit mode for the new text
      setEditingText({
        id,
        value: '', // Start with blank text
        x: canvasPos.x,
        y: canvasPos.y,
        color: props.textColor || '#FF0000',
        fontSize: 32,
        rotation: 0,
        cursorPosition: 0, // Start at beginning of blank text
        selectionStart: 0,
        selectionEnd: 0,
      });
      
      // Select the new text
      setSelectedIds([{ id, type: 'text' }]);
      
      // Focus the stage for keyboard input
      const stageForFocus = stageRef.current;
      if (stageForFocus) {
        stageForFocus.container().focus();
      }
      
      return;
    }
    if (props.selectedTool === 'select' && e.target === e.target.getStage()) {
      setSelectedIds([]);
    }
  };

  // Text editing is now handled inline, no need for click outside handlers

  // Handle mouse events for sketch mode bounding box
  const handleSketchBoxMouseDown = (e: any) => {
    if (!props.sketchModeActive) return;
    if (sketchBox) return; // Only one at a time
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    // Convert screen coordinates to canvas coordinates
    const canvasPos = screenToCanvas(pointer.x, pointer.y);
    
    setSketchBoxDrawing(true);
    setSketchBoxStart({ x: canvasPos.x, y: canvasPos.y });
    setSketchBox({ x: canvasPos.x, y: canvasPos.y, width: 1, height: 1 });
  };
  
  const handleSketchBoxMouseMove = (e: any) => {
    if (!props.sketchModeActive) return;
    if (!sketchBoxDrawing || !sketchBoxStart) return;
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    // Convert screen coordinates to canvas coordinates
    const canvasPos = screenToCanvas(pointer.x, pointer.y);
    
    const x = Math.min(sketchBoxStart.x, canvasPos.x);
    const y = Math.min(sketchBoxStart.y, canvasPos.y);
    const width = Math.abs(canvasPos.x - sketchBoxStart.x);
    const height = Math.abs(canvasPos.y - sketchBoxStart.y);
    setSketchBox({ x, y, width, height });
  };
  const handleSketchBoxMouseUp = (e: any) => {
    if (!props.sketchModeActive) return;
    if (!sketchBoxDrawing) return;
    setSketchBoxDrawing(false);
    setSketchBoxStart(null);
  };
  // Handle transform (move/resize) of bounding box
  const handleSketchBoxTransform = (e: any) => {
    if (!props.sketchModeActive) return;
    const node = sketchBoxRef.current;
    if (!node) return;
    const x = node.x();
    const y = node.y();
    const width = Math.max(10, node.width() * node.scaleX());
    const height = Math.max(10, node.height() * node.scaleY());
    setSketchBox({ x, y, width, height });
    node.scaleX(1);
    node.scaleY(1);
  };

  // Add a function to clear the bounding box
  const clearSketchBox = () => {
    setSketchBox(null);
    setSketchBoxDrawing(false);
    setSketchBoxStart(null);
  };

  // Render mode bounding box handlers (completely independent)
  const handleRenderBoxMouseDown = (e: any) => {
    if (!props.renderModeActive) return;
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    // Convert screen coordinates to canvas coordinates
    const canvasPos = screenToCanvas(pointer.x, pointer.y);
    
    setRenderBoxDrawing(true);
    setRenderBoxStart({ x: canvasPos.x, y: canvasPos.y });
    
    // Clear any existing render box
    setRenderBox(null);
  };

  const handleRenderBoxMouseMove = (e: any) => {
    if (!props.renderModeActive || !renderBoxDrawing || !renderBoxStart) return;
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    // Convert screen coordinates to canvas coordinates
    const canvasPos = screenToCanvas(pointer.x, pointer.y);
    
    const x = Math.min(renderBoxStart.x, canvasPos.x);
    const y = Math.min(renderBoxStart.y, canvasPos.y);
    const width = Math.abs(canvasPos.x - renderBoxStart.x);
    const height = Math.abs(canvasPos.y - renderBoxStart.y);
    
    setRenderBox({ x, y, width, height });
  };

  const handleRenderBoxMouseUp = (e: any) => {
    if (!props.renderModeActive || !renderBoxDrawing) return;
    e.evt.preventDefault();
    setRenderBoxDrawing(false);
    setRenderBoxStart(null);
  };

  const handleRenderBoxTransform = (e: any) => {
    if (!props.renderModeActive) return;
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotation = node.rotation();
    
    setRenderBox({
      x: node.x(),
      y: node.y(),
      width: Math.max(20, node.width() * scaleX),
      height: Math.max(20, node.height() * scaleY)
    });
    
    node.scaleX(1);
    node.scaleY(1);
  };

  const clearRenderBox = () => {
    setRenderBox(null);
    setRenderBoxDrawing(false);
    setRenderBoxStart(null);
  };

  // Display scale for newly added media (images/videos) to keep board light
  const DISPLAY_SCALE = 0.2;

  // Drag and drop functionality
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  // Helper function to import image using the existing importImage logic
  const importImageHelper = useCallback((src: string, x?: number, y?: number, width?: number, height?: number, onLoadId?: (id: string) => void) => {
    console.log('🎯 importImageHelper called with:', { src: src.substring(0, 50) + '...', x, y, width, height });
    pushToUndoStackWithSave();
    const img = new window.Image();
    // Avoid tainted canvas: set CORS mode for cross-origin images
    try {
      const isDataUrl = /^data:/i.test(src);
      const isSameOrigin = (() => {
        try {
          const u = new URL(src, window.location.href);
          return u.origin === window.location.origin;
        } catch {
          return true; // data URLs or invalid URLs
        }
      })();
      if (!isDataUrl && !isSameOrigin) {
        img.crossOrigin = 'anonymous';
      }
    } catch {}
    img.src = src;
    const id = Date.now().toString();
    
    img.onload = () => {
      console.log('🎯 Image loaded successfully, natural dimensions:', img.naturalWidth, 'x', img.naturalHeight);
      // Calculate viewport center if no coordinates provided
      let imageX = x;
      let imageY = y;
      
      if (x === undefined || y === undefined) {
        const center = getViewportCenter();
        imageX = center.x - (width || 200) / 2;
        imageY = center.y - (height || 200) / 2;
      }
      
      // Calculate dimensions maintaining aspect ratio if not provided
      let imageWidth = width;
      let imageHeight = height;
      
      if (width === undefined || height === undefined) {
        // Maintain original aspect ratio
        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;
        
        if (width === undefined && height === undefined) {
          // Neither provided - use original dimensions
          imageWidth = originalWidth;
          imageHeight = originalHeight;
        } else if (width === undefined) {
          // Only height provided - calculate width maintaining aspect ratio
          imageWidth = (originalWidth / originalHeight) * height;
        } else {
          // Only width provided - calculate height maintaining aspect ratio
          imageHeight = (originalHeight / originalWidth) * width;
        }
      }
      
      // Apply display scaling for lighter on-canvas representation
      if (imageWidth !== undefined && imageHeight !== undefined) {
        imageWidth = imageWidth * DISPLAY_SCALE;
        imageHeight = imageHeight * DISPLAY_SCALE;
      }

      console.log('🎯 Adding image to state:', { id, x: imageX, y: imageY, width: imageWidth, height: imageHeight });
      setImages(prev => [
        ...prev,
        { 
          id, 
          image: img, 
          x: imageX, 
          y: imageY, 
          width: imageWidth, 
          height: imageHeight, 
          rotation: 0, 
          timestamp: Date.now() 
        }
      ]);
      
      if (onLoadId) onLoadId(id);
      
      // Center viewport on the newly imported image if no specific coordinates were provided
      if (x === undefined || y === undefined) {
        setTimeout(() => {
          centerViewportOnElement(imageX, imageY, width || 200, height || 200);
        }, 100);
      }
    };
    
    img.onerror = () => {
      console.error('Failed to load image:', src);
      
      // Calculate viewport center if no coordinates provided
      let imageX = x;
      let imageY = y;
      
      if (x === undefined || y === undefined) {
        const center = getViewportCenter();
        imageX = center.x - (width || 200) / 2;
        imageY = center.y - (height || 200) / 2;
      }
      
      // Calculate dimensions maintaining aspect ratio if not provided (same logic as success case)
      let imageWidth = width;
      let imageHeight = height;
      
      if (width === undefined || height === undefined) {
        // For error case, we don't have img.naturalWidth/Height, so use default with aspect ratio
        if (width === undefined && height === undefined) {
          // Neither provided - use default dimensions
          imageWidth = 200;
          imageHeight = 200;
        } else if (width === undefined) {
          // Only height provided - use default aspect ratio
          imageWidth = height;
          imageHeight = height;
        } else {
          // Only width provided - use default aspect ratio
          imageWidth = width;
          imageHeight = width;
        }
      }
      // Apply display scaling for lighter on-canvas representation
      if (imageWidth !== undefined && imageHeight !== undefined) {
        imageWidth = imageWidth * DISPLAY_SCALE;
        imageHeight = imageHeight * DISPLAY_SCALE;
      }
      
      setImages(prev => [
        ...prev,
        { 
          id, 
          image: null, 
          x: imageX, 
          y: imageY, 
          width: imageWidth, 
          height: imageHeight, 
          rotation: 0, 
          timestamp: Date.now(), 
          error: true 
        }
      ]);
      
      if (onLoadId) onLoadId(id);
    };
    
    return id;
  }, [pushToUndoStackWithSave, getViewportCenter, centerViewportOnElement]);

  // Helper function to validate image URLs
  const isValidImageUrl = useCallback((url: string): boolean => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(pathname) || 
             urlObj.hostname.includes('imgur') || 
             urlObj.hostname.includes('unsplash') ||
             urlObj.hostname.includes('pixabay');
    } catch {
      return false;
    }
  }, []);

  // Handle external image URLs
  const handleExternalImageUrl = useCallback((url: string, e: React.DragEvent) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const canvasPos = screenToCanvas(pointer.x, pointer.y);

    // Create image with CORS handling
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Convert to data URL for consistency
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/png');
      importImageHelper(dataUrl, canvasPos.x, canvasPos.y, img.width, img.height);
    };

    img.onerror = () => {
      console.warn('Failed to load external image:', url);
    };

    img.src = url;
  }, [screenToCanvas]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    
    // Update drag position for visual feedback
    const rect = e.currentTarget.getBoundingClientRect();
    setDragPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide if leaving the entire canvas area
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer?.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      // Check for URL data (from browser, other apps)
      const url = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
      if (url && isValidImageUrl(url)) {
        handleExternalImageUrl(url, e);
        return;
      }
      console.log('No valid image files or URLs found in drop');
      return;
    }

    // Convert drop coordinates to canvas coordinates
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const canvasPos = screenToCanvas(pointer.x, pointer.y);

    // Process each image file
    console.log('🎯 Processing dropped files:', imageFiles.length);
    imageFiles.forEach((file, index) => {
      console.log('🎯 Processing file:', file.name, file.type);
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          console.log('🎯 File loaded, importing image at position:', canvasPos);
          // Stagger positioning for multiple images
          const offsetX = index * 50;
          const offsetY = index * 50;
          const result = importImageHelper(dataUrl, canvasPos.x + offsetX, canvasPos.y + offsetY);
          console.log('🎯 Import result:', result);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [screenToCanvas, handleExternalImageUrl]);


  // Paste functionality
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    e.preventDefault();
    
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    
    if (imageItems.length === 0) return;

    const stage = stageRef.current;
    if (!stage) return;

    // Get viewport center for paste position
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    const canvasPos = screenToCanvas(centerX, centerY);

    for (let i = 0; i < imageItems.length; i++) {
      const item = imageItems[i];
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (dataUrl) {
            // Stagger positioning for multiple images
            const offsetX = i * 50;
            const offsetY = i * 50;
            importImageHelper(dataUrl, canvasPos.x + offsetX, canvasPos.y + offsetY);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }, [screenToCanvas, viewport]);

  // Add global paste handler
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Only handle paste when canvas is focused or no input is focused
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.contentEditable === 'true') {
        return;
      }
      handlePaste(e);
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [handlePaste]);

    return (
    <div 
      className={`fixed inset-0 z-0 overflow-hidden ${props.className || ''}`} 
      style={{ background: '#1E1E1E' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay for visual feedback */}
      {isDragOver && (
        <div 
          className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
          style={{ background: 'rgba(59, 130, 246, 0.1)' }}
        >
          <div className="bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg border-2 border-dashed border-blue-400">
            📁 Drop images here
          </div>
        </div>
      )}
      
      <Stage
        width={viewport.width}
        height={viewport.height}
        ref={stageRef}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, cursor: 
          isDuplicating ? 'copy' :
          isTemporaryPanMode ? 'grabbing' : 
          props.selectedTool === 'hand' && isDragging ? 'grabbing' : 
          props.selectedTool === 'hand' ? 'grab' : 
          props.selectedTool === 'draw' ? 'crosshair' : 
          'default' 
        }}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={zoom}
        scaleY={zoom}
        draggable={false}
        onWheel={handleWheel}
        onMouseDown={props.sketchModeActive ? handleSketchBoxMouseDown : props.renderModeActive ? handleRenderBoxMouseDown : handleStageMouseDown}
        onTouchStart={props.sketchModeActive ? handleSketchBoxMouseDown : props.renderModeActive ? handleRenderBoxMouseDown : handleStageMouseDown}
        onMouseMove={props.sketchModeActive ? handleSketchBoxMouseMove : props.renderModeActive ? handleRenderBoxMouseMove : handleStageMouseMove}
        onTouchMove={props.sketchModeActive ? handleSketchBoxMouseMove : props.renderModeActive ? handleRenderBoxMouseMove : handleStageMouseMove}
                  onMouseUp={props.sketchModeActive ? handleSketchBoxMouseUp : props.renderModeActive ? handleRenderBoxMouseUp : handleStageMouseUp}
          onTouchEnd={props.sketchModeActive ? handleSketchBoxMouseUp : props.renderModeActive ? handleRenderBoxMouseUp : handleStageMouseUp}
          onMouseLeave={() => {
            // Exit temporary pan mode if mouse leaves the stage
            if (isTemporaryPanMode) {
              setIsTemporaryPanMode(false);
              setTemporaryPanStart(null);
            }
          }}
        onClick={handleStageClick}
      >
        <Layer ref={layerRef} width={boardWidth} height={boardHeight}>
          {/* Draw grid lines */}
          <Group id="grid-group">
            {gridLines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke="#333"
                strokeWidth={0.5}
                listening={false}
              />
            ))}
          </Group>
          {/* Render frames at the very bottom (oldest to newest) */}
          {frames
            .slice()
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(frame => (
              <Group
                key={frame.id}
                id={`frame-${frame.id}`}
                x={frame.x}
                y={frame.y}
                rotation={frame.rotation || 0}
                draggable={props.selectedTool === 'select' && isSelected(frame.id, 'frame') && !isAltPressed}
                onClick={evt => handleItemClick(frame.id, 'frame', evt)}
                onTap={evt => handleItemClick(frame.id, 'frame', evt)}
                onDragEnd={e => {
                  const { x, y } = e.target.position();
                  const snapped = applySnapToFrame({ x, y, width: frame.width, height: frame.height }, frame.id);
                  setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, x: snapped.x, y: snapped.y } : f));
                }}
                onTransformEnd={e => {
                  const node = e.target;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  const rotation = node.rotation();
                  const x = node.x();
                  const y = node.y();
                  const newDims = { width: Math.max(20, frame.width * scaleX), height: Math.max(20, frame.height * scaleY) };
                  const snapped = applySnapToFrame({ x, y, width: newDims.width, height: newDims.height }, frame.id);
                  setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, x: snapped.x, y: snapped.y, width: snapped.width, height: snapped.height, rotation } : f));
                  node.scaleX(1);
                  node.scaleY(1);
                }}
              >
                <Rect
                  x={0}
                  y={0}
                  width={frame.width}
                  height={frame.height}
                  fill="#ffffff"
                  stroke="#cccccc"
                  strokeWidth={1}
                  shadowColor="#000000"
                  shadowBlur={2}
                />
                {/* Title label */}
                <KonvaText
                  text={frame.name || ''}
                  x={8}
                  y={8}
                  fontSize={16}
                  fontFamily="Gilroy, sans-serif"
                  fill="#111111"
                  onDblClick={() => {
                    const newName = prompt('Rename frame', frame.name || '');
                    if (newName !== null) {
                      setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, name: newName } : f));
                    }
                  }}
                  onDblTap={() => {
                    const newName = prompt('Rename frame', frame.name || '');
                    if (newName !== null) {
                      setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, name: newName } : f));
                    }
                  }}
                />
              </Group>
            ))}

          {/* Preview current frame while creating */}
          {currentFrame && props.selectedTool === 'frame' && frameDrawing && (
            <Rect
              x={currentFrame.x}
              y={currentFrame.y}
              width={currentFrame.width}
              height={currentFrame.height}
              fill="rgba(255,255,255,0.6)"
              stroke="#cccccc"
              strokeWidth={1}
              listening={false}
            />
          )}
          
          {/* Show empty state message when no board is selected */}
          {!props.boardContent && (
            <KonvaText
              x={boardWidth / 2 - 200}
              y={boardHeight / 2 - 50}
              text="Select a board to start creating"
              fontSize={24}
              fill="#666"
              fontFamily="Gilroy, sans-serif"
              align="center"
              listening={false}
            />
          )}
          
          {/* Render all images first (oldest to newest) */}
          {images
            .slice()
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(img => (
              img.error ? (
                <Rect
                  key={img.id}
                  x={img.x}
                  y={img.y}
                  width={img.width || 200}
                  height={img.height || 200}
                  fill="#ff3333"
                  cornerRadius={16}
                  shadowBlur={8}
                  shadowColor="#000"
                  stroke="#fff"
                  strokeWidth={2}
                />
              ) : (
                <KonvaImage
                  key={img.id}
                  id={`img-${img.id}`}
                  image={img.image}
                  x={img.x}
                  y={img.y}
                  width={img.width || 200}
                  height={img.height || 200}
                  rotation={img.rotation || 0}
                  opacity={img.loading ? 0.3 : 1} // Show loading state
                  draggable={props.selectedTool === 'select' && isSelected(img.id, 'image') && !isAltPressed}
                  onClick={evt => handleItemClick(img.id, 'image', evt)}
                  onTap={evt => handleItemClick(img.id, 'image', evt)}
                  onDragEnd={e => {
                    pushToUndoStackWithSave();
                    const { x, y } = e.target.position();
                    const snapped = applySnapToFrame({ x, y, width: img.width || 200, height: img.height || 200 }, undefined);
                    setImages(prev => prev.map(im => im.id === img.id ? { ...im, x: snapped.x, y: snapped.y } : im));
                    handleGroupDragEnd();
                  }}
                  onTransformEnd={e => handleTransformEndImage(img.id, e.target)}
                  onDragStart={e => handleGroupDragStart(e, img.id, 'image')}
                  onDragMove={e => handleGroupDragMove(e, img.id, 'image')}
                />
              )
            ))}
          
          {/* Render all videos after images (oldest to newest) */}
          {console.log('Rendering videos:', videos)}
          {videos
            .slice()
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(video => (
                              <Group
                  key={video.id}
                  id={`video-${video.id}`}
                  x={video.x}
                  y={video.y}
                  rotation={video.rotation || 0}
                  draggable={props.selectedTool === 'select' && isSelected(video.id, 'video') && !isAltPressed}
                  transformable={props.selectedTool === 'select' && isSelected(video.id, 'video')}
                  onClick={evt => handleItemClick(video.id, 'video', evt)}
                  onTap={evt => handleItemClick(video.id, 'video', evt)}
                  onDragEnd={e => {
                    pushToUndoStackWithSave();
                    const { x, y } = e.target.position();
                    const snapped = applySnapToFrame({ x, y, width: video.width, height: video.height }, undefined);
                    setVideos(prev => prev.map(v => v.id === video.id ? { ...v, x: snapped.x, y: snapped.y } : v));
                    handleGroupDragEnd();
                  }}
                  onTransformEnd={e => {
                    pushToUndoStackWithSave();
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    const rotation = node.rotation();
                    const x = node.x();
                    const y = node.y();
                    const newWidth = Math.max(20, video.width * scaleX);
                    const newHeight = Math.max(20, video.height * scaleY);
                    const snapped = applySnapToFrame({ x, y, width: newWidth, height: newHeight }, undefined);
                    setVideos(prev => prev.map(v => v.id === video.id ? { ...v, x: snapped.x, y: snapped.y, width: snapped.width, height: snapped.height, rotation } : v));
                    node.scaleX(1);
                    node.scaleY(1);
                  }}
                  onDragStart={e => handleGroupDragStart(e, video.id, 'video')}
                  onDragMove={e => handleGroupDragMove(e, video.id, 'video')}
                >

                {video.videoElement ? (
                  video.thumbnail ? (
                    // Show thumbnail when video is paused/not playing
                    <KonvaImage
                      image={video.thumbnail}
                      width={video.width}
                      height={video.height}
                      cornerRadius={8}
                    />
                  ) : (
                    // Show live video when playing and no thumbnail yet
                    <KonvaImage
                      image={video.videoElement}
                      width={video.width}
                      height={video.height}
                      cornerRadius={8}
                    />
                  )
                ) : video.thumbnail ? (
                  // Show thumbnail when video element not ready
                  <KonvaImage
                    image={video.thumbnail}
                    width={video.width}
                    height={video.height}
                    cornerRadius={8}
                  />
                ) : (
                  // Show loading placeholder while thumbnail generates
                  <Rect
                    x={0}
                    y={0}
                    width={video.width}
                    height={video.height}
                    fill="#f0f0f0"
                    stroke="#ccc"
                    strokeWidth={1}
                    cornerRadius={8}
                  />
                )}
                
                {/* Selection border - always visible but changes color */}
                <Rect
                  x={0}
                  y={0}
                  width={video.width}
                  height={video.height}
                  fill="transparent"
                  stroke={isSelected(video.id, 'video') ? "#E1FF00" : "transparent"}
                  strokeWidth={3}
                  cornerRadius={8}
                  listening={false}
                />
                                 {/* Video controls overlay - no click functionality */}
                 <Rect
                   x={0}
                   y={0}
                   width={video.width}
                   height={video.height}
                   fill="transparent"
                 />
                 
                 {/* Simple Play/Pause icon with consistent sizing and dark color */}
                 <KonvaText
                   x={15}
                   y={15}
                   text={video.videoElement && !video.videoElement.paused ? "⏸" : "▶"}
                   fontSize={24}
                   fill="#1A1A1A"
                   align="center"
                   fontFamily="Arial, sans-serif"
                   onClick={() => {
                     if (video.videoElement) {
                       if (video.videoElement.paused) {
                         video.videoElement.play();
                       } else {
                         video.videoElement.pause();
                       }
                     }
                   }}
                 />
              </Group>
            ))}
          
          {/* Render all texts after images (oldest to newest) */}
          {texts
            .slice()
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(txt => (
              <Group key={txt.id}>
                {/* Main text */}
                <KonvaText
                  id={`text-${txt.id}`}
                  text={txt.text || ' '} // Show space for empty text to maintain clickable area
                  x={txt.x}
                  y={txt.y}
                  fontSize={txt.fontSize}
                  fontFamily="Gilroy, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                  fill={txt.text ? txt.color : 'transparent'} // Make empty text transparent
                  draggable={props.selectedTool === 'select' && isSelected(txt.id, 'text') && !isAltPressed}
                  rotation={txt.rotation}
                  // Show text normally
                  opacity={1}
                  // Add subtle highlight when text tool is active or when editing
                  shadowColor={props.selectedTool === 'text' || (editingText && editingText.id === txt.id) ? 'rgba(225,255,0,0.3)' : 'transparent'}
                  shadowBlur={props.selectedTool === 'text' || (editingText && editingText.id === txt.id) ? 8 : 0}
                  shadowOffset={{ x: 0, y: 0 }}
                  stroke="transparent"
                  strokeWidth={0}
                  onClick={evt => handleItemClick(txt.id, 'text', evt)}
                  onTap={evt => handleItemClick(txt.id, 'text', evt)}
                  onDblClick={() => handleTextDblClick(txt)}
                  onDblTap={() => handleTextDblClick(txt)}
                  onDragEnd={e => {
                    pushToUndoStackWithSave();
                    const { x, y } = e.target.position();
                    const widthApprox = measureTextWidth(txt.text, txt.fontSize, "Gilroy, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
                    const snapped = applySnapToFrame({ x, y, width: widthApprox, height: txt.fontSize * 1.2 }, undefined);
                    setTexts(prev => prev.map(t => t.id === txt.id ? { ...t, x: snapped.x, y: snapped.y } : t));
                    handleGroupDragEnd();
                  }}
                  onTransformEnd={e => {
                    pushToUndoStackWithSave();
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    const rotation = node.rotation();
                    const x = node.x();
                    const y = node.y();
                    const newFontSize = Math.max(10, txt.fontSize * scaleY);
                    const widthApprox = measureTextWidth(txt.text, newFontSize, "Gilroy, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
                    const snapped = applySnapToFrame({ x, y, width: widthApprox, height: newFontSize * 1.2 }, undefined);
                    setTexts(prev => prev.map(t => t.id === txt.id ? { ...t, x: snapped.x, y: snapped.y, fontSize: newFontSize, rotation } : t));
                    node.scaleX(1);
                    node.scaleY(1);
                  }}
                  onDragStart={e => handleGroupDragStart(e, txt.id, 'text')}
                  onDragMove={e => handleGroupDragMove(e, txt.id, 'text')}
                />
                
                {/* Text selection highlight */}
                {editingText && editingText.id === txt.id && editingText.selectionStart !== editingText.selectionEnd && (() => {
                  // Calculate selection highlight for multi-line text
                  const textLines = editingText.value.split('\n');
                  const startPos = editingText.selectionStart;
                  const endPos = editingText.selectionEnd;
                  const lineHeight = txt.fontSize * 1.2;
                  
                  // Find start and end lines
                  let startLine = 0;
                  let startChar = startPos;
                  let endLine = 0;
                  let endChar = endPos;
                  
                  // Find start line and character
                  for (let i = 0; i < textLines.length; i++) {
                    if (startChar <= textLines[i].length) {
                      startLine = i;
                      break;
                    }
                    startChar -= textLines[i].length + 1;
                  }
                  
                  // Find end line and character
                  for (let i = 0; i < textLines.length; i++) {
                    if (endChar <= textLines[i].length) {
                      endLine = i;
                      break;
                    }
                    endChar -= textLines[i].length + 1;
                  }
                  
                  // Render selection highlights for each line
                  const highlights = [];
                  
                  if (startLine === endLine) {
                    // Single line selection
                    const textBeforeSelection = textLines[startLine].substring(0, startChar);
                    const selectedText = textLines[startLine].substring(startChar, endChar);
                    const textBeforeWidth = measureTextWidth(textBeforeSelection, txt.fontSize, "Gilroy, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
                    const selectionWidth = measureTextWidth(selectedText, txt.fontSize, "Gilroy, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
                    
                    highlights.push(
                      <Rect
                        key={`selection-${startLine}`}
                        x={txt.x + textBeforeWidth}
                        y={txt.y + (startLine * lineHeight)}
                        width={selectionWidth}
                        height={txt.fontSize}
                        fill="rgba(0, 123, 255, 0.3)"
                        rotation={txt.rotation}
                      />
                    );
                  } else {
                    // Multi-line selection
                    for (let line = startLine; line <= endLine; line++) {
                      let lineStart = 0;
                      let lineEnd = textLines[line].length;
                      
                      if (line === startLine) {
                        lineStart = startChar;
                      }
                      if (line === endLine) {
                        lineEnd = endChar;
                      }
                      
                      const textBeforeSelection = textLines[line].substring(0, lineStart);
                      const selectedText = textLines[line].substring(lineStart, lineEnd);
                      const textBeforeWidth = measureTextWidth(textBeforeSelection, txt.fontSize, "Gilroy, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
                      const selectionWidth = measureTextWidth(selectedText, txt.fontSize, "Gilroy, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
                      
                      highlights.push(
                        <Rect
                          key={`selection-${line}`}
                          x={txt.x + textBeforeWidth}
                          y={txt.y + (line * lineHeight)}
                          width={selectionWidth}
                          height={txt.fontSize}
                          fill="rgba(0, 123, 255, 0.3)"
                          rotation={txt.rotation}
                        />
                      );
                    }
                  }
                  
                  return highlights;
                })()}
                
                {/* Custom caret for native editing */}
                {editingText && editingText.id === txt.id && caretVisible && (() => {
                  // Calculate caret position for multi-line text
                  const textLines = editingText.value.split('\n');
                  let currentLine = 0;
                  let currentChar = editingText.cursorPosition;
                  
                  // Find which line the cursor is on
                  for (let i = 0; i < textLines.length; i++) {
                    if (currentChar <= textLines[i].length) {
                      currentLine = i;
                      break;
                    }
                    currentChar -= textLines[i].length + 1; // +1 for the newline character
                  }
                  
                  // Use accurate text measurement for caret positioning
                  const textBeforeCursor = textLines[currentLine].substring(0, currentChar);
                  const textWidth = measureTextWidth(textBeforeCursor, txt.fontSize, "Gilroy, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
                  const lineHeight = txt.fontSize * 1.2; // Better line height for multi-line
                  
                  // Calculate caret position with proper vertical alignment
                  const caretX = txt.x + textWidth;
                  const caretY = txt.y + (currentLine * lineHeight); // Remove offset for better alignment
                  
                  return (
                    <Line
                      points={[
                        caretX,
                        caretY,
                        caretX,
                        caretY + txt.fontSize
                      ]}
                      stroke={txt.color}
                      strokeWidth={2}
                      rotation={txt.rotation}
                      lineCap="round"
                      lineJoin="round"
                    />
                  );
                })()}
              </Group>
            ))}
          {/* Render all strokes after images (oldest to newest) */}
          {strokes
            .slice()
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(stroke => (
              <Line
                key={stroke.id}
                id={`stroke-${stroke.id}`}
                points={stroke.points}
                x={stroke.x}
                y={stroke.y}
                stroke={stroke.color}
                strokeWidth={stroke.size}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                draggable={props.selectedTool === 'select' && isSelected(stroke.id, 'stroke') && !isAltPressed}
                rotation={stroke.rotation}
                onClick={evt => handleItemClick(stroke.id, 'stroke', evt)}
                onTap={evt => handleItemClick(stroke.id, 'stroke', evt)}
                onDragEnd={e => {
                  pushToUndoStackWithSave();
                  const { x, y } = e.target.position();
                  const snapped = applySnapToFrame({ x, y, width: stroke.width, height: stroke.height }, undefined);
                  setStrokes(prev => prev.map(s => s.id === stroke.id ? { ...s, x: snapped.x, y: snapped.y } : s));
                  handleGroupDragEnd();
                }}
                onTransformEnd={e => handleTransformEndStroke(stroke.id, e.target)}
                onDragStart={e => handleGroupDragStart(e, stroke.id, 'stroke')}
                onDragMove={e => handleGroupDragMove(e, stroke.id, 'stroke')}
              />
            ))}
          {/* Render current stroke live while drawing */}
          {currentStroke && props.selectedTool === 'draw' && (
            <Line
              key="current"
              points={currentStroke.points}
              x={currentStroke.x}
              y={currentStroke.y}
              stroke={currentStroke.color}
              strokeWidth={currentStroke.size}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              draggable={false}
              listening={false}
            />
          )}
          {/* Selection handles (Miro-style) */}
          {selectedIds.length > 0 && props.selectedTool === 'select' && (
            <Transformer
              ref={transformerRef}
              rotateEnabled={true}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
              borderStroke="#E1FF00"
              anchorStroke="#E1FF00"
              anchorFill="#fff"
              anchorSize={8}
              anchorCornerRadius={4}
              anchorStrokeWidth={2}
              anchorDash={[2, 2]}
              boundBoxFunc={(oldBox, newBox) => {
                // Limit resize to minimum size
                if (newBox.width < 20 || newBox.height < 20) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          )}
          {/* Selection rectangle */}
          {selectionRect && (
            <Line
              points={[
                selectionRect.x, selectionRect.y,
                selectionRect.x + selectionRect.width, selectionRect.y,
                selectionRect.x + selectionRect.width, selectionRect.y + selectionRect.height,
                selectionRect.x, selectionRect.y + selectionRect.height,
                selectionRect.x, selectionRect.y
              ]}
              stroke="#E1FF00"
              strokeWidth={1.5}
              dash={[4, 4]}
              closed={false}
              listening={false}
            />
          )}
          {/* Render sketch bounding box if in sketch mode */}
          {props.sketchModeActive && sketchBox && (
            <>
              <Rect
                ref={sketchBoxRef}
                x={sketchBox.x}
                y={sketchBox.y}
                width={sketchBox.width}
                height={sketchBox.height}
                stroke="#E1FF00"
                strokeWidth={2}
                dash={[6, 4]}
                fill="rgba(0,0,0,0.0)"
                draggable
                onTransformEnd={handleSketchBoxTransform}
                onDragEnd={handleSketchBoxTransform}
              />
              <Transformer
                ref={sketchBoxTransformerRef}
                nodes={sketchBoxRef.current ? [sketchBoxRef.current] : []}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
                borderStroke="#E1FF00"
                anchorStroke="#E1FF00"
                anchorFill="#fff"
                anchorSize={8}
                anchorCornerRadius={4}
                anchorStrokeWidth={2}
                anchorDash={[2, 2]}
              />
            </>
          )}
          {/* Render render bounding box if in render mode */}
          {props.renderModeActive && renderBox && (
            <>
              <Rect
                ref={renderBoxRef}
                x={renderBox.x}
                y={renderBox.y}
                width={renderBox.width}
                height={renderBox.height}
                stroke="#E1FF00"
                strokeWidth={2}
                dash={[6, 4]}
                fill="rgba(0,0,0,0.0)"
                draggable
                onTransformEnd={handleRenderBoxTransform}
                onDragEnd={handleRenderBoxTransform}
              />
              <Transformer
                ref={renderBoxTransformerRef}
                nodes={renderBoxRef.current ? [renderBoxRef.current] : []}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
                borderStroke="#E1FF00"
                anchorStroke="#E1FF00"
                anchorFill="#fff"
                anchorSize={8}
                anchorCornerRadius={4}
                anchorStrokeWidth={2}
                anchorDash={[2, 2]}
              />
            </>
          )}

          {/* Duplication preview layer */}
          {isDuplicating && duplicateOffset && selectedIds.map(sel => {
            if (sel.type === 'image') {
              const img = images.find(i => i.id === sel.id);
              if (!img) return null;
              return (
                <KonvaImage
                  key={`duplicate-preview-${sel.id}`}
                  image={img.image}
                  x={img.x + duplicateOffset.x}
                  y={img.y + duplicateOffset.y}
                  width={img.width || 200}
                  height={img.height || 200}
                  rotation={img.rotation || 0}
                  opacity={0.6}
                  listening={false}
                />
              );
            } else if (sel.type === 'video') {
              const video = videos.find(v => v.id === sel.id);
              if (!video) return null;
              return (
                <Rect
                  key={`duplicate-preview-${sel.id}`}
                  x={video.x + duplicateOffset.x}
                  y={video.y + duplicateOffset.y}
                  width={video.width}
                  height={video.height}
                  rotation={video.rotation}
                  fill="rgba(0, 0, 0, 0.3)"
                  stroke="rgba(255, 255, 255, 0.8)"
                  strokeWidth={2}
                  opacity={0.6}
                  listening={false}
                />
              );
            } else if (sel.type === 'text') {
              const txt = texts.find(t => t.id === sel.id);
              if (!txt) return null;
              return (
                <KonvaText
                  key={`duplicate-preview-${sel.id}`}
                  text={txt.text}
                  x={txt.x + duplicateOffset.x}
                  y={txt.y + duplicateOffset.y}
                  fontSize={txt.fontSize}
                  fontFamily="Gilroy, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                  fill={txt.color}
                  rotation={txt.rotation || 0}
                  opacity={0.6}
                  listening={false}
                />
              );
            } else if (sel.type === 'stroke') {
              const stroke = strokes.find(s => s.id === sel.id);
              if (!stroke) return null;
              return (
                <Line
                  key={`duplicate-preview-${sel.id}`}
                  points={stroke.points.map((p, i) => 
                    i % 2 === 0 ? p + duplicateOffset.x : p + duplicateOffset.y
                  )}
                  x={stroke.x + duplicateOffset.x}
                  y={stroke.y + duplicateOffset.y}
                  stroke={stroke.color}
                  strokeWidth={stroke.size}
                  lineCap="round"
                  lineJoin="round"
                  rotation={stroke.rotation || 0}
                  opacity={0.6}
                  listening={false}
                />
              );
            }
            return null;
          })}
        </Layer>
      </Stage>
      {/* Inline text editing is now handled directly in the text elements */}
      </div>
    );
});
