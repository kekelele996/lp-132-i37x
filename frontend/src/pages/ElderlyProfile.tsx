import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, message, Card, Tag, Drawer, Timeline, Empty, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, HeartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { elderlyApi, vitalRecordApi } from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

const ElderlyProfile = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [form] = Form.useForm();
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineProfile, setTimelineProfile] = useState<any>(null);
  const [vitalRecords, setVitalRecords] = useState<any[]>([]);
  const [vitalLoading, setVitalLoading] = useState(false);
  const [followupTarget, setFollowupTarget] = useState<any>(null);
  const [followupResult, setFollowupResult] = useState('');
  const [followupSaving, setFollowupSaving] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const response = await elderlyApi.getList();
      setProfiles(response.data);
    } catch (error) {
      message.error('获取老人档案失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleAdd = () => {
    setEditingProfile(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditingProfile(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个老人档案吗？',
      onOk: async () => {
        try {
          await elderlyApi.delete(id);
          message.success('删除成功');
          fetchProfiles();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingProfile) {
        await elderlyApi.update(editingProfile.id, values);
        message.success('更新成功');
      } else {
        await elderlyApi.create(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchProfiles();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const fetchVitalRecords = async (elderlyId: string) => {
    setVitalLoading(true);
    try {
      const response = await vitalRecordApi.getByElderly(elderlyId);
      setVitalRecords(response.data);
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取健康记录失败');
    } finally {
      setVitalLoading(false);
    }
  };

  const openTimeline = (record: any) => {
    setTimelineProfile(record);
    setTimelineOpen(true);
    fetchVitalRecords(record.id);
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
      fetchVitalRecords(timelineProfile.id);
    } catch (error: any) {
      message.error(error.response?.data?.message || '跟进失败');
    } finally {
      setFollowupSaving(false);
    }
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <div className="flex items-center">
          <Avatar icon={<UserOutlined />} className="mr-3" />
          <div>
            <div className="font-medium">{text}</div>
            <div className="text-gray-500 text-sm">{record.gender} · {record.age}岁</div>
          </div>
        </div>
      ),
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '病史',
      dataIndex: 'medical_history',
      key: 'medical_history',
      render: (text: string) => text ? <Tag color="red">{text}</Tag> : <span className="text-gray-400">无</span>,
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: '紧急联系人',
      dataIndex: 'emergency_contact',
      key: 'emergency_contact',
      render: (text: string, record: any) => (
        <div>
          <div>{text}</div>
          <div className="text-gray-500 text-sm">{record.emergency_phone}</div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<HeartOutlined />} onClick={() => openTimeline(record)}>
            健康时间线
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const Avatar = ({ icon, className }: any) => (
    <div className={`w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center ${className}`}>
      {icon}
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">老人档案管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加老人档案
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={profiles}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
          }}
        />
      </Card>

      <Drawer
        title={timelineProfile ? `${timelineProfile.name} 的健康时间线` : '健康时间线'}
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        width={560}
      >
        {vitalLoading ? (
          <div className="text-gray-400 text-center py-8">加载中...</div>
        ) : vitalRecords.length === 0 ? (
          <Empty description="暂无血压测量记录" />
        ) : (
          <Timeline
            items={vitalRecords.map((item) => ({
              color: item.is_abnormal ? 'red' : 'green',
              children: (
                <div className="pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {item.systolic}/{item.diastolic} mmHg
                      <span className="text-gray-500 font-normal ml-2">心率 {item.heart_rate} 次/分</span>
                    </span>
                    {item.is_abnormal ? <Tag color="red">异常</Tag> : <Tag color="green">正常</Tag>}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    测量时间：{dayjs(item.measured_at).format('YYYY-MM-DD HH:mm')} ｜ 护工：{item.worker_name || '未知'}
                  </div>
                  {item.is_abnormal && (
                    <Alert
                      className="mt-2"
                      type="error"
                      showIcon
                      message={`异常原因：${item.abnormal_reason}`}
                    />
                  )}
                  {item.follow_up_status === 'pending' && (
                    <div className="mt-2 flex items-center justify-between">
                      <Tag color="orange">待跟进</Tag>
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
                  )}
                  {item.follow_up_status === 'closed' && (
                    <div className="mt-2 text-sm bg-gray-50 rounded p-2">
                      <Tag color="default">跟进已关闭</Tag>
                      <div className="text-gray-700 mt-1">{item.follow_up_result}</div>
                      <div className="text-gray-400 text-xs mt-1">
                        {item.followed_up_name} · {item.followed_up_at ? dayjs(item.followed_up_at).format('YYYY-MM-DD HH:mm') : ''}
                      </div>
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        )}
      </Drawer>

      <Modal
        title="血压异常跟进"
        open={!!followupTarget}
        onCancel={() => setFollowupTarget(null)}
        onOk={handleFollowUp}
        confirmLoading={followupSaving}
        okText="提交并关闭提醒"
        cancelText="取消"
      >
        {followupTarget && (
          <div className="space-y-3">
            <Alert
              type="error"
              showIcon
              message={`${followupTarget.systolic}/${followupTarget.diastolic} mmHg · 心率 ${followupTarget.heart_rate} 次/分`}
              description={followupTarget.abnormal_reason}
            />
            <Input.TextArea
              rows={4}
              placeholder="请填写跟进结果，例如：已联系老人复测并提醒按时服药"
              value={followupResult}
              onChange={(e) => setFollowupResult(e.target.value)}
            />
          </div>
        )}
      </Modal>

      <Modal
        title={editingProfile ? '编辑老人档案' : '添加老人档案'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="name"
              label="姓名"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input placeholder="请输入姓名" />
            </Form.Item>
            <Form.Item
              name="gender"
              label="性别"
              rules={[{ required: true, message: '请选择性别' }]}
            >
              <Select placeholder="请选择性别">
                <Option value="男">男</Option>
                <Option value="女">女</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="age"
              label="年龄"
              rules={[{ required: true, message: '请输入年龄' }]}
            >
              <Input type="number" placeholder="请输入年龄" />
            </Form.Item>
            <Form.Item name="phone" label="联系电话">
              <Input placeholder="请输入联系电话" />
            </Form.Item>
            <Form.Item name="id_card" label="身份证号">
              <Input placeholder="请输入身份证号" />
            </Form.Item>
            <Form.Item name="emergency_contact" label="紧急联系人">
              <Input placeholder="请输入紧急联系人" />
            </Form.Item>
            <Form.Item name="emergency_phone" label="紧急联系电话">
              <Input placeholder="请输入紧急联系电话" />
            </Form.Item>
          </div>

          <Form.Item
            name="address"
            label="住址"
            rules={[{ required: true, message: '请输入住址' }]}
          >
            <Input placeholder="请输入详细住址" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="medical_history" label="病史">
              <TextArea rows={3} placeholder="请输入病史信息" />
            </Form.Item>
            <Form.Item name="medication" label="用药情况">
              <TextArea rows={3} placeholder="请输入日常用药" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="allergy_history" label="过敏史">
              <TextArea rows={2} placeholder="请输入过敏史" />
            </Form.Item>
            <Form.Item name="notes" label="备注">
              <TextArea rows={2} placeholder="其他需要说明的情况" />
            </Form.Item>
          </div>

          <Form.Item className="mb-0">
            <div className="flex justify-end space-x-3">
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingProfile ? '保存修改' : '创建档案'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ElderlyProfile;
