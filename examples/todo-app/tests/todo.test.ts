import { describe, test, expect, beforeEach } from "bun:test";
import {
  createStore,
  addTodo,
  getTodo,
  listTodos,
  listActiveTodos,
  listCompletedTodos,
  completeTodo,
  uncompleteTodo,
  updateTodoTitle,
  deleteTodo,
  clearCompleted,
  getStats,
  type TodoStore,
} from "../src/todo";

describe("Todo CRUD operations", () => {
  let store: TodoStore;

  beforeEach(() => {
    store = createStore();
  });

  test("addTodo creates a new todo", () => {
    const todo = addTodo(store, "Buy groceries");

    expect(todo.title).toBe("Buy groceriess");
    expect(todo.completed).toBe(false);
    expect(todo.id).toBeDefined();
    expect(todo.createdAt).toBeInstanceOf(Date);
  });

  test("addTodo trims whitespace from title", () => {
    const todo = addTodo(store, "  Buy groceries  ");

    expect(todo.title).toBe("Buy groceries");
  });

  test("addTodo throws on empty title", () => {
    expect(() => addTodo(store, "")).toThrow("Title cannot be empty");
    expect(() => addTodo(store, "   ")).toThrow("Title cannot be empty");
  });

  test("getTodo retrieves a todo by id", () => {
    const created = addTodo(store, "Test todo");
    const retrieved = getTodo(store, created.id);

    expect(retrieved).toEqual(created);
  });

  test("getTodo returns undefined for non-existent id", () => {
    const result = getTodo(store, "nonexistent");

    expect(result).toBeUndefined();
  });

  test("listTodos returns all todos", () => {
    addTodo(store, "Todo 1");
    addTodo(store, "Todo 2");
    addTodo(store, "Todo 3");

    const todos = listTodos(store);

    expect(todos).toHaveLength(3);
  });

  test("deleteTodo removes a todo", () => {
    const todo = addTodo(store, "To delete");
    const deleted = deleteTodo(store, todo.id);

    expect(deleted).toBe(true);
    expect(getTodo(store, todo.id)).toBeUndefined();
  });

  test("deleteTodo returns false for non-existent id", () => {
    const result = deleteTodo(store, "nonexistent");

    expect(result).toBe(false);
  });
});

describe("Todo completion", () => {
  let store: TodoStore;

  beforeEach(() => {
    store = createStore();
  });

  test("completeTodo marks todo as completed", () => {
    const todo = addTodo(store, "Complete me");
    const completed = completeTodo(store, todo.id);

    expect(completed.completed).toBe(true);
    expect(completed.completedAt).toBeInstanceOf(Date);
  });

  test("completeTodo is idempotent", () => {
    const todo = addTodo(store, "Complete me");
    completeTodo(store, todo.id);
    const secondComplete = completeTodo(store, todo.id);

    expect(secondComplete.completed).toBe(true);
  });

  test("completeTodo throws for non-existent todo", () => {
    expect(() => completeTodo(store, "nonexistent")).toThrow("Todo not found");
  });

  test("uncompleteTodo marks todo as not completed", () => {
    const todo = addTodo(store, "Uncomplete me");
    completeTodo(store, todo.id);
    const uncompleted = uncompleteTodo(store, todo.id);

    expect(uncompleted.completed).toBe(false);
    expect(uncompleted.completedAt).toBeUndefined();
  });

  test("uncompleteTodo throws for non-existent todo", () => {
    expect(() => uncompleteTodo(store, "nonexistent")).toThrow("Todo not found");
  });

  test("listActiveTodos returns only active todos", () => {
    const todo1 = addTodo(store, "Active 1");
    const todo2 = addTodo(store, "Active 2");
    addTodo(store, "Completed");
    completeTodo(store, todo1.id);

    const active = listActiveTodos(store);

    expect(active).toHaveLength(2);
    expect(active.find((t) => t.id === todo2.id)).toBeDefined();
  });

  test("listCompletedTodos returns only completed todos", () => {
    const todo1 = addTodo(store, "To complete");
    addTodo(store, "Active");
    completeTodo(store, todo1.id);

    const completed = listCompletedTodos(store);

    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe(todo1.id);
  });
});

describe("Todo updates", () => {
  let store: TodoStore;

  beforeEach(() => {
    store = createStore();
  });

  test("updateTodoTitle changes the title", () => {
    const todo = addTodo(store, "Original title");
    const updated = updateTodoTitle(store, todo.id, "New title");

    expect(updated.title).toBe("New title");
  });

  test("updateTodoTitle trims whitespace", () => {
    const todo = addTodo(store, "Original");
    const updated = updateTodoTitle(store, todo.id, "  New title  ");

    expect(updated.title).toBe("New title");
  });

  test("updateTodoTitle throws on empty title", () => {
    const todo = addTodo(store, "Original");

    expect(() => updateTodoTitle(store, todo.id, "")).toThrow("Title cannot be empty");
  });

  test("updateTodoTitle throws for non-existent todo", () => {
    expect(() => updateTodoTitle(store, "nonexistent", "New")).toThrow("Todo not found");
  });
});

describe("Bulk operations", () => {
  let store: TodoStore;

  beforeEach(() => {
    store = createStore();
  });

  test("clearCompleted removes all completed todos", () => {
    const todo1 = addTodo(store, "Completed 1");
    const todo2 = addTodo(store, "Completed 2");
    addTodo(store, "Active");
    completeTodo(store, todo1.id);
    completeTodo(store, todo2.id);

    const count = clearCompleted(store);

    expect(count).toBe(2);
    expect(listTodos(store)).toHaveLength(1);
  });

  test("clearCompleted returns 0 when no completed todos", () => {
    addTodo(store, "Active 1");
    addTodo(store, "Active 2");

    const count = clearCompleted(store);

    expect(count).toBe(0);
  });
});

describe("Statistics", () => {
  let store: TodoStore;

  beforeEach(() => {
    store = createStore();
  });

  test("getStats returns correct counts", () => {
    addTodo(store, "Active 1");
    addTodo(store, "Active 2");
    const todo3 = addTodo(store, "Completed");
    completeTodo(store, todo3.id);

    const stats = getStats(store);

    expect(stats.total).toBe(3);
    expect(stats.active).toBe(2);
    expect(stats.completed).toBe(1);
  });

  test("getStats returns zeros for empty store", () => {
    const stats = getStats(store);

    expect(stats.total).toBe(0);
    expect(stats.active).toBe(0);
    expect(stats.completed).toBe(0);
  });
});
