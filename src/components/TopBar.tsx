import React, { useState, useRef } from 'react';
import { List, ArrowUpLeft } from '@phosphor-icons/react';

interface ButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  iconOnly?: boolean;
}

const TopBarButton: React.FC<ButtonProps> = ({ 
  icon, 
  label, 
  onClick, 
  disabled = false,
  iconOnly = false
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
      className={`flex items-center ${iconOnly ? 'gap-0 justify-center px-2' : 'gap-2.5 justify-center px-2.5'} py-2 text-sm whitespace-nowrap min-h-[30px] cursor-pointer transition-colors ${getTextColor()} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      aria-label={label}
      disabled={disabled}
    >
      <div className="w-[12px] h-[12px] flex items-center justify-center">
        {icon}
      </div>
      {!iconOnly && <span className="self-stretch my-auto">{label}</span>}
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
          icon={<List size={12} weight="regular" />}
          label="Import"
          onClick={handleImport}
          iconOnly={true}
        />
        <TopBarButton
          icon={<ArrowUpLeft size={12} weight="regular" />}
          label="Undo"
          onClick={handleUndo}
          disabled={!canUndo}
          iconOnly={true}
        />
        <TopBarButton
          icon={<ArrowUpLeft size={12} weight="regular" />}
          label="Redo"
          onClick={handleRedo}
          disabled={!canRedo}
          iconOnly={true}
        />
      </div>
    </div>
  );
};