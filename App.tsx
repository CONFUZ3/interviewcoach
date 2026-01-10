import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { TranscriptionEntry } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audio-processing';
import VideoPreview from './components/VideoPreview';
import InterviewerAvatar from './components/InterviewerAvatar';

// Use the Gemini native audio model
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

// Function to generate system instruction based on whether JD is provided
const getSystemInstruction = (jobDescription?: string) => {
  const baseInstruction = `You are Alex, a friendly and supportive AI interview coach conducting mock interviews.

LANGUAGE:
- Conduct all interactions in English only.
- If speech is unclear, kindly ask the candidate to repeat.

YOUR ROLE:
You are a Professional Interviewer conducting realistic mock interviews. Focus 100% on being an excellent interviewer - do NOT provide any feedback or coaching tips during the interview. You will have the opportunity to provide comprehensive feedback at the end.`;

  const openingWithJD = `
INTERVIEW FLOW:
1. Opening (warm and welcoming):
   - Introduce yourself briefly: "Hi, I'm Alex, your interview coach today!"
   - Acknowledge that you have the job description for the role they're preparing for
   - Briefly confirm the role and ask about their experience level to calibrate question difficulty

2. Question Strategy (IMPORTANT - Use the Job Description):
   - Ask ONE question at a time, then wait for the full response
   - Tailor ALL questions to the specific job description provided
   - Focus on skills, requirements, and responsibilities mentioned in the JD
   - Mix question types based on the JD requirements:
     • Behavioral: "Tell me about a time when..." (related to JD requirements)
     • Situational: "How would you handle..." (scenarios from the role)
     • Technical: Questions about specific skills/technologies mentioned in the JD
     • Motivational: "Why are you interested in this specific role?"
   - Start with easier questions, gradually increase difficulty
   - Ask thoughtful follow-ups to dig deeper into answers
   - Assess the candidate's fit for the specific requirements in the JD`;

  const openingWithoutJD = `
INTERVIEW FLOW:
1. Opening (warm and welcoming):
   - Introduce yourself briefly: "Hi, I'm Alex, your interview coach today!"
   - Ask what role they're preparing for
   - Ask about their experience level to calibrate question difficulty

2. Question Strategy:
   - Ask ONE question at a time, then wait for the full response
   - Mix question types based on role:
     • Behavioral: "Tell me about a time when..."
     • Situational: "How would you handle..."
     • Technical: Role-specific knowledge questions
     • Motivational: "Why are you interested in..."
   - Start with easier questions, gradually increase difficulty
   - Ask thoughtful follow-ups to dig deeper into answers`;

  const commonInstructions = `

3. Candidate Support:
   - Allow 5-10 seconds of thinking silence before prompting
   - If they struggle, offer to rephrase or give a hint
   - Acknowledge strong points naturally: "Great example! Next..."

IMPORTANT - DURING THE INTERVIEW:
- Do NOT provide coaching tips or feedback during the interview
- Do NOT comment on their pace, filler words, posture, or delivery
- Focus entirely on asking good questions and listening
- Mentally note observations for the end-of-interview feedback

RESTRICTIONS:
- No medical, psychological, or personal advice
- Stay in interviewer character throughout

ENDING THE SESSION:
When candidate says "end interview" or similar:
1. Say a brief closing remark like "Great, that concludes our practice session!"
2. Do NOT provide verbal feedback - the written feedback will be shown separately
3. Thank them briefly for practicing with you`;

  if (jobDescription && jobDescription.trim()) {
    return `${baseInstruction}${openingWithJD}${commonInstructions}

---
JOB DESCRIPTION FOR THIS INTERVIEW:
${jobDescription.trim()}
---

Use the above job description to guide your questions. Extract key requirements, skills, and responsibilities and ask questions that assess the candidate's fit for this specific role.`;
  }

  return `${baseInstruction}${openingWithoutJD}${commonInstructions}`;
};

