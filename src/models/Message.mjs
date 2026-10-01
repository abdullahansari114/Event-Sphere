import { Schema, model } from 'mongoose'

// Ek chat message — sender aur receiver dono User collection ke documents hain
// (attendee ho ya exhibitor, sab User hi hain, sirf role field alag hota hai)
const messageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false }, // receiver ne padha ya nahi
  },
  { timestamps: true },
)

// Do logon ke beech ki chat history baar baar fetch hoti hai — isliye compound index
messageSchema.index({ sender: 1, receiver: 1, createdAt: 1 })

export default model('Message', messageSchema)
