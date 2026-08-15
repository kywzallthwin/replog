import { Resend } from 'resend'
import { env } from '../../env.js'

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  if (!env.RESEND_API_KEY) {
    throw new Error('Password reset email is not configured')
  }

  const resend = new Resend(env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: 'Reset your RepLog password',
    text: `Use this link to reset your RepLog password. The link expires in one hour:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:560px;margin:0 auto">
        <h1 style="font-size:24px">Reset your RepLog password</h1>
        <p>Use the button below to choose a new password. This link expires in one hour.</p>
        <p style="margin:28px 0">
          <a href="${resetUrl}" style="background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Reset password</a>
        </p>
        <p style="color:#64748b;font-size:14px">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  })

  if (error) {
    throw new Error(`Resend rejected the password reset email: ${error.message}`)
  }
}
