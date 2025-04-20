# User stories for app

## Shared User Stories

As a site user with any role or site admin status I can:

- See a page of available events [✅]
- See a dedicated event details page [✅]
- Register for an event and receive a confirmation email [✅]
- Cancel my registration for an event [✅]
- Filter events by category, location, price range, and date [✅]
- Sort events by different criteria (price, location, date, category) [✅]
- View upcoming events [✅]
- Access public events without being logged in [✅]

## Site Admin Stories

As a site admin (is_site_admin value on user object) I can:

- See all the data for users, events etc [✅]
- Add a new event [✅]
- Edit any event [✅]
- Delete any event [✅]
- Add a new user profile [✅]
- Edit any user profile [✅]
- Delete any user profile [✅]
- Promote another user to be site admin [✅]
- See a dedicated site admin dashboard page [✅]

## Team Admin Stories

As a team admin or event_manager (User is in a team and has the role team_admin or event_manager) I can:

- Sign up using my username, email and password, along with the option to be an event organiser where I give a team name and description and I also get the team_admin role on being authenticated [✅]
- Sign in using my username and password [✅]
- Create a new event managed only by me and someone with event_manager role [✅]
- See the events that have been drafted [✅]
- See a dedicated team dashboard page [✅]
- Delete a team member [ ]
- See my team members [✅]
- Create draft and published events for my team [✅]
- Update events that belong to my team [✅]
- Delete events that belong to my team [✅]
- Set event capacity, price, location, and other details [✅]
- View draft events for my team [✅]

As a team_admin or event_manager I can NOT:

- Edit any other teams event [✅]
- Delete another teams event [✅]
- See the site admin dashboard [✅]
- View draft events for other teams [✅]

## Authentication Features [✅]

Based on auth.test.ts, the application provides:

- User registration with validation for username, email, and password [✅]
- Support for regular user registration [✅]
- Support for event organiser registration with team creation [✅]
- User login with validation [✅]
- JWT-based authentication with access and refresh tokens [✅]
- Token refresh functionality [✅]
- Logout functionality [✅]
- Secure handling of authentication edge cases [✅]

## User Management Features [✅]

Based on users.test.ts, the application provides:

- List all users in the system [✅]
- Look up users by ID, username, or email [✅]
- Check if a user has site admin privileges [✅]
- Create new user accounts with all required fields [✅]
- Update user profile information (username, email, profile image) [✅]
- Delete user accounts [✅]
- Validation for required fields when creating/updating users [✅]
- Protection against duplicate usernames and emails [✅]
- Authentication required for accessing protected user endpoints [✅]
- View a user's event registrations [✅]

## Team Management Features [✅]

Based on teams.test.ts, the application provides:

- List all teams in the system [✅]
- Look up team by ID [✅]
- View all members of a specific team [✅]
- List all team members across all teams [✅]
- Find team members by ID, user ID, or role [✅]
- Create new teams with proper validation [✅]
- Update team information (name, description) [✅]
- Delete teams [✅]
- Add new members to teams [✅]
- Create a new user and add them to a team in one operation [✅]
- Validation for team and team member operations [✅]
- Authentication required for accessing team management functions [✅]

## Event Management Features [✅]

Based on events.test.ts, the application provides:

- List all published events [✅]
- Filter events by various criteria (category, location, price, date) [✅]
- Sort events by different fields (date, price, location, category) [✅]
- Pagination for event listings [✅]
- Look up event by ID [✅]
- Create new events with required validation [✅]
- Update existing events [✅]
- Delete events [✅]
- Role-based permissions for event management [✅]
- View upcoming events [✅]
- View events by team [✅]
- Draft event functionality for team members [✅]
- View and manage event capacity/attendance limits [✅]
- Event availability checking [✅]
- Proper validation of event dates and times [✅]
- Public vs. private event visibility [✅]

## Event Registration Features [✅]

Based on events.test.ts, the application provides:

- Register for available events [✅]
- Receive email confirmation after registration [✅]
- Cancel registrations [✅]
- Reactivate cancelled registrations [✅]
- View registrations for an event [✅]
- Prevent duplicate registrations [✅]
- Validation for event capacity limits [✅]
- Validation for event availability (not started, not ended, published) [✅]
- Proper error handling for registration issues [✅]
- Ticket generation upon successful registration [✅]

## Ticket Management Features [✅]

Based on tickets.test.ts, the application provides:

- List all tickets in the system [✅]
- Look up tickets by ID or ticket code [✅]
- View all tickets for a specific user [✅]
- Verify ticket validity for event entry [✅]
- Check if a user has paid for a specific event [✅]
- Create new tickets for event registrations [✅]
- Mark tickets as used at event entry [✅]
- Update ticket status (valid, used, cancelled) [✅]
- Delete tickets when needed [✅]
- Validation for ticket operations with appropriate error handling [✅]
- Authentication required for accessing protected ticket endpoints [✅]
- Support for event timeline validation (preventing use after event end) [✅]

## Payment Features [✅]

Based on stripe.test.ts, the application provides:

- View payment history for a user [✅]
- Create Stripe checkout sessions for event payment [✅]
- Process successful payments and issue tickets [✅]
- Handle Stripe webhook events [✅]
- Sync payment status from Stripe [✅]
- Complete end-to-end payment flow (checkout to ticket issuance) [✅]
- Authentication required for payment operations [✅]
- Validation and error handling for payment processes [✅]
- Idempotent payment processing to prevent duplicates [✅]

## Regular User Stories

As a regular user I can:

- Sign up using a username, email and password [✅]
- Sign in using my username and password [✅]
- Register for a event and receive a confirmation email [✅]
- Cancel a registration for an event [✅]
- Reactivate a previously cancelled registration [✅]
- Update my username or email [✅]
- See my profile and calendar with events I've registered for on there [✅]
- Receive tickets for events I've registered for [✅]
- View my tickets for upcoming events [✅]
- Pay for events using Stripe [✅]
- View my payment history [✅]
- Filter events by category, location, price, and date [✅]
- Sort events by different criteria [✅]
- See only published events [✅]

As a regular user I can NOT:

- See the admin or team dashboard [✅]
- Create an event [✅]
- Edit any event [✅]
- Edit any other users profile [✅]
- Delete any other users profile [✅]
- View draft events [✅]
