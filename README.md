# Flappy Next

A responsive Flappy-style browser game built with Next.js, Phaser, TypeScript, and Tailwind CSS.

## Features

- Phaser-powered arcade physics and collision
- Tap, click, Space, or Up Arrow flap controls
- Restart and pause controls
- Local best-score persistence
- Responsive desktop and mobile layout
- Vercel-ready Next.js App Router setup

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Deploy

This app can be deployed directly to Vercel from GitHub.

```bash
npx vercel
npx vercel --prod
```

Vercel build settings can stay on the Next.js defaults:

- Framework preset: Next.js
- Build command: `npm run build`
- Output directory: `.next`

## GitHub

```bash
git add .
git commit -m "Build flappy game app"
git push
```
