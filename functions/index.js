require("dotenv").config();

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const express = require("express");
const cors = require("cors");
const { analyzeWithRetry } = require("./llm/ollamaClient");

admin.initializeApp();
const db = getFirestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/analyzeMeeting", async (req, res) => {
  const { title, participants, raw_text } = req.body;
  const participantList = Array.isArray(participants) ? participants : [];

  if (!raw_text || !raw_text.trim()) {
    return res.status(400).json({ error: "raw_text is required" });
  }

  const result = await analyzeWithRetry(raw_text, participantList);

  const summary = result && result.summary
    ? result.summary
    : "自動生成に失敗しました。手動で入力してください";
  const decisions = result && Array.isArray(result.decisions) ? result.decisions : [];
  const todos = result && Array.isArray(result.todos) ? result.todos : [];

  const meetingRef = await db.collection("meetings").add({
    company_id: "demo",
    title: title || "無題の会議",
    held_at: FieldValue.serverTimestamp(),
    participants: participantList,
    raw_text,
    summary,
    created_at: FieldValue.serverTimestamp(),
  });

  const batch = db.batch();
  decisions.forEach((content) => {
    const ref = db.collection("decisions").doc();
    batch.set(ref, { meeting_id: meetingRef.id, content });
  });
  const todoRefs = todos.map((todo) => {
    const ref = db.collection("todos").doc();
    batch.set(ref, {
      meeting_id: meetingRef.id,
      company_id: "demo",
      content: todo.content || "",
      assignee: todo.assignee || "",
      due_date: todo.due_date || null,
      is_done: false,
    });
    return ref;
  });
  await batch.commit();

  res.json({
    meeting_id: meetingRef.id,
    summary,
    decisions,
    todos: todos.map((todo, i) => ({
      id: todoRefs[i].id,
      content: todo.content || "",
      assignee: todo.assignee || "",
      due_date: todo.due_date || null,
      is_done: false,
    })),
  });
});

app.get("/api/todos", async (req, res) => {
  const snapshot = await db
    .collection("todos")
    .where("company_id", "==", "demo")
    .get();

  const todos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  todos.sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  });

  res.json({ todos });
});

app.post("/api/todos/update", async (req, res) => {
  const { todos } = req.body;
  if (!Array.isArray(todos)) {
    return res.status(400).json({ error: "todos array is required" });
  }

  const batch = db.batch();
  todos.forEach((todo) => {
    if (!todo.id) return;
    const ref = db.collection("todos").doc(todo.id);
    batch.update(ref, {
      content: todo.content || "",
      assignee: todo.assignee || "",
      due_date: todo.due_date || null,
    });
  });
  await batch.commit();

  res.json({ status: "ok" });
});

app.patch("/api/todos/:id/toggle", async (req, res) => {
  const { id } = req.params;
  const { is_done } = req.body;

  await db.collection("todos").doc(id).update({ is_done: !!is_done });

  res.json({ status: "ok" });
});

app.delete("/api/todos/:id", async (req, res) => {
  const { id } = req.params;
  await db.collection("todos").doc(id).delete();
  res.json({ status: "ok" });
});

exports.api = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onRequest(app);
