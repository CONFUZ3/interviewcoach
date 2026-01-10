import React, { useEffect, useRef, useState } from 'react';

interface VideoPreviewProps {
  onFrame?: (base64Frame: string) => void;
  isActive: boolean;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ onFrame, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Start camera preview on mount
  useEffect(() => {
    let mounted = true;

    const startPreview = async () => {
      try {
        console.log('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            facingMode: 'user'
          }, 
          audio: false 
        });
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        console.log('Camera stream obtained');
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            console.log('Video metadata loaded');
            if (mounted) {
              videoRef.current?.play().then(() => {
                console.log('Video playing');
                setCameraState('ready');
              }).catch(err => {
                console.error('Error playing video:', err);
              });
            }
          };
        }
      } catch (err: any) {
        console.error('Error accessing webcam:', err);
        if (mounted) {
          setCameraState('error');
          if (err.name === 'NotAllowedError') {
            setErrorMessage('Camera access denied. Please allow camera access.');
          } else if (err.name === 'NotFoundError') {
            setErrorMessage('No camera found. Please connect a camera.');
          } else if (err.name === 'NotReadableError') {
            setErrorMessage('Camera is in use by another application.');
          } else {
            setErrorMessage(`Camera error: ${err.message || 'Unknown error'}`);
          }
        }
      }
    };

    startPreview();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Send frames when active
  useEffect(() => {
    let interval: number | null = null;

    if (isActive && onFrame && cameraState === 'ready') {
      interval = window.setInterval(() => {
        if (videoRef.current && canvasRef.current && videoRef.current.videoWidth > 0) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            // Mirror the canvas to match the video display
            ctx.translate(canvasRef.current.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(videoRef.current, 0, 0);
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
            const base64Frame = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
            onFrame(base64Frame);
          }
        }
      }, 1000); // 1 second between frames for more responsive posture/eye contact feedback
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isActive, onFrame, cameraState]);

  return (
    <div className="relative w-full flex-1 min-h-[200px] md:min-h-[300px] rounded-2xl overflow-hidden border-2 border-slate-700 glass shadow-2xl bg-slate-900">
      {/* Video element - always rendered */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${cameraState === 'ready' ? 'opacity-100' : 'opacity-0'}`}
        aria-label="Camera preview"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Loading overlay */}
      {cameraState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <svg className="animate-spin w-10 h-10 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-slate-400 text-sm">Starting camera...</p>
            <p className="text-slate-600 text-xs mt-1">Please allow camera access</p>
          </div>
        </div>
      )}
      
      {/* Error overlay */}
      {cameraState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="text-center p-8">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-red-500/50 mx-auto mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <p className="text-red-400 text-sm font-medium">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              aria-label="Retry camera access"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      {/* Status indicator */}
      {cameraState === 'ready' && (
        <div className={`absolute bottom-4 left-4 px-3 py-1.5 backdrop-blur-sm text-xs font-medium rounded-full flex items-center space-x-2 ${
          isActive ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-black/50 text-slate-300'
        }`}>
          {isActive && (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
          <span>{isActive ? 'Recording' : 'Preview'}</span>
        </div>
      )}
    </div>
  );
};

export default VideoPreview;
