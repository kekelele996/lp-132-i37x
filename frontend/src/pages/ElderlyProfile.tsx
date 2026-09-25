import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, message, Card, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { elderlyApi } from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

const ElderlyProfile = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [form] = Form.useForm();

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
