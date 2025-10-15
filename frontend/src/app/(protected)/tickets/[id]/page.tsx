'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sparkles, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiGet, apiPost } from '@/lib/api'

interface MessageOut {
  id: string
  ticket_id: string
  sender_id: string
  sender_role: string
  body: string
  created_at: string
  meta?: any // For AI messages with citations and confidence
}

interface TicketDetail {
  id: string
  created_by: string
  assignee_id?: string
  title: string
  description: string
  status: string
  message_count: number
  last_message_at: string
  created_at: string
}

interface TicketWithMessages {
  ticket: TicketDetail
  messages: MessageOut[]
}

// Phase 4: AI Chat interfaces
interface Citation {
  label: string
  doc_id: string
  chunk_id: string
  faiss_id: number
  score?: number
}

interface ChatResponse {
  message_id: string
  content: string
  citations: Citation[]
  confidence: number
  suggest_escalation: boolean
}

// Helper function to detect system messages
const isSystemMessage = (message: MessageOut) => {
  return message.sender_role === 'system' || message.body.startsWith('[system]');
};

// System Message Component
const SystemMessage = ({ message }: { message: MessageOut }) => (
  <div className="my-2 text-center">
    <div className="inline-block px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs">
      {message.body.replace('[system]', '').trim()}
    </div>
  </div>
);

