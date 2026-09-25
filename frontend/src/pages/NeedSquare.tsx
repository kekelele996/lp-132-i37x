import { useState, useEffect } from 'react';
import { Card, List, Tag, Button, Select, Input, Space, message, Modal, Rate, Form } from 'antd';
import { HeartOutlined, ClockCircleOutlined, EnvironmentOutlined, UserOutlined, StarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { careNeedsApi, favoriteApi, reviewApi } from '../services/api';
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

  useEffect(() => {
    fetchNeeds();
    fetchFavorites();
  }, []);

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

  const handleComplete = async (id: string) => {
    try {
      await careNeedsApi.complete(id);
      message.success('服务已完成');
      fetchNeeds();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
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

  const openDetail = (need: any) => {
    setSelectedNeed(need);
    setDetailModal(true);
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
    </div>
  );
};

export default NeedSquare;
