-- Database Schema for Token Management System
-- Run these SQL commands in your Supabase SQL editor to create the required tables

-- 1. Create user_groups table
CREATE TABLE IF NOT EXISTS user_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    image_limit INTEGER NOT NULL DEFAULT 100,
    video_limit INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Create group_memberships table
CREATE TABLE IF NOT EXISTS group_memberships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES approved_users(user_id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(group_id, user_id)
);

-- 3. Create generation_usage table
CREATE TABLE IF NOT EXISTS generation_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES approved_users(user_id) ON DELETE CASCADE,
    generation_type TEXT NOT NULL CHECK (generation_type IN ('image', 'video')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_memberships_group_id ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user_id ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_active ON group_memberships(is_active);
CREATE INDEX IF NOT EXISTS idx_generation_usage_group_id ON generation_usage(group_id);
CREATE INDEX IF NOT EXISTS idx_generation_usage_user_id ON generation_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_usage_type ON generation_usage(generation_type);
CREATE INDEX IF NOT EXISTS idx_generation_usage_created_at ON generation_usage(created_at);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_usage ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for admin access
-- Note: You'll need to adjust these policies based on your admin_users table structure

-- Policy for user_groups - only admins can access
CREATE POLICY "Admins can manage user groups" ON user_groups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE admin_users.user_id = auth.uid()
        )
    );

-- Policy for group_memberships - only admins can access
CREATE POLICY "Admins can manage group memberships" ON group_memberships
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE admin_users.user_id = auth.uid()
        )
    );

-- Policy for generation_usage - only admins can access
CREATE POLICY "Admins can manage generation usage" ON generation_usage
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE admin_users.user_id = auth.uid()
        )
    );

-- 7. Grant necessary permissions
GRANT ALL ON user_groups TO authenticated;
GRANT ALL ON group_memberships TO authenticated;
GRANT ALL ON generation_usage TO authenticated;

-- 8. Create a function to get group usage statistics
CREATE OR REPLACE FUNCTION get_group_usage_stats(group_uuid UUID)
RETURNS TABLE (
    group_id UUID,
    member_count BIGINT,
    image_usage BIGINT,
    video_usage BIGINT,
    image_remaining BIGINT,
    video_remaining BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id as group_id,
        COALESCE(member_stats.member_count, 0) as member_count,
        COALESCE(usage_stats.image_usage, 0) as image_usage,
        COALESCE(usage_stats.video_usage, 0) as video_usage,
        GREATEST(0, g.image_limit - COALESCE(usage_stats.image_usage, 0)) as image_remaining,
        GREATEST(0, g.video_limit - COALESCE(usage_stats.video_usage, 0)) as video_remaining
    FROM user_groups g
    LEFT JOIN (
        SELECT 
            group_id,
            COUNT(*) as member_count
        FROM group_memberships 
        WHERE is_active = true
        GROUP BY group_id
    ) member_stats ON g.id = member_stats.group_id
    LEFT JOIN (
        SELECT 
            group_id,
            COUNT(*) FILTER (WHERE generation_type = 'image') as image_usage,
            COUNT(*) FILTER (WHERE generation_type = 'video') as video_usage
        FROM generation_usage
        GROUP BY group_id
    ) usage_stats ON g.id = usage_stats.group_id
    WHERE g.id = group_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create a function to check if user can generate (for API use)
CREATE OR REPLACE FUNCTION can_user_generate(
    user_uuid UUID,
    gen_type TEXT
) RETURNS TABLE (
    can_generate BOOLEAN,
    group_id UUID,
    current_usage BIGINT,
    limit_value INTEGER,
    remaining BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN g.id IS NULL THEN TRUE -- User not in any group, no limits
            WHEN gen_type = 'image' AND COALESCE(usage_stats.image_usage, 0) < g.image_limit THEN TRUE
            WHEN gen_type = 'video' AND COALESCE(usage_stats.video_usage, 0) < g.video_limit THEN TRUE
            ELSE FALSE
        END as can_generate,
        g.id as group_id,
        CASE 
            WHEN gen_type = 'image' THEN COALESCE(usage_stats.image_usage, 0)
            WHEN gen_type = 'video' THEN COALESCE(usage_stats.video_usage, 0)
            ELSE 0
        END as current_usage,
        CASE 
            WHEN gen_type = 'image' THEN g.image_limit
            WHEN gen_type = 'video' THEN g.video_limit
            ELSE 0
        END as limit_value,
        CASE 
            WHEN gen_type = 'image' THEN GREATEST(0, g.image_limit - COALESCE(usage_stats.image_usage, 0))
            WHEN gen_type = 'video' THEN GREATEST(0, g.video_limit - COALESCE(usage_stats.video_usage, 0))
            ELSE 0
        END as remaining
    FROM group_memberships gm
    JOIN user_groups g ON gm.group_id = g.id
    LEFT JOIN (
        SELECT 
            group_id,
            COUNT(*) FILTER (WHERE generation_type = 'image') as image_usage,
            COUNT(*) FILTER (WHERE generation_type = 'video') as video_usage
        FROM generation_usage
        GROUP BY group_id
    ) usage_stats ON g.id = usage_stats.group_id
    WHERE gm.user_id = user_uuid 
    AND gm.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
