# User stories for app

## Shared User Stories

As a site user with any role or site admin status I can:

- See a page of available events [✅]
- See a dedicated event details page [✅]
- Register for an event and receive a confirmation email [✅]
- Cancel my registration for an event [✅]

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
- See my team members [ ]

As a team_admin or event_manager I can NOT:

- Edit any other teams event [✅]
- Delete another teams event [✅]
- See the site admin dashboard [✅]

## Regular User Stories

As a regular user I can:

- Sign up using a username, email and password [✅]
- Sign in using my username and password [✅]
- Register for a event and receive a confirmation email [✅]
- Cancel a registration for an event [✅]
- Update my username or email [✅]
- See my profile and calendar with events I've registered for on there [✅]

As a regular user I can NOT:

- See the admin or team dashboard [✅]
- Create an event [✅]
- Edit any event [✅]
- Edit any other users profile [✅]
- Delete any other users profile [✅]
-
