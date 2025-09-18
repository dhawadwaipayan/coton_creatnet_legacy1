import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, otp, type } = await req.json()

    if (!email || !otp) {
      return new Response(
        JSON.stringify({ error: 'Email and OTP are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Use Supabase's built-in email service
    const { data, error } = await supabaseClient.auth.admin.inviteUserByEmail(email, {
      data: {
        otp: otp,
        type: type || 'signup'
      },
      redirectTo: `${Deno.env.get('SITE_URL') || 'https://app.cotonai.com'}/auth/callback?otp=${otp}&email=${email}`
    })

    if (error) {
      console.error('Error sending invite email:', error)
      
      // Alternative: Use Supabase's email templates
      const emailTemplate = {
        to: email,
        subject: `Your CotonAI Verification Code: ${otp}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CotonAI Verification</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #333; margin: 0;">CotonAI</h1>
                <p style="color: #666; margin: 10px 0 0 0;">AI-Powered Design Platform</p>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h2 style="color: #333; margin: 0 0 20px 0;">Your Verification Code</h2>
                <div style="background-color: #E1FF00; color: #333; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; border-radius: 4px; margin: 20px 0;">
                  ${otp}
                </div>
                <p style="color: #666; margin: 20px 0 0 0; font-size: 14px;">
                  This code will expire in 5 minutes.
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                <p style="color: #666; font-size: 14px; margin: 0;">
                  If you didn't request this code, please ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  This is an automated message from CotonAI.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Your CotonAI verification code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nThis is an automated message from CotonAI.`
      }

      // Try to send using a custom email service
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'CotonAI <noreply@cotonai.com>',
          to: [email],
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text
        })
      })

      if (!emailResponse.ok) {
        throw new Error('Failed to send email via Resend')
      }

      return new Response(
        JSON.stringify({ success: true, message: 'OTP sent via email' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent via email' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in send-otp-simple function:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to send OTP email', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
