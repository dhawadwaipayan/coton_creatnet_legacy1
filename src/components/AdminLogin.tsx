import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, isUserAdmin } from '../lib/utils';

const FONT_SIZE = 'text-[12px]';
const BG_IMAGE = '/auth-bg.jpg';
const LOGO_IMAGE = '/CotonAI_Logo.svg';

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // First, try to sign in
      const { data, error: signInError } = await signIn(email, password);
      
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (!data?.user) {
        setError('Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      // Check if user is admin
      const { data: adminData, error: adminError } = await isUserAdmin(data.user.id);
      
      if (adminError || !adminData) {
        // User is not admin, sign them out and show error
        await signIn(email, password); // This will sign them out since they're not approved
        setError('Access denied. Admin privileges required. Please contact the administrator.');
        setLoading(false);
        return;
      }

      // User is admin, redirect to admin dashboard
      navigate('/admin-dashboard', { replace: true });
    } catch (error: any) {
      console.error('Admin login error:', error);
      setError('An error occurred during login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full min-w-0 min-h-0 z-50 flex items-center justify-center">
      {/* 70% black overlay */}
      <div className="absolute inset-0 bg-black" style={{ opacity: 0.7, zIndex: 1 }} />
      
      {/* Admin Login card */}
      <div className="relative z-10 flex flex-col items-center bg-[#181818] rounded-2xl shadow-lg border border-[#373737] min-w-[350px] w-[400px] max-w-full" style={{minHeight: 600}}>
        {/* Top: Image + Logo */}
        <div className="w-full h-[270px] rounded-t-2xl overflow-hidden relative flex items-center justify-center">
          <img src={BG_IMAGE} alt="Auth background" className="absolute inset-0 w-full h-full object-cover" />
          <div className="relative z-10 flex flex-col items-center justify-center">
            <img src={LOGO_IMAGE} alt="Logo" className="w-32 mb-4" />
            <div className="text-center">
              <h1 className="text-white text-xl font-bold mb-2">Admin Access</h1>
              <p className="text-neutral-300 text-sm">Administrator Login Only</p>
            </div>
          </div>
        </div>
        
        {/* Bottom: Admin Login Form */}
        <form
          onSubmit={handleAdminLogin}
          className="flex flex-col items-center w-full px-10 py-8 bg-[#181818] rounded-b-2xl"
        >
          <label className={`self-start text-neutral-300 font-gilroy mb-1 mt-2 ${FONT_SIZE}`}>Email</label>
          <input
            type="email"
            className={`w-full mb-4 px-4 py-2 rounded bg-[#232323] text-white focus:outline-none focus:ring-2 focus:ring-[#E1FF00] font-gilroy ${FONT_SIZE}`}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="admin@example.com"
          />
          
          <label className={`self-start text-neutral-300 font-gilroy mb-1 mt-2 ${FONT_SIZE}`}>Password</label>
          <input
            type="password"
            className={`w-full mb-6 px-4 py-2 rounded bg-[#232323] text-white focus:outline-none focus:ring-2 focus:ring-[#E1FF00] font-gilroy ${FONT_SIZE}`}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
          />
          
          {error && (
            <div className="text-red-400 mb-4 text-[11px] text-center max-w-xs">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className={`w-full py-2 rounded bg-[#E1FF00] text-[#181818] font-gilroy font-bold mt-2 transition-colors hover:bg-[#d4e900] disabled:opacity-60 mb-4 ${FONT_SIZE}`}
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Admin Sign In'}
          </button>
          
          <div className="text-center">
            <p className="text-neutral-400 text-xs mb-2">
              Need regular user access?
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-[#E1FF00] hover:text-[#d4e900] text-xs font-medium transition-colors"
            >
              Go to Main App
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin; 