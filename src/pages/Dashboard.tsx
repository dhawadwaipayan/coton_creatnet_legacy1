import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, signOut, getBoardsForUser, createBoard, updateBoard, deleteBoard } from '../lib/utils';
import { navigateToBoard, getDashboardUrl } from '../lib/boardUtils';
import AuthOverlay from '../components/AuthOverlay';
import BoardOverlay from '../components/BoardOverlay';

const Dashboard = () => {
  const navigate = useNavigate();
  
  // Auth state
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [showAuth, setShowAuth] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  
  // Board state
  const [boards, setBoards] = useState([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [showBoardOverlay, setShowBoardOverlay] = useState(false);

  // Check user authentication
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
          
          // Show board overlay by default
          setShowBoardOverlay(true);
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
  }, []);

  // Board management handlers
  const handleCreateNewBoard = async () => {
    if (!userId || boards.length >= 3) return;
    
    const newBoard = await createBoard({
      user_id: userId,
      name: `Untitled ${boards.length + 1}`,
      content: { images: [], strokes: [], texts: [] },
    });
    
    setBoards(prev => [...prev, newBoard]);
    setCurrentBoardId(newBoard.id);
    setShowBoardOverlay(false);
    
    // Navigate to the new board
    navigateToBoard(navigate, newBoard.id);
  };

  const handleSwitchBoard = (id: string) => {
    setCurrentBoardId(id);
  };

  const handleEnterBoard = (id: string) => {
    setCurrentBoardId(id);
    setShowBoardOverlay(false);
    navigateToBoard(navigate, id);
  };

  const handleDeleteBoard = async (id: string) => {
    await deleteBoard(id);
    setBoards(prev => prev.filter(b => b.id !== id));
    
    // If the deleted board was current, clear currentBoardId
    if (currentBoardId === id) {
      setCurrentBoardId(null);
    }
  };

  const handleCancelBoardOverlay = () => {
    // Only allow cancel if there's a valid current board to return to
    if (currentBoardId && boards.find(b => b.id === currentBoardId)) {
      setShowBoardOverlay(false);
    }
  };

  const isCancelDisabled = !currentBoardId || !boards.find(b => b.id === currentBoardId);

  const handleUpdateBoardName = async (id: string, name: string) => {
    const updated = await updateBoard({ id, name });
    setBoards(boards => boards.map(b => b.id === id ? { ...b, name: updated.name, lastEdited: updated.lastEdited } : b));
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
        setShowBoardOverlay(true);
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
    setShowBoardOverlay(false);
    navigate(getDashboardUrl());
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
      {/* Auth Overlay */}
      {showAuth && <AuthOverlay onAuthSuccess={handleAuthSuccess} />}
      
      <main className="bg-[rgba(33,33,33,1)] flex flex-col overflow-hidden min-h-screen relative">
        {/* Board Overlay - main interface for dashboard */}
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
      </main>
    </>
  );
};

export default Dashboard;
