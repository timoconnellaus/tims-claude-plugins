---
topic: tanstack-db/guides/schemas/full-context-examples
title: Schema Validation and Type Transformations - Full-Context Examples
description: Full-Context Examples section of Schema Validation and Type Transformations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/schemas.md
tags:
  - tanstack-db
  - guides
---

# Full-Context Examples

### Example 1: Todo App with Rich Types

A complete todo application demonstrating validation, transformations, and defaults:

```typescript
import { z } from 'zod'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

// Schema with validation, transformations, and defaults
const todoSchema = z.object({
  id: z.string(),
  text: z.string().min(1, "Todo text cannot be empty"),
  completed: z.boolean().default(false),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  due_date: z.union([
    z.string(),
    z.date()
  ]).transform(val => typeof val === 'string' ? new Date(val) : val).optional(),
  created_at: z.union([
    z.string(),
    z.date()
  ]).transform(val => typeof val === 'string' ? new Date(val) : val)
    .default(() => new Date()),
  tags: z.array(z.string()).default([])
})

type Todo = z.infer<typeof todoSchema>

// Collection setup
const todoCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['todos'],
    queryFn: async () => {
      const response = await fetch('/api/todos')
      const todos = await response.json()
      // Reuse schema to parse and transform API responses
      return todos.map((todo: any) => todoSchema.parse(todo))
    },
    getKey: (item) => item.id,
    schema: todoSchema,
    queryClient,

    onInsert: async ({ transaction }) => {
      const todo = transaction.mutations[0].modified

      // Serialize dates for API
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...todo,
          due_date: todo.due_date?.toISOString(),
          created_at: todo.created_at.toISOString()
        })
      })
    },

    onUpdate: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map(async (mutation) => {
          const { original, changes } = mutation

          // Serialize any date fields in changes
          const serialized = {
            ...changes,
            due_date: changes.due_date instanceof Date
              ? changes.due_date.toISOString()
              : changes.due_date
          }

          await fetch(`/api/todos/${original.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serialized)
          })
        })
      )
    },

    onDelete: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map(async (mutation) => {
          await fetch(`/api/todos/${mutation.original.id}`, {
            method: 'DELETE'
          })
        })
      )
    }
  })
)

// Component usage
function TodoApp() {
  const { data: todos } = useLiveQuery(q =>
    q.from({ todo: todoCollection })
      .where(({ todo }) => !todo.completed)
      .orderBy(({ todo }) => todo.created_at, 'desc')
  )

  const [errors, setErrors] = useState<Record<string, string>>({})

  const addTodo = (text: string, priority: 'low' | 'medium' | 'high') => {
    try {
      todoCollection.insert({
        id: crypto.randomUUID(),
        text,
        priority,
        due_date: "2024-12-31T23:59:59Z"
        // completed, created_at, tags filled automatically by defaults
      })
      setErrors({})
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

  const toggleComplete = (todo: Todo) => {
    todoCollection.update(todo.id, (draft) => {
      draft.completed = !draft.completed
    })
  }

  return (
    <div>
      <h1>Todos</h1>

      {errors.text && <div className="error">{errors.text}</div>}

      <button onClick={() => addTodo("Buy groceries", "high")}>
        Add Todo
      </button>

      <ul>
        {todos?.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleComplete(todo)}
            />
            <span>{todo.text}</span>
            <span>Priority: {todo.priority}</span>
            {todo.due_date && (
              <span>Due: {todo.due_date.toLocaleDateString()}</span>
            )}
            <span>Created: {todo.created_at.toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Example 2: E-commerce Product with Computed Fields

```typescript
import { z } from 'zod'

// Schema with computed fields and transformations
const productSchema = z.object({
  id: z.string(),
  name: z.string().min(3, "Product name must be at least 3 characters"),
  description: z.string().max(500, "Description too long"),
  base_price: z.number().positive("Price must be positive"),
  tax_rate: z.number().min(0).max(1).default(0.1),
  discount_percent: z.number().min(0).max(100).default(0),
  stock: z.number().int().min(0).default(0),
  category: z.enum(['electronics', 'clothing', 'food', 'other']),
  tags: z.array(z.string()).default([]),
  created_at: z.union([z.string(), z.date()])
    .transform(val => typeof val === 'string' ? new Date(val) : val)
    .default(() => new Date())
}).transform(data => ({
  ...data,
  // Computed fields
  final_price: data.base_price * (1 + data.tax_rate) * (1 - data.discount_percent / 100),
  in_stock: data.stock > 0,
  display_price: `$${(data.base_price * (1 + data.tax_rate) * (1 - data.discount_percent / 100)).toFixed(2)}`
}))

type Product = z.infer<typeof productSchema>

const productCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['products'],
    queryFn: async () => api.products.getAll(),
    getKey: (item) => item.id,
    schema: productSchema,
    queryClient,

    onInsert: async ({ transaction }) => {
      const product = transaction.mutations[0].modified

      // API only needs base fields, not computed ones
      await api.products.create({
        name: product.name,
        description: product.description,
        base_price: product.base_price,
        tax_rate: product.tax_rate,
        discount_percent: product.discount_percent,
        stock: product.stock,
        category: product.category,
        tags: product.tags
      })
    }
  })
)

// Usage
function ProductList() {
  const { data: products } = useLiveQuery(q =>
    q.from({ product: productCollection })
      .where(({ product }) => product.in_stock)  // Use computed field
      .orderBy(({ product }) => product.final_price, 'asc')
  )

  const addProduct = () => {
    productCollection.insert({
      id: crypto.randomUUID(),
      name: "Wireless Mouse",
      description: "Ergonomic wireless mouse",
      base_price: 29.99,
      discount_percent: 10,
      category: "electronics",
      stock: 50
      // tax_rate, tags, created_at filled by defaults
      // final_price, in_stock, display_price computed automatically
    })
  }

  return (
    <div>
      {products?.map(product => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>{product.description}</p>
          <p>Price: {product.display_price}</p>
          <p>Stock: {product.in_stock ? `${product.stock} available` : 'Out of stock'}</p>
          <p>Category: {product.category}</p>
        </div>
      ))}
    </div>
  )
}
```

---