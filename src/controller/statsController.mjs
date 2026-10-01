import Event from '../models/Event.mjs'
import Registration from '../models/Registration.mjs'
import EventRequest from '../models/EventRequest.mjs'
import BoothRequest from '../models/BoothRequest.mjs'
import Booth from '../models/Booth.mjs'
import Session from '../models/Session.mjs'
import SessionRegistration from '../models/SessionRegistration.mjs'
import User from '../models/User.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'
import { buildPublicStats, buildAdminStats } from '../utils/statsBuilder.mjs'

const getBoothCounts = async () => {
  const rows = await Booth.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
  const counts = { available: 0, reserved: 0, occupied: 0 }
  rows.forEach((r) => {
    if (counts[r._id] !== undefined) counts[r._id] = r.count
  })
  return counts
}

// GET /api/v1/stats/public  (public — home page ka "Live Analytics" section)
// Sirf aggregated numbers — kisi user ka naam/email/phone yahan nahi jaata.
export const getPublicStats = asyncHandler(async (req, res) => {
  const [events, registrations, approvedRequests, booths, allSessions] = await Promise.all([
    Event.find({ status: 'published' }).select('title date category maxAttendees registeredAttendees').lean(),
    Registration.find().select('createdAt').lean(),
    EventRequest.find({ status: 'approved' }).select('exhibitor').lean(),
    getBoothCounts(),
    Session.find().select('event category totalSeats').lean(),
  ])

  // Sirf published events ke sessions (public Schedule page jaisa hi rule)
  const publishedIds = new Set(events.map((e) => String(e._id)))
  const sessions = allSessions.filter((s) => publishedIds.has(String(s.event)))

  res.json(
    buildPublicStats({
      events,
      registrations,
      approvedExhibitorIds: approvedRequests.map((r) => r.exhibitor).filter(Boolean),
      booths,
      sessions,
    }),
  )
})

// GET /api/v1/stats/admin  (admin only) — public stats + requests, users, session seats, drafts
export const getAdminStats = asyncHandler(async (req, res) => {
  const [events, registrations, eventRequests, boothRequests, sessionRegistrations, booths, sessions, users] =
    await Promise.all([
      Event.find().select('title date category status maxAttendees registeredAttendees').lean(),
      Registration.find().select('createdAt').lean(),
      EventRequest.find().select('exhibitor status').lean(),
      BoothRequest.find().select('status').lean(),
      SessionRegistration.find().select('status').lean(),
      getBoothCounts(),
      Session.find().select('category totalSeats').lean(),
      User.find().select('role createdAt').lean(),
    ])

  res.json(
    buildAdminStats({
      events,
      registrations,
      approvedExhibitorIds: eventRequests.filter((r) => r.status === 'approved').map((r) => r.exhibitor).filter(Boolean),
      booths,
      sessions,
      eventRequests,
      boothRequests,
      sessionRegistrations,
      users,
    }),
  )
})
