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
  const [sketchBarOpen, setSketchBarOpen] = useState(false);
  const [boundingBoxCreated, setBoundingBoxCreated] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>('');
  const canvasRef = useRef<any>(null);
  
  // Zoom state for demo
  const [zoom, setZoom] = useState(100);
  const handleZoomIn = () => setZoom(z => Math.min(z + 10, 500));
  const handleZoomOut = () => setZoom(z => Math.max(z - 10, 10));

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

  // Board state management
  const [boards, setBoards] = useState([]);
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingBoards, setLoadingBoards] = useState(false);

  // Load boards from Supabase on login
  useEffect(() => {
    getUser().then(({ data }) => {
      if (data?.user) {
        setShowAuth(false);
        setUserId(data.user.id);
        const name = data.user.user_metadata?.name || '';
        setUserName(name);
        setLoadingBoards(true);
        getBoardsForUser(data.user.id)
          .then(boards => {
            setBoards(boards || []);
            setCurrentBoardId(boards && boards.length > 0 ? boards[0].id : null);
          })
          .finally(() => setLoadingBoards(false));
      } else {
        setShowAuth(true);
        setUserName('');
        setBoards([]);
        setCurrentBoardId(null);
        setUserId(null);
      }
    });
  }, []);

  // Create new board (max 3)
  const handleCreateNewBoard = async () => {
    if (!userId || boards.length >= 3) return;
    const newBoard = await createBoard({
      user_id: userId,
      name: `Untitled ${boards.length + 1}`,
      content: {},
    });
    setBoards(prev => [...prev, newBoard]);
    setCurrentBoardId(newBoard.id);
  };

  // Switch board
  const handleSwitchBoard = (id) => {
    setCurrentBoardId(id);
  };

  // Update board name
  const handleUpdateBoardName = async (id, name) => {
    const updated = await updateBoard({ id, name });
    setBoards(boards => boards.map(b => b.id === id ? { ...b, name: updated.name, lastEdited: updated.lastEdited } : b));
  };

  // Autosave board content
  const handleUpdateBoardContent = async (id, content) => {
    const updated = await updateBoard({ id, content });
    setBoards(boards => boards.map(b => b.id === id ? { ...b, content: updated.content, lastEdited: updated.lastEdited } : b));
  };

  // Get current board
  const currentBoard = boards.find(b => b.id === currentBoardId) || null;

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

  const handleAuthSuccess = () => {
    getUser().then(({ data }) => {
      setShowAuth(false);
      const name = data?.user?.user_metadata?.name || '';
      setUserName(name);
    });
  };

  const handleLogout = async () => {
    await signOut();
    setShowAuth(true);
    setUserName('');
  };

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

  return (
    <>
      {/* Auth Overlay - always rendered at the top level for perfect centering */}
      {showAuth && <AuthOverlay onAuthSuccess={handleAuthSuccess} />}
      <main className="bg-[rgba(33,33,33,1)] flex flex-col overflow-hidden min-h-screen relative">
        {/* Board Overlay - open when logo is clicked */}
        {showBoardOverlay && (
          <BoardOverlay
            onCancel={() => setShowBoardOverlay(false)}
            onCreateNew={handleCreateNewBoard}
            boards={boards}
            currentBoardId={currentBoardId}
            onSwitchBoard={handleSwitchBoard}
          />
        )}
        <div style={{ pointerEvents: showAuth ? 'none' : 'auto' }}>
          {/* Canvas Background - behind everything */}
          <Canvas
            ref={canvasRef}
            selectedTool={selectedTool || 'select'}
            onSelectedImageSrcChange={setSelectedImageSrc}
            brushColor={brushColor}
            brushSize={brushSize}
            textColor={textColor}
            onTextAdded={handleTextAdded}
            sketchModeActive={sketchModeActive}
            renderModeActive={renderModeActive}
            onRenderBoundingBoxChange={setRenderBoundingBox}
            boardContent={showBoardOverlay ? null : currentBoard?.content}
            onContentChange={content => currentBoard && handleUpdateBoardContent(currentBoard.id, content)}
          />

          {/* Sidebar - positioned center left */}
          <Sidebar onToolSelect={handleToolSelect} selectedImageSrc={selectedImageSrc} selectedTool={selectedTool} setSelectedTool={setSelectedTool} />

          {/* BrushSubBar - beside sidebar, only when draw tool is selected */}
          {selectedTool === 'draw' && (
            <BrushSubBar
              brushColor={brushColor}
              setBrushColor={setBrushColor}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
            />
          )}

          {/* TextSubBar - beside sidebar, only when text tool is selected */}
          {selectedTool === 'text' && (
            <TextSubBar
              textColor={textColor}
              setTextColor={setTextColor}
            />
          )}

          {/* UI Overlay - above canvas */}
          <div className="relative z-10 flex flex-col pl-[37px] pr-20 py-[34px] min-h-screen max-md:px-5 pointer-events-none">
            {/* Top Bar - positioned top left */}
            <div className="absolute top-[34px] left-6 pointer-events-auto">
              <TopBar
                canvasRef={canvasRef}
                onLogoClick={() => setShowBoardOverlay(true)}
                boardName={currentBoard?.name || ''}
                onBoardNameChange={name => currentBoard && handleUpdateBoardName(currentBoard.id, name)}
              />
            </div>
            
            {/* UserBar only visible if authenticated */}
            {!showAuth && (
              <div className="absolute top-[34px] right-6 z-30 pointer-events-auto">
                <UserBar userName={userName} onLogout={handleLogout} />
              </div>
            )}
            
            <div className="flex flex-1 relative">
              <div className="flex-1" />
              
              {/* Restore original bottom bar position: centered at bottom */}
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
                />
              </div>
            </div>
            {/* ZoomBar: bottom right, right-6 and bottom-[34px] for perfect gap */}
            <div className="pointer-events-auto absolute right-6 bottom-[34px] z-20">
              <ZoomBar zoom={zoom} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default Index;
