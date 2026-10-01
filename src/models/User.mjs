import { Schema, model } from 'mongoose'
import { genSalt, hash, compare } from 'bcryptjs'

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    avatar: { type: String, default: '' },
    password: {
      type: String,
      required: function () {
        return !this.googleId // Google se sign in karne walon ka password nahi hota
      },
      minlength: 6,
      select: false,
    },
    googleId: { type: String, unique: true, sparse: true }, // sparse => sirf jinke pass ye field hai unhi par unique lagega
    role: { type: String, enum: ['admin', 'exhibitor', 'attendee'], default: 'attendee' },
    // phone: { type: String, default: '' },
    // agar role exhibitor hai to iska Exhibitor document se link
    // companyId: { type: Schema.Types.ObjectId, ref: 'Exhibitor', default: null },

    // Exhibitor company profile — sirf role: 'exhibitor' walon ke liye maayne rakhta hai.
    // Exhibitor apni khud ki dashboard (Profile page) se ye fields fill/update karega.
    companyName: { type: String, default: '' },
    category: { type: String, default: '' },
    description: { type: String, default: '' },
    website: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    boothNumber: { type: String, default: '' },
    products: { type: [String], default: [] },

    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
  },
  { timestamps: true, toJSON: { virtuals: true } },
)

// Save hone se pehle password ko hash kar do
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  const salt = await genSalt(10)
  this.password = await hash(this.password, salt)
})

// Exhibitor-only company-profile fields — agar user exhibitor nahi hai to yeh
// document mein empty '' / [] bana kar save nahi hone chahiye. Yahan check karte
// hain ke role exhibitor nahi hai (admin/attendee) to yeh fields document se hata do.
const EXHIBITOR_ONLY_FIELDS = [
  'companyName',
  'category',
  'description',
  'website',
  'phone',
  'address',
  'boothNumber',
  'products',
]

userSchema.pre('save', function () {
  if (this.role === 'exhibitor') return

  for (const field of EXHIBITOR_ONLY_FIELDS) {
    this.set(field, undefined)
  }
})

// Login ke waqt password compare karne ke liye helper method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return compare(enteredPassword, this.password)
}

const User = model('User', userSchema)

export const findOne = (...args) => User.findOne(...args)
export const findById = (...args) => User.findById(...args)
export const create = (...args) => User.create(...args)

export default User