#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = (process.env.MENGLI_SERVER || "http://127.0.0.1:8890").replace(/\/$/, "");
const POLL_SECONDS = Math.max(2, Number(process.env.MENGLI_WORKER_POLL_SECONDS || 5));
const ONCE = process.argv.includes("--once");
const RUNNER = path.join(__dirname, "run-pgy-task.mjs");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function api(pathname, options = {}) {
  const resp = await fetch(`${SERVER}${pathname}`, {
    ...options,
    headers: {"Content-Type": "application/json", ...(options.headers || {})}
  });
  const text = await resp.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    throw new Error(`${SERVER}${pathname} 返回的不是智能媒体库 JSON，请检查 MENGLI_SERVER`);
  }
  if (!resp.ok) throw new Error(data.detail || data.error || `HTTP ${resp.status}`);
  return data;
}

async function healthCheck() {
  const data = await api("/api/health");
  if (!data.ok) throw new Error("智能媒体库后端健康检查失败");
  console.log(`[worker] 已连接媒体库后端：${SERVER}`);
}

async function nextQueuedTask() {
  const data = await api("/api/codex-tasks/claim-next", {method: "POST"});
  return data.task || null;
}

function runTask(taskId) {
  return new Promise((resolve) => {
    console.log(`[worker] 接收任务：${taskId}`);
    const child = spawn(process.execPath, [RUNNER, taskId], {
      cwd: path.dirname(path.dirname(__dirname)),
      env: {...process.env, MENGLI_SERVER: SERVER},
      stdio: "inherit"
    });
    child.on("exit", code => {
      console.log(`[worker] 任务 ${taskId} 结束，退出码 ${code}`);
      resolve(code || 0);
    });
  });
}

async function main() {
  await healthCheck();
  console.log(`[worker] 开始轮询蒲公英找号任务，每 ${POLL_SECONDS} 秒检查一次。`);
  while (true) {
    try {
      const task = await nextQueuedTask();
      if (task?.id) {
        await runTask(task.id);
      } else if (ONCE) {
        console.log("[worker] 没有 queued 任务，退出。");
        return;
      } else {
        process.stdout.write(".");
        await sleep(POLL_SECONDS * 1000);
      }
    } catch (err) {
      console.error(`\n[worker] ${err.message || err}`);
      if (ONCE) process.exit(1);
      await sleep(Math.max(POLL_SECONDS, 10) * 1000);
    }
  }
}

main().catch(err => {
  console.error(`[worker] 启动失败：${err.message || err}`);
  process.exit(1);
});
