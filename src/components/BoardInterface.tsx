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

export interface BoardInterfaceProps {
  // Board data
  currentBoard: any;
  boards: any[];
  userId: string | null;
  userName: string;
  
  // UI state
  showAuth: boolean;
  showBoardOverlay: boolean;
  loadingUser: boolean;
  
  // Canvas state
  selectedTool: string | null;
  selectedImageSrc: string | null;
  selectedVideoSrc: string | null;
  sketchBarOpen: boolean;
  boundingBoxCreated: boolean;
  selectedMode: string;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  
  // Brush state
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  textColor: string;
  setTextColor: (color: string) => void;
  
  // Sketch/Render state
  sketchModeActive: boolean;
  sketchBoundingBox: { x: number, y: number, width: number, height: number } | null;
  renderModeActive: boolean;
  renderBoundingBox: { x: number, y: number, width: number, height: number } | null;
  
  // Handlers
  onToolSelect: (tool: string) => void;
  onImageSelect: (src: string | null) => void;
  onVideoSelect: (src: string | null) => void;
  onSketchBarToggle: () => void;
  onModeSelect: (mode: string) => void;
  onBoundingBoxCreated: (bbox: any) => void;
  onBackgroundRemoved: (newImageSrc: string) => void;
  onTextAdded: (textData: any) => void;
  onSketchModeActivated: () => void;
  onCloseSketchBar: () => void;
  onCloseRenderBar: () => void;
  onSketchBoundingBoxChange: (box: { x: number, y: number, width: number, height: number } | null) => void;
  onRenderBoundingBoxChange: (box: { x: number, y: number, width: number, height: number } | null) => void;
  
  // Board management
  onUpdateBoardName: (id: string, name: string) => void;
  onUpdateBoardContent: (id: string, content: any) => void;
  onShowBoardOverlay: () => void;
  onLogout: () => void;
  
  // Zoom handlers
  onCanvasZoomIn: () => void;
  onCanvasZoomOut: () => void;
  onCanvasZoomReset: () => void;
  onCanvasZoomFit: () => void;
  
  // Canvas ref
  canvasRef: React.RefObject<any>;
}

