#!/bin/bash
# Quick Start Script for Creating Demo Tickets

set -e

echo "============================================================"
echo "TicketPilot Demo Ticket Creator"
echo "============================================================"
echo ""

# Check if requests library is installed
if ! python3 -c "import requests" 2>/dev/null; then
    echo "⚠️  Installing required Python packages..."
    pip3 install requests
    echo ""
fi

# Check for auth token
if [ -z "$AUTH_TOKEN" ]; then
    echo "⚠️  AUTH_TOKEN not set!"
    echo ""
    echo "To get your auth token:"
    echo "1. Go to https://ticketpilot.vercel.app and log in"
    echo "2. Open Browser DevTools (F12)"
    echo "3. Go to Application → Local Storage"
    echo "4. Copy your JWT token"
    echo ""
    read -p "Paste your AUTH_TOKEN here: " AUTH_TOKEN
    export AUTH_TOKEN
fi

# Set default backend URL if not provided
if [ -z "$BACKEND_URL" ]; then
    export BACKEND_URL="https://ticketpilot-backend.onrender.com"
fi

echo ""
echo "Configuration:"
echo "  Backend: $BACKEND_URL"
echo "  Token: ${AUTH_TOKEN:0:20}..."
echo ""

read -p "Proceed with creating demo tickets? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Creating demo tickets..."
    echo ""
    python3 seed_demo_tickets.py
    
    echo ""
    echo "✅ Done! Check your TicketPilot dashboard."
    echo "   URL: https://ticketpilot.vercel.app"
else
    echo "Cancelled."
    exit 1
fi
