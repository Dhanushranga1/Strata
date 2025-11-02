/**
 * AI prompt utilities for TicketPilot
 * Centralizes AI query generation and context handling
 */

export interface TicketContext {
  title: string;
  priority: string;
  status: string;
  customer?: string;
  customerEmail?: string;
  recentMessages: Array<{
    role: 'customer' | 'rep' | 'system';
    text: string;
    timestamp?: Date;
  }>;
}

/**
 * Simple PII redaction helper
 * Masks emails and phone numbers in text content
 */
export function redactPII(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email-redacted]')
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone-redacted]')
    .replace(/\b\d{10,}\b/g, '[number-redacted]');
}

/**
 * Builds the AI suggestion query with proper context
 * Keeps total length under safe limits (~6-8k chars)
 */
export function buildAISuggestionQuery(context: TicketContext): string {
  const { title, priority, status, customer, customerEmail, recentMessages } = context;
  
  // Prepare customer info (redacted)
  const customerInfo = customer || customerEmail;
  const redactedCustomer = customerInfo ? redactPII(customerInfo) : 'Unknown';
  
  // Format recent messages with character limit
  const maxMessageLength = 200;
  const messageHistory = recentMessages
    .slice(-5) // Last 5 messages max
    .map(msg => {
      const truncatedText = msg.text.length > maxMessageLength 
        ? `${msg.text.substring(0, maxMessageLength)}...`
        : msg.text;
      const redactedText = redactPII(truncatedText);
      return `- ${msg.role.toUpperCase()}: ${redactedText}`;
    })
    .join('\n');

  // Build the comprehensive prompt
  const prompt = [
    'You are TicketPilot\'s support copilot. Draft a concise, empathetic reply for this customer support ticket.',
    '',
    'Guidelines:',
    '• Tone: professional, clear, and calming',
    '• Length: 4-6 sentences maximum',
    '• If policy blocks direct resolution, propose the next best step',
    '• Format: plain text (bullet points allowed, no placeholders)',
    '• If escalation is needed, end with: [ESCALATE RECOMMENDED]',
    '',
    '--- TICKET CONTEXT ---',
    `Title: "${title}"`,
    `Priority: ${priority} | Status: ${status}`,
    `Customer: ${redactedCustomer}`,
    '',
    'Recent conversation:',
    messageHistory || '(no recent messages)',
    '',
    '--- RESPONSE INSTRUCTIONS ---',
    'Provide only the suggested reply text. Be specific and actionable.',
    'If you recommend escalation, explain why briefly before [ESCALATE RECOMMENDED].',
  ].join('\n');

  return prompt;
}

/**
 * Validates and prepares ticket context for AI processing
 */
export function prepareTicketContext(
  ticket: Record<string, unknown>,
  messages: Array<Record<string, unknown>> = []
): TicketContext {
  return {
    title: String(ticket.title || 'Untitled Ticket'),
    priority: String(ticket.priority || 'medium'),
    status: String(ticket.status || 'open'),
    customer: typeof ticket.customer_name === 'string' ? ticket.customer_name : undefined,
    customerEmail: typeof ticket.customer_email === 'string' ? ticket.customer_email : undefined,
    recentMessages: messages.map(msg => ({
      role: (msg.sender_role === 'customer' ? 'customer' 
           : msg.sender_role === 'rep' ? 'rep' 
           : 'system') as 'customer' | 'rep' | 'system',
      text: String(msg.body || msg.content || ''),
      timestamp: msg.timestamp ? new Date(String(msg.timestamp)) : undefined,
    })).filter(msg => msg.text.trim().length > 0),
  };
}