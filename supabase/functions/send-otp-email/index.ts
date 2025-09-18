// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SITE_URL = Deno.env.get('SITE_URL') || 'https://coton-ai.vercel.app';

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  try {
    const { email, otp, type, name } = await req.json();

    if (!email || !otp || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, otp, type' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Generate email content based on type
    let subject = '';
    let htmlContent = '';
    let textContent = '';

    if (type === 'signup') {
      subject = `Your CotonAI Verification Code: ${otp}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${SITE_URL}/CotonAI_Logo.svg" alt="CotonAI Logo" style="width: 100px; height: auto;">
          </div>
          <h2 style="color: #2a2a2a; text-align: center;">Email Verification</h2>
          <p style="text-align: center;">Hello ${name || 'there'}! Thank you for signing up for CotonAI. To complete your registration, please use the verification code below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="display: inline-block; background-color: #E1FF00; color: #181818; font-size: 28px; font-weight: bold; padding: 15px 25px; border-radius: 8px; letter-spacing: 3px;">${otp}</span>
          </div>
          <p style="text-align: center; font-size: 14px; color: #777;">This code is valid for 5 minutes.</p>
          <p style="text-align: center;">If you did not request this, please ignore this email.</p>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
            <p>&copy; ${new Date().getFullYear()} CotonAI. All rights reserved.</p>
          </div>
        </div>
      `;
      textContent = `Your CotonAI Verification Code: ${otp}\n\nHello ${name || 'there'}! Thank you for signing up for CotonAI. To complete your registration, please use the verification code above.\n\nThis code is valid for 5 minutes.\n\nIf you did not request this, please ignore this email.\n\n© ${new Date().getFullYear()} CotonAI. All rights reserved.`;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP type' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Send email using Resend API
    if (RESEND_API_KEY) {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'CotonAI <no-reply@cotonai.com>', // Replace with your verified domain
          to: email,
          subject: subject,
          html: htmlContent,
          text: textContent,
        }),
      });

      const emailData = await emailResponse.json();

      if (!emailResponse.ok) {
        console.error('Resend API error:', emailData);
        return new Response(
          JSON.stringify({ error: 'Failed to send email', details: emailData }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          message: 'OTP email sent successfully!', 
          emailId: emailData.id 
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } else {
      // Fallback if no Resend API key
      console.log(`📧 Email simulation - To: ${email}, OTP: ${otp}`);
      return new Response(
        JSON.stringify({ 
          message: 'Email simulation successful (RESEND_API_KEY not set)', 
          otp: otp 
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  } catch (error) {
    console.error('Error in send-otp-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
