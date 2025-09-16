# CotonAI Konva - AI-Powered Design Canvas

A modern, AI-enhanced design and sketching application built with React, TypeScript, and Konva.js. CotonAI Konva provides an intuitive canvas interface for creative design work with integrated AI capabilities.

## Features

- **Interactive Canvas**: Built with Konva.js for smooth drawing and manipulation
- **AI Integration**: Multiple AI services for sketch generation, rendering, and design assistance
- **User Management**: Secure authentication system with admin approval workflow
- **Modern UI**: Clean, responsive interface built with Tailwind CSS and shadcn/ui
- **Real-time Tools**: Drawing tools, text tools, shape tools, and more
- **Export/Import**: Support for various image formats and project saving

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Canvas**: Konva.js for 2D graphics
- **Styling**: Tailwind CSS + Custom UI components
- **Build Tool**: Vite
- **Authentication**: Supabase
- **AI Services**: OpenAI, Gemini AI, Flux Kontext AI, Render AI

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account for authentication

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd coton_konva1
```

1. Install dependencies:

```bash
npm install
```

1. Set up environment variables:

Create a `.env` file with your Supabase and AI service credentials.

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key # server-only
```

1. Start the development server:

```bash
npm run dev
```

1. Open your browser and navigate to `http://localhost:5173`

## Project Structure

```text
src/
├── components/          # React components
│   ├── Canvas.tsx      # Main canvas component
│   ├── TopBar.tsx      # Top navigation bar
│   ├── Sidebar.tsx     # Tool sidebar
│   └── ui/             # shadcn/ui components
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and AI services
├── pages/               # Page components
└── assets/              # Static assets
```

## AI Services

- **Sketch AI**: Generate sketches from text descriptions
- **Render AI**: Convert sketches to rendered images
- **Gemini AI**: Advanced AI assistance for design tasks
- **Flux Kontext AI**: Context-aware AI interactions

## Authentication

The application uses a secure admin approval system:

- New users request access through the signup form
- Admins review and approve user requests
- Approved users can sign in and access the application
- Admin dashboard for user management

### Security & RLS Setup

1. Open Supabase SQL editor and run the SQL in `supabase-policies.sql`.

   - This enables Row Level Security, adds `auth.uid()` policies to tables, and sets private storage policies for `board-images` and `board-videos`.
   - Adjust bucket IDs and table names if your schema differs.

1. Make buckets private in Supabase Storage:

   - `board-images`, `board-videos` should be private.

1. Rotate keys if needed:

   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is server-only.
   - Keep only the `anon` key in the browser.

1. Test access:

   - Unapproved user cannot read/modify boards or storage.
   - Approved user can read/write their own data only.
   - Non-admin cannot access admin endpoints.

## Contributing

1. Fork the repository
1. Create a feature branch
1. Make your changes
1. Submit a pull request

## License

This project is proprietary software. All rights reserved.

## Support

For support and questions, please contact the development team.
