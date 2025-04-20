# Events Platform API

Welcome to the events platform API, built using TypeScript, Express and PostgreSQL. It's designed for building full stack applications that are aimed at listing events that users can sign up/register to attend, and so event managers can sign up and create a team for themselves or with other team members.

## Demo The App

You can use one of these logins to test the app as the following roles:

Site Admin:

```bash
username=siteadmin
password=password123
```

Team Admin:

```bash
username=teamadmin
password=password123
```

Event Manager:

```bash
username=eventmanager
password=password123
```

Regular User:

```bash
username=user
password=password123
```

<details>
   <summary>
      <h2>Features</h2>
   </summary>

### Authentication

User registration with validation for username, email, and password
Support for regular user and event organizer registration
JWT-based authentication with access and refresh tokens
Secure login/logout functionality

User Management

Comprehensive user profile management
Role-based permissions system
Profile updates for username, email, and profile images
User registration tracking for events

Team Management

Create and manage teams with team admins and event managers
Add team members with specific roles
Team dashboard for managing team-specific information
Role-based access control for team operations

Event Management

Create, update, and delete events
Draft and published event states
Filter events by category, location, price range, and date
Sort events by various criteria
Event capacity and attendance management
Public and private event visibility

Event Registration

Register for available events
Email confirmation for registrations
Cancel and reactivate registrations
Ticket generation and management
Registration validation based on event capacity and availability

Payment Processing

Stripe integration for event payments
View payment history
Complete payment flow from checkout to ticket issuance
Webhook handling for payment status updates

</details>

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

The API follows RESTful principles and provides endpoints for all the features mentioned above. Detailed API documentation is available at /api-docs when running the server.

### Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

### Clone the repository

```bash
git clone https://github.com/yourusername/events-platform-api.git
cd events-platform-api
```

### Install dependencies

```bash
npm install
```

### Set up environment variables (create a .env file)

```bash
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=events_db
JWT_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
EMAIL_SERVICE=your_email_service
EMAIL_USER=your_email
EMAIL_PASSWORD=your_email_password
```

### Set up the database

```bash
npm run setup-dbs
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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
