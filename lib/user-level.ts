/**
 * User Level Utilities
 * 
 * Helper functions for mapping user level to exercise difficulty
 * and managing user learning paths
 */

/**
 * Map user level (1-12) to exercise difficulty
 * - Level 1-4: easy
 * - Level 5-8: medium  
 * - Level 9-12: hard
 */
export function mapLevelToDifficulty(level: number): 'easy' | 'medium' | 'hard' {
  if (level >= 1 && level <= 4) return 'easy';
  if (level >= 5 && level <= 8) return 'medium';
  if (level >= 9 && level <= 12) return 'hard';
  return 'easy'; // default fallback
}

/**
 * Get all difficulty levels up to user's level
 * Example: level 5 returns ['easy', 'medium']
 */
export function getDifficultyLevelsUpTo(level: number): ('easy' | 'medium' | 'hard')[] {
  const difficulties: ('easy' | 'medium' | 'hard')[] = [];
  if (level >= 1) difficulties.push('easy');
  if (level >= 5) difficulties.push('medium');
  if (level >= 9) difficulties.push('hard');
  return difficulties;
}

