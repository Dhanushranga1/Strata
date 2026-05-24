-- Find which organization has the newest ticket
-- Run this in Supabase SQL Editor

-- Step 1: Find the most recent ticket and its organization
SELECT 
    t.id as ticket_id,
    t.title,
    t.created_at,
    t.organization_id,
    o.name as org_name,
    u.email as creator_email
FROM app.tickets t
LEFT JOIN app.organizations o ON o.id = t.organization_id
LEFT JOIN auth.users u ON u.id = t.created_by
ORDER BY t.created_at DESC
LIMIT 5;

-- Step 2: Find the "Default Organization" ID
SELECT id, name, slug FROM app.organizations WHERE name = 'Default Organization';

-- Step 3: Move all tickets to Default Organization
-- (Replace 'DEFAULT_ORG_ID' with the ID from step 2)
UPDATE app.tickets
SET organization_id = 'DEFAULT_ORG_ID'
WHERE created_at > NOW() - INTERVAL '1 hour';  -- Only recent tickets

-- Step 4: Move all users to Default Organization
-- First get Default Org ID
-- Then run:
INSERT INTO app.organization_members (organization_id, user_id, role, is_default)
SELECT 
    'DEFAULT_ORG_ID',  -- Replace with actual Default Org ID
    id,
    'member',
    true
FROM auth.users
WHERE id NOT IN (
    SELECT user_id FROM app.organization_members WHERE organization_id = 'DEFAULT_ORG_ID'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Step 5: Verify everyone is now in Default Organization
SELECT 
    u.email,
    o.name as organization,
    om.role
FROM app.organization_members om
JOIN auth.users u ON u.id = om.user_id
JOIN app.organizations o ON o.id = om.organization_id
WHERE o.name = 'Default Organization'
ORDER BY u.email;
