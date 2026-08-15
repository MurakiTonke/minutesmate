import { requireAuth } from "./auth-guard.js";

await requireAuth();

const todosBodyEl = document.getElementById("todos-body");
const emptyMsgEl = document.getElementById("empty-msg");

async function loadTodos() {
  const response = await fetch("/api/todos");
  const data = await response.json();
  renderTodos(data.todos || []);
}

function renderTodos(todos) {
  todosBodyEl.innerHTML = "";

  if (todos.length === 0) {
    emptyMsgEl.classList.remove("hidden");
    return;
  }
  emptyMsgEl.classList.add("hidden");

  todos.forEach((todo) => {
    const tr = document.createElement("tr");

    const doneTd = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!todo.is_done;
    checkbox.addEventListener("change", async () => {
      checkbox.disabled = true;
      try {
        await fetch(`/api/todos/${todo.id}/toggle`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_done: checkbox.checked }),
        });
      } finally {
        checkbox.disabled = false;
      }
    });
    doneTd.appendChild(checkbox);

    const contentTd = document.createElement("td");
    contentTd.textContent = todo.content || "";

    const assigneeTd = document.createElement("td");
    assigneeTd.textContent = todo.assignee || "";

    const dueTd = document.createElement("td");
    dueTd.textContent = todo.due_date || "未定";

    const actionTd = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "削除";
    deleteBtn.addEventListener("click", async () => {
      deleteBtn.disabled = true;
      try {
        await fetch(`/api/todos/${todo.id}`, { method: "DELETE" });
        tr.remove();
        if (!todosBodyEl.querySelector("tr")) {
          emptyMsgEl.classList.remove("hidden");
        }
      } finally {
        deleteBtn.disabled = false;
      }
    });
    actionTd.appendChild(deleteBtn);

    tr.append(doneTd, contentTd, assigneeTd, dueTd, actionTd);
    todosBodyEl.appendChild(tr);
  });
}

loadTodos();
