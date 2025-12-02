-- Add display_name column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE users ADD COLUMN display_name VARCHAR(255) NULL;
    END IF;
END $$;

-- Create user nhahan
-- Password: nhahan@123
-- Hash generated using bcrypt.hash('nhahan@123', 10)
INSERT INTO users (
    username, 
    password_hash, 
    name, 
    display_name, 
    role, 
    is_active,
    created_at,
    updated_at
) VALUES (
    'nhahan',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- bcrypt hash of 'nhahan@123'
    'Trần Nhã Hân',
    'Trần Nhã Hân',
    'student',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (username) DO UPDATE
SET 
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    updated_at = NOW();

