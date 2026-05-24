-- Add Admin to Customer's Organization
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/nvgmgvplfpukckfkjuso/editor

-- Step 1: Find the organization and user IDs
SELECT 
    o.id as org_id,
    o.name as org_name,
    u.id as user_id,
    u.email as user_email
FROM app.organizations o
CROSS JOIN auth.users u
WHERE o.name = 'gdr20704@gmail.com''s Organization'
  AND u.email = 'dg1513@srmist.edu.in';

-- Copy the org_id and user_id from the result above

-- Step 2: Add admin to the customer's organization
-- Replace the IDs below with actual values from Step 1
INSERT INTO app.organization_members (organization_id, user_id, role, is_default)
VALUES (
    'PASTE_ORG_ID_HERE',    -- From step 1
    'PASTE_USER_ID_HERE',   -- From step 1
    'admin',                -- Give admin role
    false                   -- Don't make it default
);

-- Step 3: Verify the admin was added
SELECT 
    u.email,
    o.name as organization,
    om.role
FROM app.organization_members om
JOIN auth.users u ON u.id = om.user_id
JOIN app.organizations o ON o.id = om.organization_id
WHERE u.email = 'dg1513@srmist.edu.in'
ORDER BY o.name;

-- You should now see the admin is a member of gdr20704's organization!
