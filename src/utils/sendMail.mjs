import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
})

// Server start hote hi check kar lega connection sahi hai ya nahi
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Mail transporter error:', error.message)
  } else {
    console.log('✅ Mail server ready to send emails')
  }
})

const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"EventSphere" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    })
    console.log('Email sent:', info.messageId)
  } catch (error) {
    console.log('Email send error:', error.message)
    throw error // isko controller ke catch tak jaane do
  }
}

export default sendEmail