// Function to generate feedback prompt based on whether JD is provided
const getFeedbackPrompt = (jobDescription?: string) => {
  const basePrompt = `You are an expert interview coach analyzing a mock interview. You have access to both the conversation transcript AND video frames captured during the interview. Provide comprehensive, actionable feedback based on the candidate's verbal AND non-verbal performance.

Analyze the interview and provide detailed feedback in this exact format:

## Overall Performance
[1-2 sentences summarizing how the candidate did overall, considering both verbal responses and body language]

## Strengths
- **[Category]**: [Specific observation with example from transcript or video]
- **[Category]**: [Specific observation with example from transcript or video]
- **[Category]**: [Specific observation with example from transcript or video]

## Areas for Improvement
- **[Category]**: [Specific issue observed] → [Actionable tip to improve]
- **[Category]**: [Specific issue observed] → [Actionable tip to improve]
- **[Category]**: [Specific issue observed] → [Actionable tip to improve]

## Communication Analysis
- **Pace**: [Assessment of speaking pace - too fast, too slow, or well-paced]
- **Clarity**: [How clear and articulate were their responses]
- **Filler Words**: [Note any overuse of um, uh, like, you know, etc.]
- **Structure**: [Did they use STAR method? Were answers organized?]

## Body Language & Presence (from video analysis)
- **Eye Contact**: [Did they maintain good eye contact with the camera? Were they looking away frequently?]
- **Posture**: [Assessment of sitting posture - upright and confident, slouching, too rigid, etc.]
- **Facial Expressions**: [Were expressions appropriate? Did they smile? Did they appear nervous or confident?]
- **Gestures**: [Were hand gestures natural and appropriate, or distracting/absent?]
- **Overall Presence**: [Did they project confidence and professionalism on camera?]

## Content Quality
- **Specificity**: [Did they provide concrete examples with details?]
- **Relevance**: [Did answers address the questions asked?]
- **Depth**: [Surface-level or thoughtful, in-depth responses?]`;

  const jdAlignmentSection = `

## Job Description Alignment
- **Skills Match**: [How well did the candidate demonstrate the required skills mentioned in the JD?]
- **Experience Relevance**: [Did their examples align with the responsibilities in the job description?]
- **Technical Fit**: [Assessment of technical knowledge relevant to the specific role]
- **Cultural Indicators**: [Did they show understanding of what the role/company might need?]
- **Gaps Identified**: [Any key JD requirements that weren't addressed or demonstrated]`;

  const nextSteps = `

## Next Steps
1. [Most important thing to practice - could be verbal or non-verbal]
2. [Second priority]
3. [Third priority]

---
Be honest but encouraging. If something was genuinely good, say so. If something needs work, be specific about what and how to fix it. Pay special attention to the video frames to assess body language and presence.`;

  if (jobDescription && jobDescription.trim()) {
    return `${basePrompt}${jdAlignmentSection}${nextSteps}

---
JOB DESCRIPTION USED FOR THIS INTERVIEW:
${jobDescription.trim()}
---

Use the above job description to evaluate how well the candidate's responses aligned with the specific role requirements. Assess whether they demonstrated the skills, experience, and qualities needed for this position.`;
  }

  return `${basePrompt}${nextSteps}`;
};

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [realtimeText, setRealtimeText] = useState<{ user: string; model: string }>({ user: '', model: '' });
  const [endFeedback, setEndFeedback] = useState<string | null>(null);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [jobDescription, setJobDescription] = useState<string>('');

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const transcriptionBufferRef = useRef({ user: '', model: '' });
  const isSessionOpenRef = useRef<boolean>(false);
  
  // Refs for throttled realtime text updates
  const pendingTextRef = useRef({ user: '', model: '' });
  const rafRef = useRef<number | null>(null);
  
  // Ref for auto-scroll
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  
  // Ref to store video frames for end-of-interview analysis
  const capturedFramesRef = useRef<string[]>([]);
  const lastFrameCaptureTimeRef = useRef<number>(0);
  const FRAME_CAPTURE_INTERVAL = 5000; // Capture a frame every 5 seconds for feedback
  const MAX_FRAMES_FOR_FEEDBACK = 12; // Keep max 12 frames (1 minute of interview at 5s intervals)

  const cleanup = useCallback(() => {
    // Mark session as closed first to stop audio processing
    isSessionOpenRef.current = false;
    
    // Disconnect audio nodes
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (e) {}
      scriptProcessorRef.current = null;
    }
    
    if (mediaSourceRef.current) {
      try {
        mediaSourceRef.current.disconnect();
      } catch (e) {}
      mediaSourceRef.current = null;
    }
    
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Stop audio playback
    sourcesRef.current.forEach(s => {
      try { s.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  // Generate comprehensive feedback at the end of the interview
  const generateFeedback = useCallback(async (transcript: TranscriptionEntry[], videoFrames: string[], jd?: string) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || transcript.length === 0) return;

    setIsGeneratingFeedback(true);
    
    try {
      // Format transcript for analysis
      const formattedTranscript = transcript
        .map(t => `${t.role === 'user' ? 'Candidate' : 'Interviewer'}: ${t.text}`)
        .join('\n\n');

      const ai = new GoogleGenAI({ apiKey });
      
      // Build content parts with text and video frames
      const contentParts: Array<string | { inlineData: { mimeType: string; data: string } }> = [];
      
      // Add the prompt and transcript as text (using JD-aware feedback prompt)
      contentParts.push(`${getFeedbackPrompt(jd)}\n\n---\n\nINTERVIEW TRANSCRIPT:\n\n${formattedTranscript}\n\n---\n\nVIDEO FRAMES FROM THE INTERVIEW (${videoFrames.length} frames captured at regular intervals):\n`);
      
      // Add video frames as inline data
      if (videoFrames.length > 0) {
        videoFrames.forEach((frame, index) => {
          contentParts.push({ inlineData: { mimeType: 'image/jpeg', data: frame } });
          if (index < videoFrames.length - 1) {
            contentParts.push(`\n[Frame ${index + 1}]\n`);
          }
        });
      } else {
        contentParts.push('\n[No video frames were captured during this interview]\n');
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contentParts,
      });

      const feedbackText = response.text || 'Unable to generate feedback. Please try again.';
      setEndFeedback(feedbackText);
    } catch (err) {
      console.error('Error generating feedback:', err);
      setEndFeedback('Failed to generate feedback. Please check your connection and try again.');
    } finally {
      setIsGeneratingFeedback(false);
    }
  }, []);

  const stopSession = useCallback(() => {
    console.log('Stopping session...');
    
    // Capture current transcriptions, video frames, and JD before cleanup
    const currentTranscriptions = [...transcriptions];
    const currentFrames = [...capturedFramesRef.current];
    const currentJD = jobDescription;
    
    if (sessionRef.current) {
      try {
        sessionRef.current.close?.();
      } catch (e) {
        console.error('Error closing session:', e);
      }
      sessionRef.current = null;
    }
    
    cleanup();
    setIsActive(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setStatusMessage('');
    
    // Clear captured frames
    capturedFramesRef.current = [];
    lastFrameCaptureTimeRef.current = 0;
    
    // Generate feedback if we have transcript data (pass JD for JD-aware feedback)
    if (currentTranscriptions.length > 0) {
      generateFeedback(currentTranscriptions, currentFrames, currentJD);
    }
  }, [cleanup, transcriptions, jobDescription, generateFeedback]);


  const handleMessage = useCallback(async (msg: any) => {
    try {
      // Handle Audio Output
      const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        setIsSpeaking(true);
        const ctx = outputAudioContextRef.current;
        if (ctx) {
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
          
          const audioBuffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.onended = () => {
            sourcesRef.current.delete(source);
            if (sourcesRef.current.size === 0) setIsSpeaking(false);
          };
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += audioBuffer.duration;
          sourcesRef.current.add(source);
        }
      }

      // Handle Interruptions
      if (msg.serverContent?.interrupted) {
        sourcesRef.current.forEach(s => {
          try { s.stop(); } catch (e) {}
        });
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        setIsSpeaking(false);
      }

      // Handle Transcriptions with throttled updates
      if (msg.serverContent?.inputTranscription?.text) {
        const text = msg.serverContent.inputTranscription.text;
        transcriptionBufferRef.current.user += text;
        pendingTextRef.current.user += text;
        
        // Throttle updates using requestAnimationFrame
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            setRealtimeText({ ...pendingTextRef.current });
            rafRef.current = null;
          });
        }
      }
      if (msg.serverContent?.outputTranscription?.text) {
        const text = msg.serverContent.outputTranscription.text;
        transcriptionBufferRef.current.model += text;
        pendingTextRef.current.model += text;
        
        // Throttle updates using requestAnimationFrame
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            setRealtimeText({ ...pendingTextRef.current });
            rafRef.current = null;
          });
        }
      }
      if (msg.serverContent?.turnComplete) {
        // Cancel any pending RAF update
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        
        const uText = transcriptionBufferRef.current.user.trim();
        const mText = transcriptionBufferRef.current.model.trim();
        if (uText || mText) {
          setTranscriptions(prev => [
            ...prev,
            ...(uText ? [{ role: 'user' as const, text: uText, timestamp: Date.now() }] : []),
            ...(mText ? [{ role: 'model' as const, text: mText, timestamp: Date.now() }] : []),
          ]);
        }
        transcriptionBufferRef.current = { user: '', model: '' };
        pendingTextRef.current = { user: '', model: '' };
        setRealtimeText({ user: '', model: '' });
      }
    } catch (e) {
      console.error('Error handling message:', e);
    }
  }, []);

  const startSession = async () => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      setError('API key not configured. Please add GEMINI_API_KEY to your .env.local file.');
      return;
    }

    try {
      setError(null);
      setIsConnecting(true);
      setStatusMessage('Requesting microphone access...');
      
      // Request microphone first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setStatusMessage('Microphone connected. Initializing AI...');
      
      // Setup Audio Contexts
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      // Resume audio contexts (needed for some browsers)
      await audioContextRef.current.resume();
      await outputAudioContextRef.current.resume();
      
      setStatusMessage('Connecting to Gemini...');
      
      const ai = new GoogleGenAI({ apiKey });
      
      // Connect to live session
      const session = await ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: getSystemInstruction(jobDescription),
          // Enable transcription for both input and output
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live session opened');
            isSessionOpenRef.current = true;
            setStatusMessage('Connected! Starting interview...');
            setIsActive(true);
            setIsConnecting(false);
            
            // Setup audio streaming
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            mediaSourceRef.current = source;
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            scriptProcessor.onaudioprocess = (e) => {
              // Only send if session is open
              if (isSessionOpenRef.current && sessionRef.current) {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                try {
                  sessionRef.current.sendRealtimeInput({ media: pcmBlob });
                } catch (err) {
                  if (err instanceof Error && (err.message.includes('CLOS') || err.message.includes('not open'))) {
                    isSessionOpenRef.current = false;
                    // Connection closed, stop sending
                  } else {
                    console.error('Error sending audio:', err);
                  }
                }
              }
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: handleMessage,
          onerror: (e: any) => {
            console.error('Session error:', e);
            isSessionOpenRef.current = false;
            const errorMessage = e?.message || e?.toString() || 'Unknown error occurred';
            setError(`Connection error: ${errorMessage}`);
            stopSession();
          },
          onclose: (e: any) => {
            console.log('Session closed:', e);
            isSessionOpenRef.current = false;
            setStatusMessage('Session ended');
            stopSession();
          }
        }
      });

      sessionRef.current = session;
      
    } catch (err: any) {
      console.error('Failed to start session:', err);
      cleanup();
      setIsConnecting(false);
      
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (err.message?.includes('API key')) {
        setError('Invalid API key. Please check your GEMINI_API_KEY in .env.local');
      } else {
        setError(`Failed to start: ${err.message || 'Unknown error'}`);
      }
    }
  };

  const handleFrame = useCallback((base64: string) => {
    if (isSessionOpenRef.current && sessionRef.current && isActive) {
      try {
        sessionRef.current.sendRealtimeInput({
          media: { data: base64, mimeType: 'image/jpeg' }
        });
        
        // Capture frames periodically for end-of-interview video analysis
        const now = Date.now();
        if (now - lastFrameCaptureTimeRef.current >= FRAME_CAPTURE_INTERVAL) {
          lastFrameCaptureTimeRef.current = now;
          
          // Add frame to captured frames, keeping only the most recent ones
          capturedFramesRef.current.push(base64);
          if (capturedFramesRef.current.length > MAX_FRAMES_FOR_FEEDBACK) {
            capturedFramesRef.current.shift(); // Remove oldest frame
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('CLOS')) {
          isSessionOpenRef.current = false;
        }
        console.error('Error sending frame:', err);
      }
    }
  }, [isActive]);

  // Memoize the transcription list to prevent unnecessary re-renders
  const transcriptionList = useMemo(() => 
    transcriptions.map((t, i) => (
      <div key={`${t.timestamp}-${i}`} className={`flex space-x-3 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
          t.role === 'user' 
            ? 'bg-blue-600/20 text-blue-100 rounded-tr-none' 
            : 'bg-slate-800 text-slate-200 rounded-tl-none'
        }`}>
          <p>{t.text}</p>
        </div>
      </div>
    )), [transcriptions]
  );

  // Auto-scroll to the latest message
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptions, realtimeText]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-4 md:px-6 glass border-b border-slate-800 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 leading-tight">Realtime Mock Interview Coach</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">AI-Powered Mock Interviews</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {statusMessage && (
            <span className="text-sm text-slate-400 animate-pulse">{statusMessage}</span>
          )}
          {!isActive && !isConnecting ? (
            <button
              onClick={startSession}
              className="px-4 md:px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-full shadow-lg transition-all active:scale-95 flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950"
              aria-label="Start interview session"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              <span>Start Interview</span>
            </button>
          ) : isConnecting ? (
            <button
              disabled
              className="px-6 py-2 bg-slate-700 text-slate-400 font-semibold rounded-full flex items-center space-x-2 cursor-not-allowed"
            >
              <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Connecting...</span>
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="px-4 md:px-6 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/50 font-semibold rounded-full transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-950"
              aria-label="End interview session"
            >
              End Session
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-4 md:p-6 gap-4 md:gap-6">
        {/* Left Side: Video & Interaction */}
        <div className="flex-1 flex flex-col space-y-4 md:space-y-6 min-w-0">
          <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 min-h-0">
            {/* User Feed */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center mb-3 space-x-2">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} aria-label={isActive ? 'Active' : 'Inactive'} />
                <span className="text-sm font-semibold text-slate-300">Candidate View</span>
                {isActive && <span className="text-xs text-green-400 animate-fade-in">● LIVE</span>}
              </div>
              <VideoPreview isActive={isActive} onFrame={handleFrame} />
            </div>

            {/* Coach Feed */}
            <div className="w-full lg:w-1/3 flex flex-col glass rounded-2xl overflow-hidden shadow-2xl min-w-0">
               <div className="flex items-center p-4 border-b border-slate-800 space-x-2">
                <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500/50'}`} aria-label={isSpeaking ? 'Speaking' : 'Listening'} />
                <span className="text-sm font-semibold text-slate-300">AI Coach (Alex)</span>
              </div>
              <div className="flex-1 flex items-center justify-center bg-slate-900/50 min-h-[200px]">
                <InterviewerAvatar isSpeaking={isSpeaking} />
              </div>
            </div>
          </div>

            {/* Bottom Transcription Area */}
          <div className="h-48 md:h-56 glass rounded-2xl p-4 overflow-hidden flex flex-col">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Live Transcript</h4>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar" role="log" aria-live="polite" aria-label="Interview transcript">
              {transcriptions.length === 0 && !realtimeText.user && !realtimeText.model ? (
                <p className="text-slate-600 italic text-sm text-center py-8">
                  {isActive ? 'Listening... Start speaking!' : 'Transcription will appear as you speak...'}
                </p>
              ) : (
                <>
                  {transcriptionList}
                  {realtimeText.user && (
                    <div className="flex space-x-3 justify-end">
                      <div className="max-w-[80%] px-4 py-2 rounded-2xl text-sm bg-blue-600/20 text-blue-100 rounded-tr-none opacity-70">
                        <p>{realtimeText.user}</p>
                      </div>
                    </div>
                  )}
                  {realtimeText.model && (
                    <div className="flex space-x-3 justify-start">
                      <div className="max-w-[80%] px-4 py-2 rounded-2xl text-sm bg-slate-800 text-slate-200 rounded-tl-none opacity-70">
                        <p>{realtimeText.model}</p>
                      </div>
                    </div>
                  )}
                  {/* Scroll anchor for auto-scroll */}
                  <div ref={transcriptEndRef} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Interview Status / End Feedback Panel */}
        <div className="w-full lg:w-96 flex flex-col space-y-4 min-w-0">
          <div className="glass rounded-2xl p-4 md:p-5 flex flex-col h-full overflow-hidden">
            {isGeneratingFeedback ? (
              // Loading state while generating feedback
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 mb-6 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2">Analyzing Your Interview</h3>
                <p className="text-sm text-slate-400">Analyzing transcript and video footage...</p>
              </div>
            ) : endFeedback ? (
              // Show feedback after interview ends
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-100 flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-emerald-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span>Interview Feedback</span>
                  </h2>
                  <button
                    onClick={() => {
                      setEndFeedback(null);
                      setTranscriptions([]);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded px-2 py-1"
                    aria-label="Start new interview"
                  >
                    New Interview
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="prose prose-invert prose-sm max-w-none">
                    {endFeedback.split('\n').map((line, i) => {
                      // Handle markdown headers
                      if (line.startsWith('## ')) {
                        return <h3 key={i} className="text-base font-bold text-slate-100 mt-4 mb-2 first:mt-0">{line.replace('## ', '')}</h3>;
                      }
                      // Handle bold text in list items
                      if (line.startsWith('- **')) {
                        const match = line.match(/- \*\*([^*]+)\*\*:?\s*(.*)/);
                        if (match) {
                          return (
                            <div key={i} className="flex items-start gap-2 mb-2">
                              <span className="text-emerald-400 mt-1">•</span>
                              <div>
                                <span className="font-semibold text-slate-200">{match[1]}:</span>
                                <span className="text-slate-300 ml-1">{match[2]}</span>
                              </div>
                            </div>
                          );
                        }
                      }
                      // Handle numbered lists
                      if (/^\d+\.\s/.test(line)) {
                        return <p key={i} className="text-slate-300 mb-1 pl-4">{line}</p>;
                      }
                      // Handle regular list items
                      if (line.startsWith('- ')) {
                        return (
                          <div key={i} className="flex items-start gap-2 mb-1">
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-300">{line.replace('- ', '')}</span>
                          </div>
                        );
                      }
                      // Handle separator
                      if (line === '---') {
                        return <hr key={i} className="border-slate-700 my-4" />;
                      }
                      // Regular paragraphs
                      if (line.trim()) {
                        return <p key={i} className="text-slate-300 mb-2">{line}</p>;
                      }
                      return null;
                    })}
                  </div>
                </div>
              </>
            ) : isActive ? (
              // Interview in progress
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse"></div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2">Interview in Progress</h3>
                <p className="text-sm text-slate-400 mb-4">Focus on your answers. Detailed feedback will be provided when the session ends.</p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span>Click "End Session" when finished</span>
                </div>
              </div>
            ) : (
              // Waiting to start - JD Input and Info
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                    Job Description (Optional)
                  </h3>
                  {jobDescription && (
                    <button
                      onClick={() => setJobDescription('')}
                      className="text-xs text-slate-400 hover:text-red-400 transition-colors focus:outline-none"
                      aria-label="Clear job description"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste a job description here to get tailored interview questions specific to the role..."
                  className="flex-1 min-h-[120px] w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent custom-scrollbar"
                  aria-label="Job description input"
                />
                <div className="mt-3 pt-3 border-t border-slate-800">
                  {jobDescription ? (
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      <p className="text-xs text-emerald-400">JD loaded! Questions will be tailored to this role.</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-2">Or start without a JD for general interview practice</p>
                    </div>
                  )}
                  <div className="mt-3 text-xs text-slate-500">
                    <p className="font-medium text-slate-400 mb-1">Feedback includes:</p>
                    <ul className="space-y-0.5">
                      <li>• Communication & Clarity</li>
                      <li>• Body Language & Presence</li>
                      <li>• Content Quality & Structure</li>
                      {jobDescription && <li>• JD Alignment Assessment</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Error Overlay */}
      {error && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-red-500/50 p-8 rounded-3xl max-w-md w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-red-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Session Error</h3>
            <p className="text-slate-400 mb-8">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Splash Screen */}
      {!isActive && !isConnecting && transcriptions.length === 0 && !endFeedback && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 opacity-20">
          <div className="text-center">
            <div className="w-64 h-64 bg-blue-600/20 rounded-full blur-[100px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={0.5} stroke="currentColor" className="w-48 h-48 text-slate-700 mx-auto mb-8 animate-pulse">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
            <h2 className="text-4xl font-bold text-slate-800">Ready to Interview?</h2>
            <p className="text-slate-700 max-w-sm mx-auto mt-4">Connect your mic and camera to practice with an AI interviewer and receive detailed feedback.</p>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        @media (max-width: 1024px) {
          .flex-1.flex.gap-6 {
            flex-direction: column;
          }
          .w-96 {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default App;
