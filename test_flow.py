#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
养老陪护平台 - 完整业务流程测试脚本

运行依赖:
- Python 3.7+
- requests 库 (安装: pip install requests)

运行前确保:
1. Docker 服务已启动
2. 项目容器已运行 (docker compose up -d)
3. 后端服务在 http://localhost:3232 可访问

测试流程:
1. child1 (家属) 登录
2. 查询 child1 的老人档案列表，获取第一个老人 ID
3. child1 发布护理需求
4. worker1 (护工) 登录
5. worker1 接单
6. worker1 开始服务
7. worker1 完成服务
8. child1 评价服务
"""

import requests
import json
import base64
import time

BASE_URL = "http://localhost:3232/api"


def login(username, password):
    """用户登录，返回用户信息字典"""
    url = f"{BASE_URL}/auth/login"
    data = {"username": username, "password": password}
    response = requests.post(url, json=data)
    result = response.json()
    if "token" in result:
        token = result["token"]
        payload = json.loads(base64.b64decode(token.split('.')[1] + '=='))
        user_info = {
            "token": token,
            "id": payload["id"],
            "role": payload["role"],
            "username": payload["username"]
        }
        print(f"✓ {username} 登录成功, ID: {user_info['id']}")
        return user_info
    else:
        print(f"✗ {username} 登录失败: {result}")
        return None


def get_headers(token):
    """构造请求头"""
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def get_elderly_profiles(token):
    """查询用户的老人档案列表"""
    url = f"{BASE_URL}/elderly"
    response = requests.get(url, headers=get_headers(token))
    result = response.json()
    if isinstance(result, list):
        print(f"✓ 查询到 {len(result)} 条老人档案")
        for idx, elderly in enumerate(result):
            print(f"  [{idx}] {elderly.get('name', '未知')} (ID: {elderly.get('id')})")
        return result
    else:
        print(f"✗ 查询老人档案失败: {result}")
        return []


def create_care_need(token, elderly_id):
    """发布护理需求"""
    url = f"{BASE_URL}/care-needs"
    data = {
        "elderly_id": elderly_id,
        "title": "日常护理需求",
        "description": "需要专业护工进行日常照料，包括帮助穿衣、洗漱、做饭等",
        "care_type": "daily_care",
        "start_time": "2025-06-18 09:00:00",
        "address": "北京市朝阳区某某小区1号楼"
    }
    response = requests.post(url, headers=get_headers(token), json=data)
    result = response.json()
    if "need" in result:
        need_id = result["need"]["id"]
        print(f"✓ 发布需求成功，需求ID: {need_id}")
        return need_id
    else:
        print(f"✗ 发布需求失败: {result}")
        return None


def accept_order(token, need_id):
    """护工接单"""
    url = f"{BASE_URL}/care-needs/{need_id}/accept"
    response = requests.post(url, headers=get_headers(token))
    result = response.json()
    if "need" in result:
        print(f"✓ 接单成功，需求ID: {need_id}")
        return True
    else:
        print(f"✗ 接单失败: {result}")
        return False


def start_service(token, need_id):
    """开始服务"""
    url = f"{BASE_URL}/care-needs/{need_id}/start"
    response = requests.post(url, headers=get_headers(token))
    result = response.json()
    if "need" in result:
        print(f"✓ 开始服务成功，需求ID: {need_id}")
        return True
    else:
        print(f"✗ 开始服务失败: {result}")
        return False


def complete_service(token, need_id):
    """完成服务"""
    url = f"{BASE_URL}/care-needs/{need_id}/complete"
    response = requests.post(url, headers=get_headers(token))
    result = response.json()
    if "need" in result:
        print(f"✓ 完成服务成功，需求ID: {need_id}")
        return True
    else:
        print(f"✗ 完成服务失败: {result}")
        return False


def create_review(token, need_id, worker_id):
    """评价服务"""
    url = f"{BASE_URL}/reviews"
    data = {
        "order_id": need_id,
        "reviewee_id": worker_id,
        "rating": 5,
        "comment": "服务非常好，护工很专业也很有耐心"
    }
    response = requests.post(url, headers=get_headers(token), json=data)
    result = response.json()
    if "review" in result:
        print(f"✓ 评价成功，评价ID: {result['review']['id']}")
        return True
    else:
        print(f"✗ 评价失败: {result}")
        return False


def main():
    print("=" * 60)
    print("养老陪护平台 - 完整业务流程测试")
    print("=" * 60)

    print("\n" + "-" * 60)
    print("步骤0: 用户登录")
    print("-" * 60)

    child1 = login("child1", "123456")
    if not child1:
        return

    worker1 = login("worker1", "123456")
    if not worker1:
        return

    print("\n" + "-" * 60)
    print("步骤1: 查询 child1 的老人档案")
    print("-" * 60)

    elderly_list = get_elderly_profiles(child1["token"])
    if not elderly_list:
        print("✗ 没有可用的老人档案，无法继续测试")
        return

    elderly_id = elderly_list[0]["id"]
    elderly_name = elderly_list[0].get("name", "未知")
    print(f"  使用老人档案: {elderly_name} (ID: {elderly_id})")

    print("\n" + "-" * 60)
    print("步骤2: child1 发布护理需求")
    print("-" * 60)

    need_id = create_care_need(child1["token"], elderly_id)
    if not need_id:
        return

    time.sleep(1)

    print("\n" + "-" * 60)
    print("步骤3: worker1 接单")
    print("-" * 60)

    if not accept_order(worker1["token"], need_id):
        return

    time.sleep(1)

    print("\n" + "-" * 60)
    print("步骤4: worker1 开始服务")
    print("-" * 60)

    if not start_service(worker1["token"], need_id):
        return

    time.sleep(1)

    print("\n" + "-" * 60)
    print("步骤5: worker1 完成服务")
    print("-" * 60)

    if not complete_service(worker1["token"], need_id):
        return

    time.sleep(1)

    print("\n" + "-" * 60)
    print("步骤6: child1 评价服务")
    print("-" * 60)

    if not create_review(child1["token"], need_id, worker1["id"]):
        return

    print("\n" + "=" * 60)
    print("✓ 整个业务流程测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
