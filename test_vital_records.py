#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
上门量血压：记录留痕与异常跟进 业务流程测试

运行前确保服务已启动 (docker compose up -d)，后端在 http://localhost:3232 可访问。

覆盖验收点：
1. 护工未填测量记录不能完成订单
2. 完成订单前填写血压、心率、测量时间
3. 收缩压 >= 140 或舒张压 >= 90 标记异常并生成待跟进提醒
4. 重复提交只保留一条记录（UPSERT）
5. 家属首页关闭前一直显示待跟进提醒
6. 家属在老人档案查看健康时间线与异常原因
7. 家属写跟进结果后提醒关闭
8. 护工重进订单详情能看到同步记录
9. 正常血压不生成提醒
"""

import json
import base64
import requests

BASE_URL = "http://localhost:3232/api"

PASS = 0
FAIL = 0


def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        print(f"  ✗ {name} {detail}")


def login(username, password):
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": username, "password": password},
    )
    result = response.json()
    token = result.get("token")
    payload = json.loads(base64.b64decode(token.split('.')[1] + '=='))
    print(f"✓ {username} 登录成功, ID: {payload['id']}")
    return token


def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def create_health_order(child_token, elderly_id, title):
    response = requests.post(
        f"{BASE_URL}/care-needs",
        headers=headers(child_token),
        json={
            "elderly_id": elderly_id,
            "title": title,
            "description": "上门给老人量血压，记录数据",
            "care_type": "health_check",
            "start_time": "2026-10-01 09:00:00",
            "address": "北京市朝阳区幸福小区3号楼2单元501",
            "duration_hours": 1,
            "price": 80,
        },
    )
    return response.json()["need"]["id"]


def take_order(worker_token, order_id):
    """接单 -> 开始服务"""
    requests.post(f"{BASE_URL}/care-needs/{order_id}/accept", headers=headers(worker_token))
    requests.post(f"{BASE_URL}/care-needs/{order_id}/start", headers=headers(worker_token))


def main():
    print("=" * 64)
    print("上门量血压：记录留痕与异常跟进 测试")
    print("=" * 64)

    child_token = login("child1", "123456")
    worker_token = login("worker1", "123456")

    elderly = requests.get(f"{BASE_URL}/elderly", headers=headers(child_token)).json()
    elderly_id = elderly[0]["id"]

    # ---------- 场景一：异常血压（148/92）----------
    print("\n--- 场景一：异常血压订单 ---")
    order_id = create_health_order(child_token, elderly_id, "上门量血压-异常用例")
    take_order(worker_token, order_id)

    print("[1] 记录没填完，订单不能完成")
    r = requests.post(f"{BASE_URL}/care-needs/{order_id}/complete", headers=headers(worker_token))
    check("未填记录时完成订单被拒绝 (400)", r.status_code == 400, r.text)
    check("提示先填写测量记录", "测量" in r.json().get("message", ""), r.text)

    print("[2] 护工填写血压 148/92、心率 88、测量时间")
    vital = {"systolic": 148, "diastolic": 92, "heart_rate": 88,
             "measured_at": "2026-10-01 09:30:00"}
    r = requests.post(f"{BASE_URL}/care-needs/{order_id}/vital-record",
                      headers=headers(worker_token), json=vital)
    check("保存成功 (201)", r.status_code == 201, r.text)
    record = r.json()["record"]
    check("is_abnormal = true", record["is_abnormal"] is True, str(record))
    check("follow_up_status = pending", record["follow_up_status"] == "pending", str(record))
    check("异常原因包含收缩压/舒张压说明",
          "收缩压" in (record["abnormal_reason"] or "") and "舒张压" in (record["abnormal_reason"] or ""),
          str(record))

    print("[3] 重复提交（修改为 145/95）只留一条")
    vital2 = {"systolic": 145, "diastolic": 95, "heart_rate": 90,
              "measured_at": "2026-10-01 09:35:00"}
    r = requests.post(f"{BASE_URL}/care-needs/{order_id}/vital-record",
                      headers=headers(worker_token), json=vital2)
    updated = r.json()["record"]
    check("仍是同一条记录（ID 不变）", updated["id"] == record["id"], f"{updated['id']} vs {record['id']}")
    check("数值已更新为 145/95", updated["systolic"] == 145 and updated["diastolic"] == 95, str(updated))
    r = requests.get(f"{BASE_URL}/care-needs/{order_id}/vital-record", headers=headers(worker_token))
    check("按订单查询仅返回一条", r.json()["record"] is not None and r.json()["record"]["systolic"] == 145, r.text)

    print("[4] 填完后可以完成订单")
    r = requests.post(f"{BASE_URL}/care-needs/{order_id}/complete", headers=headers(worker_token))
    check("完成成功", r.status_code == 200, r.text)

    print("[5] 完成后不能再改测量记录")
    r = requests.post(f"{BASE_URL}/care-needs/{order_id}/vital-record",
                      headers=headers(worker_token), json=vital2)
    check("非进行中状态提交被拒绝 (400)", r.status_code == 400, r.text)

    print("[6] 护工重进订单详情能看到同步记录")
    r = requests.get(f"{BASE_URL}/care-needs/{order_id}", headers=headers(worker_token))
    vr = r.json().get("vital_record")
    check("订单详情携带 vital_record", vr is not None, r.text)
    check("详情中的数值为最新 145/95", vr and vr["systolic"] == 145 and vr["diastolic"] == 95, str(vr))

    print("[7] 家属首页显示待跟进提醒（关闭前一直显示）")
    r = requests.get(f"{BASE_URL}/vital-records/pending-followups", headers=headers(child_token))
    pending = r.json()
    target = next((x for x in pending if x["id"] == record["id"]), None)
    check("待跟进列表包含该异常记录", target is not None, json.dumps(pending, ensure_ascii=False))

    print("[8] 老人档案健康时间线可见记录与异常原因")
    r = requests.get(f"{BASE_URL}/vital-records/by-elderly/{elderly_id}", headers=headers(child_token))
    timeline = r.json()
    tl = next((x for x in timeline if x["id"] == record["id"]), None)
    check("时间线包含该记录", tl is not None, r.text)
    check("时间线带异常原因", tl and tl["is_abnormal"] and tl["abnormal_reason"], str(tl))
    check("时间线带护工姓名", tl and bool(tl.get("worker_name")), str(tl))

    print("[9] 跟进结果为空不允许关闭")
    r = requests.post(f"{BASE_URL}/vital-records/{record['id']}/follow-up",
                      headers=headers(child_token), json={"follow_up_result": "   "})
    check("空跟进结果被拒绝 (400)", r.status_code == 400, r.text)

    print("[10] 家属写跟进结果后提醒关闭")
    r = requests.post(f"{BASE_URL}/vital-records/{record['id']}/follow-up",
                      headers=headers(child_token),
                      json={"follow_up_result": "已电话联系老人，复测138/88，提醒按时服药"})
    check("跟进成功", r.status_code == 200, r.text)
    check("状态变为 closed", r.json()["record"]["follow_up_status"] == "closed", r.text)
    r = requests.get(f"{BASE_URL}/vital-records/pending-followups", headers=headers(child_token))
    check("首页待跟进列表不再包含该记录",
          all(x["id"] != record["id"] for x in r.json()), r.text)
    r = requests.post(f"{BASE_URL}/vital-records/{record['id']}/follow-up",
                      headers=headers(child_token), json={"follow_up_result": "再次跟进"})
    check("已关闭的提醒不能重复跟进 (400)", r.status_code == 400, r.text)

    print("[11] 家属能在订单详情看到已关闭的跟进结果")
    r = requests.get(f"{BASE_URL}/care-needs/{order_id}", headers=headers(child_token))
    vr = r.json().get("vital_record")
    check("跟进状态 closed 已同步到订单详情", vr and vr["follow_up_status"] == "closed", str(vr))
    check("跟进结果已同步到订单详情", vr and "复测" in (vr["follow_up_result"] or ""), str(vr))

    # ---------- 场景二：正常血压（125/80）----------
    print("\n--- 场景二：正常血压订单 ---")
    order2 = create_health_order(child_token, elderly_id, "上门量血压-正常用例")
    take_order(worker_token, order2)

    print("[12] 正常血压不生成待跟进提醒")
    payload = {"systolic": 125, "diastolic": 80, "heart_rate": 70,
               "measured_at": "2026-10-02 09:30:00"}
    r = requests.post(f"{BASE_URL}/care-needs/{order2}/vital-record",
                      headers=headers(worker_token), json=payload)
    rec2 = r.json()["record"]
    check("is_abnormal = false", rec2["is_abnormal"] is False, str(rec2))
    check("follow_up_status = none", rec2["follow_up_status"] == "none", str(rec2))

    print("[13] 参数校验：舒张压 >= 收缩压 / 越界值被拒绝")
    bad = {"systolic": 120, "diastolic": 130, "heart_rate": 70,
           "measured_at": "2026-10-02 09:30:00"}
    r = requests.post(f"{BASE_URL}/care-needs/{order2}/vital-record",
                      headers=headers(worker_token), json=bad)
    check("舒张压>=收缩压被拒绝 (400)", r.status_code == 400, r.text)
    bad = {"systolic": 999, "diastolic": 80, "heart_rate": 70,
           "measured_at": "2026-10-02 09:30:00"}
    r = requests.post(f"{BASE_URL}/care-needs/{order2}/vital-record",
                      headers=headers(worker_token), json=bad)
    check("越界收缩压被拒绝 (400)", r.status_code == 400, r.text)

    r = requests.post(f"{BASE_URL}/care-needs/{order2}/complete", headers=headers(worker_token))
    check("正常记录订单可完成", r.status_code == 200, r.text)

    print("\n" + "=" * 64)
    print(f"测试结束：通过 {PASS} 项，失败 {FAIL} 项")
    print("=" * 64)
    if FAIL:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
