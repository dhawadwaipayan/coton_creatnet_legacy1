import React, { useState, useRef } from 'react';

interface ButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const TopBarButton: React.FC<ButtonProps> = ({ 
  icon, 
  label, 
  onClick, 
  disabled = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setIsClicked(true);
    onClick();
    setTimeout(() => setIsClicked(false), 150);
  };

  const getTextColor = () => {
    if (disabled) return 'text-neutral-600';
    if (isClicked) return 'text-[#E1FF00]';
    if (isHovered) return 'text-white';
    return 'text-neutral-400';
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`flex items-center gap-2.5 justify-center px-2.5 py-2 text-sm whitespace-nowrap min-h-[30px] cursor-pointer transition-colors ${getTextColor()} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      aria-label={label}
      disabled={disabled}
    >
      <div className="w-[12px] h-[12px] flex items-center justify-center">
        {icon}
      </div>
      <span className="self-stretch my-auto">{label}</span>
    </button>
  );
};

interface TopBarProps {
  canvasRef: React.RefObject<any>;
  onLogoClick?: () => void;
  boardName: string;
  onBoardNameChange: (name: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ canvasRef, onLogoClick, boardName, onBoardNameChange, canUndo = false, canRedo = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // boardName and onBoardNameChange come from props
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [boardNameInput, setBoardNameInput] = useState(boardName);

  // Keep local input in sync if boardName changes from outside
  React.useEffect(() => {
    if (!editing) setBoardNameInput(boardName);
  }, [boardName, editing]);
  
  const handleImport = () => {
    console.log('TopBar: Import button clicked');
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('TopBar: File selected:', file?.name, file?.type);
    if (file && file.type.startsWith('image/')) {
      console.log('TopBar: Valid image file, calling canvas import handler');
      if (canvasRef.current && typeof canvasRef.current.importImage === 'function') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          canvasRef.current?.importImage(dataUrl);
        };
        reader.readAsDataURL(file);
        console.log('TopBar: Canvas import handler called successfully');
      } else {
        console.error('TopBar: Canvas import handler not found on window object');
      }
    } else {
      console.log('TopBar: Invalid file type or no file selected');
    }
    event.target.value = '';
  };
  
  const handleExport = () => {
    console.log('Export clicked');
  };
  
  const handleUndo = () => {
    if (canvasRef.current && typeof canvasRef.current.undo === 'function') {
      canvasRef.current.undo();
    } else {
      console.log('Undo clicked (no undo function on canvasRef)');
    }
  };
  
  const handleRedo = () => {
    if (canvasRef.current && typeof canvasRef.current.redo === 'function') {
      canvasRef.current.redo();
    } else {
      console.log('Redo clicked (no redo function on canvasRef)');
    }
  };

  const handleBoardNameClick = () => {
    setBoardNameInput(boardName);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleBoardNameBlur = () => {
    if (!boardNameInput.trim()) {
      onBoardNameChange('Untitled 1');
    } else {
      onBoardNameChange(boardNameInput);
    }
    setEditing(false);
  };

  const handleBoardNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (!boardNameInput.trim()) {
        onBoardNameChange('Untitled 1');
      } else {
        onBoardNameChange(boardNameInput);
      }
      setEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-4 bg-[#1a1a1a] border border-[#373737] rounded-xl px-4 py-2 h-[45px] pointer-events-auto">
      {/* Hidden file input */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        className="hidden" 
        aria-label="Import image file"
      />
      
      {/* Logo (clickable) */}
      <button className="flex items-center focus:outline-none" onClick={onLogoClick} aria-label="Open Board History">
        <img 
          src="/CotonAI_Logo2.svg" 
          alt="Coton AI Logo" 
          className="h-[15px] w-auto object-contain" 
        />
      </button>
      
      {/* Divider */}
      <div className="bg-[#373737] w-px h-[21px]" />
      
      {/* Board Name */}
      {editing ? (
        <input
          ref={inputRef}
          value={boardNameInput}
          onChange={e => setBoardNameInput(e.target.value)}
          onBlur={handleBoardNameBlur}
          onKeyDown={handleBoardNameKeyDown}
          className="text-white text-sm font-normal bg-transparent border-none outline-none px-0 py-0 w-[90px]"
          style={{ minWidth: 0, maxWidth: '90px' }}
          maxLength={20}
        />
      ) : (
        <span
          className="text-white text-sm font-normal cursor-pointer select-text w-[90px] inline-block truncate"
          onClick={handleBoardNameClick}
          style={{ maxWidth: '90px' }}
        >
          {boardName}
        </span>
      )}
      
      {/* Divider */}
      <div className="bg-[#373737] w-px h-[21px]" />
      
      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <TopBarButton
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
          }
          label="Import"
          onClick={handleImport}
        />
        <TopBarButton
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z" clipRule="evenodd" />
            </svg>
          }
          label="Undo"
          onClick={handleUndo}
          disabled={!canUndo}
        />
        <TopBarButton
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M12.207 2.232a.75.75 0 00.025 1.06l4.146 3.958H6.375a5.375 5.375 0 000 10.75H9.25a.75.75 0 000-1.5H6.375a3.875 3.875 0 010-7.75h10.003l-4.146 3.957a.75.75 0 001.036 1.085l5.5-5.25a.75.75 0 000-1.085l-5.5-5.25a.75.75 0 00-1.06.025z" clipRule="evenodd" />
            </svg>
          }
          label="Redo"
          onClick={handleRedo}
          disabled={!canRedo}
        />
      </div>
    </div>
  );
};