'use client';

import { useEffect, useState } from 'react';
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
      return <BlockMath math={content} className={combinedClassName} />;
    } else {
      return <InlineMath math={content} className={combinedClassName} />;
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
      console.log('🔍 LaTeX Text Debug:', {
        original: text,
        unescaped: unescaped,
        length: text.length,
        hasFrac: text.includes('frac'),
        hasDollar: text.includes('$'),
        hasDoubleBackslash: text.includes('\\\\'),
        charCodes: text.slice(0, 50).split('').map(c => c.charCodeAt(0)),
      });
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
  }

  // On server side, return plain text to avoid hydration mismatch
  if (!isClient) {
    return <span className={className}>{processedText}</span>;
  }

  // Use a hash of the text as a stable key prefix to avoid hydration issues
  const textHash = processedText.slice(0, 20).replace(/\s/g, '_');

  // First, handle explicit delimiters: $$...$$ (block) or $...$ (inline)
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;

  // Match $$...$$ (block math) or $...$ (inline math)
  const delimiterRegex = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  let match;
  const delimiterMatches: Array<{ index: number; length: number; content: string; isBlock: boolean }> = [];

  while ((match = delimiterRegex.exec(processedText)) !== null) {
    delimiterMatches.push({
      index: match.index,
      length: match[0].length,
      content: (match[1] || match[2] || '').replace(/\\\\/g, '\\'), // Unescape content
      isBlock: !!match[1],
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
    // Combine className with text color class to ensure visibility (pure black)
    const combinedClassName = `${className} text-black`.trim();
    if (mathMatch.isBlock) {
      parts.push(
        <BlockMath key={`${textHash}-block-${i}-${mathMatch.index}`} math={mathMatch.content} className={combinedClassName} />
      );
    } else {
      parts.push(
        <InlineMath key={`${textHash}-inline-${i}-${mathMatch.index}`} math={mathMatch.content} className={combinedClassName} />
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
function parseTextForLatex(text: string, className?: string, keyPrefix: string = 'latex'): (string | JSX.Element)[] {
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
  
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  
  // Check if text contains LaTeX commands (like \sqrt, \frac, \pi, etc.) without delimiters
  // If so, wrap them in $...$ for proper rendering
  const hasLatexCommands = /\\[a-zA-Z]+(\{[^}]*\})*/.test(processedText);
  const hasDelimiters = /\$|\$\$/.test(processedText);
  
  // Debug: Log text being parsed
  console.log('🔍 parseTextForLatex - Input:', {
    original: text,
    processed: processedText,
    length: text.length,
    firstChars: text.slice(0, 100),
    hasLatexCommands,
    hasDelimiters,
  });
  
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
    let match;
    while ((match = pattern.regex.exec(processedText)) !== null) {
      // Check if this match overlaps with existing matches
      const overlaps = matches.some(m => 
        (match.index! >= m.index && match.index! < m.index + m.length) ||
        (m.index >= match.index! && m.index < match.index! + match[0].length)
      );
      
      if (!overlaps) {
        const converted = pattern.convert(match);
        console.log(`✅ Pattern "${pattern.name}" matched:`, {
          original: match[0],
          converted,
          index: match.index,
          fullMatch: match,
        });
        matches.push({
          index: match.index!,
          length: match[0].length,
          content: match[0],
          converted,
          patternName: pattern.name,
        });
      }
    }
  }

  console.log('📊 Total matches found:', matches.length, matches);

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

    // Try to render as LaTeX with stable key (client-side only)
    parts.push(
      <LatexRendererClient 
        key={`${keyPrefix}-math-${i}-${mathMatch.index}-${mathMatch.content.slice(0, 10)}`}
        content={latexContent} 
        className={className} 
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

