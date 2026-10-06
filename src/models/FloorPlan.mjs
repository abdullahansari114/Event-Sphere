import { Schema, model } from 'mongoose'

const floorPlanSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, unique: true },
    rows: { type: Number, default: 5 },
    cols: { type: Number, default: 10 },
  },
  { timestamps: true },
)

export default model('FloorPlan', floorPlanSchema)