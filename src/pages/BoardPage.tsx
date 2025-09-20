import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { navigateToBoard, isValidBoardId, getDashboardUrl } from '../lib/boardUtils';
import { v4 as uuidv4 } from 'uuid';

const BoardPage = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  
  // All state variables from Index.tsx
  const [selectedTool, setSelectedTool] = useState<string | null>('select');
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [selectedVideoSrc, setSelectedVideoSrc] = useState<string | null>(null);
  const [sketchBarOpen, setSketchBarOpen] = useState(false);
  const [boundingBoxCreated, setBoundingBoxCreated] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>('');
  const canvasRef = useRef<any>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
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
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardValidated, setBoardValidated] = useState(false);

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

  // Function to reload board data
  const reloadBoardData = async (boardId: string) => {
    if (!userId) return;
    try {
      const userBoards = await getBoardsForUser(userId);
      setBoards(userBoards);
      const board = userBoards.find(b => b.id === boardId);
      if (board) {
        console.log('Reloaded board data:', board);
      }
    } catch (error) {
      console.error('Error reloading board data:', error);
    }
  };

  // Check user authentication and load board
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        setLoadingUser(true);
        const { data } = await getUser();
        
        if (data?.user) {
          setUserId(data.user.id);
          const name = data.user.user_metadata?.name || '';
          setUserName(name);
          setShowAuth(false);
          
          // Load boards for user
          const userBoards = await getBoardsForUser(data.user.id);
          setBoards(userBoards);
          
          // If we have a boardId from URL, validate and set it
          if (boardId) {
            // First validate the board ID format
            if (!isValidBoardId(boardId)) {
              setBoardError('Invalid board ID format');
              setTimeout(() => {
                navigate(getDashboardUrl());
              }, 3000);
              return;
            }
            
            const boardExists = userBoards.find(b => b.id === boardId);
            if (boardExists) {
              setCurrentBoardId(boardId);
              setShowBoardOverlay(false);
              setBoardError(null);
              setBoardValidated(true);
              console.log('Board found and loaded:', boardExists);
            } else {
              setBoardError('Board not found or access denied');
              setShowBoardOverlay(false);
              setBoardValidated(false);
              setTimeout(() => {
                navigate(getDashboardUrl());
              }, 3000);
            }
          } else {
            // No boardId in URL, show board overlay
            setShowBoardOverlay(true);
          }
        } else {
          setShowAuth(true);
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        setShowAuth(true);
      } finally {
        setLoadingUser(false);
      }
    };

    checkUserStatus();
  }, [boardId, navigate]);

  // Reload board data when boardId changes
  useEffect(() => {
    if (boardId && userId && boardValidated) {
      reloadBoardData(boardId);
    }
  }, [boardId, userId, boardValidated]);

  // Get current board
  const currentBoard = boards.find(b => b.id === currentBoardId) || null;

  // Debug: log current board state
  useEffect(() => {
    console.log('Current board state:', {
      currentBoardId,
      currentBoard,
      boardsCount: boards.length,
      showBoardOverlay,
      showAuth,
      boardError,
      boardId,
      boardValidated,
      boards: boards.map(b => ({ id: b.id, name: b.name, lastEdited: b.lastEdited }))
    });
  }, [currentBoardId, currentBoard, boards, showBoardOverlay, showAuth, boardError, boardId, boardValidated]);

  // Update undo/redo state from canvas
  useEffect(() => {
    const updateUndoRedoState = () => {
      if (canvasRef.current) {
        setCanUndo(canvasRef.current.canUndo || false);
        setCanRedo(canvasRef.current.canRedo || false);
      }
    };

    // Update immediately
    updateUndoRedoState();

    // Set up interval to check for changes
    const interval = setInterval(updateUndoRedoState, 100);

    return () => clearInterval(interval);
  }, []);

  // Prepare board content for Canvas
  const getBoardContentForCanvas = () => {
    // Show empty state during auth overlay or board overlay
    if (showAuth || showBoardOverlay) return null;
    
    if (!currentBoard) {
      console.log('No current board found');
      return null;
    }
    
    const content = {
      id: currentBoard.id,
      user_id: currentBoard.user_id,
      images: currentBoard.content?.images || [],
      videos: currentBoard.content?.videos || [],
      strokes: currentBoard.content?.strokes || [],
      texts: currentBoard.content?.texts || []
    };
    console.log('Board content for Canvas:', content);
    return content;
  };

  // Tool selection handler
  const handleToolSelect = (tool: string) => {
    setSelectedTool(tool);
    if (tool !== 'draw') {
      setSketchBarOpen(false);
    }
  };

  // Text added handler
  const handleTextAdded = (textData: any) => {
    console.log('Text added:', textData);
  };

  // Sketch mode handlers
  const handleSketchModeActivated = () => {
    setSelectedMode('sketch');
    setSketchBarOpen(true);
  };

  const handleCloseSketchBar = () => {
    setSketchBarOpen(false);
    setSelectedMode('');
  };

  // Bounding box handlers
  const handleBoundingBoxCreated = (bbox: any) => {
    setBoundingBoxCreated(true);
    console.log('Bounding box created:', bbox);
  };

  const handleCloseRenderBar = () => {
    setSelectedMode('');
  };

  // Background removal handler
  const handleBackgroundRemoved = (newImageSrc: string) => {
    if (canvasRef.current) {
      canvasRef.current.replaceSelectedImage(newImageSrc);
    }
  };

  // Board management handlers
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
    
    // Navigate to the new board URL
    navigateToBoard(navigate, newBoard.id);
  };

  const handleSwitchBoard = (id: string) => {
    setCurrentBoardId(id);
    // Reload the board data to ensure fresh content
    const board = boards.find(b => b.id === id);
    if (board) {
      console.log('Switching to board:', board);
    }
    // Navigate to the board URL
    navigateToBoard(navigate, id);
  };

  const handleEnterBoard = (id: string) => {
    setCurrentBoardId(id);
    setShowBoardOverlay(false);
    // Navigate to the board URL
    navigateToBoard(navigate, id);
  };

  const handleDeleteBoard = async (id: string) => {
    await deleteBoard(id);
    setBoards(prev => prev.filter(b => b.id !== id));
    
    // If we're currently on the deleted board, redirect to home
    if (currentBoardId === id) {
      setCurrentBoardId(null);
      navigate(getDashboardUrl());
    }
  };

  const handleCancelBoardOverlay = () => {
    // Only allow cancel if there's a valid current board to return to
    if (currentBoardId && boards.find(b => b.id === currentBoardId)) {
      setShowBoardOverlay(false);
      // Navigate back to the current board URL
      if (boardId) {
        navigateToBoard(navigate, boardId);
      }
    }
  };

  const isCancelDisabled = !currentBoardId || !boards.find(b => b.id === currentBoardId);

  const handleUpdateBoardName = async (id: string, name: string) => {
    const updated = await updateBoard({ id, name });
    setBoards(boards => boards.map(b => b.id === id ? { ...b, name: updated.name, lastEdited: updated.lastEdited } : b));
  };

  const handleUpdateBoardContent = async (id: string, content: any) => {
    console.log('Saving board content to Supabase:', { id, content });
    const updated = await updateBoard({ id, content });
    setBoards(boards => boards.map(b => b.id === id ? { ...b, content: updated.content, lastEdited: updated.lastEdited } : b));
  };

  const handleAuthSuccess = async () => {
    try {
      setShowAuth(false);
      // Reload user data after successful auth
      const { data } = await getUser();
      if (data?.user) {
        setUserId(data.user.id);
        const name = data.user.user_metadata?.name || '';
        setUserName(name);
        
        // Load boards for user
        const userBoards = await getBoardsForUser(data.user.id);
        setBoards(userBoards);
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
    navigate(getDashboardUrl());
    setCurrentBoardId(null);
    setUserId(null);
    setShowBoardOverlay(false);
  };

  // Show loading state while checking user
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#181818] flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  // Show error state if board not found
  if (boardError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Board Not Found</h1>
          <p className="text-gray-600 mb-4">{boardError}</p>
          <button
            onClick={() => navigate(getDashboardUrl())}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // Show loading state while validating board
  if (boardId && !boardValidated && !boardError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading board...</p>
        </div>
      </div>
    );
  }

  // Main board interface - EXACT COPY from Index.tsx
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
                  canUndo={canUndo}
                  canRedo={canRedo}
                />
              </div>
            )}
            
            <div className="flex flex-1 relative">
              <div className="flex-1" />
              
              {/* Restore original bottom bar position: centered at bottom - hidden during auth overlay and board overlay */}
              {!showAuth && !showBoardOverlay && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2.5 pointer-events-auto">
                  <GenerationPanel />
                  {userId && (
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
                      userId={userId}
                    />
                  )}
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

export default BoardPage;