export const BoardInterface: React.FC<BoardInterfaceProps> = ({
  currentBoard,
  boards,
  userId,
  userName,
  showAuth,
  showBoardOverlay,
  loadingUser,
  selectedTool,
  selectedImageSrc,
  selectedVideoSrc,
  sketchBarOpen,
  boundingBoxCreated,
  selectedMode,
  canUndo,
  canRedo,
  zoom,
  brushColor,
  setBrushColor,
  brushSize,
  setBrushSize,
  textColor,
  setTextColor,
  sketchModeActive,
  sketchBoundingBox,
  renderModeActive,
  renderBoundingBox,
  onToolSelect,
  onImageSelect,
  onVideoSelect,
  onSketchBarToggle,
  onModeSelect,
  onBoundingBoxCreated,
  onBackgroundRemoved,
  onTextAdded,
  onSketchModeActivated,
  onCloseSketchBar,
  onCloseRenderBar,
  onSketchBoundingBoxChange,
  onRenderBoundingBoxChange,
  onUpdateBoardName,
  onUpdateBoardContent,
  onShowBoardOverlay,
  onLogout,
  onCanvasZoomIn,
  onCanvasZoomOut,
  onCanvasZoomReset,
  onCanvasZoomFit,
  canvasRef
}) => {
  // Prepare board content for Canvas
  const getBoardContentForCanvas = () => {
    if (showAuth || showBoardOverlay) return null;
    if (!currentBoard) return null;
    
    const content = {
      id: currentBoard.id,
      user_id: currentBoard.user_id,
      images: currentBoard.content?.images || [],
      videos: currentBoard.content?.videos || [],
      strokes: currentBoard.content?.strokes || [],
      texts: currentBoard.content?.texts || []
    };
    return content;
  };

  // Show loading state
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#181818] flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {/* UserBar - positioned outside main container to ensure it's on top */}
      {!showAuth && (
        <div className="fixed top-[34px] right-6 z-[100] pointer-events-auto">
          <UserBar userName={userName} onLogout={onLogout} />
        </div>
      )}
      
      <div style={{ pointerEvents: showAuth ? 'none' : 'auto' }}>
        {/* Canvas Background - behind everything */}
        <Canvas
          ref={canvasRef}
          selectedTool={selectedTool || 'select'}
          onSelectedImageSrcChange={onImageSelect}
          onSelectedVideoSrcChange={onVideoSelect}
          brushColor={brushColor}
          brushSize={brushSize}
          textColor={textColor}
          onTextAdded={onTextAdded}
          sketchModeActive={sketchModeActive}
          renderModeActive={renderModeActive}
          onRenderBoundingBoxChange={onRenderBoundingBoxChange}
          boardContent={getBoardContentForCanvas()}
          onContentChange={content => currentBoard && onUpdateBoardContent(currentBoard.id, content)}
        />

        {/* Sidebar - positioned center left - hidden during auth overlay and board overlay */}
        {!showAuth && !showBoardOverlay && (
          <Sidebar 
            onToolSelect={onToolSelect} 
            selectedImageSrc={selectedImageSrc} 
            selectedVideoSrc={selectedVideoSrc}
            selectedTool={selectedTool} 
            setSelectedTool={onToolSelect}
            onBackgroundRemoved={onBackgroundRemoved}
          />
        )}

        {/* BrushSubBar - beside sidebar, only when draw tool is selected */}
        {!showAuth && !showBoardOverlay && selectedTool === 'draw' && (
          <BrushSubBar
            brushColor={brushColor}
            setBrushColor={setBrushColor}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
          />
        )}

        {/* TextSubBar - beside sidebar, only when text tool is selected */}
        {!showAuth && !showBoardOverlay && selectedTool === 'text' && (
          <TextSubBar
            textColor={textColor}
            setTextColor={setTextColor}
          />
        )}

        {/* UI Overlay - above canvas */}
        <div className="relative z-10 flex flex-col pl-[37px] pr-20 py-[34px] min-h-screen max-md:px-5 pointer-events-none">
          {/* Top Bar - positioned top left */}
          {!showAuth && !showBoardOverlay && (
            <div className="absolute top-[34px] left-6 pointer-events-auto">
              <TopBar
                canvasRef={canvasRef}
                onLogoClick={onShowBoardOverlay}
                boardName={currentBoard?.name || ''}
                onBoardNameChange={name => currentBoard && onUpdateBoardName(currentBoard.id, name)}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            </div>
          )}
          
          <div className="flex flex-1 relative">
            <div className="flex-1" />
            
            {/* Bottom bar - centered at bottom */}
            {!showAuth && !showBoardOverlay && (
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2.5 pointer-events-auto">
                <GenerationPanel />
                {userId && (
                  <ModePanel
                    canvasRef={canvasRef}
                    onSketchModeActivated={onSketchModeActivated}
                    onBoundingBoxCreated={onBoundingBoxCreated}
                    showSketchSubBar={sketchBarOpen}
                    closeSketchBar={onCloseSketchBar}
                    selectedMode={selectedMode}
                    setSelectedMode={onModeSelect}
                    brushColor={brushColor}
                    setBrushColor={setBrushColor}
                    brushSize={brushSize}
                    setBrushSize={setBrushSize}
                    sketchModeActive={sketchModeActive}
                    onSketchBoundingBoxChange={onSketchBoundingBoxChange}
                    onRenderBoundingBoxChange={onRenderBoundingBoxChange}
                    renderBoundingBox={renderBoundingBox}
                    closeRenderBar={onCloseRenderBar}
                    userId={userId}
                  />
                )}
              </div>
            )}
          </div>
          
          {/* ZoomBar: bottom right */}
          {!showAuth && !showBoardOverlay && (
            <div className="pointer-events-auto absolute right-6 bottom-[34px] z-20">
              <ZoomBar 
                zoom={zoom} 
                onZoomIn={onCanvasZoomIn} 
                onZoomOut={onCanvasZoomOut}
                viewportWidth={window.innerWidth}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};
