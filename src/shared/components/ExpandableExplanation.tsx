import { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableExplanationProps {
  title: string;
  content: string | React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

const ExpandableExplanation = ({ 
  title, 
  content, 
  defaultOpen = false,
  className = '' 
}: ExpandableExplanationProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-blue-100 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Info size={18} className="text-blue-600" />
          <span className="font-medium text-blue-800">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp size={18} className="text-blue-600" />
        ) : (
          <ChevronDown size={18} className="text-blue-600" />
        )}
      </button>
      
      {isOpen && (
        <div className="px-3 pb-3 text-sm text-blue-700">
          {typeof content === 'string' ? (
            <p className="whitespace-pre-line">{content}</p>
          ) : (
            content
          )}
        </div>
      )}
    </div>
  );
};

export default ExpandableExplanation;

