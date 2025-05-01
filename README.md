# Events Platform API

Welcome to the events platform API, built using TypeScript, Express and PostgreSQL. It's designed for building full stack applications that are aimed at listing events that users can sign up/register to attend, and so event managers can sign up and create a team for themselves or with other team members.

## Table of Contents

- [Demo](#demo)
- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Demo The App

You can use one of these logins to test the app as the following roles:

| Role          | Username     | Password    |
| ------------- | ------------ | ----------- |
| Admin         | siteadmin    | password123 |
| Team Admin    | alice123     | password123 |
| Event Manager | eventmanager | password123 |
| User          | regularuser  | password123 |

## Features

### Authentication

- User registration with validation for username, email, and password
- Support for regular user and event organiser registration
- JWT-based authentication with access and refresh tokens
- Secure login/logout functionality

### User Management

- Comprehensive user profile management
- Role-based permissions system
- Profile updates for username, email, and profile images
- User registration tracking for events

### Team Management

- Create and manage teams with team admins and event managers
- Add team members with specific roles
- Team dashboard for managing team-specific information
- Role-based access control for team operations

### Event Management

- Create, update, and delete events
- Draft and published event states
- Filter events by category, location, price range, and date
- Sort events by various criteria
- Event capacity and attendance management
- Public and private event visibility

### Event Registration

- Register for available events
- Email confirmation for registrations
- Cancel and reactivate registrations
- Ticket generation and management
- Registration validation based on event capacity and availability

### Payment Processing

- Stripe integration for event payments
- View payment history
- Complete payment flow from checkout to ticket issuance
- Webhook handling for payment status updates

## User Roles

### Site Admin

- Full system access
- Manage all users, events, and teams
- Access to admin dashboard
- Promote users to site admin

### Team Admin

- Create and manage their team
- Add and manage team members
- Create and manage team events
- Access to team dashboard

### Event Manager

- Create and manage events for their team
- View and manage team-specific event data
- Access to team dashboard

### Regular User

- Register for events
- View and manage personal registrations
- Update personal profile information
- View tickets and payment history

## API Documentation

The API follows RESTful principles and provides endpoints for all the features mentioned above. Detailed API documentation is available at /api when running the server.

### Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

### Clone the repository

```bash
git clone https://github.com/TTibbs/events-api
cd events-platform-api
```

### Install dependencies

```bash
npm install
```

### Set up environment variables (create a .env file)

```bash
JWT_SECRET=your_jwt_secret
DATABASE_URL=your_supabase_db_url
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=your_send_from_email_in_sendgrid
STRIPE_PUBLISHABLE_KEY=your_strike_sk_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
FRONTEND_URL=the_redirect_url_for_stripe_rejected_payments
```

### Set up the database

```bash
npm run setup-dbs
```

### Seeding the database

Seeding for testing

```bash
npm run seed
```

Seeding for production

```bash
npm run seed-prod
```

### Start the development server

```bash
npm start
```

## Testing

The application includes comprehensive test suites for all features:

### Run all tests

```bash
npm test
```

### Run specific test suites

```bash
npm test auth.test
```

## Deployment

For production deployment:

```bash
npm run build
npm start
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
