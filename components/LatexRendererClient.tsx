'use client';

import { useEffect, useState } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

/**
 * Client-side only LaTeX renderer to avoid hydration mismatches
 */
export function LatexRendererClient({ content, displayMode = false, className = '', style }: { content: string; displayMode?: boolean; className?: string; style?: React.CSSProperties }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!content || !isClient) {
    return <span className={className}>{content || ''}</span>;
  }

  try {
    // Remove delimiters if present (react-katex doesn't need them)
    let mathContent = content.trim().replace(/^\$+|\$+$/g, '');
    
    // Ensure content has proper LaTeX formatting
    // If content is just a LaTeX command like \sqrt{2}, it should work directly
    if (!mathContent) {
      return <span className={className}>{content}</span>;
    }

    // Use provided style or default to black
    const mathStyle = style || { color: '#000', opacity: 1, WebkitTextFillColor: '#000' };
    const combinedClassName = `${className}`.trim();
    if (displayMode) {
      return (
        <div className={combinedClassName} style={mathStyle}>
          <BlockMath math={mathContent} />
        </div>
      );
    } else {
      return (
        <span className={combinedClassName} style={mathStyle}>
          <InlineMath math={mathContent} />
        </span>
      );
    }
  } catch (error) {
    console.warn('LaTeX parsing error:', error, 'Content:', content);
    return <span className={className}>{content}</span>;
  }
}

