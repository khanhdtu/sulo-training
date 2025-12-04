'use client';

import { useEffect, useState } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

/**
 * Client-side only LaTeX renderer to avoid hydration mismatches
 */
export function LatexRendererClient({ content, displayMode = false, className = '' }: { content: string; displayMode?: boolean; className?: string }) {
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

    // Combine className with text color class to ensure visibility (pure black)
    const combinedClassName = `${className} text-black`.trim();
    if (displayMode) {
      return <BlockMath math={mathContent} className={combinedClassName} />;
    } else {
      return <InlineMath math={mathContent} className={combinedClassName} />;
    }
  } catch (error) {
    console.warn('LaTeX parsing error:', error, 'Content:', content);
    return <span className={className}>{content}</span>;
  }
}

