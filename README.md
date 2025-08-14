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
- **Styling**: Tailwind CSS + shadcn/ui components
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

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file with your Supabase and AI service credentials.

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

## Project Structure

```
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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is proprietary software. All rights reserved.

## Support

For support and questions, please contact the development team.
