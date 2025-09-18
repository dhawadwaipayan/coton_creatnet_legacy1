import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signUp, getUser, signInWithGoogle } from '../lib/utils';

const FONT_SIZE = 'text-[12px]';
const BG_IMAGE = '/auth-bg.jpg';
const LOGO_IMAGE = '/CotonAI_Logo.svg';

const AuthOverlay: React.FC<{ onAuthSuccess: () => void }> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'google' | 'email'>('google');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError(error.message);
        setLoading(false);
      }
      // Don't set loading to false here as user will be redirected
    } catch (error: any) {
      setError(error.message || 'Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      const { data } = await getUser();
      if (data?.user) {
        onAuthSuccess();
      } else {
        setError('Login failed.');
      }
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await signUp(email, password, name);
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setRequestSuccess(true);
        setTimeout(() => {
          setRequestSuccess(false);
          setMode('google');
        }, 3000);
      }
    } catch (error: any) {
      setLoading(false);
      setError(error.message || 'Failed to create account. Please try again.');
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full min-w-0 min-h-0 z-50 flex items-center justify-center">
      {/* 70% black overlay */}
      <div className="absolute inset-0 bg-black" style={{ opacity: 0.7, zIndex: 1 }} />
      {/* Auth card above overlay */}
      <div className="relative z-10 flex flex-col items-center bg-[#181818] rounded-2xl shadow-lg border border-[#373737] min-w-[350px] w-[400px] max-w-full" style={{minHeight: 600}}>
        {/* Top: Image + Logo */}
        <div className="w-full h-[270px] rounded-t-2xl overflow-hidden relative flex items-center justify-center">
          <img src={BG_IMAGE} alt="Auth background" className="absolute inset-0 w-full h-full object-cover" />
          <div className="relative z-10 flex items-center justify-center">
            <img src={LOGO_IMAGE} alt="Logo" className="w-32" />
          </div>
        </div>
        {/* Bottom: Form */}
        <div className="flex flex-col items-center w-full px-10 py-8 bg-[#181818] rounded-b-2xl">
          {/* Google Sign In - Primary Method */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={`w-full py-3 px-4 rounded font-gilroy ${FONT_SIZE} mb-4 flex items-center justify-center gap-3 ${
              loading
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-white text-black hover:bg-gray-100'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>

          <div className="flex items-center w-full mb-4">
            <div className="flex-1 border-t border-neutral-600"></div>
            <span className="px-3 text-neutral-400 text-xs">OR</span>
            <div className="flex-1 border-t border-neutral-600"></div>
          </div>

          {/* Email Authentication - Secondary Method */}
          <form
            onSubmit={mode === 'email' ? handleEmailSignIn : handleEmailSignUp}
            className="w-full"
          >
            {mode === 'email' && (
              <>
                <label className={`self-start text-neutral-300 font-gilroy mb-1 mt-2 ${FONT_SIZE}`}>Name</label>
            <input
              type="text"
              className={`w-full mb-4 px-4 py-2 rounded bg-[#232323] text-white focus:outline-none focus:ring-2 focus:ring-[#E1FF00] font-gilroy ${FONT_SIZE}`}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
              </>
            )}
            <label className={`self-start text-neutral-300 font-gilroy mb-1 mt-2 ${FONT_SIZE}`}>Email</label>
            <input
              type="email"
              className={`w-full mb-4 px-4 py-2 rounded bg-[#232323] text-white focus:outline-none focus:ring-2 focus:ring-[#E1FF00] font-gilroy ${FONT_SIZE}`}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
            />
            <label className={`self-start text-neutral-300 font-gilroy mb-1 mt-2 ${FONT_SIZE}`}>Password</label>
            <input
              type="password"
              className={`w-full mb-6 px-4 py-2 rounded bg-[#232323] text-white focus:outline-none focus:ring-2 focus:ring-[#E1FF00] font-gilroy ${FONT_SIZE}`}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            {error && (
              <div className="text-red-400 mb-2 text-[11px] text-center">
                {error}
              </div>
            )}
            {requestSuccess && (
              <div className="text-green-400 mb-2 text-[11px] text-center">
                Account created successfully! You can now sign in.
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 rounded font-gilroy ${FONT_SIZE} ${
                loading
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-[#E1FF00] text-black hover:bg-[#D1EF00]'
              }`}
            >
              {loading ? 'Loading...' : mode === 'email' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === 'google' ? 'email' : 'google')}
            className="mt-3 text-neutral-400 hover:text-white font-gilroy text-[11px]"
          >
            {mode === 'google' ? 'Use email instead' : 'Use Google instead'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthOverlay; 