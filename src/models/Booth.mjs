import { Schema, model } from 'mongoose'

const boothSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    row: { type: Number, required: true },
    col: { type: Number, required: true },
    boothNumber: { type: String, required: true }, // e.g. "R1-C1"
    status: { type: String, enum: ['available', 'reserved', 'occupied'], default: 'available' },
    exhibitor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
)

boothSchema.index({ event: 1, row: 1, col: 1 }, { unique: true })

export default model('Booth', boothSchema)