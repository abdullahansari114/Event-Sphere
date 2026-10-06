import { Schema, model } from 'mongoose'

const eventRequestSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    exhibitor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true },
)

// Ek exhibitor ek event ke liye sirf ek hi active (pending/approved) request bhej sake
eventRequestSchema.index({ event: 1, exhibitor: 1 }, { unique: false })

export default model('EventRequest', eventRequestSchema)
