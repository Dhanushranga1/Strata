-- TicketPilot Demo Tickets SQL Seed
-- Run this directly in your Supabase SQL Editor or PostgreSQL console
-- NOTE: Replace the UUIDs with actual user IDs from your auth.users table

-- First, let's check if we have any users to create tickets for
-- You'll need to replace 'YOUR_USER_ID_HERE' with an actual user UUID

-- Demo Ticket 1: AI Not Working
INSERT INTO app.tickets (created_by, title, description, status, message_count, last_message_at)
VALUES (
  'YOUR_USER_ID_HERE'::uuid,
  'AI Response Not Working - Getting Error 500',
  'I''m trying to use the AI assistant to get help with my account issue, but every time I submit a query, I get an error message saying "Something went wrong." The error code appears to be 500. I''ve tried refreshing the page and logging out/in, but the issue persists.

Steps to reproduce:
1. Go to the ticket page
2. Click on "Ask AI Assistant"
3. Type any question
4. Click Submit
5. Error appears

This is blocking me from getting support. Please help!',
  'open',
  1,
  now()
);

-- Demo Ticket 2: Knowledge Base Access Issue
INSERT INTO app.tickets (created_by, title, description, status, message_count, last_message_at)
VALUES (
  'YOUR_USER_ID_HERE'::uuid,
  'Cannot Access Knowledge Base Articles',
  'The knowledge base section is not loading for me. When I click on "Browse Knowledge Base", I see a spinning loader that never completes. I''ve waited for over 5 minutes.

Browser: Chrome 120
OS: Windows 11
Account Type: Customer

Is this a known issue? I need to access documentation for setting up my integration.',
  'open',
  1,
  now()
);

-- Demo Ticket 3: Slow Response Time
INSERT INTO app.tickets (created_by, title, description, status, message_count, last_message_at)
VALUES (
  'YOUR_USER_ID_HERE'::uuid,
  'Slow Response Time from AI Assistant',
  'The AI assistant is working but taking 30-45 seconds to respond to queries. This used to be much faster (under 5 seconds). Is something wrong with the system?

Example queries I tried:
- "How do I reset my password?"
- "What are your business hours?"
- "How to integrate with API?"

All of them took very long to respond.',
  'open',
  1,
  now()
);

-- Demo Ticket 4: Incorrect AI Information
INSERT INTO app.tickets (created_by, title, description, status, message_count, last_message_at)
VALUES (
  'YOUR_USER_ID_HERE'::uuid,
  'AI Giving Incorrect Information About Billing',
  'The AI assistant told me that I would be charged $50/month for the Pro plan, but when I checked the pricing page, it says $29/month. This is confusing and concerning.

Question I asked: "How much does the Pro plan cost?"
AI Response: "The Pro plan costs $50 per month with a 14-day free trial."

Can someone clarify the correct pricing and update the AI knowledge base?',
  'open',
  1,
  now()
);

-- Demo Ticket 5: Feature Request
INSERT INTO app.tickets (created_by, title, description, status, message_count, last_message_at)
VALUES (
  'YOUR_USER_ID_HERE'::uuid,
  'Feature Request: Export Chat History with AI',
  'I would love to have a feature that allows me to export my conversation history with the AI assistant. This would be helpful for:
- Keeping records of troubleshooting steps
- Sharing solutions with my team
- Documenting resolved issues

Would be great if it could export to PDF or CSV format.

Is this something that''s planned for a future release?',
  'open',
  1,
  now()
);

-- Demo Ticket 6: Multi-Part Questions
INSERT INTO app.tickets (created_by, title, description, status, message_count, last_message_at)
VALUES (
  'YOUR_USER_ID_HERE'::uuid,
  'AI Not Understanding Multi-Part Questions',
  'When I ask questions with multiple parts, the AI only answers the first part and ignores the rest.

Example: "How do I reset my password AND how long until my account is activated?"
AI only explained password reset, didn''t mention account activation.

This makes it frustrating to get comprehensive help. Can the AI be improved to handle complex questions?',
  'open',
  1,
  now()
);

-- Demo Ticket 7: Missing Citations
INSERT INTO app.tickets (created_by, title, description, status, message_count, last_message_at)
VALUES (
  'YOUR_USER_ID_HERE'::uuid,
  'No Citations Shown in AI Responses',
  'I''m supposed to see citations/sources for AI responses according to the help docs, but I''m not seeing any links or references in the answers I receive.

I want to verify the information and read more details, but without citations, I have no way to know where the AI got this information from.

Is this a bug or a missing feature?',
  'open',
  1,
  now()
);

-- Demo Ticket 8: API Integration Help
INSERT INTO app.tickets (created_by, title, description, status, message_count, last_message_at)
VALUES (
  'YOUR_USER_ID_HERE'::uuid,
  'Need Help with API Integration',
  'I''m a developer trying to integrate your API into our system. I have a few questions:

1. What''s the rate limit for API calls?
2. Do you provide a sandbox environment for testing?
3. How do I handle webhook authentication?
4. Is there an SDK available for Python?

I couldn''t find detailed documentation in the knowledge base. Any guidance would be appreciated!',
  'open',
  1,
  now()
);

-- Demo Ticket 9: Status Update Bug
INSERT INTO app.tickets (created_by, title, description, status, message_count, last_message_at)
VALUES (
  'YOUR_USER_ID_HERE'::uuid,
  'Ticket Status Not Updating Correctly',
  'I marked my ticket #12345 as resolved, but it still shows as "Open" in my dashboard. I''ve tried refreshing multiple times, but the status doesn''t change.

This is causing confusion as I can''t track which issues are actually resolved vs still pending.

Could this be a caching issue or a database sync problem?',
  'open',
  1,
  now()
);

-- Demo Ticket 10: Positive Feedback
INSERT INTO app.tickets (created_by, title, description, status, message_count, last_message_at)
VALUES (
  'YOUR_USER_ID_HERE'::uuid,
  'Excellent AI Response - Feature Works Great!',
  'Just wanted to leave positive feedback! The AI assistant helped me solve my login issue in under 2 minutes. The response was accurate, included step-by-step instructions, and had links to relevant docs.

This is exactly what I need from a support system. Great work on implementing this feature! 🎉

Keep up the good work!',
  'open',
  1,
  now()
);

-- Verify the tickets were created
SELECT id, title, status, created_at 
FROM app.tickets 
ORDER BY created_at DESC 
LIMIT 10;
