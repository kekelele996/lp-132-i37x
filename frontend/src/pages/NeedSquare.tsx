import { useState, useEffect } from 'react';
import { Card, List, Tag, Button, Select, Input, Space, message, Modal, Rate, Form, Alert, DatePicker, InputNumber } from 'antd';
import { HeartOutlined, ClockCircleOutlined, EnvironmentOutlined, UserOutlined, StarOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { careNeedsApi, favoriteApi, reviewApi, healthAlertApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { useNavigate } from 'react-router-dom';

const { Search } = Input;
const { Option } = Select;
const { Meta } = Card;

const careTypeMap: Record<string, { label: string; color: string }> = {
  health_check: { label: '健康检查', color: 'blue' },
  accompany: { label: '陪同就医', color: 'green' },
  daily_care: { label: '日常照料', color: 'orange' },
  shopping: { label: '代购代办', color: 'purple' },
  companionship: { label: '聊天陪伴', color: 'pink' },
  other: { label: '其他', color: 'default' },
};

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待接单', color: 'orange' },
  accepted: { label: '已接单', color: 'blue' },
  in_progress: { label: '进行中', color: 'processing' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
};

const NeedSquare = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [needs, setNeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNeed, setSelectedNeed] = useState<any>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewForm] = Form.useForm();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [followUpModal, setFollowUpModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [followUpForm] = Form.useForm();
  const [measureModal, setMeasureModal] = useState(false);
  const [measureIntent, setMeasureIntent] = useState<'save' | 'complete'>('complete');
  const [measureSubmitting, setMeasureSubmitting] = useState(false);
  const [measureForm] = Form.useForm();

  const fetchNeeds = async (params?: any) => {
    setLoading(true);
    try {
      const response = await careNeedsApi.getList(params);
      setNeeds(response.data.needs);
    } catch (error) {
      message.error('获取需求列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    if (user?.role === 'child') {
      try {
        const response = await favoriteApi.getList();
        setFavorites(response.data);
      } catch (error) {
        console.error('获取收藏列表失败', error);
      }
    }
  };

  const fetchAlerts = async () => {
    if (user?.role !== 'child') return;
    try {
      const response = await healthAlertApi.getPending();
      setAlerts(response.data);
    } catch (error) {
      console.error('获取待跟进提醒失败', error);
    }
  };

  useEffect(() => {
    fetchNeeds();
    fetchFavorites();
    fetchAlerts();
  }, []);

  const refreshDetail = async (id: string) => {
    try {
      const response = await careNeedsApi.getDetail(id);
      setSelectedNeed(response.data);
    } catch (error) {
      console.error('获取需求详情失败', error);
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await careNeedsApi.accept(id);
      message.success('接单成功');
      fetchNeeds();
    } catch (error: any) {
      message.error(error.response?.data?.message || '接单失败');
    }
  };

  const handleStart = async (id: string) => {
    try {
      await careNeedsApi.start(id);
      message.success('服务已开始');
      fetchNeeds();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const openMeasureModal = async (need: any, intent: 'save' | 'complete') => {
    setMeasureIntent(intent);
    let detail = need;
    try {
      const response = await careNeedsApi.getDetail(need.id);
      detail = response.data;
      setSelectedNeed(detail);
    } catch (error) {
      setSelectedNeed(need);
    }
    const record = detail.health_record;
    measureForm.resetFields();
    measureForm.setFieldsValue({
      systolic_pressure: record?.systolic_pressure,
      diastolic_pressure: record?.diastolic_pressure,
      heart_rate: record?.heart_rate,
      measured_at: record?.measured_at ? dayjs(record.measured_at) : dayjs(),
    });
    setMeasureModal(true);
  };

  const handleMeasureSubmit = async (values: any) => {
    const payload = {
      systolic_pressure: values.systolic_pressure,
      diastolic_pressure: values.diastolic_pressure,
      heart_rate: values.heart_rate,
      measured_at: values.measured_at.format('YYYY-MM-DD HH:mm:ss'),
    };
    setMeasureSubmitting(true);
    try {
      if (measureIntent === 'complete') {
        const response = await careNeedsApi.complete(selectedNeed.id, payload);
        if (response.data.health_record?.is_abnormal) {
          message.warning('服务已完成，本次血压异常，已生成待跟进提醒');
        } else {
          message.success('服务已完成');
        }
      } else {
        const response = await careNeedsApi.saveHealthRecord(selectedNeed.id, payload);
        if (response.data.record?.is_abnormal) {
          message.warning('测量记录已保存，血压异常已生成待跟进提醒');
        } else {
          message.success('测量记录已保存');
        }
      }
      setMeasureModal(false);
      measureForm.resetFields();
      fetchNeeds();
      if (detailModal) {
        refreshDetail(selectedNeed.id);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    } finally {
      setMeasureSubmitting(false);
    }
  };

  const handleComplete = async (need: any) => {
    // 完成订单前必须先填写本次测量记录
    openMeasureModal(need, 'complete');
  };

  const handleCancel = async (id: string) => {
    Modal.confirm({
      title: '确认取消',
      content: '确定要取消这个订单吗？',
      onOk: async () => {
        try {
          await careNeedsApi.cancel(id);
          message.success('已取消');
          fetchNeeds();
        } catch (error: any) {
          message.error(error.response?.data?.message || '取消失败');
        }
      },
    });
  };

  const handleFavorite = async (workerId: string) => {
    try {
      const isFavorited = favorites.some((f) => f.worker_id === workerId);
      if (isFavorited) {
        await favoriteApi.remove(workerId);
        message.success('已取消收藏');
      } else {
        await favoriteApi.add(workerId);
        message.success('收藏成功');
      }
      fetchFavorites();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleReview = async (values: any) => {
    try {
      await reviewApi.create({
        ...values,
        order_id: selectedNeed.id,
        reviewee_id: user?.role === 'child' ? selectedNeed.worker_id : selectedNeed.child_id,
      });
      message.success('评价成功');
      setReviewModal(false);
      reviewForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.message || '评价失败');
    }
  };

  const openDetail = async (need: any) => {
    setSelectedNeed(need);
    setDetailModal(true);
    refreshDetail(need.id);
  };

  const openReview = (need: any) => {
    setSelectedNeed(need);
    setReviewModal(true);
  };

  const openFollowUp = (alert: any) => {
    setSelectedAlert(alert);
    setFollowUpModal(true);
  };

  const handleFollowUp = async (values: any) => {
    try {
      await healthAlertApi.followUp(selectedAlert.id, {
        follow_up_result: values.follow_up_result,
      });
      message.success('跟进结果已保存，提醒已关闭');
      setFollowUpModal(false);
      followUpForm.resetFields();
      fetchAlerts();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleChat = (userId: string) => {
    navigate('/messages', { state: { userId } });
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">需求广场</h1>
        <Space>
          <Select
            placeholder="服务类型"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => fetchNeeds({ care_type: value })}
          >
            <Option value="health_check">健康检查</Option>
            <Option value="accompany">陪同就医</Option>
            <Option value="daily_care">日常照料</Option>
            <Option value="shopping">代购代办</Option>
            <Option value="companionship">聊天陪伴</Option>
            <Option value="other">其他</Option>
          </Select>
          <Select
            placeholder="订单状态"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => fetchNeeds({ status: value })}
          >
            <Option value="pending">待接单</Option>
            <Option value="accepted">已接单</Option>
            <Option value="in_progress">进行中</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
          <Search
            placeholder="搜索需求"
            style={{ width: 250 }}
            onSearch={(value) => fetchNeeds({ keyword: value })}
            allowClear
          />
        </Space>
      </div>

      {user?.role === 'child' && alerts.length > 0 && (
        <div className="mb-6 space-y-3">
          {alerts.map((alert) => (
            <Alert
              key={alert.id}
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              message={`${alert.elderly_name} 血压异常，待跟进`}
              description={
                <div className="text-sm">
                  <div>异常原因：{alert.abnormal_reason}</div>
                  <div className="text-gray-500 mt-1">
                    血压 {alert.systolic_pressure}/{alert.diastolic_pressure} mmHg · 心率 {alert.heart_rate} 次/分 ·
                    测量时间 {dayjs(alert.measured_at).format('YYYY-MM-DD HH:mm')} · 护工：{alert.worker_name || '未知'}
                  </div>
                </div>
              }
              action={
                <Button type="primary" size="small" onClick={() => openFollowUp(alert)}>
                  填写跟进结果
                </Button>
              }
            />
          ))}
        </div>
      )}

      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
        dataSource={needs}
        loading={loading}
        renderItem={(item) => (
          <List.Item>
            <Card
              hoverable
              onClick={() => openDetail(item)}
              className="h-full"
              actions={[
                item.status === 'pending' && (user?.role === 'worker' || user?.role === 'volunteer') ? (
                  <Button type="primary" size="small" onClick={(e) => { e.stopPropagation(); handleAccept(item.id); }}>
                    接单
                  </Button>
                ) : null,
                item.status === 'accepted' && item.worker_id === user?.id ? (
                  <Button type="primary" size="small" onClick={(e) => { e.stopPropagation(); handleStart(item.id); }}>
                    开始服务
                  </Button>
                ) : null,
                item.status === 'in_progress' && item.worker_id === user?.id ? (
                  <Button type="primary" size="small" onClick={(e) => { e.stopPropagation(); handleComplete(item); }}>
                    完成服务
                  </Button>
                ) : null,
                item.status === 'completed' && (item.child_id === user?.id || item.worker_id === user?.id) ? (
                  <Button size="small" onClick={(e) => { e.stopPropagation(); openReview(item); }}>
                    评价
                  </Button>
                ) : null,
                (item.status === 'pending' || item.status === 'accepted') && item.child_id === user?.id ? (
                  <Button danger size="small" onClick={(e) => { e.stopPropagation(); handleCancel(item.id); }}>
                    取消
                  </Button>
                ) : null,
              ].filter(Boolean)}
            >
              <Meta
                title={
                  <div className="flex justify-between items-center">
                    <span className="truncate">{item.title}</span>
                    <Tag color={statusMap[item.status]?.color}>
                      {statusMap[item.status]?.label}
                    </Tag>
                  </div>
                }
                description={
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center text-gray-600">
                      <Tag color={careTypeMap[item.care_type]?.color}>
                        {careTypeMap[item.care_type]?.label}
                      </Tag>
                      <span className="ml-2 text-orange-500 font-medium">
                        ¥{item.price}
                      </span>
                    </div>
                    <div className="flex items-center text-gray-500 text-sm">
                      <ClockCircleOutlined className="mr-1" />
                      {dayjs(item.start_time).format('YYYY-MM-DD HH:mm')}
                    </div>
                    <div className="flex items-center text-gray-500 text-sm">
                      <EnvironmentOutlined className="mr-1" />
                      <span className="truncate">{item.address}</span>
                    </div>
                    <div className="flex items-center text-gray-500 text-sm">
                      <UserOutlined className="mr-1" />
                      {item.elderly_name} ({item.elderly_age}岁)
                    </div>
                    {item.worker_name && (
                      <div className="flex items-center text-gray-500 text-sm">
                        <HeartOutlined className="mr-1" />
                        护工：{item.worker_name}
                      </div>
                    )}
                  </div>
                }
              />
            </Card>
          </List.Item>
        )}
      />

      <Modal
        title="需求详情"
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={null}
        width={600}
      >
        {selectedNeed && (
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold">{selectedNeed.title}</h2>
              <Tag color={statusMap[selectedNeed.status]?.color}>
                {statusMap[selectedNeed.status]?.label}
              </Tag>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex">
                <span className="w-24 text-gray-500">服务类型：</span>
                <Tag color={careTypeMap[selectedNeed.care_type]?.color}>
                  {careTypeMap[selectedNeed.care_type]?.label}
                </Tag>
              </div>
              <div className="flex">
                <span className="w-24 text-gray-500">服务价格：</span>
                <span className="text-orange-500 font-medium text-lg">¥{selectedNeed.price}</span>
              </div>
              <div className="flex">
                <span className="w-24 text-gray-500">服务时间：</span>
                <span>{dayjs(selectedNeed.start_time).format('YYYY-MM-DD HH:mm')}</span>
              </div>
              <div className="flex">
                <span className="w-24 text-gray-500">服务时长：</span>
                <span>{selectedNeed.duration_hours}小时</span>
              </div>
              <div className="flex">
                <span className="w-24 text-gray-500">服务地址：</span>
                <span>{selectedNeed.address}</span>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">服务内容</h3>
              <p className="text-gray-700">{selectedNeed.description}</p>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">老人信息</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>姓名：{selectedNeed.elderly_name}</div>
                <div>年龄：{selectedNeed.elderly_age}岁</div>
                <div>性别：{selectedNeed.elderly_gender}</div>
                <div>病史：{selectedNeed.medical_history || '无'}</div>
                <div>用药：{selectedNeed.medication || '无'}</div>
                <div>紧急联系人：{selectedNeed.emergency_contact} ({selectedNeed.emergency_phone})</div>
              </div>
            </div>

            {selectedNeed.health_record && (
              <div className={`p-4 rounded-lg ${selectedNeed.health_record.is_abnormal ? 'bg-red-50' : 'bg-cyan-50'}`}>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">本次测量记录</h3>
                  {selectedNeed.health_record.is_abnormal && <Tag color="red">血压异常</Tag>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>血压：{selectedNeed.health_record.systolic_pressure}/{selectedNeed.health_record.diastolic_pressure} mmHg</div>
                  <div>心率：{selectedNeed.health_record.heart_rate} 次/分</div>
                  <div className="col-span-2">测量时间：{dayjs(selectedNeed.health_record.measured_at).format('YYYY-MM-DD HH:mm')}</div>
                  {selectedNeed.health_record.is_abnormal && (
                    <div className="col-span-2 text-red-500">异常原因：{selectedNeed.health_record.abnormal_reason}</div>
                  )}
                </div>
              </div>
            )}

            {selectedNeed.worker_name && (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">接单护工：{selectedNeed.worker_name}</h3>
                    <p className="text-sm text-gray-500">联系电话：{selectedNeed.worker_phone}</p>
                  </div>
                  {user?.role === 'child' && (
                    <Space>
                      <Button
                        icon={favorites.some((f) => f.worker_id === selectedNeed.worker_id) ? <StarOutlined style={{ color: '#fadb14' }} /> : <StarOutlined />}
                        onClick={() => handleFavorite(selectedNeed.worker_id)}
                      >
                        {favorites.some((f) => f.worker_id === selectedNeed.worker_id) ? '已收藏' : '收藏'}
                      </Button>
                      <Button type="primary" onClick={() => handleChat(selectedNeed.worker_id)}>
                        联系护工
                      </Button>
                    </Space>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              {selectedNeed.status === 'pending' && (user?.role === 'worker' || user?.role === 'volunteer') && (
                <Button type="primary" onClick={() => handleAccept(selectedNeed.id)}>
                  接单
                </Button>
              )}
              {selectedNeed.status === 'accepted' && selectedNeed.worker_id === user?.id && (
                <Button type="primary" onClick={() => handleStart(selectedNeed.id)}>
                  开始服务
                </Button>
              )}
              {selectedNeed.status === 'in_progress' && selectedNeed.worker_id === user?.id && (
                <>
                  <Button onClick={() => openMeasureModal(selectedNeed, 'save')}>
                    {selectedNeed.health_record ? '修改测量记录' : '填写测量记录'}
                  </Button>
                  <Button type="primary" onClick={() => handleComplete(selectedNeed)}>
                    完成服务
                  </Button>
                </>
              )}
              {selectedNeed.status === 'completed' && (selectedNeed.child_id === user?.id || selectedNeed.worker_id === user?.id) && (
                <Button onClick={() => openReview(selectedNeed)}>
                  评价
                </Button>
              )}
              {(selectedNeed.status === 'pending' || selectedNeed.status === 'accepted') && selectedNeed.child_id === user?.id && (
                <Button danger onClick={() => handleCancel(selectedNeed.id)}>
                  取消订单
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={measureIntent === 'complete' ? '填写测量记录并完成订单' : '填写测量记录'}
        open={measureModal}
        onCancel={() => setMeasureModal(false)}
        footer={null}
        forceRender
      >
        {selectedNeed && (
          <div className="mb-4 text-sm text-gray-500">
            老人：{selectedNeed.elderly_name} · 订单：{selectedNeed.title}
          </div>
        )}
        <Form form={measureForm} onFinish={handleMeasureSubmit} layout="vertical">
          <div className="grid grid-cols-3 gap-4">
            <Form.Item
              name="systolic_pressure"
              label="收缩压 (mmHg)"
              rules={[{ required: true, message: '请输入收缩压' }]}
            >
              <InputNumber min={40} max={300} precision={0} placeholder="如 120" className="w-full" />
            </Form.Item>
            <Form.Item
              name="diastolic_pressure"
              label="舒张压 (mmHg)"
              rules={[{ required: true, message: '请输入舒张压' }]}
            >
              <InputNumber min={20} max={200} precision={0} placeholder="如 80" className="w-full" />
            </Form.Item>
            <Form.Item
              name="heart_rate"
              label="心率 (次/分)"
              rules={[{ required: true, message: '请输入心率' }]}
            >
              <InputNumber min={20} max={250} precision={0} placeholder="如 75" className="w-full" />
            </Form.Item>
          </div>
          <Form.Item
            name="measured_at"
            label="测量时间"
            rules={[{ required: true, message: '请选择测量时间' }]}
          >
            <DatePicker showTime format="YYYY-MM-DD HH:mm" className="w-full" placeholder="请选择测量时间" />
          </Form.Item>
          <div className="text-xs text-gray-400 mb-4">
            收缩压 ≥ 140 或舒张压 ≥ 90 将标记为异常，并为家属生成待跟进提醒
          </div>
          <Form.Item className="mb-0">
            <div className="flex justify-end space-x-3">
              <Button onClick={() => setMeasureModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={measureSubmitting}>
                {measureIntent === 'complete' ? '提交并完成订单' : '保存记录'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="填写跟进结果"
        open={followUpModal}
        onCancel={() => setFollowUpModal(false)}
        footer={null}
      >
        {selectedAlert && (
          <div className="mb-4 bg-orange-50 p-3 rounded-lg text-sm">
            <div className="font-medium mb-1">{selectedAlert.elderly_name} 血压异常</div>
            <div className="text-gray-600">异常原因：{selectedAlert.abnormal_reason}</div>
            <div className="text-gray-500 mt-1">
              血压 {selectedAlert.systolic_pressure}/{selectedAlert.diastolic_pressure} mmHg · 心率 {selectedAlert.heart_rate} 次/分 ·
              测量时间 {dayjs(selectedAlert.measured_at).format('YYYY-MM-DD HH:mm')}
            </div>
          </div>
        )}
        <Form form={followUpForm} onFinish={handleFollowUp} layout="vertical">
          <Form.Item
            name="follow_up_result"
            label="跟进结果"
            rules={[{ required: true, message: '请填写跟进结果' }]}
          >
            <Input.TextArea rows={4} placeholder="例如：已电话询问老人身体状况，预约了社区医院复查..." />
          </Form.Item>
          <Form.Item className="mb-0">
            <div className="flex justify-end space-x-3">
              <Button onClick={() => setFollowUpModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交并关闭提醒</Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="服务评价"
        open={reviewModal}
        onCancel={() => setReviewModal(false)}
        footer={null}
      >
        <Form form={reviewForm} onFinish={handleReview} layout="vertical">
          <Form.Item
            name="rating"
            label="评分"
            rules={[{ required: true, message: '请选择评分' }]}
          >
            <Rate />
          </Form.Item>
          <Form.Item name="comment" label="评价内容">
            <Input.TextArea rows={4} placeholder="请输入您的评价..." />
          </Form.Item>
          <Form.Item className="mb-0">
            <div className="flex justify-end space-x-3">
              <Button onClick={() => setReviewModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交评价</Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default NeedSquare;
