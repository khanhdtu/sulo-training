'use client';

import { useEffect, useState, ReactElement } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { LatexRendererClient } from './LatexRendererClient';

interface LatexRendererProps {
  content: string;
  displayMode?: boolean;
  className?: string;
}

/**
 * Component to render LaTeX content
 * Supports both inline and block math
 */
export default function LatexRenderer({ content, displayMode = false, className = '' }: LatexRendererProps) {
  if (!content) return null;

  // Check if content contains LaTeX syntax
  const hasLatex = /\\[a-zA-Z]+|\\\(|\\\[|\$|\{|\}/.test(content);

  if (!hasLatex) {
    // No LaTeX, return as plain text
    return <span className={className}>{content}</span>;
  }

  try {
    // Combine className with text color class to ensure visibility (pure black)
    const combinedClassName = `${className} text-black`.trim();
    if (displayMode) {
      return <div className={combinedClassName}><BlockMath math={content} /></div>;
    } else {
      return <span className={combinedClassName}><InlineMath math={content} /></span>;
    }
  } catch (error) {
    // If LaTeX parsing fails, return as plain text
    console.warn('LaTeX parsing error:', error);
    return <span className={className}>{content}</span>;
  }
}

/**
 * Component to render text that may contain LaTeX
 * Automatically detects LaTeX blocks and renders them appropriately
 * Uses stable keys based on content to avoid hydration mismatches
 */
export function LatexText({ text, className }: { text: string; className?: string }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!text) return null;

  // Debug: Log original text
  useEffect(() => {
    if (isClient && text) {
      // Unescape double backslashes
      const unescaped = text.replace(/\\\\/g, '\\');
    }
  }, [text, isClient]);

  // Unescape double backslashes in text (common issue from database/API)
  let processedText = text ? text.replace(/\\\\/g, '\\') : text;
  
  // Convert Unicode geometric symbols to LaTeX
  if (processedText) {
    // Angle symbol: ∠ → \angle
    processedText = processedText.replace(/∠/g, '\\angle');
    // Triangle symbol: △ → \triangle (if used)
    processedText = processedText.replace(/△/g, '\\triangle');
    // Parallel symbol: ∥ → \parallel (if used as Unicode)
    processedText = processedText.replace(/∥/g, '\\parallel');
    // Perpendicular symbol: ⊥ → \perp
    processedText = processedText.replace(/⊥/g, '\\perp');
    // Similar symbol: ∼ → \sim
    processedText = processedText.replace(/∼/g, '\\sim');
    // Congruent symbol: ≅ → \cong
    processedText = processedText.replace(/≅/g, '\\cong');
    
    // Normalize LaTeX delimiters: convert \( and \) to $ for easier parsing
    // This helps with cases where AI returns \( ... \) format
    processedText = processedText.replace(/\\\(/g, '$').replace(/\\\)/g, '$');
    processedText = processedText.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
  }

  // On server side, return plain text to avoid hydration mismatch
  if (!isClient) {
    return <span className={className}>{processedText}</span>;
  }

  // Use a hash of the text as a stable key prefix to avoid hydration issues
  const textHash = processedText.slice(0, 20).replace(/\s/g, '_');

  // First, handle explicit delimiters: $$...$$ (block) or $...$ (inline)
  const parts: (string | ReactElement)[] = [];
  let lastIndex = 0;

  // Match $$...$$ (block math), $...$ (inline math), \[...\] (block math), or \(...\) (inline math)
  // Note: In regex literal, \\( matches literal \( in text, \\[ matches literal \[
  const delimiterRegex = /\$\$([^$]+)\$\$|\\\[([^\]]+)\\\]|\$([^$]+)\$|\\(([^)]+)\\)/g;
  let match;
  const delimiterMatches: Array<{ index: number; length: number; content: string; isBlock: boolean }> = [];

  while ((match = delimiterRegex.exec(processedText)) !== null) {
    // match[1] = $$...$$, match[2] = \[...\], match[3] = $...$, match[4] = \(...\)
    let content = (match[1] || match[2] || match[3] || match[4] || '').replace(/\\\\/g, '\\'); // Unescape content
    const isBlock = !!(match[1] || match[2]); // $$...$$ or \[...\] are block math
    
    // Clean up content - remove any remaining escape sequences that shouldn't be there
    content = content.trim();
    
    delimiterMatches.push({
      index: match.index,
      length: match[0].length,
      content,
      isBlock,
    });
  }

  // Process delimiter matches
  for (let i = 0; i < delimiterMatches.length; i++) {
    const mathMatch = delimiterMatches[i];
    // Add text before LaTeX
    if (mathMatch.index > lastIndex) {
      const beforeText = processedText.substring(lastIndex, mathMatch.index);
      // Check if this text contains LaTeX syntax without delimiters
      parts.push(...parseTextForLatex(beforeText, className, `${textHash}-before-${i}`));
    }

    // Add LaTeX math with stable key
    // Use black color to match question text
    const combinedClassName = `${className}`.trim();
    const mathColor = '#000';
    if (mathMatch.isBlock) {
      parts.push(
        <div key={`${textHash}-block-${i}-${mathMatch.index}`} className={combinedClassName} style={{ color: mathColor, opacity: 1, WebkitTextFillColor: mathColor }}>
          <BlockMath math={mathMatch.content} />
        </div>
      );
    } else {
      parts.push(
        <span key={`${textHash}-inline-${i}-${mathMatch.index}`} className={combinedClassName} style={{ color: mathColor, opacity: 1, WebkitTextFillColor: mathColor }}>
          <InlineMath math={mathMatch.content} />
        </span>
      );
    }
    lastIndex = mathMatch.index + mathMatch.length;
  }

  // Add remaining text (or all text if no delimiters found)
  if (lastIndex < processedText.length) {
    const remainingText = processedText.substring(lastIndex);
    parts.push(...parseTextForLatex(remainingText, className, `${textHash}-remaining`));
  } else if (delimiterMatches.length === 0) {
    // No delimiters found, parse entire text
    parts.push(...parseTextForLatex(processedText, className, textHash));
  }

  // If no parts, return plain text
  if (parts.length === 0) {
    return <span className={className}>{processedText}</span>;
  }

  return <>{parts}</>;
}

