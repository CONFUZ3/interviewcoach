import React, { memo } from 'react';
import { FeedbackMessage, Sentiment } from '../types';

interface FeedbackListProps {
  feedbacks: FeedbackMessage[];
}

// Severity indicator component
const SeverityBadge = ({ severity }: { severity?: string }) => {
  if (!severity) return null;
  
  const colors = {
    minor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    moderate: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    significant: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${colors[severity as keyof typeof colors] || ''}`}>
      {severity}
    </span>
  );
};

// Memoized individual feedback item to prevent unnecessary re-renders
const FeedbackItem = memo<{ fb: FeedbackMessage }>(({ fb }) => (
  <div 
    className={`p-4 rounded-xl border-l-4 transition-all animate-slide-in ${
      fb.sentiment === Sentiment.POSITIVE ? 'bg-emerald-950/20 border-emerald-500 text-emerald-200' :
      fb.sentiment === Sentiment.IMPROVEMENT ? 'bg-amber-950/20 border-amber-500 text-amber-200' :
      'bg-slate-800/50 border-slate-500 text-slate-200'
    }`}
  >
    <div className="flex justify-between items-start mb-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider opacity-70">{fb.category}</span>
        {fb.subcategory && (
          <span className="text-[10px] opacity-50">• {fb.subcategory}</span>
        )}
        {fb.severity && fb.sentiment === Sentiment.IMPROVEMENT && (
          <SeverityBadge severity={fb.severity} />
        )}
      </div>
      <span className="text-[10px] opacity-50">{new Date(fb.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
    </div>
    <p className="text-sm font-medium leading-relaxed">{fb.message}</p>
  </div>
));

FeedbackItem.displayName = 'FeedbackItem';

// Feedbacks are already prepended with newest first in App.tsx, no need to sort
const FeedbackList: React.FC<FeedbackListProps> = memo(({ feedbacks }) => {
  return (
    <div className="flex flex-col space-y-4 max-h-full overflow-y-auto pr-2 custom-scrollbar">
      {feedbacks.length === 0 ? (
        <div className="text-center py-10 text-slate-500 italic">
          Coach tips will appear here in real-time...
        </div>
      ) : (
        feedbacks.map((fb) => (
          <FeedbackItem key={fb.id} fb={fb} />
        ))
      )}
    </div>
  );
});

FeedbackList.displayName = 'FeedbackList';

export default FeedbackList;
