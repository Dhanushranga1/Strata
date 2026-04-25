#!/usr/bin/env python3
"""
Seed Demo Tickets for TicketPilot
Creates realistic customer support tickets to demonstrate the AI-powered support system.
"""

import os
import requests
import json
from datetime import datetime

# Configuration
BASE_URL = os.getenv("BACKEND_URL", "https://ticketpilot-backend.onrender.com")
# You'll need to provide a valid JWT token for authentication
AUTH_TOKEN = os.getenv("AUTH_TOKEN", "")

if not AUTH_TOKEN:
    print("⚠️  ERROR: Please set AUTH_TOKEN environment variable")
    print("   Example: export AUTH_TOKEN='your-jwt-token-here'")
    print("   You can get this from the frontend after logging in (check browser DevTools)")
    exit(1)

headers = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

# Demo tickets showcasing different scenarios
DEMO_TICKETS = [
    {
        "title": "AI Response Not Working - Getting Error 500",
        "description": """I'm trying to use the AI assistant to get help with my account issue, 
but every time I submit a query, I get an error message saying "Something went wrong." 
The error code appears to be 500. I've tried refreshing the page and logging out/in, but the issue persists.

Steps to reproduce:
1. Go to the ticket page
2. Click on "Ask AI Assistant"
3. Type any question
4. Click Submit
5. Error appears

This is blocking me from getting support. Please help!""",
        "priority": "high"
    },
    {
        "title": "Cannot Access Knowledge Base Articles",
        "description": """The knowledge base section is not loading for me. When I click on "Browse Knowledge Base", 
I see a spinning loader that never completes. I've waited for over 5 minutes.

Browser: Chrome 120
OS: Windows 11
Account Type: Customer

Is this a known issue? I need to access documentation for setting up my integration.""",
        "priority": "medium"
    },
    {
        "title": "Slow Response Time from AI Assistant",
        "description": """The AI assistant is working but taking 30-45 seconds to respond to queries. 
This used to be much faster (under 5 seconds). Is something wrong with the system?

Example queries I tried:
- "How do I reset my password?"
- "What are your business hours?"
- "How to integrate with API?"

All of them took very long to respond.""",
        "priority": "medium"
    },
    {
        "title": "AI Giving Incorrect Information About Billing",
        "description": """The AI assistant told me that I would be charged $50/month for the Pro plan, 
but when I checked the pricing page, it says $29/month. This is confusing and concerning.

Question I asked: "How much does the Pro plan cost?"
AI Response: "The Pro plan costs $50 per month with a 14-day free trial."

Can someone clarify the correct pricing and update the AI knowledge base?""",
        "priority": "high"
    },
    {
        "title": "Feature Request: Export Chat History with AI",
        "description": """I would love to have a feature that allows me to export my conversation history 
with the AI assistant. This would be helpful for:
- Keeping records of troubleshooting steps
- Sharing solutions with my team
- Documenting resolved issues

Would be great if it could export to PDF or CSV format.

Is this something that's planned for a future release?""",
        "priority": "low"
    },
    {
        "title": "AI Not Understanding Multi-Part Questions",
        "description": """When I ask questions with multiple parts, the AI only answers the first part and ignores the rest.

Example: "How do I reset my password AND how long until my account is activated?"
AI only explained password reset, didn't mention account activation.

This makes it frustrating to get comprehensive help. Can the AI be improved to handle complex questions?""",
        "priority": "medium"
    },
    {
        "title": "No Citations Shown in AI Responses",
        "description": """I'm supposed to see citations/sources for AI responses according to the help docs, 
but I'm not seeing any links or references in the answers I receive.

I want to verify the information and read more details, but without citations, 
I have no way to know where the AI got this information from.

Is this a bug or a missing feature?""",
        "priority": "medium"
    },
    {
        "title": "Need Help with API Integration",
        "description": """I'm a developer trying to integrate your API into our system. I have a few questions:

1. What's the rate limit for API calls?
2. Do you provide a sandbox environment for testing?
3. How do I handle webhook authentication?
4. Is there an SDK available for Python?

I couldn't find detailed documentation in the knowledge base. Any guidance would be appreciated!""",
        "priority": "high"
    },
    {
        "title": "Ticket Status Not Updating Correctly",
        "description": """I marked my ticket #12345 as resolved, but it still shows as "Open" in my dashboard. 
I've tried refreshing multiple times, but the status doesn't change.

This is causing confusion as I can't track which issues are actually resolved vs still pending.

Could this be a caching issue or a database sync problem?""",
        "priority": "low"
    },
    {
        "title": "Excellent AI Response - Feature Works Great!",
        "description": """Just wanted to leave positive feedback! The AI assistant helped me solve my login issue 
in under 2 minutes. The response was accurate, included step-by-step instructions, and had links to relevant docs.

This is exactly what I need from a support system. Great work on implementing this feature! 🎉

Keep up the good work!""",
        "priority": "low"
    }
]

def create_ticket(ticket_data):
    """Create a single ticket via the API"""
    endpoint = f"{BASE_URL}/tickets"
    
    payload = {
        "title": ticket_data["title"],
        "description": ticket_data["description"]
    }
    
    try:
        response = requests.post(endpoint, json=payload, headers=headers)
        response.raise_for_status()
        result = response.json()
        return True, result
    except requests.exceptions.RequestException as e:
        return False, str(e)

def main():
    print("=" * 60)
    print("TicketPilot Demo Ticket Seeder")
    print("=" * 60)
    print(f"Backend URL: {BASE_URL}")
    print(f"Tickets to create: {len(DEMO_TICKETS)}")
    print("=" * 60)
    print()
    
    created = 0
    failed = 0
    
    for i, ticket in enumerate(DEMO_TICKETS, 1):
        print(f"[{i}/{len(DEMO_TICKETS)}] Creating: {ticket['title'][:50]}...")
        
        success, result = create_ticket(ticket)
        
        if success:
            print(f"    ✅ Created ticket ID: {result.get('id', 'N/A')}")
            created += 1
        else:
            print(f"    ❌ Failed: {result}")
            failed += 1
        
        print()
    
    print("=" * 60)
    print("Summary:")
    print(f"  ✅ Successfully created: {created}")
    print(f"  ❌ Failed: {failed}")
    print(f"  📊 Total: {len(DEMO_TICKETS)}")
    print("=" * 60)
    
    if created > 0:
        print()
        print("🎉 Demo tickets have been created successfully!")
        print("   Visit your TicketPilot dashboard to see them.")
    
    if failed > 0:
        print()
        print("⚠️  Some tickets failed to create. Check the errors above.")
        print("   Common issues:")
        print("   - Invalid or expired AUTH_TOKEN")
        print("   - Backend API is down")
        print("   - Network connectivity issues")
        print("   - Organization context missing")

if __name__ == "__main__":
    main()
