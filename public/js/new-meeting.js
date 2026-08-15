import { requireAuth } from "./auth-guard.js";

await requireAuth();

const form = document.getElementById("meeting-form");
const analyzeBtn = document.getElementById("analyze-btn");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const resultEl = document.getElementById("result");
const summaryTextEl = document.getElementById("summary-text");
const decisionsListEl = document.getElementById("decisions-list");
const todosBodyEl = document.getElementById("todos-body");
const saveTodosBtn = document.getElementById("save-todos-btn");
const saveMsgEl = document.getElementById("save-msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value.trim();
  const participants = document.getElementById("participants").value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const rawText = document.getElementById("raw-text").value.trim();

  if (!rawText) return;

  errorEl.classList.add("hidden");
  resultEl.classList.add("hidden");
  loadingEl.classList.remove("hidden");
  analyzeBtn.disabled = true;

  try {
    const response = await fetch("/api/analyzeMeeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        participants,
        raw_text: rawText,
      }),
    });

    if (!response.ok) {
      throw new Error(`サーバーエラー (${response.status})`);
    }

    const data = await response.json();
    renderResult(data);
  } catch (err) {
    errorEl.textContent = `解析に失敗しました: ${err.message}`;
    errorEl.classList.remove("hidden");
  } finally {
    loadingEl.classList.add("hidden");
    analyzeBtn.disabled = false;
  }
});

function renderResult(data) {
  summaryTextEl.textContent = data.summary || "";

  decisionsListEl.innerHTML = "";
  (data.decisions || []).forEach((d) => {
    const li = document.createElement("li");
    li.textContent = d;
    decisionsListEl.appendChild(li);
  });

  todosBodyEl.innerHTML = "";
  (data.todos || []).forEach((todo) => {
    const tr = document.createElement("tr");
    tr.dataset.id = todo.id;

    const contentTd = document.createElement("td");
    const contentInput = document.createElement("input");
    contentInput.type = "text";
    contentInput.className = "todo-content";
    contentInput.value = todo.content || "";
    contentTd.appendChild(contentInput);

    const assigneeTd = document.createElement("td");
    const assigneeInput = document.createElement("input");
    assigneeInput.type = "text";
    assigneeInput.className = "todo-assignee";
    assigneeInput.value = todo.assignee || "";
    assigneeTd.appendChild(assigneeInput);

    const dueTd = document.createElement("td");
    const dueInput = document.createElement("input");
    dueInput.type = "date";
    dueInput.className = "todo-due";
    dueInput.value = todo.due_date || "";
    dueTd.appendChild(dueInput);

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
      } finally {
        deleteBtn.disabled = false;
      }
    });
    actionTd.appendChild(deleteBtn);

    tr.append(contentTd, assigneeTd, dueTd, actionTd);
    todosBodyEl.appendChild(tr);
  });

  resultEl.classList.remove("hidden");
  saveMsgEl.classList.add("hidden");
}

saveTodosBtn.addEventListener("click", async () => {
  const rows = [...todosBodyEl.querySelectorAll("tr")];
  const todos = rows.map((tr) => ({
    id: tr.dataset.id,
    content: tr.querySelector(".todo-content").value.trim(),
    assignee: tr.querySelector(".todo-assignee").value.trim(),
    due_date: tr.querySelector(".todo-due").value || null,
  }));

  saveTodosBtn.disabled = true;
  try {
    const response = await fetch("/api/todos/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todos }),
    });
    if (!response.ok) {
      throw new Error(`サーバーエラー (${response.status})`);
    }
    saveMsgEl.classList.remove("hidden");
  } catch (err) {
    errorEl.textContent = `保存に失敗しました: ${err.message}`;
    errorEl.classList.remove("hidden");
  } finally {
    saveTodosBtn.disabled = false;
  }
});
