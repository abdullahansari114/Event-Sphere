import { Schema, model } from 'mongoose'

const registrationSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    attendee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { timestamps: true },
)

// Ek attendee ek event ke liye sirf ek hi baar register ho sake
registrationSchema.index({ event: 1, attendee: 1 }, { unique: true })

export default model('Registration', registrationSchema)