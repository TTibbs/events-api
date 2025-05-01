## 1. All Visitors (Public)

- **Browse events:** I can see a list of upcoming events—even without logging in—so I know what’s available.
- **View event details:** I can click into any event to read all the essential info on its own page.
- **Filter & sort:** I can narrow down events by category, location, price or date, and sort them by those same criteria.

---

## 2. All Authenticated Users (Any Role)

- **Sign up & sign in:** I can register with a username, email and password; log in and log out; and use access & refresh tokens for secure sessions.
- **Register & manage events:** I can sign up for an event, receive a confirmation email, cancel or reactivate my registration.
- **Manage my account:** I can update my username or email, view my profile and calendar of registered events, see my tickets, and review my payment history.

---

## 3. Regular Users (Non-admins)

- **Secure access:** I can sign up or log in with my username/email and password, log out, and refresh my session via JWT tokens.
- **Stripe payments:** I can pay for events through Stripe checkout, receive tickets automatically, and rely on webhooks to keep everything in sync.
- **Limitations:** I cannot see drafts, dashboards, or manage other users or events.

---

## 4. Team Admin & Event Manager

- **Onboarding**: I can register either as a regular user or as an event organiser—creating my own team with a name and description to gain the team-admin role.
- **Team dashboard**: I can view my team’s members, see all my draft and published events in one place, and manage event details (capacity, price, location, etc.).
- **Manage team members**: I can add, invite, remove team members and assign them roles (team_admin, event_manager, member).
- **Event lifecycle**: I can create, update or delete any events owned by my team, draft them first if I like, and later publish them live.
- **View registrations**: I can see who’s signed up for each event.
- **Export & waiting-list**: I can export registration lists and manage waiting lists.
- **Ticketing & check-in**: I can issue tickets to registered users, verify tickets at event check-in, cancel or update ticket status, and track attendance.
- **Restrictions**: I cannot touch another team’s drafts or events, nor can I access the site-wide admin dashboard.

---

## Team Members

- **View teams**: I can see which teams I belong to.
- **View members**: I can view other members of my teams.
- **View team events**: I can browse and see details of events organised by my teams.

---

## 6. Site Admin

- **Full visibility**: I can see and manage every user, team, and event in the system.
- **Event & user control**: I can add, edit or remove any event or user profile, promote users to admin, and use a dedicated admin dashboard to oversee it all.
- **Team management**: I can manage all teams (create, edit, delete) and assign users to them.
- **System analytics**: I can access system-wide analytics and reporting.
- **Roles & permissions**: I can assign system roles, manage permissions, and configure access controls.
