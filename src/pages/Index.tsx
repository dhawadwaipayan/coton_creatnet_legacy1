import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { GenerationPanel } from '@/components/GenerationPanel';
import { ModePanel } from '@/components/ModePanel';
import { Canvas } from '@/components/Canvas';
import { TopBar } from '@/components/TopBar';
import ZoomBar from '@/components/ZoomBar';
import UserBar from '@/components/UserBar';
import { BrushSubBar } from '@/components/BrushSubBar';
import { TextSubBar } from '@/components/TextSubBar';

import AuthOverlay from '../components/AuthOverlay';
import { getUser, signOut, getBoardsForUser, createBoard, updateBoard, deleteBoard } from '../lib/utils';
import BoardOverlay from '../components/BoardOverlay';
import { v4 as uuidv4 } from 'uuid';

const Index = () => {
  const [selectedTool, setSelectedTool] = useState<string | null>('select');
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [selectedVideoSrc, setSelectedVideoSrc] = useState<string | null>(null);
  const [sketchBarOpen, setSketchBarOpen] = useState(false);
  const [boundingBoxCreated, setBoundingBoxCreated] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>('');
  const canvasRef = useRef<any>(null);
  
  // Zoom state for demo
  const [zoom, setZoom] = useState(100);
  const handleZoomIn = () => setZoom(z => Math.min(z + 10, 500));
  const handleZoomOut = () => setZoom(z => Math.max(z - 10, 10));
  
  // Enhanced zoom handlers using Canvas zoom state
  const handleCanvasZoomIn = () => {
    if (canvasRef.current && canvasRef.current.zoomIn) {
      canvasRef.current.zoomIn();
      // Update local zoom state for real-time updates
      setZoom(canvasRef.current.zoom);
    }
  };
  
  const handleCanvasZoomOut = () => {
    if (canvasRef.current && canvasRef.current.zoomOut) {
      canvasRef.current.zoomOut();
      // Update local zoom state for real-time updates
      setZoom(canvasRef.current.zoom);
    }
  };
  
  const handleZoomReset = () => {
    if (canvasRef.current && canvasRef.current.resetZoom) {
      canvasRef.current.resetZoom();
      // Update local zoom state for real-time updates
      setZoom(1);
    }
  };
  
  const handleZoomFit = () => {
    if (canvasRef.current && canvasRef.current.fitToViewport) {
      canvasRef.current.fitToViewport();
      // Update local zoom state for real-time updates
      setZoom(canvasRef.current.zoom);
    }
  };

  // Brush state for draw tool (lifted up)
  const [brushColor, setBrushColor] = useState('#FF0000');
  const [brushSize, setBrushSize] = useState(5);
  const [textColor, setTextColor] = useState('#FF0000');

  // Add state for Konva-based Sketch mode
  const sketchModeActive = sketchBarOpen && selectedMode === 'sketch';
  const [sketchBoundingBox, setSketchBoundingBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  // Add state for Konva-based Render mode
  const renderModeActive = selectedMode === 'render';
  const [renderBoundingBox, setRenderBoundingBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  const [showAuth, setShowAuth] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [showBoardOverlay, setShowBoardOverlay] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  // Board state management
  const [boards, setBoards] = useState([]);
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [savingBoard, setSavingBoard] = useState(false);

  // Sync zoom state with Canvas zoom changes
  useEffect(() => {
    const syncZoom = () => {
      if (canvasRef.current?.zoom) {
        setZoom(canvasRef.current.zoom);
      }
    };
    
    // Sync zoom when component mounts
    syncZoom();
    
    // Set up interval to sync zoom (for real-time updates)
    const interval = setInterval(syncZoom, 100);
    
    return () => clearInterval(interval);
  }, []);

  // Check user authentication (no admin check for main app)
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        setLoadingUser(true);
        const { data } = await getUser();
        
        if (data?.user) {
          setUserId(data.user.id);
          const name = data.user.user_metadata?.name || '';
          setUserName(name);
          
          // Regular user, show normal app
          setShowAuth(false);
          setShowBoardOverlay(true);
          setLoadingBoards(true);
          console.log('Loading boards for user:', data.user.id);
          getBoardsForUser(data.user.id)
            .then(boards => {
              console.log('Loaded boards:', boards);
              setBoards(boards || []);
              setCurrentBoardId(boards && boards.length > 0 ? boards[0].id : null);
            })
            .catch(error => {
              console.error('Error loading boards:', error);
            })
            .finally(() => setLoadingBoards(false));
        } else {
          setShowAuth(true);
          setUserName('');
          setBoards([]);
          setCurrentBoardId(null);
          setUserId(null);
          setShowBoardOverlay(false);
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        setShowAuth(true);
      } finally {
        setLoadingUser(false);
      }
    };

    checkUserStatus();
  }, []);

  // Create new board (max 3)
  const handleCreateNewBoard = async () => {
    if (!userId || boards.length >= 3) return;
    console.log('Creating new board for user:', userId);
    const newBoard = await createBoard({
      user_id: userId,
      name: `Untitled ${boards.length + 1}`,
      content: { images: [], strokes: [], texts: [] },
    });
    console.log('Created new board:', newBoard);
    setBoards(prev => [...prev, newBoard]);
    setCurrentBoardId(newBoard.id);
    setShowBoardOverlay(false);
  };

  // Switch board (select only, do not enter)
  const handleSwitchBoard = (id) => {
    setCurrentBoardId(id);
    // Do not close overlay here
  };

  // Enter board (double click)
  const handleEnterBoard = (id) => {
    setCurrentBoardId(id);
    setShowBoardOverlay(false);
  };

  // Delete board
  const handleDeleteBoard = async (id) => {
    await deleteBoard(id);
    setBoards(prev => prev.filter(b => b.id !== id));
    // If the deleted board was current, clear currentBoardId
    setCurrentBoardId(prev => (prev === id ? null : prev));
  };

  // Handle cancel button logic
  const handleCancelBoardOverlay = () => {
    // Only allow cancel if there's a valid current board to return to
    if (currentBoardId && boards.find(b => b.id === currentBoardId)) {
      setShowBoardOverlay(false);
    }
    // If no valid current board, don't allow cancel - user must create a board or select one
  };

  // Check if cancel button should be disabled
  const isCancelDisabled = !currentBoardId || !boards.find(b => b.id === currentBoardId);

  // Update board name
  const handleUpdateBoardName = async (id, name) => {
    const updated = await updateBoard({ id, name });
    setBoards(boards => boards.map(b => b.id === id ? { ...b, name: updated.name, lastEdited: updated.lastEdited } : b));
  };

  // Autosave board content
  const handleUpdateBoardContent = async (id, content) => {
    console.log('Saving board content to Supabase:', { id, content });
    const updated = await updateBoard({ id, content });
    setBoards(boards => boards.map(b => b.id === id ? { ...b, content: updated.content, lastEdited: updated.lastEdited } : b));
  };

  // Get current board
  const currentBoard = boards.find(b => b.id === currentBoardId) || null;

  // Debug: log current board state
  useEffect(() => {
    console.log('Current board state:', {
      currentBoardId,
      currentBoard,
      boardsCount: boards.length,
      boards: boards.map(b => ({ id: b.id, name: b.name, lastEdited: b.lastEdited }))
    });
  }, [currentBoardId, currentBoard, boards]);

  // Prepare board content for Canvas
  const getBoardContentForCanvas = () => {
    // Show empty state during auth overlay or board overlay
    if (showAuth || showBoardOverlay) return null;
    
    if (!currentBoard) return null;
    
    const content = {
      id: currentBoard.id,
      user_id: currentBoard.user_id, // Add user_id for Canvas component
      images: currentBoard.content?.images || [],
      videos: currentBoard.content?.videos || [], // Add videos field
      strokes: currentBoard.content?.strokes || [],
      texts: currentBoard.content?.texts || []
    };
    console.log('Board content for Canvas:', content);
    return content;
  };

  useEffect(() => {
    getUser().then(({ data }) => {
      if (data?.user) {
        setShowAuth(false);
        const name = data.user.user_metadata?.name || '';
        setUserName(name);
      } else {
        setShowAuth(true);
        setUserName('');
      }
    });
  }, []);

  // After successful auth (from AuthOverlay), show normal app
  const handleAuthSuccess = async () => {
    try {
      const { data } = await getUser();
      if (data?.user) {
        setUserId(data.user.id);
        const name = data?.user?.user_metadata?.name || '';
        setUserName(name);
        
        // Regular user, show normal app
        setShowAuth(false);
        setShowBoardOverlay(true);
        setLoadingBoards(true);
        console.log('Reloading boards after auth success for user:', data.user.id);
        getBoardsForUser(data.user.id)
          .then(boards => {
            console.log('Reloaded boards after auth:', boards);
            setBoards(boards || []);
            setCurrentBoardId(boards && boards.length > 0 ? boards[0].id : null);
          })
          .catch(error => {
            console.error('Error reloading boards after auth:', error);
          })
          .finally(() => setLoadingBoards(false));
      }
    } catch (error) {
      console.error('Error in handleAuthSuccess:', error);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setShowAuth(true);
              setUserName('');
          setBoards([]);
          setCurrentBoardId(null);
          setUserId(null);
          setShowBoardOverlay(false);
  };



  // Manual save function
  const handleManualSave = async () => {
    if (canvasRef.current && canvasRef.current.saveBoardContent) {
      console.log('Manual save triggered');
      setSavingBoard(true);
      try {
        await canvasRef.current.saveBoardContent();
        console.log('Manual save completed successfully');
      } catch (error) {
        console.error('Manual save failed:', error);
      } finally {
        setSavingBoard(false);
      }
    } else {
      console.error('Canvas save function not available');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToolSelect = (toolId: string) => {
    if (sketchBarOpen && !boundingBoxCreated) {
      setSketchBarOpen(false);
      setSelectedTool(toolId);
      setSelectedMode('');
      return;
    }
    // Close render bar and clear render bounding box when any tool is selected
    if (selectedMode === 'render') {
      handleCloseRenderBar();
      if (canvasRef.current && canvasRef.current.clearRenderBox) {
        canvasRef.current.clearRenderBox();
      }
    }
    setSelectedTool(toolId);
    setSelectedMode(toolId);
    console.log(`Tool selected: ${toolId}`);
  };

  // Handler to be called when Sketch mode is activated
  const handleSketchModeActivated = () => {
    setSketchBarOpen(true);
    setBoundingBoxCreated(false);
    setSelectedTool(null); // No tool active while bounding box is being created
  };

  // Handler to be called when bounding box is created
  const handleBoundingBoxCreated = () => {
    setBoundingBoxCreated(true);
    setSelectedTool('select'); // Activate move/select tool
  };

  // Handler to close Sketch bar
  const handleCloseSketchBar = () => {
    setSketchBarOpen(false);
    setBoundingBoxCreated(false);
    setSelectedTool('select');
  };

  // Handler to close Render bar
  const handleCloseRenderBar = () => {
    setSelectedMode('');
    setSelectedTool('select');
  };

  // Handler to auto-switch to select tool after adding text
  const handleTextAdded = () => {
    setSelectedTool('select');
    setSelectedMode && setSelectedMode('select');
  };

  // Handler for background removal
  const handleBackgroundRemoved = (newImageSrc: string) => {
    console.log('[Index] Background removed, new image src:', newImageSrc);
    // Update the selected image with the background-removed version
    setSelectedImageSrc(newImageSrc);
    
    // Update the image on the canvas if canvas ref exists
    if (canvasRef.current && canvasRef.current.replaceSelectedImage) {
      canvasRef.current.replaceSelectedImage(newImageSrc);
    }
  };

  // Show loading state while checking user status
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#181818] flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {/* Auth Overlay - always rendered at the top level for perfect centering */}
      {showAuth && <AuthOverlay onAuthSuccess={handleAuthSuccess} />}
      <main className="bg-[rgba(33,33,33,1)] flex flex-col overflow-hidden min-h-screen relative">
        {/* Board Overlay - open when logo is clicked */}
        {showBoardOverlay && (
          <BoardOverlay
            onCancel={handleCancelBoardOverlay}
            onCreateNew={handleCreateNewBoard}
            boards={boards}
            currentBoardId={currentBoardId}
            onSwitchBoard={handleSwitchBoard}
            onEnterBoard={handleEnterBoard}
            onDeleteBoard={handleDeleteBoard}
            isCancelDisabled={isCancelDisabled}
          />
        )}
        
        {/* UserBar - positioned outside main container to ensure it's on top */}
        {!showAuth && (
          <div className="fixed top-[34px] right-6 z-[100] pointer-events-auto">
            <UserBar userName={userName} onLogout={handleLogout} />
          </div>
        )}
        
        <div style={{ pointerEvents: showAuth ? 'none' : 'auto' }}>
          {/* Canvas Background - behind everything */}
                      <Canvas
              ref={canvasRef}
              selectedTool={selectedTool || 'select'}
              onSelectedImageSrcChange={setSelectedImageSrc}
              onSelectedVideoSrcChange={setSelectedVideoSrc}
              brushColor={brushColor}
              brushSize={brushSize}
              textColor={textColor}
              onTextAdded={handleTextAdded}
              sketchModeActive={sketchModeActive}
              renderModeActive={renderModeActive}
              onRenderBoundingBoxChange={setRenderBoundingBox}
              boardContent={getBoardContentForCanvas()}
              onContentChange={content => currentBoard && handleUpdateBoardContent(currentBoard.id, content)}
            />



          {/* Sidebar - positioned center left - hidden during auth overlay and board overlay */}
          {!showAuth && !showBoardOverlay && (
            <Sidebar 
              onToolSelect={handleToolSelect} 
              selectedImageSrc={selectedImageSrc} 
              selectedVideoSrc={selectedVideoSrc}
              selectedTool={selectedTool} 
              setSelectedTool={setSelectedTool}
              onBackgroundRemoved={handleBackgroundRemoved}
            />
          )}

          {/* BrushSubBar - beside sidebar, only when draw tool is selected - hidden during auth overlay and board overlay */}
          {!showAuth && !showBoardOverlay && selectedTool === 'draw' && (
            <BrushSubBar
              brushColor={brushColor}
              setBrushColor={setBrushColor}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
            />
          )}

          {/* TextSubBar - beside sidebar, only when text tool is selected - hidden during auth overlay and board overlay */}
          {!showAuth && !showBoardOverlay && selectedTool === 'text' && (
            <TextSubBar
              textColor={textColor}
              setTextColor={setTextColor}
            />
          )}

          {/* UI Overlay - above canvas */}
          <div className="relative z-10 flex flex-col pl-[37px] pr-20 py-[34px] min-h-screen max-md:px-5 pointer-events-none">
            {/* Top Bar - positioned top left - hidden during auth overlay and board overlay */}
            {!showAuth && !showBoardOverlay && (
              <div className="absolute top-[34px] left-6 pointer-events-auto">
                <TopBar
                  canvasRef={canvasRef}
                  onLogoClick={() => setShowBoardOverlay(true)}
                  boardName={currentBoard?.name || ''}
                  onBoardNameChange={name => currentBoard && handleUpdateBoardName(currentBoard.id, name)}
                  onSaveBoard={handleManualSave}
                  isSaving={savingBoard}
                />
              </div>
            )}
            
            <div className="flex flex-1 relative">
              <div className="flex-1" />
              
              {/* Restore original bottom bar position: centered at bottom - hidden during auth overlay and board overlay */}
              {!showAuth && !showBoardOverlay && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2.5 pointer-events-auto">
                  <GenerationPanel />
                  <ModePanel
                    canvasRef={canvasRef}
                    onSketchModeActivated={handleSketchModeActivated}
                    onBoundingBoxCreated={handleBoundingBoxCreated}
                    showSketchSubBar={sketchBarOpen}
                    closeSketchBar={handleCloseSketchBar}
                    selectedMode={selectedMode}
                    setSelectedMode={setSelectedMode}
                    brushColor={brushColor}
                    setBrushColor={setBrushColor}
                    brushSize={brushSize}
                    setBrushSize={setBrushSize}
                    sketchModeActive={sketchModeActive}
                    onSketchBoundingBoxChange={setSketchBoundingBox}
                    renderBoundingBox={renderBoundingBox}
                    closeRenderBar={handleCloseRenderBar}
                    userId={userId} // Pass userId to ModePanel
                  />
                </div>
              )}
            </div>
            {/* ZoomBar: bottom right, right-6 and bottom-[34px] for perfect gap - hidden during auth overlay and board overlay */}
            {!showAuth && !showBoardOverlay && (
              <div className="pointer-events-auto absolute right-6 bottom-[34px] z-20">
                <ZoomBar 
                  zoom={zoom} 
                  onZoomIn={handleCanvasZoomIn} 
                  onZoomOut={handleCanvasZoomOut}
                  viewportWidth={window.innerWidth}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

export default Index;
