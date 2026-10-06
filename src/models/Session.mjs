import { Schema, model } from 'mongoose'

const sessionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    speaker: { type: String, required: true, trim: true }, // guest speaker ka naam
    speakerTitle: { type: String, default: '' }, // e.g. "CEO, Acme Inc." — optional
    hall: { type: String, required: true, trim: true }, // e.g. "Hall A - Stage 1"
    location: { type: String, default: '' }, // venue/city — khud likhna hoga
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    startTime: { type: String, required: true },
    endTime: { type: String, default: '' },
    totalSeats: { type: Number, required: true, min: 1 },
    description: { type: String, default: '' },
  },
  { timestamps: true },
)

export default model('Session', sessionSchema)
