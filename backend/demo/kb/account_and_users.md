# Account Management and User Roles — Help Guide

## Creating and Managing Users

Admins can invite new users from **Settings → Team → Invite Member**.

Enter the user's email address and select their role:
- **Admin** — full access to settings, billing, analytics, and all tickets
- **Support Rep** — can view and respond to tickets, use AI assist, and manage the queue
- **Customer** — can submit tickets and view their own ticket history only

Invites expire after 7 days. If the link expires, the admin can resend the invitation from the same page.

## Changing a User's Role

To change a user's role:
1. Go to **Settings → Team**.
2. Find the user and click the **Edit** icon.
3. Select the new role from the dropdown.
4. Save your changes.

Role changes take effect immediately. The user will see updated permissions on their next page load.

## Removing a User

To remove a user from your organization:
1. Go to **Settings → Team**.
2. Click the **Remove** button next to the user's name.
3. Confirm the removal.

Removed users lose access immediately. Their historical ticket activity is preserved in your account for audit purposes.

## Resetting Your Password

If you have forgotten your password:
1. Go to the login page and click **Forgot Password**.
2. Enter your account email address.
3. Check your email for a password reset link (valid for 1 hour).
4. Click the link and set a new password.

If you do not receive the email within 5 minutes, check your spam folder or contact support.

## Two-Factor Authentication (2FA)

Two-factor authentication adds an extra layer of security to your account.

To enable 2FA:
1. Go to **Settings → Security → Two-Factor Authentication**.
2. Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.).
3. Enter the 6-digit code to verify and save.

Once enabled, you will be prompted for a 2FA code on every login. Save your backup codes in a secure location — they can be used if you lose access to your authenticator app.

## Updating Your Profile

To update your name, email, or profile picture:
1. Click your avatar in the top-right corner.
2. Select **Profile Settings**.
3. Update your details and click **Save**.

Email changes require verification — a confirmation link will be sent to the new address.

## Single Sign-On (SSO)

SSO is available on the Enterprise plan. Supported providers include Google Workspace, Microsoft Azure AD, and Okta.

To configure SSO:
1. Go to **Settings → Security → Single Sign-On**.
2. Select your identity provider and follow the setup instructions.
3. Test the connection before enabling it for all users.

Contact support if you need assistance configuring a custom SAML provider.

## Account Data and Privacy

- All data is encrypted at rest (AES-256) and in transit (TLS 1.3).
- We do not sell or share your data with third parties.
- You can export all your account data by going to **Settings → Data → Export Data**.
- To request account deletion, contact our support team. All data is permanently deleted within 30 days of the request.

## Audit Log

Admins can view a full audit log of all actions taken within the account under **Settings → Audit Log**. This includes login events, settings changes, ticket actions, and user management events. The audit log can be exported as a CSV file.

## Notification Preferences

To manage email and in-app notifications:
1. Go to **Settings → Notifications**.
2. Toggle on or off notifications for ticket assignments, status changes, new messages, and system alerts.
3. Save your preferences.

Reps can set per-ticket notification preferences directly from the ticket detail page.
