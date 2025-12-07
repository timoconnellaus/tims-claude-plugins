export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
}

export interface TodoStore {
  todos: Map<string, Todo>;
}

export function createStore(): TodoStore {
  return { todos: new Map() };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function addTodo(store: TodoStore, title: string): Todo {
  if (!title.trim()) {
    throw new Error("Title cannot be empty");
  }

  const todo: Todo = {
    id: generateId(),
    title: title.trim(),
    completed: false,
    createdAt: new Date(),
  };

  store.todos.set(todo.id, todo);
  return todo;
}

export function getTodo(store: TodoStore, id: string): Todo | undefined {
  return store.todos.get(id);
}

export function listTodos(store: TodoStore): Todo[] {
  return Array.from(store.todos.values());
}

export function listActiveTodos(store: TodoStore): Todo[] {
  return listTodos(store).filter((t) => !t.completed);
}

export function listCompletedTodos(store: TodoStore): Todo[] {
  return listTodos(store).filter((t) => t.completed);
}

export function completeTodo(store: TodoStore, id: string): Todo {
  const todo = store.todos.get(id);
  if (!todo) {
    throw new Error(`Todo not found: ${id}`);
  }

  if (todo.completed) {
    return todo;
  }

  todo.completed = true;
  todo.completedAt = new Date();
  return todo;
}

export function uncompleteTodo(store: TodoStore, id: string): Todo {
  const todo = store.todos.get(id);
  if (!todo) {
    throw new Error(`Todo not found: ${id}`);
  }

  todo.completed = false;
  todo.completedAt = undefined;
  return todo;
}

export function updateTodoTitle(store: TodoStore, id: string, title: string): Todo {
  const todo = store.todos.get(id);
  if (!todo) {
    throw new Error(`Todo not found: ${id}`);
  }

  if (!title.trim()) {
    throw new Error("Title cannot be empty");
  }

  todo.title = title.trim();
  return todo;
}

export function deleteTodo(store: TodoStore, id: string): boolean {
  return store.todos.delete(id);
}

export function clearCompleted(store: TodoStore): number {
  let count = 0;
  for (const [id, todo] of store.todos) {
    if (todo.completed) {
      store.todos.delete(id);
      count++;
    }
  }
  return count;
}

export function getStats(store: TodoStore): { total: number; active: number; completed: number } {
  const todos = listTodos(store);
  const completed = todos.filter((t) => t.completed).length;
  return {
    total: todos.length,
    active: todos.length - completed,
    completed,
  };
}
