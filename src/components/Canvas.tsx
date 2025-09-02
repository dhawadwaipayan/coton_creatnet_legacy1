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

  // Keyboard event listeners for delete functionality
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected items (Delete or Backspace key)
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
  // Use only selectedIds: Array<{ id: string, type: 'image' | 'stroke' }>
  const [selectedIds, setSelectedIds] = useState<Array<{ id: string, type: 'image' | 'stroke' | 'text' | 'video' }>>([]);
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
  const [groupDragStart, setGroupDragStart] = useState<{ x: number, y: number, items: Array<{ id: string, type: 'image' | 'stroke' | 'text' | 'video', x: number, y: number }> } | null>(null);

  // Add texts state
  const [texts, setTexts] = useState<Array<{ id: string, text: string, x: number, y: number, color: string, fontSize: number, rotation: number, timestamp: number }>>([]);
  // Add state for editing text
  const [editingText, setEditingText] = useState<null | {
    id: string;
    value: string;
    x: number;
    y: number;
    color: string;
    fontSize: number;
    rotation: number;
  }>(null);
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

  // Fallback export method that only exports images (no videos) to avoid CORS issues
  const exportImagesOnlyFromRenderBox = useCallback((box: { x: number, y: number, width: number, height: number }) => {
    console.log('🖼️ Using fallback export method for render box:', box);
    console.log('🖼️ Current zoom:', zoom, 'stagePos:', stagePos);
    
    // box is already in canvas coordinates, so use it directly
    const canvasBox = box;
    
    console.log('🖼️ Using canvas coordinates directly:', canvasBox);
    
    // Create a temporary canvas for image-only export
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      console.error('Could not get 2D context for fallback export');
      return null;
    }
    
    // Set canvas dimensions to match the bounding box (use original dimensions)
    tempCanvas.width = box.width;
    tempCanvas.height = box.height;
    
    // Fill with transparent background
    tempCtx.clearRect(0, 0, box.width, box.height);
    
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
      if (!img.image) return false;
      
      // Check if image intersects with bounding box (canvas coordinates)
      const imgRight = img.x + (img.width || 0);
      const imgBottom = img.y + (img.height || 0);
      const boxRight = canvasBox.x + canvasBox.width;
      const boxBottom = canvasBox.y + canvasBox.height;
      
      const intersects = !(img.x > boxRight || imgRight < canvasBox.x || img.y > boxBottom || imgBottom < canvasBox.y);
      
      if (intersects) {
        console.log('🖼️ Image intersects:', {
          id: img.id,
          imgPos: { x: img.x, y: img.y, width: img.width, height: img.height },
          boxPos: { x: canvasBox.x, y: canvasBox.y, width: canvasBox.width, height: canvasBox.height }
        });
      }
      
      return intersects;
    });
    
    console.log('🖼️ Found intersecting images:', intersectingImages.length);
    
    if (intersectingImages.length === 0) {
      console.warn('No images found in bounding box area');
      console.warn('Canvas box:', canvasBox);
      console.warn('Available images:', images.length);
      
      // Fallback: Create a simple colored rectangle representing the bounding box
      console.log('🖼️ Creating fallback bounding box representation');
      tempCtx.fillStyle = '#FF6B6B'; // Light red color
      tempCtx.fillRect(0, 0, box.width, box.height);
      
      // Add a border
      tempCtx.strokeStyle = '#FF0000';
      tempCtx.lineWidth = 2;
      tempCtx.strokeRect(0, 0, box.width, box.height);
      
      // Add text label
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.font = '16px Arial';
      tempCtx.textAlign = 'center';
      tempCtx.fillText('Bounding Box Area', box.width / 2, box.height / 2);
      
      try {
        const dataURL = tempCanvas.toDataURL('image/png');
        console.log('🖼️ Fallback bounding box representation created, data length:', dataURL.length);
        return dataURL;
      } catch (error) {
        console.error('Failed to create fallback bounding box representation:', error);
        return null;
      }
    }
    
    // Draw each intersecting image onto the temporary canvas
    intersectingImages.forEach(img => {
      if (!img.image) return;
      
      // Calculate the intersection area (canvas coordinates)
      const imgRight = img.x + (img.width || 0);
      const imgBottom = img.y + (img.height || 0);
      const boxRight = canvasBox.x + canvasBox.width;
      const boxBottom = canvasBox.y + canvasBox.height;
      
      // Calculate intersection in canvas coordinates
      const intersectX = Math.max(canvasBox.x, img.x);
      const intersectY = Math.max(canvasBox.y, img.y);
      const intersectRight = Math.min(boxRight, imgRight);
      const intersectBottom = Math.min(boxBottom, imgBottom);
      
      const intersectWidth = Math.max(0, intersectRight - intersectX);
      const intersectHeight = Math.max(0, intersectBottom - intersectY);
      
      // Calculate drawing coordinates relative to the bounding box
      const drawX = intersectX - canvasBox.x;
      const drawY = intersectY - canvasBox.y;
      const drawWidth = intersectWidth;
      const drawHeight = intersectHeight;
      
      // Calculate source coordinates for the image (in canvas coordinates)
      const srcX = intersectX - img.x;
      const srcY = intersectY - img.y;
      
      console.log('🖼️ Drawing image:', {
        id: img.id,
        drawPos: { x: drawX, y: drawY, width: drawWidth, height: drawHeight },
        srcPos: { x: srcX, y: srcY }
      });
      
      try {
        tempCtx.drawImage(
          img.image,
          srcX, srcY, drawWidth, drawHeight,  // Source coordinates
          drawX, drawY, drawWidth, drawHeight  // Destination coordinates
        );
      } catch (error) {
        console.warn('Failed to draw image in fallback export:', error);
      }
    });
    
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

  // Expose importImage method on ref
  useImperativeHandle(ref, () => ({
    exportCurrentBoundingBoxAsPng: () => {
      // Use sketchBox for Sketch mode, renderBox for Render mode
      const activeBox = props.renderModeActive ? renderBox : sketchBox;
      if (!activeBox) return null;
      const stage = stageRef.current;
      if (!stage) return null;
      
      // Use canvas coordinates directly for stage.toDataURL
      // stage.toDataURL expects coordinates relative to the stage (canvas coordinates)
      return stage.toDataURL({
        x: activeBox.x,
        y: activeBox.y,
        width: activeBox.width,
        height: activeBox.height,
        pixelRatio: 1,
      });
    },
    
    exportCurrentRenderBoxAsPng: () => {
      if (!renderBox) return null;
      const stage = stageRef.current;
      if (!stage) return null;
      
      // renderBox is already in canvas coordinates, use them directly for stage.toDataURL
      console.log('🎯 Exporting render box (canvas coordinates):', renderBox);
      console.log('🎯 Current zoom:', zoom, 'stagePos:', stagePos);
      
      // stage.toDataURL expects coordinates relative to the stage (canvas coordinates)
      // No need to convert to screen coordinates
      console.log('🎯 Using canvas coordinates directly for stage.toDataURL');
      
      try {
        // Primary export method - use canvas coordinates directly
        const result = stage.toDataURL({
          x: renderBox.x,
          y: renderBox.y,
          width: renderBox.width,
          height: renderBox.height,
          pixelRatio: 1,
        });
        
        if (result && result !== 'data:,' && result.length > 100) {
          console.log('✅ Primary export successful, data length:', result.length);
          return result;
        }
        
        // Fallback: export only images in the bounding box area
        console.warn('⚠️ Primary export failed, using fallback method');
        return exportImagesOnlyFromRenderBox(renderBox);
        
      } catch (error) {
        console.error('❌ Export failed, using fallback method:', error);
        return exportImagesOnlyFromRenderBox(renderBox);
      }
    },
    removeImage: (id: string) => {
      console.log('🎬 Removing image with ID:', id);
      setImages(prev => prev.filter(img => img.id !== id));
      console.log('🎬 Image removed successfully');
    },
    importImage: (src: string, x?: number, y?: number, width?: number, height?: number, onLoadId?: (id: string) => void) => {
      // Security validation (DISABLED FOR NOW)
      // const validation = securityManager.validateInput(src, 'string');
      // if (!validation.valid) {
      //   console.error('Image import validation failed:', validation.errors);
      //   return null;
      // }
      
      pushToUndoStackWithSave();
      const img = new window.Image();
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
            v.id === id ? { ...v, width: actualWidth, height: actualHeight } : v
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
      
      const newVideo = {
        id,
        src,
        x,
        y,
        width: width || 764,  // Use correct video aspect ratio width
        height: height || 1200, // Use correct video aspect ratio height
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
            
            // Add video to videos array with desqueezed dimensions
            setVideos(videos => [
              ...videos,
              {
                id: `video-${Date.now()}`,
                src: newSrc,
                x: oldImg.x,
                y: oldImg.y,
                width: width || 764,  // Use provided width (desqueezed) or fallback
                height: height || 1200, // Use provided height (desqueezed) or fallback
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
    if (props.selectedTool === 'hand') {
      setIsDragging(true);
      setLastPos({
        x: e.evt.clientX,
        y: e.evt.clientY
      });
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
    if (props.selectedTool === 'hand' && isDragging && lastPos) {
      const dx = e.evt.clientX - lastPos.x;
      const dy = e.evt.clientY - lastPos.y;
      setStagePos(prev => clampStagePos({ x: prev.x + dx, y: prev.y + dy }));
      setLastPos({ x: e.evt.clientX, y: e.evt.clientY });
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
    if (props.selectedTool === 'hand') {
      setIsDragging(false);
      setLastPos(null);
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
  const handleStageClick = (e: any) => {
    if (props.selectedTool === 'text') {
      // Don't create text if we're currently editing
      if (editingText) return;
      
      const stage = stageRef.current;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      
      // Convert screen coordinates to canvas coordinates
      const canvasPos = screenToCanvas(pointer.x, pointer.y);
      
      const id = Date.now().toString();
      pushToUndoStackWithSave();
      setTexts(prev => [
        ...prev,
        {
          id,
          text: 'Add text',
          x: canvasPos.x,
          y: canvasPos.y,
          color: props.textColor || '#FF0000',
          fontSize: 32,
          rotation: 0,
          timestamp: Date.now()
        }
      ]);
      
      // Immediately enter edit mode for the new text
      setEditingText({
        id,
        value: 'Add text',
        x: canvasPos.x,
        y: canvasPos.y,
        color: props.textColor || '#FF0000',
        fontSize: 32,
        rotation: 0,
      });
      
      // Select the new text
      setSelectedIds([{ id, type: 'text' }]);
      
      // Immediately show the editing interface for new text
      setTimeout(() => {
        const stage = stageRef.current;
        if (!stage) return;
        
        // Calculate the exact position where the text appears on screen
        const stageRect = stage.container().getBoundingClientRect();
        const textX = stageRect.left + (canvasPos.x * zoom + stagePos.x);
        const textY = stageRect.top + (canvasPos.y * zoom + stagePos.y);
        
        // Create a simple input element positioned exactly over the text
        const input = document.createElement('input');
        input.type = 'text';
        input.value = 'Add text';
        input.style.position = 'fixed';
        input.style.left = textX + 'px';
        input.style.top = textY + 'px';
        input.style.fontSize = '32px';
        input.style.color = props.textColor || '#FF0000';
        input.style.background = 'rgba(255,255,255,0.95)';
        input.style.border = '2px solid rgba(225,255,0,0.8)';
        input.style.borderRadius = '4px';
        input.style.padding = '4px 8px';
        input.style.outline = 'none';
        input.style.fontFamily = 'Arial, sans-serif';
        input.style.fontWeight = 'normal';
        input.style.fontStyle = 'normal';
        input.style.zIndex = '1000';
        input.style.minWidth = '120px';
        input.style.maxWidth = '600px';
        
        // Add to body
        document.body.appendChild(input);
        
        // Focus and select all text
        input.focus();
        input.select();
        
        // Handle input changes in real-time
        const handleInput = () => {
          const newValue = input.value;
          setEditingText(prev => prev ? { ...prev, value: newValue } : null);
        };
        
        // Handle completion (Enter key or blur)
        const handleComplete = () => {
          const newValue = input.value;
          
          if (newValue.trim() !== '') {
            // Save the changes
            pushToUndoStackWithSave();
            setTexts(prev => prev.map(t => t.id === id ? { ...t, text: newValue } : t));
            
            // Switch to select tool after editing
            if (props.onTextAdded) props.onTextAdded();
          }
          
          // Clean up
          cleanupSimpleTextEditing(input);
        };
        
        // Handle keyboard events
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleComplete();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cleanupSimpleTextEditing(input);
          }
        };
        
        // Add event listeners
        input.addEventListener('input', handleInput);
        input.addEventListener('blur', handleComplete);
        input.addEventListener('keydown', handleKeyDown);
      }, 100); // Small delay to ensure state is updated
      
      return;
    }
    if (props.selectedTool === 'select' && e.target === e.target.getStage()) {
      setSelectedIds([]);
    }
  };

  // Selection helpers
  const isSelected = (id: string, type: 'image' | 'stroke' | 'text' | 'video') => selectedIds.some(sel => sel.id === id && sel.type === type);

  // Handle click on image/stroke/text/video
  const handleItemClick = (id: string, type: 'image' | 'stroke' | 'text' | 'video', evt: any) => {
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
    setImages(prev => prev.map(img =>
      img.id === id
        ? { ...img, x, y, width, height, rotation }
        : img
    ));
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
    setStrokes(prev => prev.map(stroke =>
      stroke.id === id
        ? {
            ...stroke,
            x,
            y,
            width: Math.max(20, stroke.width * scaleX),
            height: Math.max(20, stroke.height * scaleY),
            points: stroke.points.map((p, i) => i % 2 === 0 ? p * scaleX : p * scaleY),
            rotation
          }
        : stroke
    ));
    node.scaleX(1);
    node.scaleY(1);
  };

  // Attach Transformer to all selected nodes
  React.useEffect(() => {
    if (transformerRef.current && selectedIds.length > 0) {
      const nodes = selectedIds.map(sel => {
        if (sel.type === 'image') {
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
  }, [selectedIds, images, strokes, texts, videos]);

  // Delete selected items
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        pushToUndoStackWithSave();
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

  // Simple and reliable text editing with proper positioning
  const handleTextDblClick = (txt: any) => {
    if (editingText) return; // Only one at a time
    
    // Clear any existing selection
    setSelectedIds([]);
    
    // Set editing state
    setEditingText({
      id: txt.id,
      value: txt.text,
      x: txt.x,
      y: txt.y,
      color: txt.color,
      fontSize: txt.fontSize,
      rotation: txt.rotation || 0,
    });
    
    // Get the stage for positioning
    const stage = stageRef.current;
    if (!stage) return;
    
    // Calculate the exact position where the text appears on screen
    const stageRect = stage.container().getBoundingClientRect();
    const textX = stageRect.left + (txt.x * zoom + stagePos.x);
    const textY = stageRect.top + (txt.y * zoom + stagePos.y);
    
    // Create a simple input element positioned exactly over the text
    const input = document.createElement('input');
    input.type = 'text';
    input.value = txt.text;
    input.style.position = 'fixed';
    input.style.left = textX + 'px';
    input.style.top = textY + 'px';
    input.style.fontSize = txt.fontSize + 'px';
    input.style.color = txt.color;
    input.style.background = 'rgba(255,255,255,0.95)';
    input.style.border = '2px solid rgba(225,255,0,0.8)';
    input.style.borderRadius = '4px';
    input.style.padding = '4px 8px';
    input.style.outline = 'none';
    input.style.fontFamily = 'Arial, sans-serif';
    input.style.fontWeight = 'normal';
    input.style.fontStyle = 'normal';
    input.style.zIndex = '1000';
    input.style.minWidth = Math.max(100, txt.text.length * 20) + 'px';
    input.style.maxWidth = '600px';
    
    // Add to body
    document.body.appendChild(input);
    
    // Focus and select all text
    input.focus();
    input.select();
    
    // Handle input changes in real-time
    const handleInput = () => {
      const newValue = input.value;
      setEditingText(prev => prev ? { ...prev, value: newValue } : null);
    };
    
    // Handle completion (Enter key or blur)
    const handleComplete = () => {
      const newValue = input.value;
      
      if (newValue.trim() !== '') {
        // Save the changes
        pushToUndoStackWithSave();
        setTexts(prev => prev.map(t => t.id === txt.id ? { ...t, text: newValue } : t));
        
        // Switch to select tool after editing
        if (props.onTextAdded) props.onTextAdded();
      }
      
      // Clean up
      cleanupSimpleTextEditing(input);
    };
    
    // Handle keyboard events
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleComplete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cleanupSimpleTextEditing(input);
      }
    };
    
    // Add event listeners
    input.addEventListener('input', handleInput);
    input.addEventListener('blur', handleComplete);
    input.addEventListener('keydown', handleKeyDown);
  };
  // Text editing is now handled inline, no separate textarea needed
  
  // Cleanup function for simple text editing
  const cleanupSimpleTextEditing = useCallback((input: HTMLInputElement) => {
    if (!input) return;
    
    // Remove from DOM
    if (document.body.contains(input)) {
      document.body.removeChild(input);
    }
    
    // Clear editing state
    setEditingText(null);
  }, []);

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

    return (
    <div className={`fixed inset-0 z-0 overflow-hidden ${props.className || ''}`} style={{ background: '#1E1E1E' }}>
      <Stage
        width={viewport.width}
        height={viewport.height}
        ref={stageRef}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, cursor: 
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
          {gridLines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke="#333"
              strokeWidth={0.5}
              listening={false}
            />
          ))}
          
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
                  draggable={props.selectedTool === 'select' && isSelected(img.id, 'image')}
                  onClick={evt => handleItemClick(img.id, 'image', evt)}
                  onTap={evt => handleItemClick(img.id, 'image', evt)}
                  onDragEnd={e => {
                    pushToUndoStackWithSave();
                    const { x, y } = e.target.position();
                    setImages(prev => prev.map(im => im.id === img.id ? { ...im, x, y } : im));
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
                  draggable={props.selectedTool === 'select' && isSelected(video.id, 'video')}
                  transformable={props.selectedTool === 'select' && isSelected(video.id, 'video')}
                  onClick={evt => handleItemClick(video.id, 'video', evt)}
                  onTap={evt => handleItemClick(video.id, 'video', evt)}
                  onDragEnd={e => {
                    pushToUndoStackWithSave();
                    const { x, y } = e.target.position();
                    setVideos(prev => prev.map(v => v.id === video.id ? { ...v, x, y } : v));
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
                    setVideos(prev => prev.map(v =>
                      v.id === video.id
                        ? { ...v, x, y, width: v.width * scaleX, height: v.height * scaleY, rotation }
                        : v
                    ));
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
              <KonvaText
                key={txt.id}
                id={`text-${txt.id}`}
                text={txt.text}
                x={txt.x}
                y={txt.y}
                fontSize={txt.fontSize}
                fill={txt.color}
                draggable={props.selectedTool === 'select' && isSelected(txt.id, 'text')}
                rotation={txt.rotation}
                // Show text normally, but highlight when editing
                opacity={editingText && editingText.id === txt.id ? 0.3 : 1}
                // Add subtle highlight when text tool is active
                shadowColor={props.selectedTool === 'text' ? 'rgba(225,255,0,0.3)' : 'transparent'}
                shadowBlur={props.selectedTool === 'text' ? 8 : 0}
                shadowOffset={{ x: 0, y: 0 }}
                // Add border when editing
                stroke={editingText && editingText.id === txt.id ? 'rgba(225,255,0,0.6)' : 'transparent'}
                strokeWidth={editingText && editingText.id === txt.id ? 0.5 : 0}
                onClick={evt => handleItemClick(txt.id, 'text', evt)}
                onTap={evt => handleItemClick(txt.id, 'text', evt)}
                onDblClick={() => handleTextDblClick(txt)}
                onDblTap={() => handleTextDblClick(txt)}
                onDragEnd={e => {
                  pushToUndoStackWithSave();
                  const { x, y } = e.target.position();
                  setTexts(prev => prev.map(t => t.id === txt.id ? { ...t, x, y } : t));
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
                  setTexts(prev => prev.map(t =>
                    t.id === txt.id
                      ? { ...t, x, y, fontSize: Math.max(10, t.fontSize * scaleY), rotation }
                      : t
                  ));
                  node.scaleX(1);
                  node.scaleY(1);
                }}
                onDragStart={e => handleGroupDragStart(e, txt.id, 'text')}
                onDragMove={e => handleGroupDragMove(e, txt.id, 'text')}
              />
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
                draggable={props.selectedTool === 'select' && isSelected(stroke.id, 'stroke')}
                rotation={stroke.rotation}
                onClick={evt => handleItemClick(stroke.id, 'stroke', evt)}
                onTap={evt => handleItemClick(stroke.id, 'stroke', evt)}
                onDragEnd={e => {
                  pushToUndoStackWithSave();
                  const { x, y } = e.target.position();
                  setStrokes(prev => prev.map(s => s.id === stroke.id ? { ...s, x, y } : s));
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
        </Layer>
      </Stage>
      {/* Inline text editing is now handled directly in the text elements */}
      </div>
    );
});
