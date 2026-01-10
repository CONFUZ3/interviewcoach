
import React from 'react';

interface InterviewerAvatarProps {
  isSpeaking: boolean;
}

const InterviewerAvatar: React.FC<InterviewerAvatarProps> = ({ isSpeaking }) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 md:p-8 space-y-4 md:space-y-6" role="status" aria-live="polite">
      <div className={`relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl flex items-center justify-center transition-all duration-500 ${isSpeaking ? 'scale-110 shadow-blue-500/50 pulse-ring' : 'scale-100'}`} aria-label={isSpeaking ? 'AI coach speaking' : 'AI coach listening'}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 md:w-16 md:h-16 text-white" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-lg md:text-xl font-semibold text-slate-100">Alex</h3>
        <p className="text-slate-400 text-xs md:text-sm" aria-label={isSpeaking ? 'Speaking' : 'Listening'}>{isSpeaking ? 'Speaking...' : 'Listening...'}</p>
      </div>
      
      {/* Waveform Visualization */}
      <div className="flex items-end space-x-1 h-8" aria-hidden="true">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className={`w-1 rounded-full bg-blue-400 transition-all duration-150 ${isSpeaking ? 'animate-bounce' : 'h-1'}`}
            style={{ 
              height: isSpeaking ? `${Math.random() * 100}%` : '4px',
              animationDelay: `${i * 0.05}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default InterviewerAvatar;
