# OWVO Admin Dashboard

Next.js admin dashboard for OWVO operations, connected to the existing OWVO Node.js backend.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Update `.env.local` with the backend URLs:

```env
NEXT_PUBLIC_API_BASE_URL=https://owvo-backend.onrender.com/api/v1
NEXT_PUBLIC_SOCKET_URL=https://owvo-backend.onrender.com
```

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm start
```

## Notes

- Keep backend secrets, Stripe secret keys, MongoDB URLs, and JWT secrets in the backend only.
- This dashboard only needs public frontend environment variables pointing to the backend API and socket URL.
- Do not commit `.env`, `.env.local`, `.next`, or `node_modules`.
