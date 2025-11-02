# TicketPilot AI Integration

This module provides AI-powered assistance for customer support representatives in TicketPilot.

## Overview

The AI feature helps support reps by:
- Analyzing ticket context and recent messages
- Providing suggested responses to customers
- Recommending escalation when appropriate
- Maintaining confidence scores and source citations
- Recording audit trails for AI interactions

## Components

### `/lib/ai/prompt.ts`
Central prompt management and context preparation.

**Functions:**
- `buildAISuggestionQuery(context)` - Creates contextual prompts for AI
- `prepareTicketContext(ticket, messages)` - Formats ticket data for AI processing
- `redactPII(text)` - Removes emails/phones from content

### `/components/rep/AIResponseModal.tsx`
Modal component for displaying AI suggestions with actions.

**Features:**
- Displays AI confidence scores and model info
- Shows knowledge base sources and citations
- Provides action buttons (copy, insert, escalate)
- Handles user feedback collection

### Enhanced Rep Console (`/app/(protected)/rep/page.tsx`)
Integrated AI functionality in the ticket queue.

**Features:**
- AI Assist button with cooldown indicators
- Rate limiting protection (8-second cooldowns)
- Enhanced error handling for 401/404/429/5xx responses
- Automatic retry for network errors
- Audit trail integration

## Usage

### Basic AI Suggestion Flow

1. Rep clicks "AI Assist" button on any ticket
2. System fetches full ticket details and recent messages
3. Context is prepared and PII is redacted
4. Query is sent to backend with `{ query: "..." }` format
5. AI response is displayed in modal with confidence score
6. Rep can copy, insert, or escalate based on suggestion

### Rate Limiting

- 8-second cooldown between requests per ticket
- Button shows countdown timer during cooldown
- 429 responses trigger automatic cooldown
- Clear error messages for rate limit hits

### Error Handling

- **401 Unauthorized**: Redirects to login
- **404 Not Found**: Shows "ticket not found" message
- **429 Rate Limited**: Sets cooldown timer automatically
- **5xx Server Error**: Shows specific error with retry option
- **Network Error**: Suggests connection check with retry

### Audit Trail

When reps take AI-suggested actions:
- Insert/Copy: `[system] AI suggestion applied (confidence X%, model Y)`
- Escalate: `[system] AI suggested escalation (confidence X%)`

## Configuration

### Environment Variables

Ensure these are set in your backend:
- `GOOGLE_API_KEY` - Google Gemini API key
- `GENAI_MODEL` - Model name (default: gemini-1.5-pro)

### Backend Dependencies

Required backend endpoints:
- `GET /api/tickets/{id}` - Ticket details
- `GET /api/tickets/{id}/messages` - Recent messages
- `POST /api/tickets/{id}/chat` - AI chat endpoint
- `POST /api/tickets/{id}/messages` - Add audit messages

## Best Practices

### Context Management
- Keep total context under 6-8k characters
- Include last 5 messages maximum
- Redact PII automatically
- Include ticket metadata (title, priority, status)

### Error Handling
- Always provide user-friendly error messages
- Implement proper retry logic for network issues
- Respect rate limits and show countdowns
- Log errors for debugging but don't expose internals

### User Experience
- Show confidence scores to help reps assess suggestions
- Provide clear actions (copy vs insert vs escalate)
- Display knowledge base sources for transparency
- Collect feedback for improvement

## Testing

### Unit Tests
```bash
# Test prompt generation
npm test -- --testPathPattern="ai/prompt"

# Test modal component
npm test -- --testPathPattern="AIResponseModal"

# Test rate limiting
npm test -- --testPathPattern="rep.*ai"
```

### Integration Tests
```bash
# Test full AI flow
npm run test:integration -- ai-flow

# Test error scenarios
npm run test:integration -- ai-errors
```

## Limitations

### Current Constraints
- 8-second cooldown between AI requests per ticket
- Maximum 5 recent messages included in context
- PII redaction is basic (emails/phones only)
- No conversation memory between requests
- Feedback is logged locally only

### Future Enhancements
- Conversation context retention
- Enhanced PII detection
- Feedback analytics dashboard
- Custom prompt templates per team
- Real-time streaming responses

## Troubleshooting

### Common Issues

**"AI button disabled"**
- Check for active cooldown timer
- Verify network connectivity
- Check authentication status

**"Rate limited" errors**
- Wait for cooldown to expire (max 8 seconds)
- Check backend rate limiting configuration
- Verify API key quotas

**"No AI response"**
- Check backend logs for errors
- Verify Google API key is valid
- Confirm FAISS index is loaded

**Poor suggestion quality**
- Check if knowledge base is populated
- Verify recent messages are being included
- Review prompt template effectiveness

### Debug Mode

Enable debug logging:
```javascript
localStorage.setItem('ai-debug', 'true')
```

This will log:
- Full prompt content
- API request/response details
- Context preparation steps
- Error stack traces

## Security

### Data Protection
- PII is redacted before sending to AI
- Audit trails are encrypted at rest
- API calls use proper authentication
- No AI data is cached client-side

### Privacy Considerations
- Customer messages are processed by Google Gemini
- Citations reference knowledge base only
- Feedback is anonymized
- Audit trails include confidence scores only

---

For technical support or feature requests, contact the TicketPilot development team.