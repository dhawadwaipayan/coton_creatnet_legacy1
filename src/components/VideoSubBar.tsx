import React, { useState } from 'react';

interface VideoSubBarProps {
  onCancel: () => void;
  onGenerate: (details: string) => void;
  hasSelectedImage: boolean;
  processingStatus?: 'idle' | 'preprocessing' | 'ai-processing' | 'post-processing' | 'complete' | 'error';
  processingProgress?: number;
}

export const VideoSubBar: React.FC<VideoSubBarProps> = ({
  onCancel,
  onGenerate,
  hasSelectedImage,
  processingStatus = 'idle',
  processingProgress = 0
}) => {
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [isFastMode, setIsFastMode] = useState(false);
  
  const handleGenerate = () => {
    onGenerate(additionalDetails);
  };
  
  const handleCancel = () => {
    setAdditionalDetails('');
    setIsFastMode(false);
    onCancel();
  };
  
  const handleSpeedToggle = () => {
    setIsFastMode(!isFastMode);
  };
  
  return (
    <div className="w-[600px] h-[45px] bg-[#1a1a1a] border border-[#373737] rounded-xl flex items-center gap-2 mb-2.5 mx-0 py-[24px] px-[8px]">
      {/* Additional details input */}
      <div className="flex-[8] px-2">
        <input 
          type="text" 
          placeholder="Additional details" 
          value={additionalDetails} 
          onChange={e => setAdditionalDetails(e.target.value)} 
          className="w-full bg-transparent text-[#666666] placeholder-[#666666] border-none outline-none text-sm font-gilroy font-medium" 
        />
      </div>

      {/* Speed Toggle button */}
      <button onClick={handleSpeedToggle} className="flex items-center gap-1 px-2 py-1 text-neutral-400 hover:text-[#E1FF00] transition-colors shrink-0">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[16px] h-[16px]">
          <path d="M9.5 1L6.5 8H10L6.5 15L9.5 8H6L9.5 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-sm ml-0.5">{isFastMode ? 'Fastrack' : 'Accurate'}</span>
      </button>

      {/* Progress indicator */}
      {processingStatus !== 'idle' && (
        <div className="flex items-center gap-2 px-2 text-xs text-neutral-400">
          <div className="w-16 h-2 bg-neutral-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#E1FF00] transition-all duration-300 ease-out"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
          <span className="min-w-[80px]">
            {processingStatus === 'preprocessing' && 'Preprocessing...'}
            {processingStatus === 'ai-processing' && 'AI Processing...'}
            {processingStatus === 'post-processing' && 'Finalizing...'}
            {processingStatus === 'complete' && 'Complete!'}
            {processingStatus === 'error' && 'Error!'}
          </span>
        </div>
      )}

      {/* Cancel button */}
      <button onClick={handleCancel} className="flex items-center gap-1 px-2 py-1 text-neutral-400 hover:text-[#E1FF00] transition-colors shrink-0">
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[30px] h-[30px]">
          <path d="M19.889 18.889L12.111 11.111M21.5 15C21.5 18.0376 19.0376 20.5 16 20.5C12.9624 20.5 10.5 18.0376 10.5 15C10.5 11.9624 12.9624 9.5 16 9.5C19.0376 9.5 21.5 11.9624 21.5 15Z" stroke="currentColor" strokeWidth="1.3" strokeMiterlimit="10" strokeLinecap="round" />
        </svg>
        <span className="text-sm">Cancel</span>
      </button>

      {/* Generate button - disabled until image is selected */}
      <button 
        onClick={handleGenerate} 
        disabled={!hasSelectedImage || processingStatus !== 'idle'}
        className={`flex items-center gap-1 px-2 py-1 transition-colors shrink-0 ${
          hasSelectedImage && processingStatus === 'idle'
            ? 'text-[#E1FF00] hover:text-white cursor-pointer' 
            : 'text-neutral-500 cursor-not-allowed'
        }`}
      >
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[30px] h-[30px]">
          <path d="M18.2406 9.5V11.9445M20.6851 12.3519V13.9816M17.0184 10.7223H19.4629M19.8702 13.1667H21.4999M13.5692 17.4308L10.7637 16.397C10.6863 16.3685 10.6196 16.3169 10.5724 16.2492C10.5253 16.1816 10.5 16.1011 10.5 16.0186C10.5 15.9362 10.5253 15.8557 10.5724 15.788C10.6196 15.7204 10.6863 15.6688 10.7637 15.6402L13.5692 14.6064L14.603 11.8009C14.6316 11.7235 14.6831 11.6568 14.7508 11.6097C14.8185 11.5625 14.8989 11.5372 14.9814 11.5372C15.0639 11.5372 15.1443 11.5625 15.212 11.6097C15.2796 11.6568 15.3312 11.7235 15.3598 11.8009L16.3936 14.6064L19.1991 15.6402C19.2765 15.6688 19.3432 15.7204 19.3904 15.788C19.4375 15.8557 19.4628 15.9362 19.4628 16.0186C19.4628 16.1011 19.4375 16.1816 19.3904 16.2492C19.3432 16.3169 19.2765 16.3685 19.1991 16.397L16.3936 17.4308L15.3598 20.2364C15.3312 20.3137 15.2796 20.3805 15.212 20.4276C15.1443 20.4747 15.0639 20.5 14.9814 20.5C14.8989 20.5 14.8185 20.4747 14.7508 20.4276C14.6831 20.3805 14.6316 20.3137 14.603 20.2364L13.5692 17.4308Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-medium">
          {processingStatus === 'idle' ? 'Generate' : 'Processing...'}
        </span>
      </button>
    </div>
  );
};
