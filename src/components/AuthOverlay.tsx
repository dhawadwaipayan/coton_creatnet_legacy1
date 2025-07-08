import React, { useState } from 'react';
import { signIn, signUp, getUser } from '../lib/utils';

const FONT_SIZE = 'text-[12px]';

const AuthOverlay: React.FC<{ onAuthSuccess: () => void }> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    await signUp(email, password, name);
    setLoading(false);
    setSignupSuccess(true);
    setTimeout(() => {
      setSignupSuccess(false);
      setMode('signin');
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <form
        onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}
        className="flex flex-col items-center bg-[#181818] rounded-2xl p-10 min-w-[350px] shadow-lg relative border border-[#373737]"
        style={{ minHeight: 380 }}
      >
        <img src="/BRANDLOGO.svg" alt="Logo" className="mb-8 w-24" />
        {mode === 'signup' && (
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
        {error && mode === 'signup' && (
          <div className="text-red-400 mb-2 text-[11px] text-center">
            Sign up failed. Confirmation email sent to your ID if the email is not already registered.
          </div>
        )}
        {error && mode === 'signin' && (
          <div className="text-red-400 mb-2 text-[11px] text-center">{error}</div>
        )}
        {signupSuccess && (
          <div className="text-green-400 mb-2 text-[11px] text-center">Confirmation email sent to your ID</div>
        )}
        <button
          type="submit"
          className={`w-full py-2 rounded bg-[#E1FF00] text-[#181818] font-gilroy font-bold mt-2 transition-colors hover:bg-[#d4e900] disabled:opacity-60 mb-2 ${FONT_SIZE}`}
          disabled={loading}
        >
          {loading ? (mode === 'signin' ? 'Signing In...' : 'Signing Up...') : mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>
        {mode === 'signin' && (
          <button
            type="button"
            className={`w-full py-2 rounded bg-[#232323] text-white font-gilroy font-bold mt-1 transition-colors hover:bg-[#232323]/80 border-none ${FONT_SIZE}`}
            onClick={() => {
              setError(null);
              setMode('signup');
            }}
          >
            Sign Up
          </button>
        )}
        {mode === 'signup' && (
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
  );
};

export default AuthOverlay; 