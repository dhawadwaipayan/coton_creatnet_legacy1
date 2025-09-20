import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUser, signOut, getBoardsForUser, updateBoard } from '../lib/utils';
import { navigateToBoard, isValidBoardId, getDashboardUrl } from '../lib/boardUtils';
import { BoardInterface } from '../components/BoardInterface';
import AuthOverlay from '../components/AuthOverlay';

const BoardPage = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  
  // Auth state
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [showAuth, setShowAuth] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  
  // Board state
  const [boards, setBoards] = useState([]);
  const [currentBoard, setCurrentBoard] = useState<any>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardValidated, setBoardValidated] = useState(false);
  
  // Canvas state
  const [selectedTool, setSelectedTool] = useState<string | null>('select');
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [selectedVideoSrc, setSelectedVideoSrc] = useState<string | null>(null);
  const [sketchBarOpen, setSketchBarOpen] = useState(false);
  const [boundingBoxCreated, setBoundingBoxCreated] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>('');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [zoom, setZoom] = useState(100);
  
  // Brush state
  const [brushColor, setBrushColor] = useState('#FF0000');
  const [brushSize, setBrushSize] = useState(5);
  const [textColor, setTextColor] = useState('#FF0000');
  
  // Sketch/Render state
  const [sketchBoundingBox, setSketchBoundingBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [renderBoundingBox, setRenderBoundingBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  
  const canvasRef = useRef<any>(null);
  const sketchModeActive = sketchBarOpen && selectedMode === 'sketch';
  const renderModeActive = selectedMode === 'render';

  // Load user and board
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
            if (!isValidBoardId(boardId)) {
              setBoardError('Invalid board ID format');
              setTimeout(() => {
                navigate(getDashboardUrl());
              }, 3000);
              return;
            }
            
            const boardExists = userBoards.find(b => b.id === boardId);
            if (boardExists) {
              setCurrentBoard(boardExists);
              setBoardError(null);
              setBoardValidated(true);
            } else {
              setBoardError('Board not found or access denied');
              setBoardValidated(false);
              setTimeout(() => {
                navigate(getDashboardUrl());
              }, 3000);
            }
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
      const reloadBoardData = async () => {
        try {
          const userBoards = await getBoardsForUser(userId);
          setBoards(userBoards);
          const board = userBoards.find(b => b.id === boardId);
          if (board) {
            setCurrentBoard(board);
          }
        } catch (error) {
          console.error('Error reloading board data:', error);
        }
      };
      reloadBoardData();
    }
  }, [boardId, userId, boardValidated]);

  // Update undo/redo state from canvas
  useEffect(() => {
    const updateUndoRedoState = () => {
      if (canvasRef.current) {
        setCanUndo(canvasRef.current.canUndo || false);
        setCanRedo(canvasRef.current.canRedo || false);
      }
    };

    updateUndoRedoState();
    const interval = setInterval(updateUndoRedoState, 100);
    return () => clearInterval(interval);
  }, []);

  // Sync zoom state with Canvas zoom changes
  useEffect(() => {
    const syncZoom = () => {
      if (canvasRef.current?.zoom) {
        setZoom(canvasRef.current.zoom);
      }
    };
    
    syncZoom();
    const interval = setInterval(syncZoom, 100);
    return () => clearInterval(interval);
  }, []);

  // Handlers
  const handleToolSelect = (tool: string) => {
    setSelectedTool(tool);
    if (tool !== 'draw') {
      setSketchBarOpen(false);
    }
  };

  const handleTextAdded = (textData: any) => {
    console.log('Text added:', textData);
  };

  const handleSketchModeActivated = () => {
    setSelectedMode('sketch');
    setSketchBarOpen(true);
  };

  const handleCloseSketchBar = () => {
    setSketchBarOpen(false);
    setSelectedMode('');
  };

  const handleBoundingBoxCreated = (bbox: any) => {
    setBoundingBoxCreated(true);
    console.log('Bounding box created:', bbox);
  };

  const handleCloseRenderBar = () => {
    setSelectedMode('');
  };

  const handleBackgroundRemoved = (newImageSrc: string) => {
    if (canvasRef.current) {
      canvasRef.current.replaceSelectedImage(newImageSrc);
    }
  };

  const handleUpdateBoardName = async (id: string, name: string) => {
    const updated = await updateBoard({ id, name });
    setBoards(boards => boards.map(b => b.id === id ? { ...b, name: updated.name, lastEdited: updated.lastEdited } : b));
    setCurrentBoard(prev => prev ? { ...prev, name: updated.name, lastEdited: updated.lastEdited } : null);
  };

  const handleUpdateBoardContent = async (id: string, content: any) => {
    const updated = await updateBoard({ id, content });
    setBoards(boards => boards.map(b => b.id === id ? { ...b, content: updated.content, lastEdited: updated.lastEdited } : b));
    setCurrentBoard(prev => prev ? { ...prev, content: updated.content, lastEdited: updated.lastEdited } : null);
  };

  const handleShowBoardOverlay = () => {
    navigate(getDashboardUrl());
  };

  const handleLogout = async () => {
    await signOut();
    setShowAuth(true);
    setUserName('');
    setBoards([]);
    setCurrentBoard(null);
    navigate(getDashboardUrl());
  };

  const handleAuthSuccess = async () => {
    try {
      setShowAuth(false);
      const { data } = await getUser();
      if (data?.user) {
        setUserId(data.user.id);
        const name = data.user.user_metadata?.name || '';
        setUserName(name);
        
        const userBoards = await getBoardsForUser(data.user.id);
        setBoards(userBoards);
      }
    } catch (error) {
      console.error('Error in handleAuthSuccess:', error);
    }
  };

  // Zoom handlers
  const handleCanvasZoomIn = () => {
    if (canvasRef.current && canvasRef.current.zoomIn) {
      canvasRef.current.zoomIn();
      setZoom(canvasRef.current.zoom);
    }
  };
  
  const handleCanvasZoomOut = () => {
    if (canvasRef.current && canvasRef.current.zoomOut) {
      canvasRef.current.zoomOut();
      setZoom(canvasRef.current.zoom);
    }
  };
  
  const handleCanvasZoomReset = () => {
    if (canvasRef.current && canvasRef.current.resetZoom) {
      canvasRef.current.resetZoom();
      setZoom(1);
    }
  };
  
  const handleCanvasZoomFit = () => {
    if (canvasRef.current && canvasRef.current.fitToViewport) {
      canvasRef.current.fitToViewport();
      setZoom(canvasRef.current.zoom);
    }
  };

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
            Return to Dashboard
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

  return (
    <>
      {/* Auth Overlay */}
      {showAuth && <AuthOverlay onAuthSuccess={handleAuthSuccess} />}
      
      <main className="bg-[rgba(33,33,33,1)] flex flex-col overflow-hidden min-h-screen relative">
        <BoardInterface
          currentBoard={currentBoard}
          boards={boards}
          userId={userId}
          userName={userName}
          showAuth={showAuth}
          showBoardOverlay={false} // Never show board overlay on individual board page
          loadingUser={loadingUser}
          selectedTool={selectedTool}
          selectedImageSrc={selectedImageSrc}
          selectedVideoSrc={selectedVideoSrc}
          sketchBarOpen={sketchBarOpen}
          boundingBoxCreated={boundingBoxCreated}
          selectedMode={selectedMode}
          canUndo={canUndo}
          canRedo={canRedo}
          zoom={zoom}
          brushColor={brushColor}
          brushSize={brushSize}
          textColor={textColor}
          sketchModeActive={sketchModeActive}
          sketchBoundingBox={sketchBoundingBox}
          renderModeActive={renderModeActive}
          renderBoundingBox={renderBoundingBox}
          onToolSelect={handleToolSelect}
          onImageSelect={setSelectedImageSrc}
          onVideoSelect={setSelectedVideoSrc}
          onSketchBarToggle={() => setSketchBarOpen(!sketchBarOpen)}
          onModeSelect={setSelectedMode}
          onBoundingBoxCreated={handleBoundingBoxCreated}
          onBackgroundRemoved={handleBackgroundRemoved}
          onTextAdded={handleTextAdded}
          onSketchModeActivated={handleSketchModeActivated}
          onCloseSketchBar={handleCloseSketchBar}
          onCloseRenderBar={handleCloseRenderBar}
          onSketchBoundingBoxChange={setSketchBoundingBox}
          onRenderBoundingBoxChange={setRenderBoundingBox}
          onUpdateBoardName={handleUpdateBoardName}
          onUpdateBoardContent={handleUpdateBoardContent}
          onShowBoardOverlay={handleShowBoardOverlay}
          onLogout={handleLogout}
          onCanvasZoomIn={handleCanvasZoomIn}
          onCanvasZoomOut={handleCanvasZoomOut}
          onCanvasZoomReset={handleCanvasZoomReset}
          onCanvasZoomFit={handleCanvasZoomFit}
          canvasRef={canvasRef}
        />
      </main>
    </>
  );
};

export default BoardPage;