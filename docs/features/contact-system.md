# Contact System Implementation

## Overview

The urlfy.cc contact system is a hybrid solution that combines database persistence with real-time Telegram notifications. It provides a LGPD-compliant contact form for users and a comprehensive admin interface for managing messages.

## Features

### Public Contact Form

- **Location:** `/contact`
- **Rate Limiting:** 30 submissions per hour per IP
- **LGPD Compliance:** Explicit consent checkbox required
- **Fields:**
  - Name (2-255 characters)
  - Email (valid email format)
  - Subject (3-255 characters)
  - Message (10-5000 characters)
  - Consent checkbox (required)

### Telegram Integration

- **Optional:** System works without Telegram configuration
- **Real-time Notifications:** Messages are sent to configured Telegram chat
- **Fallback:** Failed notifications don't block message submission
- **Status Tracking:** Admin can see which messages were successfully sent to Telegram

### Admin Interface

- **Location:** `/admin/messages`
- **Features:**
  - View all contact messages
  - Filter by status (unread, read, archived)
  - Mark as read/archived
  - View full message details
  - See Telegram delivery status
  - Delete messages

## Environment Variables

Add to your `.env` file:

```env
# Telegram Bot Configuration (Optional)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### Setting up Telegram Bot

1. **Create a Bot:**
   - Message [@BotFather](https://t.me/BotFather) on Telegram
   - Send `/newbot` and follow instructions
   - Save the bot token

2. **Get Chat ID:**
   - Add your bot to a group or message it directly
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find the `chat.id` value
   - Use this as your `TELEGRAM_CHAT_ID`

3. **Test:**
   - Submit a contact form
   - Check if message appears in Telegram
   - Check admin panel for delivery status

## API Endpoints

### Public

- `POST /api/contact` - Submit contact form

### Admin (Requires Authentication + Admin Role)

- `GET /api/admin/messages` - List messages (supports pagination and filtering)
- `GET /api/admin/messages/:id` - Get message details
- `PATCH /api/admin/messages/:id` - Update message status
- `DELETE /api/admin/messages/:id` - Delete message

## Database Schema

The `contact_message` table includes:

- Basic contact info (name, email, subject, message)
- IP address for abuse prevention
- User agent tracking
- Status field (unread, read, archived)
- Telegram delivery tracking
- LGPD consent flag
- Timestamps

## Security

### Rate Limiting

- **30 requests per hour per IP** using Redis sliding window algorithm
- Prevents spam and abuse
- Returns 429 status with retry-after header when exceeded

### Data Privacy

- IP addresses stored for abuse prevention (consider anonymization if needed)
- Explicit consent required before submission
- Users can see what data is collected in the consent message

### Admin Access

- Only users with `admin` role can access admin endpoints
- Uses `requireAdmin` middleware for authentication
- All admin actions are auditable

## Testing

### Manual Testing Checklist

1. **Public Form:**
   - [ ] Form renders correctly
   - [ ] All fields validate properly
   - [ ] Consent checkbox is required
   - [ ] Success message appears after submission
   - [ ] Rate limiting works (try 31 submissions)

2. **Telegram Integration:**
   - [ ] Messages arrive in Telegram (if configured)
   - [ ] Delivery status shows in admin panel
   - [ ] System works without Telegram configured

3. **Admin Panel:**
   - [ ] Messages list loads
   - [ ] Filtering by status works
   - [ ] Can view message details
   - [ ] Can mark as read/archived
   - [ ] Telegram status icon displays correctly

## Troubleshooting

### Telegram not working

- Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set
- Check bot has permission to post in the chat/group
- Check admin panel for error messages
- Messages are still saved even if Telegram fails

### Rate limiting too strict

- Adjust `CONTACT_RATE_LIMIT` in `contact.controller.ts`
- Default: 30 requests per hour (3600 seconds)

### Messages not appearing in admin panel

- Verify admin user role is set correctly
- Check database migration ran successfully
- Check browser console for API errors

## Migration Applied

The contact system requires a database migration that was automatically applied:

- Migration: `0002_supreme_absorbing_man.sql`
- Table: `contact_message`
- Run: `bun run db:migrate` (already completed)

## Future Enhancements

- Email notifications as alternative to Telegram
- Webhook support for third-party integrations
- Message threading/conversation view
- Auto-response templates
- Advanced filtering and search
- Export messages to CSV