export default function TicketDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [ticketData, setTicketData] = useState<TicketWithMessages | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Message composer
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  
  // AI Chat state
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showCitations, setShowCitations] = useState<{[messageId: string]: boolean}>({})
  
  // System messages toggle and citation tooltip
  const [showSystemMessages, setShowSystemMessages] = useState(false)
  const [showCitationTip, setShowCitationTip] = useState(true)

  const loadTicket = async () => {
    try {
      setLoading(true)
      setError('')
      const data: TicketWithMessages = await apiGet(`/api/tickets/${params.id}`)
      setTicketData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTicket()
  }, [params.id])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim()) {
      return
    }
    
    try {
      setSending(true)
      await apiPost(`/api/tickets/${params.id}/messages`, {
        body: newMessage.trim()
      })
      
      setNewMessage('')
      // Refresh the ticket to show the new message
      await loadTicket()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  // Phase 4: AI Chat handler
  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!aiQuery.trim()) {
      return
    }
    
    try {
      setAiLoading(true)
      const response: ChatResponse = await apiPost(`/api/tickets/${params.id}/chat`, {
        query: aiQuery.trim()
      })
      
      setAiQuery('')
      // Refresh the ticket to show the AI response
      await loadTicket()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI response')
    } finally {
      setAiLoading(false)
    }
  }

  const toggleCitations = (messageId: string) => {
    setShowCitations(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-3 py-1 rounded-full text-sm font-medium"
    if (status === 'open') {
      return `${baseClasses} bg-green-100 text-green-800`
    }
    return `${baseClasses} bg-gray-100 text-gray-800`
  }

  const getRoleBadge = (role: string) => {
    const baseClasses = "px-2 py-1 rounded text-xs font-medium"
    if (role === 'rep' || role === 'admin') {
      return `${baseClasses} bg-blue-100 text-blue-800`
    }
    if (role === 'ai') {
      return `${baseClasses} bg-purple-100 text-purple-800`
    }
    return `${baseClasses} bg-gray-100 text-gray-800`
  }

  const getSenderName = (role: string) => {
    if (role === 'rep' || role === 'admin') return 'Support Rep'
    if (role === 'ai') return 'AI Assistant'
    return 'You'
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <div className="text-gray-500">Loading ticket...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
        <button
          onClick={() => router.push('/tickets')}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to tickets
        </button>
      </div>
    )
  }

  if (!ticketData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <div className="text-gray-500">Ticket not found</div>
        </div>
      </div>
    )
  }

  const { ticket, messages } = ticketData

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/tickets')}
          className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to tickets
        </button>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{ticket.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Ticket #{ticket.id.slice(0, 8)}</span>
                <span>Created {formatDate(ticket.created_at)}</span>
                <span>{ticket.message_count} message{ticket.message_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <span className={getStatusBadge(ticket.status)}>
              {ticket.status}
            </span>
          </div>
          
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-2">Description</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Messages</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowSystemMessages(!showSystemMessages)}
            className="flex items-center gap-2"
          >
            {showSystemMessages ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showSystemMessages ? 'Hide' : 'Show'} System Logs
          </Button>
        </div>
        
        <div className="divide-y divide-gray-200">
          {messages
            .filter(msg => showSystemMessages || !isSystemMessage(msg))
            .map((message) => (
              isSystemMessage(message) ? (
                <SystemMessage key={message.id} message={message} />
              ) : (
            <div key={message.id} className="p-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.sender_role === 'ai' ? 'bg-purple-100' : 'bg-gray-300'
                  }`}>
                    <span className={`text-sm font-medium ${
                      message.sender_role === 'ai' ? 'text-purple-600' : 'text-gray-600'
                    }`}>
                      {message.sender_role === 'ai' ? 'AI' : 
                       message.sender_role === 'rep' || message.sender_role === 'admin' ? 'R' : 'U'}
                    </span>
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {getSenderName(message.sender_role)}
                    </span>
                    <span className={getRoleBadge(message.sender_role)}>
                      {message.sender_role}
                    </span>
                    
                    {/* AI Confidence Badge */}
                    {message.sender_role === 'ai' && message.meta && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        message.meta.confidence >= 0.7 ? 'bg-green-100 text-green-800' :
                        message.meta.confidence >= 0.4 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Confidence: {(message.meta.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    
                    <span className="text-sm text-gray-500">
                      {formatDate(message.created_at)}
                    </span>
                  </div>
                  
                  {/* Low confidence warning for AI messages */}
                  {message.sender_role === 'ai' && message.meta?.suggest_escalation && (
                    <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-800">
                            Low confidence answer. Consider escalating this ticket for human review.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-gray-700 whitespace-pre-wrap">
                    {message.body}
                  </div>
                  
                  {/* AI Citations */}
                  {message.sender_role === 'ai' && message.meta?.citations?.length > 0 && (
                    <div className="mt-3">
                      {/* Citation Education Tooltip */}
                      {showCitationTip && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-start gap-2"
                        >
                          <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 text-sm text-blue-900">
                            <strong>💡 Tip:</strong> Blue numbers like [1], [2] are links to our help docs. Click to see the sources!
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCitationTip(false)}
                            className="text-blue-600 h-auto p-1"
                          >
                            Got it
                          </Button>
                        </motion.div>
                      )}
                      
                      <button
                        onClick={() => toggleCitations(message.id)}
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                      >
                        {showCitations[message.id] ? '▼' : '▶'} 
                        {showCitations[message.id] ? 'Hide' : 'Show'} Sources ({message.meta.citations.length})
                      </button>
                      
                      {showCitations[message.id] && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-md">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Sources:</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {message.meta.citations.map((citation: Citation, idx: number) => (
                              <li key={idx} className="flex justify-between">
                                <span>{citation.label}</span>
                                {citation.score && (
                                  <span className="text-xs text-gray-500">
                                    Score: {(citation.score * 100).toFixed(0)}%
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
              )
          ))}
        </div>
      </div>

      {/* AI Chat Interface */}
      {ticket.status === 'open' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M13 7H7v6h6V7z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M13 15H7a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2zM7 6a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V7a1 1 0 00-1-1H7z" clipRule="evenodd" />
            </svg>
            Ask AI Assistant
          </h3>
          
          <form onSubmit={handleAskAI}>
            <div className="mb-4">
              <textarea
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="Ask the AI assistant about your issue..."
                rows={3}
                className="w-full border border-purple-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                maxLength={1000}
                disabled={aiLoading}
              />
              <div className="text-xs text-gray-500 mt-1">
                {aiQuery.length}/1000 characters
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={aiLoading || !aiQuery.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Ask AI'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Message Composer */}
      {ticket.status === 'open' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Add a message</h3>
          
          <form onSubmit={handleSendMessage}>
            <div className="mb-4">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={4}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={8000}
                required
              />
              <div className="text-xs text-gray-500 mt-1">
                {newMessage.length}/8000 characters
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      )}

      {ticket.status === 'closed' && (
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-gray-600">This ticket is closed. No new messages can be added.</p>
        </div>
      )}
    </div>
  )
}