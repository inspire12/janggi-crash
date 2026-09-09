# Kakao login

Email OTP initiation has been replaced with server-side Kakao OAuth (PKCE).
The callback exchanges the code for a Supabase cookie session, then opens /join.
Account identity is the verified Supabase user UUID. Email may be absent; it is
stored as an empty string, not a synthetic or trusted identity. Anonymous Auth
sessions are not accepted. Existing accounts are not deleted or automatically
merged by nickname. The login endpoint returns a preparation notice until the
Kakao provider is enabled.

## Required provider setup

1. In Kakao Developers create/select the intended application and enable Kakao Login.
2. Register this Kakao Login Redirect URI exactly:
   `https://puiwukfftwbwkdsnpwuw.supabase.co/auth/v1/callback`
3. Configure the profile scopes required by the Supabase Kakao provider. Email
   consent is optional; no Kakao friends permission is requested by this app.
4. Supabase → Authentication → Sign In / Providers → Kakao:
   enter the Kakao REST API key (Client ID) and activated Kakao Login Client Secret.
   Enable Kakao and Allow users without an email if email scope is not requested.
   Keys belong in Supabase provider configuration, not source or browser code.
5. Supabase redirect allow list must include:
   `https://janggi-crash.inspire12-dev.workers.dev/api/auth/callback`

The two callback URLs are different: Kakao returns to Supabase, then Supabase
returns to the Worker. SMTP is not required for this social-login flow.

## Verify

- Provider disabled: login start returns a readable 503, no email is sent.
- Cancelled/invalid callback: redirect to /login?error=kakao; no session created.
- Real Kakao consent: callback cookie survives /join and /lobby navigation.
- Repeat login retains UUID, game profile and records; logout clears session.
- Email-less account can register; cross-origin POST remains blocked.

Source: https://supabase.com/docs/guides/auth/social-login/auth-kakao
