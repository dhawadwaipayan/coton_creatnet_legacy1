import React, { useState } from 'react';
import { signOut, getUser } from '../lib/utils';

const UserBar: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  // REMOVE AUTH LOGIC: show static initials
  // const [activeBtn, setActiveBtn] = useState<'share' | 'logout' | null>(null);
  // const [userInitials, setUserInitials] = useState('U1');
  // useEffect(() => {
  //   getUser().then(({ data }) => {
  //     const name = data?.user?.user_metadata?.name;
  //     if (name && typeof name === 'string' && name.trim().length > 0) {
  //       setUserInitials(name.trim().slice(0, 2));
  //     } else {
  //       setUserInitials('U1');
  //     }
  //   });
  // }, []);
  const [activeBtn, setActiveBtn] = useState<'share' | 'logout' | null>(null);
  const userInitials = 'U1';

  // Disable logout
  // const handleLogout = async () => {
  //   await signOut();
  //   if (onLogout) onLogout();
  // };
  const handleLogout = () => {};

  const getTextColor = (btn: 'share' | 'logout') =>
    activeBtn === btn
      ? 'text-[#E1FF00]'
      : 'hover:text-white text-neutral-400';

  return (
    <div className="flex items-center bg-[#1a1a1a] border border-[#373737] rounded-xl h-[45px] px-4 gap-2">
      <button
        className={`font-gilroy font-bold text-sm transition-colors px-2.5 py-2 whitespace-nowrap min-h-[30px] cursor-pointer ${getTextColor('share')}`}
        onMouseDown={() => setActiveBtn('share')}
        onMouseUp={() => setActiveBtn(null)}
        onMouseLeave={() => setActiveBtn(null)}
        type="button"
      >
        Share
      </button>
      <button
        className={`font-gilroy font-bold text-sm transition-colors px-2.5 py-2 whitespace-nowrap min-h-[30px] cursor-pointer ${getTextColor('logout')}`}
        onMouseDown={() => setActiveBtn('logout')}
        onMouseUp={() => setActiveBtn(null)}
        onMouseLeave={() => setActiveBtn(null)}
        onClick={handleLogout}
        type="button"
        disabled
      >
        Log out
      </button>
      <div className="h-8 w-px bg-[#232323] mx-2" />
      <div className="w-[25px] h-[25px] rounded-full bg-[#EDEDED] flex items-center justify-center">
        <span className="font-gilroy text-sm text-[#232323] font-bold leading-none" style={{fontSize: '14px'}}>{userInitials}</span>
      </div>
    </div>
  );
};

export default UserBar; 