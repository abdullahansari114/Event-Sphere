import { Schema, model } from 'mongoose'

// Exhibitor ka product ya service — hamesha kisi ek event se juda hota hai,
// taake attendee jab wo event dekhe to sirf usi event ke exhibitors ke products dikhein.
const productSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    exhibitor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: ['product', 'service'], default: 'product' },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true, maxlength: 600 },

    // null = "Contact for price"
    price: { type: Number, default: null, min: 0 },

    image: { type: String, default: '' },
    imagePublicId: { type: String, default: '' }, // Cloudinary se delete karne ke liye
  },
  { timestamps: true },
)

export default model('Product', productSchema)
