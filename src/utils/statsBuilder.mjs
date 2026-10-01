// Analytics ka saara hisaab yahan hota hai — pure functions, koi DB call nahi.
// Controller DB se data laata hai, yahan sirf numbers banaye jaate hain (isliye test karna aasaan hai).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n) => String(n).padStart(2, '0')
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const toDate = (v) => {
  const d = new Date(v)
  return isNaN(d) ? null : d
}

// Ek saal ke 12 mahino ka count
const monthlySeries = (dates, year, valueKey) => {
  const counts = Array(12).fill(0)
  dates.forEach((v) => {
    const d = toDate(v)
    if (d && d.getFullYear() === year) counts[d.getMonth()] += 1
  })
  return MONTHS.map((m, i) => ({ month: m, [valueKey]: counts[i] }))
}

// Aakhri `days` din ka daily count (aaj tak)
const dailySeries = (dates, days, now, valueKey) => {
  const buckets = new Map()
  const list = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const key = dateKey(d)
    buckets.set(key, 0)
    list.push({ key, label: `${d.getDate()} ${MONTHS[d.getMonth()]}` })
  }
  dates.forEach((v) => {
    const d = toDate(v)
    if (!d) return
    const key = dateKey(d)
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1)
  })
  return list.map(({ key, label }) => ({ date: key, label, [valueKey]: buckets.get(key) }))
}

const countInMonth = (dates, monthsAgo, now) => {
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
  return dates.filter((v) => {
    const d = toDate(v)
    return d && d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth()
  }).length
}

// { current, previous, pct } — pct null ho to matlab "compare nahi ho sakta"
const monthGrowth = (dates, now) => {
  const current = countInMonth(dates, 0, now)
  const previous = countInMonth(dates, 1, now)
  let pct = null
  if (previous > 0) pct = Math.round(((current - previous) / previous) * 100)
  else if (current > 0) pct = 100
  return { current, previous, pct }
}

const statusCounts = (items) => {
  const out = { pending: 0, approved: 0, rejected: 0 }
  items.forEach((i) => {
    if (out[i.status] !== undefined) out[i.status] += 1
  })
  return { ...out, total: items.length }
}

const groupByName = (items, pick) => {
  const map = new Map()
  items.forEach((i) => {
    const name = (pick(i) || '').trim()
    if (name) map.set(name, (map.get(name) || 0) + 1)
  })
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

const fillRateOf = (events) => {
  const capped = events.filter((e) => e.maxAttendees > 0)
  const max = capped.reduce((s, e) => s + e.maxAttendees, 0)
  const reg = capped.reduce((s, e) => s + (e.registeredAttendees || 0), 0)
  return max > 0 ? Math.min(100, Math.round((reg / max) * 100)) : 0
}

const topEventsOf = (events, limit = 6) =>
  [...events]
    .sort((a, b) => (b.registeredAttendees || 0) - (a.registeredAttendees || 0))
    .slice(0, limit)
    .map((e) => ({
      id: String(e._id),
      title: e.title,
      category: e.category || '',
      date: e.date,
      registered: e.registeredAttendees || 0,
      capacity: e.maxAttendees || 0,
      fillRate: e.maxAttendees > 0 ? Math.min(100, Math.round(((e.registeredAttendees || 0) / e.maxAttendees) * 100)) : null,
    }))

/**
 * @param {object} input
 * @param {Array}  input.events            - public ke liye sirf published, admin ke liye sab
 * @param {Array}  input.registrations     - [{ createdAt }]
 * @param {Array}  input.approvedExhibitorIds
 * @param {object} input.booths            - { available, reserved, occupied }
 * @param {Array}  input.sessions          - [{ category, totalSeats }]
 * @param {Date}   input.now
 */
export const buildPublicStats = ({ events, registrations, approvedExhibitorIds, booths, sessions, now = new Date() }) => {
  const regDates = registrations.map((r) => r.createdAt)
  const today = dateKey(now)
  const boothTotal = booths.available + booths.reserved + booths.occupied

  return {
    generatedAt: now.toISOString(),
    year: now.getFullYear(),
    totals: {
      events: events.length,
      upcomingEvents: events.filter((e) => e.date >= today).length,
      attendees: registrations.length,
      exhibitors: new Set(approvedExhibitorIds.map(String)).size,
      sessions: sessions.length,
      booths: boothTotal,
      fillRate: fillRateOf(events),
    },
    growth: { attendees: monthGrowth(regDates, now) },
    registrationsByMonth: monthlySeries(regDates, now.getFullYear(), 'registrations'),
    registrationsDaily: dailySeries(regDates, 30, now, 'registrations'),
    topEvents: topEventsOf(events),
    eventsByCategory: groupByName(events, (e) => e.category),
    sessionsByCategory: groupByName(sessions, (s) => s.category),
    boothStatus: { ...booths, total: boothTotal },
  }
}

// Admin ke liye extra: requests funnel, users, session seats, drafts
export const buildAdminStats = ({
  events, registrations, approvedExhibitorIds, booths, sessions, now = new Date(),
  eventRequests, boothRequests, sessionRegistrations, users,
}) => {
  const base = buildPublicStats({ events, registrations, approvedExhibitorIds, booths, sessions, now })

  const evReq = statusCounts(eventRequests)
  const boothReq = statusCounts(boothRequests)
  const sessionReq = statusCounts(sessionRegistrations)

  const totalSeats = sessions.reduce((s, x) => s + (x.totalSeats || 0), 0)
  const bookedSeats = sessionReq.approved
  const roleLabels = { attendee: 'Attendees', exhibitor: 'Exhibitors', admin: 'Admins' }
  const usersByRole = ['attendee', 'exhibitor', 'admin']
    .map((role) => ({ name: roleLabels[role], value: users.filter((u) => u.role === role).length }))
    .filter((r) => r.value > 0)

  return {
    ...base,
    events: {
      total: events.length,
      published: events.filter((e) => e.status === 'published').length,
      draft: events.filter((e) => e.status === 'draft').length,
    },
    requests: { events: evReq, booths: boothReq, sessions: sessionReq },
    pendingTotal: evReq.pending + boothReq.pending + sessionReq.pending,
    sessionSeats: {
      total: totalSeats,
      booked: bookedSeats,
      utilization: totalSeats > 0 ? Math.min(100, Math.round((bookedSeats / totalSeats) * 100)) : 0,
    },
    usersByRole,
    usersTotal: users.length,
    usersByMonth: monthlySeries(users.map((u) => u.createdAt), now.getFullYear(), 'users'),
    usersGrowth: monthGrowth(users.map((u) => u.createdAt), now),
  }
}
