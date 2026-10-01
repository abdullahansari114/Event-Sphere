// src/controller/chatController.mjs

import asyncHandler from '../utils/asyncHandler.mjs'
import Event from '../models/Event.mjs'

const MODEL = 'gemini-3.6-flash'

const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const MAX_HISTORY_MESSAGES = 12

// Server-side quota lock — tracked in memory so it survives page refreshes
// and so we don't waste any remaining quota by calling Gemini while we
// already know we're rate-limited. Resets when the server restarts.
let quotaLockedUntil = null // Date | null

const getLockStatus = () => {
  if (quotaLockedUntil && Date.now() < quotaLockedUntil.getTime()) {
    return { limited: true, retryAt: quotaLockedUntil }
  }
  // Lock has expired (or never existed) — clear it
  if (quotaLockedUntil) quotaLockedUntil = null
  return { limited: false, retryAt: null }
}

const buildLimitedReply = (retryAt) => {
  const timeStr = retryAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `The AI assistant has reached its usage limit. Chat will be available again around ${timeStr}.`
}

// Published, upcoming events ko Gemini ke liye context mein convert karta hai.
const buildEventsContext = async () => {
  const today = new Date().toISOString().slice(0, 10)

  const events = await Event.find({
    status: 'published',
    date: { $gte: today },
  })
    .sort({ date: 1 })
    .limit(15)
    .select('title date startTime location venue category description')

  if (events.length === 0) {
    return 'Right now there are no upcoming published events in the database.'
  }

  return events
    .map(
      (e, i) =>
        `${i + 1}. "${e.title}" — ${e.date}${
          e.startTime ? ` at ${e.startTime}` : ''
        }, ${e.venue || e.location || 'location TBA'} (category: ${
          e.category || 'general'
        })`
    )
    .join('\n')
}

const SYSTEM_PROMPT_BASE = `
You are the friendly AI assistant embedded on the EventSphere website.

EventSphere is a platform for discovering and exhibiting at expos,
summits, conferences, and networking events.

Your job is to help visitors understand EventSphere, registration,
exhibiting, upcoming events, sessions, and other event-related questions.

Answer questions about EventSphere itself, including:
- What EventSphere is
- How attendee registration works
- How exhibitors can register
- How exhibitors can apply for an event
- How booths work
- How visitors can discover events
- Event schedules and available events

You also have access to the upcoming published events listed below.

IMPORTANT RESPONSE RULES:
- Match your reply length to the question's complexity — this is the most important rule.
- Greetings, yes/no questions, or simple factual questions (e.g. "what's your name", "is registration free") → answer in 1-2 short sentences. Do not pad with extra context nobody asked for.
- Questions asking "how does X work" or multi-part questions → answer in 3-6 sentences, covering every part asked, but stop once it's fully answered.
- Never write more than the question requires. If a one-line answer fully answers it, give a one-line answer.
- Do not repeat the same information in different words.
- Do not add unsolicited extra tips, disclaimers, or "let me know if..." closers unless it's genuinely useful.
- Do not cut off sentences. Do not leave answers incomplete.
- Use simple, natural, conversational language.
- If the user asks a multi-part question, answer every part — but each part gets only as much detail as it needs.
- If the user asks about an event that is not in the provided list, clearly say that you cannot see that event in the current event list.
- Never invent event names, dates, venues, prices, speakers, or other event details.
- If the question is unrelated to EventSphere or events, answer briefly and then guide the user back toward EventSphere.

Upcoming published events:
`

// GET /api/v1/chat/status
// Frontend calls this on load / on opening the widget to sync the lock
// state without spending any Gemini quota.
export const getChatStatus = asyncHandler(async (req, res) => {
  const { limited, retryAt } = getLockStatus()

  res.json({
    limited,
    retryAt: retryAt ? retryAt.toISOString() : null,
  })
})

// POST /api/v1/chat
// Public route — login required nahi.
export const sendChatMessage = asyncHandler(async (req, res) => {
  const { message, history } = req.body

  if (!message || !message.trim()) {
    res.status(400)
    throw new Error('Message is required')
  }

  // Already known to be rate-limited — don't waste a call on Gemini,
  // just hand back the same lock info.
  const currentLock = getLockStatus()
  if (currentLock.limited) {
    return res.json({
      reply: buildLimitedReply(currentLock.retryAt),
      limited: true,
      retryAt: currentLock.retryAt.toISOString(),
    })
  }

  // Gemini API key check
  if (!process.env.GEMINI_API_KEY) {
    return res.json({
      reply:
        "The AI assistant isn't fully set up yet. The site owner needs to add a GEMINI_API_KEY to the backend .env file.",
    })
  }

  // Get live event data from MongoDB
  const eventsContext = await buildEventsContext()

  // Keep only recent conversation history
  const trimmedHistory = Array.isArray(history)
    ? history.slice(-MAX_HISTORY_MESSAGES)
    : []

  const contents = [
    ...trimmedHistory
      .filter(
        (m) =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.trim()
      )
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [
          {
            text: m.content,
          },
        ],
      })),

    // Current user message
    {
      role: 'user',
      parts: [
        {
          text: message.trim(),
        },
      ],
    },
  ]

  try {
    const response = await fetch(
      `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          contents,

          systemInstruction: {
            parts: [
              {
                text: SYSTEM_PROMPT_BASE + '\n\n' + eventsContext,
              },
            ],
          },

          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
          },
        }),
      }
    )

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')

      console.error(
        'Gemini API error:',
        response.status,
        errBody
      )

      // Rate limit / quota exceeded — lock the chat server-side and tell
      // the frontend exactly when to unlock it.
      if (response.status === 429) {
        let seconds = 300 // fallback guess: 5 minutes, used when Google doesn't tell us

        try {
          const errJson = JSON.parse(errBody)
          const details = errJson?.error?.details || []

          const retryInfo = details.find((d) =>
            d['@type']?.includes('RetryInfo')
          )

          // retryDelay looks like "34s"
          const parsed = retryInfo?.retryDelay
            ? parseInt(retryInfo.retryDelay.replace('s', ''), 10)
            : null

          if (parsed && !isNaN(parsed)) {
            seconds = parsed
          }
        } catch (parseErr) {
          // Couldn't parse the error body — stick with the fallback above
        }

        const retryAt = new Date(Date.now() + seconds * 1000)
        quotaLockedUntil = retryAt

        return res.json({
          reply: buildLimitedReply(retryAt),
          limited: true,
          retryAt: retryAt.toISOString(),
        })
      }

      res.status(502)

      throw new Error(
        'The AI assistant is temporarily unavailable. Please try again shortly.'
      )
    }

    const data = await response.json()

    // Debug information
    console.log(
      'Gemini finish reason:',
      data.candidates?.[0]?.finishReason
    )

    const parts = data.candidates?.[0]?.content?.parts || []

    const reply = parts
      .map((part) => part.text || '')
      .join('')
      .trim()

    if (!reply) {
      return res.json({
        reply:
          "Sorry, I couldn't generate a complete reply. Please try asking your question again.",
      })
    }

    res.json({
      reply,
    })
  } catch (error) {
    console.error('Gemini request failed:', error)

    if (error.message?.includes('temporarily unavailable')) {
      throw error
    }

    res.status(502)

    throw new Error(
      'The AI assistant is temporarily unavailable. Please try again shortly.'
    )
  }
})
