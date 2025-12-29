import { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

interface InfoTooltipProps {
  title: string;
  content: string | React.ReactNode;
  className?: string;
}

const InfoTooltip = ({ title, content, className = '' }: InfoTooltipProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm"
      >
        <Info size={16} />
        <span>{title}</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
          <div className="text-sm text-gray-700">
            {typeof content === 'string' ? (
              <p className="whitespace-pre-line">{content}</p>
            ) : (
              content
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;

