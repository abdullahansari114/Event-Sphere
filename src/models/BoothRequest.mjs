import { Schema, model } from 'mongoose'

const boothRequestSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    booths: [{ type: Schema.Types.ObjectId, ref: 'Booth', required: true }],
    exhibitor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true },
)

export default model('BoothRequest', boothRequestSchema)