# Troubleshooting and Technical Support — Help Guide

## I Can't Log In

If you are unable to log in to your account:

1. **Check your email address** — ensure you are using the email associated with your account.
2. **Reset your password** — go to the login page and click **Forgot Password** to receive a reset link.
3. **Check for account suspension** — if your subscription payment failed, your account may be paused. Go to **Settings → Billing** to update your payment method.
4. **SSO users** — if your organization uses Single Sign-On, use the SSO login button rather than entering a password directly.
5. **Clear browser cache** — cached login tokens can sometimes cause issues. Clear your browser cookies and try again.

If you still cannot log in after these steps, contact our support team with your account email.

## Ticket Submission Not Working

If you are unable to submit a ticket:

- Ensure all required fields (Subject, Description) are filled in.
- Check your internet connection — the form requires an active connection to submit.
- If you see a "413 Request Too Large" error, your file attachment exceeds the 10 MB limit. Compress the file or remove the attachment.
- Try a different browser or disable browser extensions that may be blocking form submissions.

## Email Notifications Not Arriving

If you are not receiving email notifications:

1. Check your spam or junk folder.
2. Add `noreply@ticketpilot.io` to your email contacts or safe senders list.
3. Confirm notifications are enabled under **Settings → Notifications**.
4. Check with your IT team if your company email server applies strict spam filters.

If the issue persists, our support team can verify whether emails are being sent successfully from our side.

## Page Loading Slowly or Not at All

If pages are loading slowly:

- Check your internet connection speed.
- Try refreshing the page (Ctrl+R or Cmd+R).
- Clear your browser cache and cookies.
- Try an incognito or private browsing window to rule out extension conflicts.
- Supported browsers: Chrome 90+, Firefox 90+, Edge 90+, Safari 14+. If you are using an older browser, please update it.

For persistent performance issues, contact support and include the browser version and operating system you are using.

## File Attachment Issues

- Maximum file size per attachment: **10 MB**
- Supported file types: PDF, PNG, JPG, JPEG, GIF, DOCX, XLSX, TXT, ZIP
- You can attach up to 5 files per message.
- If an upload fails, check your file size and type, then try again.

## AI Assistant Not Responding

If the AI assistant is not generating a response on a ticket:

- The AI requires at least one document to be uploaded to the Knowledge Base. Ensure your organization has uploaded relevant documents.
- If the AI responds with low confidence or recommends escalation, this means the knowledge base does not contain enough relevant information for the question. Add more documents to improve AI response quality.
- The AI chat feature is available to Support Reps and Admins only. Customers cannot access it directly.

## Data Export and Backup

To export your ticket data:
1. Go to **Admin → Reports → Export**.
2. Select the date range and data type (tickets, messages, audit log).
3. Click **Export CSV** or **Export Excel**.

Exports are processed in the background and emailed to the requesting admin when ready. Large exports (over 10,000 rows) may take up to 10 minutes.

## API Integration Issues

If you are experiencing issues with the API:

- Verify your API key is active under **Settings → API Keys**.
- Ensure you are including the `Authorization: Bearer <api_key>` header in every request.
- API keys are scoped per organization — use the key for the correct organization.
- Rate limits: 60 requests per minute on Professional, 300 per minute on Enterprise.
- All API endpoints return standard HTTP status codes. Check the response body for detailed error messages.

For full API documentation, visit our developer portal.

## Browser Compatibility

For the best experience, use the latest version of:
- **Google Chrome** (recommended)
- **Mozilla Firefox**
- **Microsoft Edge**
- **Apple Safari**

Internet Explorer is not supported. Mobile browsers are supported for viewing tickets but not for all admin features.

## Contacting Technical Support

For technical issues not covered here:

- **Email**: support@ticketpilot.io
- **Live chat**: Available Monday–Friday, 9 AM–6 PM IST
- **Response time**: Under 4 hours on Professional, under 1 hour on Enterprise
- **Emergency escalation**: Enterprise customers can call our dedicated support line listed in their onboarding email.

When contacting support, please include:
- Your account email and organization name
- A description of the issue and steps to reproduce it
- Screenshots or screen recordings if possible
- Your browser version and operating system
