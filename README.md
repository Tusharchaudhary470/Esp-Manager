# Esp-Manager

A full-stack web app for managing shared finances, tournaments, and team stats for competitive esports teams — built to solve a real problem I faced as a Free Fire player.

🌐 [Live Demo](https://esport-manager-azure.vercel.app/)

## The Problem

Most amateur esports teams don't have an org or manager handling money. One teammate usually ends up holding the funds — buying lobbies, collecting winnings, storing it all in his personal bank account alongside his own money. That setup causes real problems:

- Lost track of who contributed what
- Accidental mixing of personal and team funds
- Disputes over missing money
- Forgotten tournament registrations
- No shared visibility — only one person knows the real balance

I originally solved this with a Flutter + Firebase app for my own team. This is the rebuilt web version using the MERN stack — with proper authentication, a custom backend, and a real database.

## Features

### 💰 Wallet
- Shared team balance visible to all members in real time
- **Deposit** — log who added money and when
- **Withdraw** — log who took money and why
- **Lobby transactions** — track entry fee and profit for each practice lobby, with net gain/loss calculated automatically
- **Pending lobby system** — any member can log a lobby immediately after playing, even before the profit is confirmed. The team treasurer reviews and completes it later — preventing forgotten or inaccurate entries
- Running balance chart (area chart) showing wallet trend over time, switchable between all transactions and lobbies only
- Delete any transaction with automatic balance reversal

### 🏆 Tournaments
- Track all upcoming registered tournaments so nothing gets forgotten
- Add tournament name, date, and entry fee
- Auto-splits into Upcoming and Completed based on date
- Edit or delete tournaments

### 📊 Statistics
- Win rate calculated automatically from completed lobby data
- A win is defined as profit > entry fee
- Pie chart showing wins vs losses

### 👥 Members & Payouts
- View all team members in one place
- Pay a member directly from the team wallet
- Track total amount paid to each member
- Full payout history

### 🔐 Authentication
- Register and login with username and password
- Passwords hashed with bcrypt
- JWT-based authentication — stay logged in across sessions
- Protected routes — no access without a valid token

### 🏠 Multi-Team Support
- Create multiple teams, each with their own wallet, tournaments, and stats
- Join any team using a unique team code
- Switch between teams from the dashboard

## Tech Stack

**Frontend**
- React
- React Router
- Recharts (charts)
- Deployed on Vercel

**Backend**
- Node.js
- Express
- MongoDB + Mongoose
- JWT + bcrypt for auth
- Deployed on Render

## How It Works

```
User registers/logs in
→ Creates or joins a team using a unique code
→ All teammates join using the same code
→ Everyone sees the same wallet, tournaments, and stats in real time
→ Transactions are logged with who did what and when
→ Balance updates automatically on every action
```

## Background

This app was born from a real problem my esports team faced. I originally built a Flutter + Firebase version to solve it for our group. After learning the MERN stack, I rebuilt it as a full web application — adding proper authentication, a custom REST API, and MongoDB for persistent storage.

The name "Esp-Manager" reflects that the app isn't limited to one game — any esports team dealing with shared funds and tournament tracking can use it.