# RHU Student Companion

A React + TypeScript web app that retrieves a student's verified RHU timetable through n8n and presents classes, campus navigation, cafeteria information, and a campus assistant.

## Class reminders

- The n8n schedule response may include `reminderMinutesBefore` (default: `10`).
- While the web app is open, it checks the verified timetable every 15 seconds and shows one reminder during the configured pre-class window.
- Delivered occurrence IDs are retained locally to prevent duplicate alerts. Moodle credentials and tokens are never stored for reminders.

The in-app reminder works without a browser permission prompt. If the site already has notification permission, the same reminder is also delivered as a system notification.

## Development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm test
npm run lint
npm run build
```

Copy `.env.example` to `.env` and point `VITE_SCHEDULE_API_URL` at the same-origin schedule route. Vercel rewrites that route to the n8n webhook in `vercel.json`.
