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
import { navigateToBoard, isValidBoardId } from '../lib/boardUtils';
import { v4 as uuidv4 } from 'uuid';

const BoardPage = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  
  // All existing state from Index.tsx
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
      setZoom(100);
    }
  };

  // Auth and board state
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [boards, setBoards] = useState<any[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [showBoardOverlay, setShowBoardOverlay] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardValidated, setBoardValidated] = useState(false);

  // Load user and boards
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const { data: { user } } = await getUser();
        if (user) {
          setUserId(user.id);
          setShowAuth(false);
          
          // Load boards for user
          const userBoards = await getBoardsForUser(user.id);
          setBoards(userBoards);
          
          // If we have a boardId from URL, validate and set it
          if (boardId) {
            // First validate the board ID format
            if (!isValidBoardId(boardId)) {
              setBoardError('Invalid board ID format');
              setTimeout(() => {
                navigate('/');
              }, 3000);
              return;
            }
            
            const boardExists = userBoards.find(b => b.id === boardId);
            if (boardExists) {
              setCurrentBoardId(boardId);
              setShowBoardOverlay(false);
              setBoardError(null); // Clear any previous errors
              setBoardValidated(true);
            } else {
              setBoardError('Board not found or access denied');
              setShowBoardOverlay(false); // Don't show overlay for invalid boards
              setBoardValidated(false);
              // Redirect to home after a delay
              setTimeout(() => {
                navigate('/');
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

  // Handle board creation with URL navigation
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

  // Handle board switching with URL navigation
  const handleSwitchBoard = (id: string) => {
    setCurrentBoardId(id);
    // Navigate to the board URL
    navigateToBoard(navigate, id);
  };

  // Handle entering board (double click)
  const handleEnterBoard = (id: string) => {
    setCurrentBoardId(id);
    setShowBoardOverlay(false);
    // Navigate to the board URL
    navigateToBoard(navigate, id);
  };

  // Handle board deletion with URL navigation
  const handleDeleteBoard = async (id: string) => {
    await deleteBoard(id);
    setBoards(prev => prev.filter(b => b.id !== id));
    
    // If the deleted board was current, redirect to home
    if (currentBoardId === id) {
      setCurrentBoardId(null);
      navigate('/');
    }
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
  const handleUpdateBoardName = async (id: string, name: string) => {
    const updated = await updateBoard({ id, name });
    setBoards(boards => boards.map(b => b.id === id ? { ...b, name: updated.name, lastEdited: updated.lastEdited } : b));
  };

  // Autosave board content
  const handleUpdateBoardContent = async (id: string, content: any) => {
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

  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    setUserId(null);
    setShowAuth(true);
    setBoards([]);
    setCurrentBoardId(null);
    navigate('/');
  };

  // Show loading state while checking user
  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
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
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // Show auth overlay if not authenticated
  if (showAuth) {
    return <AuthOverlay onAuthSuccess={() => setShowAuth(false)} />;
  }

  // Show board overlay if no board selected and we're not on a specific board URL
  if (showBoardOverlay && !boardId) {
    return (
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

  // Main board interface (same as Index.tsx)
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <TopBar
        onSignOut={handleSignOut}
        onShowBoardOverlay={() => setShowBoardOverlay(true)}
        currentBoardName={currentBoard?.name || 'Untitled'}
        onUpdateBoardName={(name) => currentBoardId && handleUpdateBoardName(currentBoardId, name)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => canvasRef.current?.undo()}
        onRedo={() => canvasRef.current?.redo()}
        isSaving={false} // You can add saving state if needed
      />
      
      <div className="flex-1 flex">
        <Sidebar
          selectedTool={selectedTool}
          onToolSelect={setSelectedTool}
          onImageSelect={setSelectedImageSrc}
          onVideoSelect={setSelectedVideoSrc}
          onSketchBarToggle={() => setSketchBarOpen(!sketchBarOpen)}
          sketchBarOpen={sketchBarOpen}
          onModeSelect={setSelectedMode}
          selectedMode={selectedMode}
        />
        
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            <Canvas
              ref={canvasRef}
              boardContent={getBoardContentForCanvas()}
              onContentChange={handleUpdateBoardContent}
              selectedTool={selectedTool}
              selectedImageSrc={selectedImageSrc}
              selectedVideoSrc={selectedVideoSrc}
              onImageSelect={setSelectedImageSrc}
              onVideoSelect={setSelectedVideoSrc}
              onBoundingBoxCreated={setBoundingBoxCreated}
              boundingBoxCreated={boundingBoxCreated}
              selectedMode={selectedMode}
              onModeSelect={setSelectedMode}
            />
            
            {selectedTool === 'brush' && (
              <BrushSubBar
                onClose={() => setSelectedTool('select')}
              />
            )}
            
            {selectedTool === 'text' && (
              <TextSubBar
                onClose={() => setSelectedTool('select')}
              />
            )}
          </div>
          
          <div className="flex items-center justify-between p-4 bg-white border-t">
            <div className="flex items-center space-x-4">
              <GenerationPanel
                selectedMode={selectedMode}
                onModeSelect={setSelectedMode}
                boundingBoxCreated={boundingBoxCreated}
                onBoundingBoxCreated={setBoundingBoxCreated}
                selectedImageSrc={selectedImageSrc}
                selectedVideoSrc={selectedVideoSrc}
                onImageSelect={setSelectedImageSrc}
                onVideoSelect={setSelectedVideoSrc}
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <ModePanel
                selectedMode={selectedMode}
                onModeSelect={setSelectedMode}
                boundingBoxCreated={boundingBoxCreated}
                onBoundingBoxCreated={setBoundingBoxCreated}
                selectedImageSrc={selectedImageSrc}
                selectedVideoSrc={selectedVideoSrc}
                onImageSelect={setSelectedImageSrc}
                onVideoSelect={setSelectedVideoSrc}
              />
            </div>
          </div>
        </div>
      </div>
      
      <ZoomBar
        zoom={zoom}
        onZoomIn={handleCanvasZoomIn}
        onZoomOut={handleCanvasZoomOut}
        onZoomReset={handleZoomReset}
      />
      
      <UserBar
        userId={userId}
        onSignOut={handleSignOut}
      />
    </div>
  );
};

export default BoardPage;
