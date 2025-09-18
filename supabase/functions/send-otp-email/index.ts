import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, otp, type, name } = await req.json();

    if (!email || !otp || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, otp, type' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    // Prepare email content
    let subject = '';
    let htmlContent = '';
    let textContent = '';

    if (type === 'signup') {
      subject = `Your CotonAI Verification Code: ${otp}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 30px; padding: 20px 0; border-bottom: 2px solid #E1FF00;">
            <h1 style="color: #333; margin: 0; font-size: 28px;">CotonAI</h1>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 16px;">AI-Powered Design Platform</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 40px; border-radius: 12px; text-align: center; margin: 30px 0; border: 1px solid #e9ecef;">
            <h2 style="color: #333; margin: 0 0 25px 0; font-size: 24px;">Your Verification Code</h2>
            <div style="background-color: #E1FF00; color: #333; font-size: 36px; font-weight: bold; letter-spacing: 8px; padding: 25px; border-radius: 8px; margin: 25px 0; display: inline-block; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
              ${otp}
            </div>
            <p style="color: #666; margin: 25px 0 0 0; font-size: 16px; line-height: 1.5;">
              This code will expire in <strong>5 minutes</strong>.
            </p>
            <p style="color: #666; margin: 15px 0 0 0; font-size: 14px;">
              Use this code to complete your CotonAI account verification.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
              If you didn't request this code, please ignore this email.
            </p>
            <p style="color: #999; font-size: 12px; margin: 0;">
              This is an automated message from CotonAI. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;
      textContent = `Your CotonAI Verification Code: ${otp}\n\nHello${name ? ` ${name}` : ''},\n\nThank you for signing up for CotonAI! To complete your registration, please use the verification code above.\n\nThis code will expire in 5 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nBest regards,\nThe CotonAI Team`;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP type' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Send email using Supabase's built-in email service
    // Note: This requires SMTP configuration in Supabase Dashboard
    const { data, error } = await supabaseClient.auth.admin.inviteUserByEmail(email, {
      data: {
        otp: otp,
        type: type,
        name: name || '',
        subject: subject,
        html: htmlContent,
        text: textContent
      },
      redirectTo: `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/auth/callback?otp=${otp}&email=${email}`
    });

    if (error) {
      console.error('Error sending email:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email',
          details: error.message,
          fallback: `OTP: ${otp}` // Provide OTP as fallback
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log(`OTP email sent successfully to: ${email}`);
    
    return new Response(
      JSON.stringify({ 
        message: 'OTP email sent successfully!',
        email: email,
        otp: otp // Include OTP in response for development
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in send-otp-email function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        fallback: 'Check console for OTP'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
