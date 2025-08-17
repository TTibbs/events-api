# Event Image File Upload Feature

This feature allows events to have images uploaded as files in addition to URLs. The system supports both file uploads and URL inputs for event images.

## Features

- **File Upload Support**: Upload image files directly to the server
- **URL Support**: Continue using external image URLs
- **File Validation**: Only image files (JPEG, PNG, GIF, WebP) are allowed
- **File Size Limit**: Maximum 5MB per image
- **Automatic Cleanup**: Old image files are automatically deleted when updated or when events are deleted
- **Unique Filenames**: Generated with timestamps to prevent conflicts

## API Usage

### Creating an Event with File Upload

**POST** `/api/events`

```javascript
// Using multipart/form-data
const formData = new FormData();
formData.append("title", "My Event");
formData.append("description", "Event description");
formData.append("location", "Event location");
formData.append("start_time", "2025-12-01T10:00:00Z");
formData.append("end_time", "2025-12-01T18:00:00Z");
formData.append("max_attendees", "100");
formData.append("price", "25.0");
formData.append("category", "Conference");
formData.append("is_public", "true");
formData.append("event_image", imageFile); // File input

fetch("/api/events", {
  method: "POST",
  headers: {
    Authorization: "Bearer YOUR_TOKEN",
  },
  body: formData,
});
```

### Creating an Event with URL

**POST** `/api/events`

```javascript
// Using JSON
fetch("/api/events", {
  method: "POST",
  headers: {
    Authorization: "Bearer YOUR_TOKEN",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "My Event",
    description: "Event description",
    location: "Event location",
    start_time: "2025-12-01T10:00:00Z",
    end_time: "2025-12-01T18:00:00Z",
    max_attendees: 100,
    price: 25.0,
    category: "Conference",
    is_public: true,
    event_img_url: "https://example.com/image.jpg",
  }),
});
```

### Updating an Event with File Upload

**PATCH** `/api/events/:id`

```javascript
// Using multipart/form-data
const formData = new FormData();
formData.append("title", "Updated Event Title");
formData.append("event_image", newImageFile); // New file

fetch("/api/events/123", {
  method: "PATCH",
  headers: {
    Authorization: "Bearer YOUR_TOKEN",
  },
  body: formData,
});
```

### Updating an Event with URL

**PATCH** `/api/events/:id`

```javascript
// Using JSON
fetch("/api/events/123", {
  method: "PATCH",
  headers: {
    Authorization: "Bearer YOUR_TOKEN",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Updated Event Title",
    event_img_url: "https://example.com/new-image.jpg",
  }),
});
```

## File Storage

- **Upload Directory**: `uploads/event-images/`
- **File Naming**: `event-{timestamp}-{random}.{extension}`
- **URL Path**: `/uploads/event-images/{filename}`
- **Static Serving**: Files are served statically via Express

## File Validation

- **Allowed Types**: JPEG, JPG, PNG, GIF, WebP
- **Maximum Size**: 5MB
- **Error Response**: 400 Bad Request with descriptive message

## Automatic Cleanup

When an event is updated with a new image or deleted:

1. The system checks if the existing image is a file (not a URL)
2. If it's a file, it's automatically deleted from the server
3. This prevents orphaned files from accumulating

## Database Schema

The `event_img_url` field in the events table can store:

- `NULL` - No image
- URL string (e.g., `https://example.com/image.jpg`)
- File path (e.g., `/uploads/event-images/event-1234567890-123456789.jpg`)

## Security Considerations

- Only image files are allowed
- File size is limited to prevent abuse
- Files are stored outside the web root
- Unique filenames prevent path traversal attacks
- Authentication required for upload operations

## Error Handling

Common error responses:

```json
{
  "status": "error",
  "msg": "File too large. Maximum size is 5MB."
}
```

```json
{
  "status": "error",
  "msg": "Only image files are allowed (JPEG, PNG, GIF, WebP)"
}
```

## Testing

Run the file upload tests:

```bash
npm test -- fileUpload.test.ts
```

## Frontend Integration

For frontend applications, use `multipart/form-data` for file uploads:

```html
<form enctype="multipart/form-data">
  <input type="file" name="event_image" accept="image/*" />
  <!-- other form fields -->
</form>
```

Or with JavaScript:

```javascript
const fileInput = document.querySelector('input[type="file"]');
const formData = new FormData();

formData.append("event_image", fileInput.files[0]);
formData.append("title", "Event Title");
// ... other fields

fetch("/api/events", {
  method: "POST",
  headers: {
    Authorization: "Bearer YOUR_TOKEN",
  },
  body: formData,
});
```
