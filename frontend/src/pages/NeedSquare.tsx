import { useState, useEffect } from 'react';
import { Card, List, Tag, Button, Select, Input, Space, message, Modal, Rate, Form, InputNumber, DatePicker, Alert } from 'antd';
import { HeartOutlined, ClockCircleOutlined, EnvironmentOutlined, UserOutlined, StarOutlined, AlertOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { careNeedsApi, favoriteApi, reviewApi, vitalRecordApi } from '../services/api';
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
  const [vitalModalOpen, setVitalModalOpen] = useState(false);
  const [vitalForm] = Form.useForm();
  const [vitalSaving, setVitalSaving] = useState(false);
  const [followupTarget, setFollowupTarget] = useState<any>(null);
  const [followupResult, setFollowupResult] = useState('');
  const [followupSaving, setFollowupSaving] = useState(false);
  const [pendingFollowups, setPendingFollowups] = useState<any[]>([]);

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

  const fetchPendingFollowups = async () => {
    if (user?.role !== 'child') return;
    try {
      const response = await vitalRecordApi.getPendingFollowups();
      setPendingFollowups(response.data);
    } catch (error) {
      console.error('获取待跟进提醒失败', error);
    }
  };

  useEffect(() => {
    fetchNeeds();
    fetchFavorites();
    fetchPendingFollowups();
  }, []);

  const refreshDetail = async (id: string) => {
    try {
      const response = await careNeedsApi.getDetail(id);
      setSelectedNeed(response.data);
      return response.data;
    } catch {
      return null;
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

  const completeOrder = async (id: string) => {
    try {
      await careNeedsApi.complete(id);
      message.success('服务已完成');
      setVitalModalOpen(false);
      fetchNeeds();
      const detail = await refreshDetail(id);
      if (!detail) {
        setDetailModal(false);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  // 健康检查（量血压）订单必须先填写血压、心率和测量时间；其他类型直接完成
  const handleComplete = async (id: string) => {
    try {
      const detail = await careNeedsApi.getDetail(id);
      const need = detail.data;
      if (need.care_type === 'health_check') {
        setSelectedNeed(need);
        openVitalModal(need);
      } else {
        await completeOrder(id);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const openVitalModal = (need: any) => {
    const record = need.vital_record;
    vitalForm.setFieldsValue(
      record
        ? {
            systolic: record.systolic,
            diastolic: record.diastolic,
            heart_rate: record.heart_rate,
            measured_at: dayjs(record.measured_at),
          }
        : { measured_at: dayjs() }
    );
    setVitalModalOpen(true);
  };

  const handleVitalSubmit = async () => {
    try {
      const values = await vitalForm.validateFields();
      setVitalSaving(true);
      await careNeedsApi.submitVitalRecord(selectedNeed.id, {
        systolic: values.systolic,
        diastolic: values.diastolic,
        heart_rate: values.heart_rate,
        measured_at: values.measured_at.format('YYYY-MM-DD HH:mm:ss'),
      });
      message.success('测量记录已保存，正在完成订单');
      await completeOrder(selectedNeed.id);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.response?.data?.message || '测量记录保存失败');
    } finally {
      setVitalSaving(false);
    }
  };

  const handleFollowUp = async () => {
    if (!followupResult.trim()) {
      message.warning('请填写跟进结果');
      return;
    }
    setFollowupSaving(true);
    try {
      await vitalRecordApi.followUp(followupTarget.id, followupResult.trim());
      message.success('跟进完成，提醒已关闭');
      setFollowupTarget(null);
      setFollowupResult('');
      fetchPendingFollowups();
      fetchNeeds();
      if (selectedNeed) {
        refreshDetail(selectedNeed.id);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '跟进失败');
    } finally {
      setFollowupSaving(false);
    }
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
    setDetailModal(true);
    setSelectedNeed(need);
    // 重进订单详情时拉取最新数据，同步护工已填写的测量记录
    await refreshDetail(need.id);
  };

  const openReview = (need: any) => {
    setSelectedNeed(need);
    setReviewModal(true);
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

      {user?.role === 'child' && pendingFollowups.length > 0 && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          icon={<AlertOutlined />}
          message={`有 ${pendingFollowups.length} 条血压异常待跟进提醒`}
          description={
            <Space direction="vertical" className="w-full" size={4}>
              {pendingFollowups.map((item) => (
                <div key={item.id} className="flex justify-between items-center w-full">
                  <span className="text-sm">
                    <Tag color="red">异常</Tag>
                    <b>{item.elderly_name}</b>
                    <span className="text-gray-500"> · {item.order_title} · </span>
                    {item.systolic}/{item.diastolic} mmHg
                    <span className="text-gray-400">
                      {' '}（{dayjs(item.measured_at).format('MM-DD HH:mm')}，{item.worker_name} 测量）
                    </span>
                  </span>
                  <Button
                    size="small"
                    danger
                    type="primary"
                    onClick={() => {
                      setFollowupTarget(item);
                      setFollowupResult('');
                    }}
                  >
                    填写跟进结果
                  </Button>
                </div>
              ))}
            </Space>
          }
        />
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
                  <Button type="primary" size="small" onClick={(e) => { e.stopPropagation(); handleComplete(item.id); }}>
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

            {selectedNeed.vital_record && (
              <div className={`p-4 rounded-lg ${selectedNeed.vital_record.is_abnormal ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">血压测量记录</h3>
                  {selectedNeed.vital_record.is_abnormal ? (
                    <Tag color="red">异常</Tag>
                  ) : (
                    <Tag color="green">正常</Tag>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                  <div>
                    收缩压：
                    <b className={selectedNeed.vital_record.is_abnormal && selectedNeed.vital_record.systolic >= 140 ? 'text-red-600' : ''}>
                      {selectedNeed.vital_record.systolic} mmHg
                    </b>
                  </div>
                  <div>
                    舒张压：
                    <b className={selectedNeed.vital_record.is_abnormal && selectedNeed.vital_record.diastolic >= 90 ? 'text-red-600' : ''}>
                      {selectedNeed.vital_record.diastolic} mmHg
                    </b>
                  </div>
                  <div>心率：<b>{selectedNeed.vital_record.heart_rate} 次/分</b></div>
                </div>
                <div className="text-sm text-gray-500">
                  测量时间：{dayjs(selectedNeed.vital_record.measured_at).format('YYYY-MM-DD HH:mm')}
                </div>
                {selectedNeed.vital_record.is_abnormal && (
                  <div className="text-sm text-red-600 mt-1">
                    异常原因：{selectedNeed.vital_record.abnormal_reason}
                  </div>
                )}
                {selectedNeed.vital_record.follow_up_status === 'pending' && (
                  <div className="mt-2 flex items-center justify-between">
                    <Tag color="orange">待跟进</Tag>
                    {user?.role === 'child' && (
                      <Button
                        size="small"
                        danger
                        type="primary"
                        onClick={() => {
                          setFollowupTarget(selectedNeed.vital_record);
                          setFollowupResult('');
                        }}
                      >
                        填写跟进结果
                      </Button>
                    )}
                  </div>
                )}
                {selectedNeed.vital_record.follow_up_status === 'closed' && (
                  <div className="mt-2 text-sm bg-white rounded p-2">
                    <Tag color="default">跟进已关闭</Tag>
                    <span className="text-gray-700">{selectedNeed.vital_record.follow_up_result}</span>
                    <span className="text-gray-400 ml-2">
                      {selectedNeed.vital_record.followed_up_at
                        ? dayjs(selectedNeed.vital_record.followed_up_at).format('YYYY-MM-DD HH:mm')
                        : ''}
                    </span>
                  </div>
                )}
              </div>
            )}

            {selectedNeed.status === 'in_progress' &&
              selectedNeed.care_type === 'health_check' &&
              selectedNeed.worker_id === user?.id &&
              !selectedNeed.vital_record && (
                <Alert
                  type="warning"
                  showIcon
                  message="完成订单前请先填写血压、心率和测量时间"
                />
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
                <Button type="primary" onClick={() => handleComplete(selectedNeed.id)}>
                  完成服务
                </Button>
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

      <Modal
        title="填写血压测量记录"
        open={vitalModalOpen}
        onCancel={() => setVitalModalOpen(false)}
        onOk={handleVitalSubmit}
        confirmLoading={vitalSaving}
        okText="保存并完成订单"
        cancelText="取消"
        width={480}
      >
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="收缩压 ≥ 140 或 舒张压 ≥ 90 将自动标记异常并通知家属跟进。重复提交只保留一条记录。"
        />
        <Form form={vitalForm} layout="vertical">
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="systolic"
              label="收缩压（高压，mmHg）"
              rules={[{ required: true, message: '请输入收缩压' }]}
            >
              <InputNumber min={50} max={300} precision={0} className="w-full" placeholder="如 125" />
            </Form.Item>
            <Form.Item
              name="diastolic"
              label="舒张压（低压，mmHg）"
              rules={[{ required: true, message: '请输入舒张压' }]}
            >
              <InputNumber min={30} max={200} precision={0} className="w-full" placeholder="如 80" />
            </Form.Item>
          </div>
          <Form.Item
            name="heart_rate"
            label="心率（次/分）"
            rules={[{ required: true, message: '请输入心率' }]}
          >
            <InputNumber min={30} max={250} precision={0} className="w-full" placeholder="如 72" />
          </Form.Item>
          <Form.Item
            name="measured_at"
            label="测量时间"
            rules={[{ required: true, message: '请选择测量时间' }]}
          >
            <DatePicker showTime className="w-full" format="YYYY-MM-DD HH:mm" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="血压异常跟进"
        open={!!followupTarget}
        onCancel={() => setFollowupTarget(null)}
        onOk={handleFollowUp}
        confirmLoading={followupSaving}
        okText="提交并关闭提醒"
        cancelText="取消"
        width={520}
      >
        {followupTarget && (
          <div className="space-y-3">
            <Alert
              type="error"
              showIcon
              message={`${followupTarget.systolic}/${followupTarget.diastolic} mmHg · 心率 ${followupTarget.heart_rate} 次/分`}
              description={followupTarget.abnormal_reason}
            />
            <div className="text-sm text-gray-500">
              老人：{followupTarget.elderly_name} ｜ 测量时间：
              {dayjs(followupTarget.measured_at).format('YYYY-MM-DD HH:mm')}
            </div>
            <Input.TextArea
              rows={4}
              placeholder="请填写跟进结果，例如：已电话联系老人，复测血压 135/85，提醒按时服药"
              value={followupResult}
              onChange={(e) => setFollowupResult(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NeedSquare;
