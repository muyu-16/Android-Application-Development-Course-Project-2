"""
Qwen3-ASR WebSocket 服务器
桥接前端 record.vue (ws://127.0.0.1:8765/ws/transcribe) 到 Qwen3-ASR vLLM 后端。

启动方式:
  python asr_server.py --model Qwen/Qwen3-ASR-1.7B --port 8765

依赖:
  pip install qwen-asr[vllm] websockets numpy
"""

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

import numpy as np
import websockets
from websockets.asyncio.server import serve

# 将 asrsubmodules 加入 path，以便直接使用本地源码
REPO_ROOT = Path(__file__).resolve().parent
ASR_SUBMODULE = REPO_ROOT / "asrsubmodules"
if str(ASR_SUBMODULE) not in sys.path:
    sys.path.insert(0, str(ASR_SUBMODULE))

ASR_MODEL = None
ASR_ARGS = None


def load_model():
    """延迟加载 Qwen3-ASR 模型（vLLM 后端）。"""
    global ASR_MODEL
    if ASR_MODEL is not None:
        return

    from qwen_asr import Qwen3ASRModel

    print(f"[ASR] 正在加载模型: {ASR_ARGS.model}")
    ASR_MODEL = Qwen3ASRModel.LLM(
        model=ASR_ARGS.model,
        gpu_memory_utilization=ASR_ARGS.gpu_memory_utilization,
        max_new_tokens=ASR_ARGS.max_new_tokens,
    )
    print("[ASR] 模型加载完成，WebSocket 服务已就绪")


def int16_to_float32(int16_bytes: bytes) -> np.ndarray:
    """将前端发送的 Int16 PCM 字节转换为 Float32 [-1, 1] 数组。"""
    arr = np.frombuffer(int16_bytes, dtype=np.int16).astype(np.float32)
    arr /= 32768.0
    return arr


async def handle_transcribe(websocket):
    """处理单个 /ws/transcribe WebSocket 连接。"""
    load_model()

    # 初始化流式识别状态
    state = ASR_MODEL.init_streaming_state(
        unfixed_chunk_num=ASR_ARGS.unfixed_chunk_num,
        unfixed_token_num=ASR_ARGS.unfixed_token_num,
        chunk_size_sec=ASR_ARGS.chunk_size_sec,
    )

    print("[ASR] 新客户端连接，流式识别开始")
    last_text = ""

    try:
        async for message in websocket:
            if isinstance(message, str):
                # 文本消息 — 目前只处理 "stop"
                try:
                    msg = json.loads(message)
                    if msg.get("type") == "stop":
                        break
                except json.JSONDecodeError:
                    pass
                continue

            # 二进制消息 — Int16 PCM 数据
            if isinstance(message, bytes):
                if len(message) < 3200:  # < 0.1s @16kHz, 跳过太短的块
                    continue

                wav = int16_to_float32(message)
                ASR_MODEL.streaming_transcribe(wav, state)

                current_text = getattr(state, "text", "") or ""
                language = getattr(state, "language", "") or ""

                if current_text != last_text:
                    await websocket.send(json.dumps({
                        "type": "interim",
                        "text": current_text,
                        "language": language,
                    }, ensure_ascii=False))
                    last_text = current_text

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        # 结束流式识别，发送最终结果
        try:
            ASR_MODEL.finish_streaming_transcribe(state)
        except Exception:
            pass

        final_text = getattr(state, "text", "") or ""
        language = getattr(state, "language", "") or ""

        if final_text:
            await websocket.send(json.dumps({
                "type": "final",
                "text": final_text,
                "language": language,
            }, ensure_ascii=False))
        else:
            await websocket.send(json.dumps({
                "type": "final",
                "text": last_text or "",
                "language": language,
            }, ensure_ascii=False))

        print(f"[ASR] 客户端断开，最终文本: {final_text or last_text}")


async def handle_health(websocket):
    """健康检查端点。"""
    await websocket.send(json.dumps({"status": "ok", "model": ASR_ARGS.model}))
    await websocket.close()


async def router(websocket):
    """按路径路由 WebSocket 连接。"""
    path = websocket.request.path if hasattr(websocket, "request") else "/"
    if path == "/ws/transcribe":
        await handle_transcribe(websocket)
    elif path == "/ws/health":
        await handle_health(websocket)
    else:
        await websocket.close(1008, "Unknown path")


def parse_args():
    p = argparse.ArgumentParser(description="Qwen3-ASR WebSocket Server")
    p.add_argument("--model", default="Qwen/Qwen3-ASR-1.7B",
                   help="模型名称或本地路径 (默认: Qwen/Qwen3-ASR-1.7B)")
    p.add_argument("--host", default="127.0.0.1", help="绑定地址 (默认: 127.0.0.1)")
    p.add_argument("--port", type=int, default=8765, help="绑定端口 (默认: 8765)")
    p.add_argument("--gpu-memory-utilization", type=float, default=0.8,
                   help="vLLM GPU 内存利用率 (默认: 0.8)")
    p.add_argument("--max-new-tokens", type=int, default=64,
                   help="单次推理最大 token 数 (默认: 64)")
    p.add_argument("--unfixed-chunk-num", type=int, default=4,
                   help="流式未固定块数 (默认: 4)")
    p.add_argument("--unfixed-token-num", type=int, default=5,
                   help="流式未固定 token 数 (默认: 5)")
    p.add_argument("--chunk-size-sec", type=float, default=1.0,
                   help="流式块大小/秒 (默认: 1.0)")
    return p.parse_args()


async def main():
    global ASR_ARGS
    ASR_ARGS = parse_args()

    print(f"[ASR] WebSocket 服务启动: ws://{ASR_ARGS.host}:{ASR_ARGS.port}/ws/transcribe")
    print(f"[ASR] 模型: {ASR_ARGS.model}")

    async with serve(router, ASR_ARGS.host, ASR_ARGS.port) as server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())