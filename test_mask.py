"""局部重绘 mask 支持测试脚本
用法：python3 test_mask.py
"""
import json, base64, io, os
from urllib.request import Request, urlopen

# 读取 API 配置
from dotenv import load_dotenv
load_dotenv()

IMG_KEY = os.environ.get("OPENAI_API_KEY", "")
IMG_URL = os.environ.get("OPENAI_BASE_URL", "https://ai.t8star.org/v1")
EDITS_URL = IMG_URL + "/images/edits"

def create_test_image():
    """创建一个简单的测试图：左边红色，右边蓝色，中间一个白圆"""
    try:
        from PIL import Image, ImageDraw
        img = Image.new('RGB', (512, 512), (255, 255, 255))
        draw = ImageDraw.Draw(img)
        # 左半边红色
        draw.rectangle([0, 0, 255, 512], fill=(220, 50, 50))
        # 右半边蓝色
        draw.rectangle([256, 0, 511, 512], fill=(50, 50, 220))
        # 中间白色圆
        draw.ellipse([180, 180, 332, 332], fill=(255, 255, 255))
        return img
    except ImportError:
        # 没有 PIL，用纯 bytes 构造一个最小 PNG
        # 简单的 2x2 红蓝棋盘格
        print("⚠️  未安装 Pillow，使用最小测试图")
        return None

def create_test_mask():
    """创建测试遮罩：只覆盖左半边（白色），右半边黑色"""
    try:
        from PIL import Image
        mask = Image.new('RGB', (512, 512), (0, 0, 0))
        # 左半边白色 = 要重绘的区域
        for x in range(256):
            for y in range(512):
                mask.putpixel((x, y), (255, 255, 255))
        return mask
    except ImportError:
        return None

def img_to_base64(img):
    """PIL Image 转 base64"""
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()

def test_mask_support():
    print("=" * 50)
    print("局部重绘 mask 支持测试")
    print("=" * 50)
    print(f"API: {EDITS_URL}")
    print(f"Model: gpt-image-2-all")
    print()

    # 创建测试图片和遮罩
    img = create_test_image()
    mask = create_test_mask()

    if not img or not mask:
        print("❌ 无法创建测试图片，请先安装 Pillow:")
        print("   pip3 install Pillow")
        return

    img_b64 = img_to_base64(img)
    mask_b64 = img_to_base64(mask)

    print(f"测试图片: 512x512 左红右蓝+白色圆")
    print(f"遮罩: 左半边白色(重绘)，右半边黑色(保持)")
    print(f"Prompt: '把遮罩区域改成绿色'")
    print()

    # 构造 multipart 请求
    boundary = "----TestBoundary123456"
    parts = []

    # image
    img_data = base64.b64decode(img_b64)
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + img_data)

    # mask
    mask_data = base64.b64decode(mask_b64)
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="mask"; filename="mask.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + mask_data)

    # prompt
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n把遮罩区域改成绿色'.encode())

    # model
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-image-2-all'.encode())

    # size
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n512x512'.encode())

    # n
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="n"\r\n\r\n1'.encode())

    body_bytes = b"\r\n".join(parts) + f"\r\n--{boundary}--\r\n".encode()

    req = Request(EDITS_URL, data=body_bytes, headers={
        "Authorization": f"Bearer {IMG_KEY}",
        "Content-Type": f"multipart/form-data; boundary={boundary}"
    })

    print("发送请求...")
    try:
        resp = urlopen(req, timeout=120)
        data = json.loads(resp.read())
        print()
        print("✅ API 响应成功!")
        print(f"响应数据: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")

        image_url = data.get("data", [{}])[0].get("url", "") if data.get("data") else data.get("url", "")
        if image_url:
            print(f"\n🖼  生成图片: {image_url}")
            print()
            print("=" * 50)
            print("验证方法：")
            print("1. 打开上面的图片链接")
            print("2. 如果左半边变绿 + 右半边保持红蓝 → mask 生效 ✅")
            print("3. 如果整个图都变了 → mask 被忽略 ❌")
            print("=" * 50)
        else:
            print("⚠️  响应中没有找到图片 URL")

    except Exception as e:
        print(f"\n❌ 请求失败: {e}")
        # 尝试读取错误响应
        if hasattr(e, 'read'):
            err_body = e.read().decode()
            print(f"错误详情: {err_body[:500]}")
        print()
        print("可能原因：")
        print("1. API 不支持 mask 参数")
        print("2. mask 格式不正确（可能需要透明 PNG 而不是黑白）")
        print("3. API Key 无效或额度不足")
        print("4. 网络问题")

if __name__ == "__main__":
    test_mask_support()
