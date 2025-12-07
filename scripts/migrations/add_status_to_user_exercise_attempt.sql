-- Migration: Add status field to user_exercise_attempts table
-- Date: 2025-01-XX
-- Description: Add status field to track draft, submitted, and completed states

-- Add status column with default value 'draft'
ALTER TABLE user_exercise_attempts 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';

-- Update existing records: 
-- - If is_completed = true, set status = 'completed'
-- - If is_completed = false and has answers, set status = 'submitted'
-- - Otherwise, keep as 'draft'
UPDATE user_exercise_attempts
SET status = CASE
  WHEN is_completed = true THEN 'completed'
  WHEN answers IS NOT NULL AND answers::text != '{}' THEN 'submitted'
  ELSE 'draft'
END
WHERE status IS NULL OR status = 'draft';

-- Add comment to column
COMMENT ON COLUMN user_exercise_attempts.status IS 'Status of the exercise attempt: draft, submitted, or completed';



