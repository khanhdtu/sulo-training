-- Add display_name column to users table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE users ADD COLUMN display_name VARCHAR(255) NULL;
        RAISE NOTICE 'Column display_name added successfully';
    ELSE
        RAISE NOTICE 'Column display_name already exists';
    END IF;
END $$;

-- Create user nhahan
-- Note: Password hash for 'nhahan@123' using bcrypt with salt rounds 10
-- You can generate this using: bcrypt.hash('nhahan@123', 10)
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
    '$2a$10$rK8X8X8X8X8X8X8X8X8Xe.8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X', -- Placeholder, will be updated
    'Trần Nhã Hân',
    'Trần Nhã Hân',
    'student',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (username) DO NOTHING;

-- Note: You need to update the password_hash manually or use the create-user script
-- The password hash should be generated using bcrypt.hash('nhahan@123', 10)

