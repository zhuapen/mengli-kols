"""
萌力互动 · Worker 执行机
只做3件事：轮询任务、执行任务、回传结果
"""
import os
import sys
import json
import time
import uuid
import requests
from datetime import datetime

# 配置
API_BASE = os.getenv("MENGLI_API_BASE", "https://api.mengliai.cn")
WORKER_ID = os.getenv("WORKER_ID", f"worker-{uuid.uuid4().hex[:8]}")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))  # 轮询间隔（秒）
TASK_TYPES = os.getenv("TASK_TYPES", "").split(",")  # 支持的任务类型

class Worker:
    def __init__(self):
        self.worker_id = WORKER_ID
        self.api_base = API_BASE
        self.running = True
        print(f"[worker] 启动 Worker: {self.worker_id}")
        print(f"[worker] API 地址: {self.api_base}")
        print(f"[worker] 轮询间隔: {POLL_INTERVAL}秒")
        print(f"[worker] 支持的任务类型: {TASK_TYPES or '所有'}")

    def heartbeat(self):
        """发送心跳"""
        try:
            requests.post(
                f"{self.api_base}/tasks/worker/heartbeat",
                json={
                    "worker_id": self.worker_id,
                    "status": "online",
                    "capabilities": TASK_TYPES
                },
                timeout=10
            )
        except Exception as e:
            print(f"[worker] 心跳失败: {e}")

    def get_next_task(self):
        """获取下一个任务"""
        try:
            params = {"worker_id": self.worker_id}
            if TASK_TYPES and TASK_TYPES[0]:
                params["type"] = TASK_TYPES[0]

            resp = requests.get(
                f"{self.api_base}/tasks/worker/next",
                params=params,
                timeout=10
            )
            data = resp.json()

            if data.get("code") == 0 and data.get("data"):
                return data["data"]
            return None
        except Exception as e:
            print(f"[worker] 获取任务失败: {e}")
            return None

    def execute_task(self, task):
        """执行任务"""
        task_id = task["id"]
        task_type = task["type"]
        payload = task.get("payload", {})

        print(f"[worker] 执行任务: {task_id} (类型: {task_type})")

        try:
            # 根据任务类型分发
            if task_type == "pgy_collect":
                result = self.execute_pgy_collect(payload)
            elif task_type == "brief_intelligence":
                result = self.execute_brief_intelligence(payload)
            elif task_type == "kol_analysis":
                result = self.execute_kol_analysis(payload)
            else:
                result = {"error": f"未知任务类型: {task_type}"}

            return result
        except Exception as e:
            print(f"[worker] 执行任务失败: {e}")
            return {"error": str(e)}

    def execute_pgy_collect(self, payload):
        """执行蒲公英采集"""
        print(f"[worker] 执行蒲公英采集: {payload}")
        # TODO: 调用 run-pgy-task.mjs
        return {"status": "completed", "message": "蒲公英采集完成"}

    def execute_brief_intelligence(self, payload):
        """执行 Brief 分析"""
        print(f"[worker] 执行 Brief 分析: {payload}")
        # TODO: 调用 AI 分析
        return {"status": "completed", "message": "Brief 分析完成"}

    def execute_kol_analysis(self, payload):
        """执行 KOL 分析"""
        print(f"[worker] 执行 KOL 分析: {payload}")
        # TODO: 调用分析逻辑
        return {"status": "completed", "message": "KOL 分析完成"}

    def submit_result(self, task_id, result):
        """提交任务结果"""
        try:
            error = result.get("error")
            resp = requests.post(
                f"{self.api_base}/tasks/{task_id}/result",
                json={
                    "worker_id": self.worker_id,
                    "result": result if not error else None,
                    "error": error
                },
                timeout=10
            )
            data = resp.json()
            if data.get("code") == 0:
                print(f"[worker] 任务 {task_id} 结果已提交")
            else:
                print(f"[worker] 提交结果失败: {data.get('msg')}")
        except Exception as e:
            print(f"[worker] 提交结果失败: {e}")

    def run(self):
        """主循环"""
        print(f"[worker] 开始运行...")
        heartbeat_counter = 0

        while self.running:
            try:
                # 每 60 秒发送一次心跳
                heartbeat_counter += 1
                if heartbeat_counter >= 60 // POLL_INTERVAL:
                    self.heartbeat()
                    heartbeat_counter = 0

                # 获取下一个任务
                task = self.get_next_task()

                if task:
                    # 执行任务
                    result = self.execute_task(task)
                    # 提交结果
                    self.submit_result(task["id"], result)
                else:
                    # 没有任务，等待
                    time.sleep(POLL_INTERVAL)

            except KeyboardInterrupt:
                print("\n[worker] 收到停止信号，正在退出...")
                self.running = False
            except Exception as e:
                print(f"[worker] 主循环错误: {e}")
                time.sleep(POLL_INTERVAL)

        print(f"[worker] Worker 已停止")


if __name__ == "__main__":
    worker = Worker()
    worker.run()
