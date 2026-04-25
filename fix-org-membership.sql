-- TicketPilot: Fix Organization Membership
-- Use this to add users to the same organization for testing

-- ===================================================================
-- STEP 1: Find all organizations
-- ===================================================================
SELECT 
    id, 
    name, 
    slug,
    created_at
FROM app.organizations
ORDER BY created_at DESC;

-- Copy the ID of the organization you want users to share


-- ===================================================================
-- STEP 2: Find users (especially recently created ones)
-- ===================================================================
SELECT 
    id, 
    email,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- Copy the user IDs you want to add to the organization


-- ===================================================================
-- STEP 3: Check current organization memberships
-- ===================================================================
SELECT 
    om.user_id,
    u.email,
    om.organization_id,
    o.name as org_name,
    om.role,
    om.is_default
FROM app.organization_members om
JOIN auth.users u ON u.id = om.user_id
JOIN app.organizations o ON o.id = om.organization_id
ORDER BY u.email;


-- ===================================================================
-- STEP 4: Add user to organization
-- ===================================================================
-- REPLACE THESE VALUES:
-- - 'ORG_ID_HERE' with organization ID from step 1
-- - 'USER_ID_HERE' with user ID from step 2

INSERT INTO app.organization_members (
    organization_id, 
    user_id, 
    role,
    is_default
)
VALUES (
    'ORG_ID_HERE',     -- Organization ID (e.g., '123e4567-e89b-12d3-a456-426614174000')
    'USER_ID_HERE',    -- User ID (e.g., '987fcdeb-51a2-43d7-8901-234567890abc')
    'member',          -- Role: 'owner', 'admin', 'member', 'rep', or 'customer'
    true               -- Make this their default org
);


-- ===================================================================
-- STEP 5: Verify membership
-- ===================================================================
SELECT 
    u.email,
    o.name as organization,
    om.role,
    om.is_default
FROM app.organization_members om
JOIN auth.users u ON u.id = om.user_id
JOIN app.organizations o ON o.id = om.organization_id
WHERE u.email IN ('admin@example.com', 'customer@example.com')  -- Replace with your emails
ORDER BY u.email;


-- ===================================================================
-- OPTIONAL: Remove user from auto-created organization
-- ===================================================================
-- If the new user has an auto-created org you don't need, remove them:

-- First, find their auto-created org:
SELECT 
    o.id,
    o.name,
    o.slug,
    COUNT(om.user_id) as member_count
FROM app.organizations o
LEFT JOIN app.organization_members om ON om.organization_id = o.id
GROUP BY o.id, o.name, o.slug
HAVING COUNT(om.user_id) = 1;  -- Organizations with only 1 member

-- Then delete the membership:
DELETE FROM app.organization_members
WHERE organization_id = 'AUTO_CREATED_ORG_ID'
  AND user_id = 'USER_ID';

-- And optionally delete the empty org:
DELETE FROM app.organizations
WHERE id = 'AUTO_CREATED_ORG_ID';


-- ===================================================================
-- QUICK EXAMPLE: Add new user to admin's org
-- ===================================================================
-- This is a complete example - replace the IDs and emails

-- 1. Find admin's organization
SELECT id, name FROM app.organizations WHERE name ILIKE '%admin%' OR slug ILIKE '%admin%';
-- Result: id = 'abc-123', name = 'Admin Org'

-- 2. Find new user
SELECT id, email FROM auth.users WHERE email = 'newcustomer@test.com';
-- Result: id = 'xyz-789', email = 'newcustomer@test.com'

-- 3. Add to organization
INSERT INTO app.organization_members (organization_id, user_id, role, is_default)
VALUES ('abc-123', 'xyz-789', 'member', true);

-- 4. Verify
SELECT u.email, o.name, om.role
FROM app.organization_members om
JOIN auth.users u ON u.id = om.user_id
JOIN app.organizations o ON o.id = om.organization_id
WHERE u.email = 'newcustomer@test.com';

-- Done! Now both users are in the same organization.
