import React, { useState, useEffect } from 'react';
import { signOut, getUser } from '../lib/utils';

const UserBar: React.FC<{ userName?: string; onLogout?: () => void }> = ({ userName, onLogout }) => {
  const [activeBtn, setActiveBtn] = useState<'share' | 'logout' | null>(null);
  const [userProfile, setUserProfile] = useState<{
    fullName?: string;
    profilePicture?: string;
    initials: string;
  }>({ initials: 'U1' });

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data } = await getUser();
        if (data?.user) {
          const fullName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || userName || '';
          const profilePicture = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || '';
          const initials = fullName && fullName.trim().length > 0 
            ? fullName.trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            : 'U1';
          
          setUserProfile({
            fullName,
            profilePicture,
            initials
          });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Fallback to userName if available
        const initials = userName && userName.trim().length > 0 
          ? userName.trim().slice(0, 2).toUpperCase()
          : 'U1';
        setUserProfile({ initials });
      }
    };

    fetchUserProfile();
  }, [userName]);

  // Compute initials from userName as fallback
  const userInitials = userProfile.initials;

  const handleLogout = async () => {
    await signOut();
    if (onLogout) onLogout();
  };

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
      >
        Log out
      </button>
      <div className="h-8 w-px bg-[#232323] mx-2" />
      <div className="w-[25px] h-[25px] rounded-full bg-[#EDEDED] flex items-center justify-center overflow-hidden">
        {userProfile.profilePicture ? (
          <img 
            src={userProfile.profilePicture} 
            alt={userProfile.fullName || 'User'} 
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to initials if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <span 
          className="font-gilroy text-sm text-[#232323] font-bold leading-none" 
          style={{fontSize: '14px', display: userProfile.profilePicture ? 'none' : 'flex'}}
        >
          {userInitials}
        </span>
      </div>
    </div>
  );
};

export default UserBar; 