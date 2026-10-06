import { Schema, model } from 'mongoose'

const exhibitorSchema = new Schema(
  {
    companyName: { type: String, required: true, trim: true },
    category: { type: String, default: '' },
    description: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },

    // Contact info shown on the exhibitor's public profile
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    website: { type: String, default: '' },
    address: { type: String, default: '' },

    boothNumber: { type: String, default: '' },
    products: { type: [String], default: [] },

    // Event this exhibitor is showcasing at (drives the "Event" card on the profile)
    event: { type: Schema.Types.ObjectId, ref: 'Event', default: null },

    // Exhibitor's own account, if they registered/logged in as role "exhibitor"
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } },
)

export default model('Exhibitor', exhibitorSchema)
