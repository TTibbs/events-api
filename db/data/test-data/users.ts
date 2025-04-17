import { User } from "../../../types";
import bcrypt from "bcryptjs";

// Hash the password "password123" for test users
const password = "password123";
const saltRounds = 10;
// Generate a hash synchronously since this is just for test data
const passwordHash = bcrypt.hashSync(password, saltRounds);

export const users: User[] = [
  {
    username: "alice123",
    email: "alice@example.com",
    password_hash: passwordHash,
    profile_image_url:
      "https://c5znixeqj7.ufs.sh/f/Jf9D0EOZjwR5r72WKKh4ScXJ607ewstvO3u2GfKimQM8hUFz",
    is_site_admin: false,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    username: "bob123",
    email: "bob@example.com",
    password_hash: passwordHash,
    profile_image_url:
      "https://c5znixeqj7.ufs.sh/f/Jf9D0EOZjwR5x2hfzLgRsYuVzfXgmwPDirIBZ8c5ytCG0pkb",
    is_site_admin: false,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    username: "charlie123",
    email: "charlie@example.com",
    password_hash: passwordHash,
    profile_image_url:
      "https://c5znixeqj7.ufs.sh/f/Jf9D0EOZjwR5r72WKKh4ScXJ607ewstvO3u2GfKimQM8hUFz",
    is_site_admin: false,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    username: "siteadmin",
    email: "siteadmin@example.com",
    password_hash: passwordHash,
    profile_image_url:
      "https://c5znixeqj7.ufs.sh/f/Jf9D0EOZjwR5UWpfohDWbPInw4yTAxkOL1dzBv3hRuFaQcem",
    is_site_admin: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    username: "regularuser",
    email: "regularuser@example.com",
    password_hash: passwordHash,
    profile_image_url:
      "https://c5znixeqj7.ufs.sh/f/Jf9D0EOZjwR5o4yVEePKrmSJEYfehPcDRGbTFjWVX7I041Up",
    is_site_admin: false,
    created_at: new Date(),
    updated_at: new Date(),
  },
];