/**
 * Helper function to render text with LaTeX (wrapper for component)
 */
export function renderTextWithLatex(text: string, className?: string) {
  return <LatexText text={text} className={className} />;
}

/**
 * Parse text to find LaTeX syntax patterns and convert them
 * Detects patterns like: frac35, sqrt, ^, _, etc.
 */
function parseTextForLatex(text: string, className?: string, keyPrefix: string = 'latex'): (string | ReactElement)[] {
  if (!text) return [];

  // Unescape double backslashes
  let processedText = text.replace(/\\\\/g, '\\');
  
  // Convert Unicode geometric symbols to LaTeX
  // Angle symbol: ∠ → \angle
  processedText = processedText.replace(/∠/g, '\\angle');
  // Triangle symbol: △ → \triangle (if used)
  processedText = processedText.replace(/△/g, '\\triangle');
  // Parallel symbol: ∥ → \parallel (if used as Unicode)
  processedText = processedText.replace(/∥/g, '\\parallel');
  // Perpendicular symbol: ⊥ → \perp
  processedText = processedText.replace(/⊥/g, '\\perp');
  // Similar symbol: ∼ → \sim
  processedText = processedText.replace(/∼/g, '\\sim');
  // Congruent symbol: ≅ → \cong
  processedText = processedText.replace(/≅/g, '\\cong');
  
  const parts: (string | ReactElement)[] = [];
  let lastIndex = 0;
  
  // Check if text contains LaTeX commands (like \sqrt, \frac, \pi, etc.) without delimiters
  // If so, wrap them in $...$ for proper rendering
  const hasLatexCommands = /\\[a-zA-Z]+(\{[^}]*\})*/.test(processedText);
  const hasDelimiters = /\$|\$\$/.test(processedText);
  
  // Simple approach: find all LaTeX patterns and convert them
  // Pattern order matters - more specific first
  const patterns = [
    // LaTeX commands with backslash (already correct) - MUST BE FIRST to catch \sqrt{}, \frac{}, \pi, etc.
    // Match: \command, \command{arg}, \command{arg1}{arg2}, etc.
    { 
      regex: /\\([a-zA-Z]+)(?:\{([^}]*)\})?(?:\{([^}]*)\})?/g, 
      convert: (m: RegExpMatchArray) => {
        // Reconstruct the LaTeX command properly
        let result = `\\${m[1]}`;
        if (m[2]) result += `{${m[2]}}`;
        if (m[3]) result += `{${m[3]}}`;
        return result;
      }, 
      name: '\\command' 
    },
    // frac{}{} format (without backslash)
    { regex: /frac\{([^}]+)\}\{([^}]+)\}/g, convert: (m: RegExpMatchArray) => `\\frac{${m[1]}}{${m[2]}}`, name: 'frac{}{}' },
    // fracXY format (frac followed by digits)
    { regex: /frac(\d+)(\d+)/g, convert: (m: RegExpMatchArray) => `\\frac{${m[1]}}{${m[2]}}`, name: 'fracXY' },
    // sqrt{} format (without backslash)
    { regex: /sqrt\{([^}]+)\}/g, convert: (m: RegExpMatchArray) => `\\sqrt{${m[1]}}`, name: 'sqrt{}' },
    // sqrtX format
    { regex: /sqrt(\d+)/g, convert: (m: RegExpMatchArray) => `\\sqrt{${m[1]}}`, name: 'sqrtX' },
    // X^Y format
    { regex: /([a-zA-Z0-9()]+)\^([a-zA-Z0-9+\-()]+)/g, convert: (m: RegExpMatchArray) => `${m[1]}^{${m[2]}}`, name: 'X^Y' },
    // X_Y format
    { regex: /([a-zA-Z0-9()]+)_([a-zA-Z0-9+\-()]+)/g, convert: (m: RegExpMatchArray) => `${m[1]}_{${m[2]}}`, name: 'X_Y' },
  ];

  // Find all matches from all patterns
  const matches: Array<{ index: number; length: number; content: string; converted: string; patternName: string }> = [];

  for (const pattern of patterns) {
    // Reset regex lastIndex
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(processedText)) !== null) {
      // Check if this match overlaps with existing matches
      const matchIndex = match.index!;
      const matchLength = match[0].length;
      const overlaps = matches.some(m => 
        (matchIndex >= m.index && matchIndex < m.index + m.length) ||
        (m.index >= matchIndex && m.index < matchIndex + matchLength)
      );
      
      if (!overlaps) {
        const converted = pattern.convert(match);
        matches.push({
          index: matchIndex,
          length: matchLength,
          content: match[0],
          converted,
          patternName: pattern.name,
        });
      }
    }
  }

  // Sort matches by index
  matches.sort((a, b) => a.index - b.index);

  // Process matches with stable keys
  for (let i = 0; i < matches.length; i++) {
    const mathMatch = matches[i];
    // Add text before LaTeX
    if (mathMatch.index > lastIndex) {
      parts.push(
        <span key={`${keyPrefix}-text-${i}-${mathMatch.index}`}>
          {processedText.substring(lastIndex, mathMatch.index)}
        </span>
      );
    }

    // Use converted LaTeX content
    const latexContent = mathMatch.converted;

    // Use black color for questions
    const mathColor = '#000';

    // Try to render as LaTeX with stable key (client-side only)
    parts.push(
      <LatexRendererClient 
        key={`${keyPrefix}-math-${i}-${mathMatch.index}-${mathMatch.content.slice(0, 10)}`}
        content={latexContent} 
        className={className}
        style={{ color: mathColor, opacity: 1, WebkitTextFillColor: mathColor }}
      />
    );

    lastIndex = mathMatch.index + mathMatch.length;
  }

  // Add remaining text
  if (lastIndex < processedText.length) {
    parts.push(
      <span key={`${keyPrefix}-text-end`}>{processedText.substring(lastIndex)}</span>
    );
  }

  // If no LaTeX found, return plain text
  if (parts.length === 0) {
    return [<span key={`${keyPrefix}-plain`} className={className}>{processedText}</span>];
  }

  return parts;
}

