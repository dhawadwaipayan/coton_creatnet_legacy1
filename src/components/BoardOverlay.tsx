import React, { useState } from 'react';
import { ShareNetwork, Trash } from '@phosphor-icons/react';

const CARD_WIDTH = 650;
const CARD_HEIGHT = 562;
const TOP_IMAGE_HEIGHT = 252;
const LEFT_TAB_WIDTH = 180;
const MAIN_CONTENT_HEIGHT = CARD_HEIGHT - TOP_IMAGE_HEIGHT;
const BOARD_ROW_HEIGHT = 35;
const BOARD_ROW_GAP = 30;
const TIME_WIDTH = 110;
const BUTTON_WIDTH = 162;
const BUTTON_HEIGHT = 50;
const BUTTON_GAP = 20;
const BUTTON_BOTTOM = 30;

interface BoardOverlayProps {
  onCancel?: () => void;
  onCreateNew?: () => void;
  boards: Array<{ id: string; name: string; lastEdited: number }>;
  currentBoardId: string;
  onSwitchBoard: (id: string) => void;
  onEnterBoard: (id: string) => void;
  onDeleteBoard: (id: string) => void;
}

const BoardOverlay: React.FC<BoardOverlayProps> = ({ onCancel, onCreateNew, boards, currentBoardId, onSwitchBoard, onEnterBoard, onDeleteBoard }) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: true, month: 'short', day: 'numeric' });
  };
  const [selectedTab, setSelectedTab] = useState<'my' | 'shared'>('my');
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(currentBoardId);

  const handleCardClick = (id: string) => {
    setSelectedBoardId(id);
    onSwitchBoard(id);
  };

  const handleCardDoubleClick = (id: string) => {
    onEnterBoard(id);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div
        className="relative rounded-2xl shadow-lg border border-[#373737] bg-[#181818] overflow-hidden flex flex-col"
        style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      >
        {/* Top image */}
        <div className="relative w-full flex items-center justify-center" style={{ height: TOP_IMAGE_HEIGHT }}>
          <img src="/boardhistory.png" alt="Board history" className="absolute inset-0 w-full h-full object-cover" />
          <div className="relative z-10 w-full flex items-center justify-center" style={{ height: TOP_IMAGE_HEIGHT }}>
            <span className="text-white" style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Gilroy, sans-serif', letterSpacing: 0 }}>
              fashionably automated
            </span>
          </div>
        </div>
        {/* Main content grid */}
        <div
          className="relative flex-1 w-full grid"
          style={{ gridTemplateColumns: `${LEFT_TAB_WIDTH}px 1fr`, height: MAIN_CONTENT_HEIGHT }}
        >
          {/* Left tab, top aligned, left aligned, clickable buttons */}
          <div className="flex flex-col border-r border-[#232323] h-full pt-8" style={{ minWidth: LEFT_TAB_WIDTH }}>
            <button
              className={`text-left pl-10 py-2 font-gilroy text-[12px] transition-colors ${selectedTab === 'my' ? 'text-[#E1FF00] font-bold' : 'text-[#A3A3A3] font-medium'}`}
              onClick={() => setSelectedTab('my')}
            >
              My Boards
            </button>
            <button
              className={`text-left pl-10 py-2 font-gilroy text-[12px] mt-[15px] transition-colors ${selectedTab === 'shared' ? 'text-[#E1FF00] font-bold' : 'text-[#A3A3A3] font-medium'}`}
              onClick={() => setSelectedTab('shared')}
            >
              Shared Boards
            </button>
          </div>
          {/* Right content: board rows and buttons */}
          <div className="flex flex-col justify-center h-full px-[30px]">
            {/* Board rows */}
            <div className="flex flex-col pt-8 gap-[9px]">
              {boards.length === 0 ? (
                <div className="text-[#A9A9A9] text-[12px] font-gilroy text-center py-8">No boards yet. Create your first board!</div>
              ) : (
                boards.map(board => (
                  <div
                    key={board.id}
                    className={`flex items-center bg-[#232323] rounded-lg cursor-pointer transition-colors ${board.id === selectedBoardId ? 'ring-2 ring-[#E1FF00]' : ''}`}
                    style={{ height: BOARD_ROW_HEIGHT, paddingLeft: 16, paddingRight: 16 }}
                    onClick={() => handleCardClick(board.id)}
                    onDoubleClick={() => handleCardDoubleClick(board.id)}
                  >
                    <span className="text-neutral-400 text-[12px] font-gilroy" style={{ width: TIME_WIDTH }}>{formatTime(board.lastEdited)}</span>
                    <span className="flex-1 text-[#A9A9A9] font-gilroy font-medium text-[12px] truncate">{board.name}</span>
                    <button className="p-2 hover:text-[#E1FF00] transition-colors"><ShareNetwork size={16} weight="regular" className="text-[12px] text-[#A9A9A9]" /></button>
                    <button className="p-2 hover:text-red-400 transition-colors" onClick={e => { e.stopPropagation(); onDeleteBoard(board.id); }}><Trash size={16} weight="regular" className="text-[12px] text-[#A9A9A9]" /></button>
                  </div>
                ))
              )}
            </div>
            {/* Spacer to push buttons to bottom */}
            <div style={{ flex: 1 }} />
            {/* Bottom buttons, horizontally aligned and equal width like Auth UI */}
            <div className="flex w-full gap-4 mt-8 pb-8">
              <button
                className="flex-1 py-2 rounded-lg bg-[#232323] text-[#A9A9A9] font-gilroy font-bold transition-colors hover:bg-[#232323]/80 border-none text-[12px]"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2 rounded-lg bg-[#E1FF00] text-[#181818] font-gilroy font-bold transition-colors hover:bg-[#d4e900] disabled:opacity-60 text-[12px]"
                onClick={onCreateNew}
                disabled={boards.length >= 3}
              >
                Create New
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardOverlay; 