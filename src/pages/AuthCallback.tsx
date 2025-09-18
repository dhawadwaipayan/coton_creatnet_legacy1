import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleGoogleAuthCallback } from '../lib/utils';

const AuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      setStatus('processing');
      
      const { data, error } = await handleGoogleAuthCallback();
      
      if (error) {
        console.error('Auth callback error:', error);
        setError(error.message || 'Authentication failed');
        setStatus('error');
        return;
      }
      
      if (data?.session?.user) {
        setStatus('success');
        // Redirect to main app after a short delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      } else {
        setError('No user session found');
        setStatus('error');
      }
    } catch (err: any) {
      console.error('Auth callback error:', err);
      setError(err.message || 'An unexpected error occurred');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[rgba(33,33,33,1)] flex items-center justify-center">
      <div className="bg-[#181818] rounded-2xl p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          <img 
            src="/CotonAI_Logo.svg" 
            alt="CotonAI" 
            className="h-12 mx-auto mb-4"
          />
        </div>
        
        {status === 'processing' && (
          <div>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E1FF00] mx-auto mb-4"></div>
            <h2 className="text-white text-lg font-gilroy mb-2">Processing Authentication</h2>
            <p className="text-neutral-300 text-sm">Please wait while we set up your account...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div>
            <div className="text-green-400 text-4xl mb-4">✓</div>
            <h2 className="text-white text-lg font-gilroy mb-2">Welcome to CotonAI!</h2>
            <p className="text-neutral-300 text-sm mb-4">Your account has been created successfully.</p>
            <p className="text-neutral-400 text-xs">Redirecting to the app...</p>
          </div>
        )}
        
        {status === 'error' && (
          <div>
            <div className="text-red-400 text-4xl mb-4">✗</div>
            <h2 className="text-white text-lg font-gilroy mb-2">Authentication Failed</h2>
            <p className="text-neutral-300 text-sm mb-4">{error}</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="bg-[#E1FF00] text-black px-6 py-2 rounded font-gilroy text-sm hover:bg-[#D1EF00] transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
