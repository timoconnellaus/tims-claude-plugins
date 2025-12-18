---
topic: tanstack-db/guides/schemas/error-handling
title: Schema Validation and Type Transformations - Error Handling
description: Error Handling section of Schema Validation and Type Transformations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/schemas.md
tags:
  - tanstack-db
  - guides
---

# Error Handling

When validation fails, TanStack DB throws a `SchemaValidationError` with detailed information.

### Basic Error Handling

```typescript
import { SchemaValidationError } from '@tanstack/db'

try {
  collection.insert({
    id: "1",
    email: "not-an-email",
    age: -5
  })
} catch (error) {
  if (error instanceof SchemaValidationError) {
    console.log(error.type)     // 'insert' or 'update'
    console.log(error.message)  // "Validation failed with 2 issues"
    console.log(error.issues)   // Array of validation issues
  }
}
```

### Error Structure

```typescript
error.issues = [
  {
    path: ['email'],
    message: 'Invalid email address'
  },
  {
    path: ['age'],
    message: 'Number must be greater than 0'
  }
]
```

### Displaying Errors in UI

```typescript
const handleSubmit = async (data: unknown) => {
  try {
    collection.insert(data)
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      // Show errors by field
      error.issues.forEach(issue => {
        const fieldName = issue.path?.join('.') || 'unknown'
        showFieldError(fieldName, issue.message)
      })
    }
  }
}
```

### React Example

```tsx
import { SchemaValidationError } from '@tanstack/db'

function TodoForm() {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    try {
      todoCollection.insert({
        id: crypto.randomUUID(),
        text: e.currentTarget.text.value,
        priority: parseInt(e.currentTarget.priority.value)
      })
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        const newErrors: Record<string, string> = {}
        error.issues.forEach(issue => {
          const field = issue.path?.[0] || 'form'
          newErrors[field] = issue.message
        })
        setErrors(newErrors)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="text" />
      {errors.text && <span className="error">{errors.text}</span>}

      <input name="priority" type="number" />
      {errors.priority && <span className="error">{errors.priority}</span>}

      <button type="submit">Add Todo</button>
    </form>
  )
}
```

---