import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signUp, getUser, requestAccess } from '../lib/utils';

const FONT_SIZE = 'text-[12px]';
const BG_IMAGE = '/auth-bg.jpg';
const LOGO_IMAGE = '/CotonAI_Logo.svg';

const AuthOverlay: React.FC<{ onAuthSuccess: () => void }> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'request'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
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

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestAccess(email, password, name);
      setLoading(false);
      setRequestSuccess(true);
      setTimeout(() => {
        setRequestSuccess(false);
        setMode('signin');
      }, 3000);
    } catch (error: any) {
      setLoading(false);
      setError(error.message || 'Failed to submit access request. Please try again.');
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
        <form
          onSubmit={mode === 'signin' ? handleSignIn : handleRequestAccess}
          className="flex flex-col items-center w-full px-10 py-8 bg-[#181818] rounded-b-2xl"
        >
          {mode === 'request' && (
            <>
              <label className={`self-start text-neutral-300 font-gilroy mb-1 mt-2 ${FONT_SIZE}`}>Name</label>
              <input
                type="text"
                className={`w-full mb-4 px-4 py-2 rounded bg-[#232323] text-white focus:outline-none focus:ring-2 focus:ring-[#E1FF00] font-gilroy ${FONT_SIZE}`}
                value={name}
                onChange={e => setName(e.target.value)}
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
            required
          />
          <label className={`self-start text-neutral-300 font-gilroy mb-1 mt-2 ${FONT_SIZE}`}>Password</label>
          <input
            type="password"
            className={`w-full mb-6 px-4 py-2 rounded bg-[#232323] text-white focus:outline-none focus:ring-2 focus:ring-[#E1FF00] font-gilroy ${FONT_SIZE}`}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && mode === 'request' && (
            <div className="text-red-400 mb-2 text-[11px] text-center">
              {error}
            </div>
          )}
          {error && mode === 'signin' && (
            <div className="text-red-400 mb-2 text-[11px] text-center">{error}</div>
          )}
          {requestSuccess && (
            <div className="text-green-400 mb-2 text-[11px] text-center">
              Access request submitted successfully! You will be notified when your request is approved.
            </div>
          )}
          <button
            type="submit"
            className={`w-full py-2 rounded bg-[#E1FF00] text-[#181818] font-gilroy font-bold mt-2 transition-colors hover:bg-[#d4e900] disabled:opacity-60 mb-2 ${FONT_SIZE}`}
            disabled={loading}
          >
            {loading ? (mode === 'signin' ? 'Signing In...' : 'Submitting Request...') : mode === 'signin' ? 'Sign In' : 'Request Access'}
          </button>
          {mode === 'signin' && (
            <button
              type="button"
              className={`w-full py-2 rounded bg-[#232323] text-white font-gilroy font-bold mt-1 transition-colors hover:bg-[#232323]/80 border-none ${FONT_SIZE}`}
              onClick={() => {
                setError(null);
                setMode('request');
              }}
            >
              Request Access
            </button>
          )}
          {mode === 'request' && (
            <button
              type="button"
              className={`w-full py-2 rounded bg-[#232323] text-white font-gilroy font-bold mt-1 transition-colors hover:bg-[#232323]/80 border-none ${FONT_SIZE}`}
              onClick={() => {
                setError(null);
                setMode('signin');
              }}
            >
              Sign In
            </button>
          )}
          

        </form>
      </div>
    </div>
  );
};

export default AuthOverlay; 