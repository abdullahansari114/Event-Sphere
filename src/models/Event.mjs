import { Schema, model } from 'mongoose'

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    date: { type: String, required: true }, // 'YYYY-MM-DD' (frontend isi format se kaam karta hai)
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    location: { type: String, default: '' },
    venue: { type: String, default: '' },
    theme: { type: String, default: '' },
    category: { type: String, default: '' },
    banner: { type: String, default: '' },
    maxAttendees: { type: Number, default: 0 },
    registeredAttendees: { type: Number, default: 0 },
    exhibitorCount: { type: Number, default: 0 },
    boothCount: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    featured: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    organizer: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true } },
)

export default model('Event', eventSchema)
