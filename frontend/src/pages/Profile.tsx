import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Avatar, message, Card as AntCard } from 'antd';
import { UserOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { userApi } from '../services/api';
import { useAuthStore } from '../store/auth';

const { TextArea } = Input;

const Profile = () => {
  const { user, setUser } = useAuthStore();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      form.setFieldsValue(user);
    }
  }, [user, form]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const response = await userApi.updateProfile(values);
      setUser(response.data.user);
      message.success('更新成功');
      setEditing(false);
    } catch (error) {
      message.error('更新失败');
    } finally {
      setLoading(false);
    }
  };

  const roleMap: Record<string, string> = {
    child: '子女家属',
    worker: '专业护工',
    volunteer: '志愿者',
    admin: '管理员',
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">个人中心</h1>
        <Button
          type={editing ? 'default' : 'primary'}
          icon={editing ? <CloseOutlined /> : <EditOutlined />}
          onClick={() => setEditing(!editing)}
        >
          {editing ? '取消编辑' : '编辑资料'}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-1">
          <div className="text-center">
            <Avatar size={120} icon={<UserOutlined />} />
            <h2 className="text-xl font-bold mt-4">{user?.real_name}</h2>
            <p className="text-gray-500 mt-2">
              @{user?.username} · {roleMap[user?.role || '']}
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">评分</div>
              <div className="text-2xl font-bold text-orange-500">{user?.rating || '5.0'}</div>
            </div>
            {user?.role === 'worker' || user?.role === 'volunteer' ? (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-500">接单量</div>
                  <div className="text-xl font-bold text-blue-600">{user?.order_count || 0}</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-500">总收入</div>
                  <div className="text-xl font-bold text-green-600">¥{user?.total_income || 0}</div>
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <AntCard className="col-span-2">
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="real_name" label="真实姓名">
                <Input disabled={!editing} />
              </Form.Item>
              <Form.Item name="gender" label="性别">
                <Input disabled={!editing} />
              </Form.Item>
              <Form.Item name="age" label="年龄">
                <Input type="number" disabled={!editing} />
              </Form.Item>
              <Form.Item name="phone" label="手机号">
                <Input disabled />
              </Form.Item>
            </div>
            <Form.Item name="address" label="地址">
              <Input disabled={!editing} />
            </Form.Item>
            {(user?.role === 'worker' || user?.role === 'volunteer') && (
              <>
                <Form.Item name="skills" label="技能">
                  <Input disabled={!editing} placeholder="例如：血压测量、打针、输液等" />
                </Form.Item>
                <Form.Item name="introduction" label="个人简介">
                  <TextArea rows={4} disabled={!editing} placeholder="介绍一下自己的服务经验和特长" />
                </Form.Item>
              </>
            )}
            {editing && (
              <Form.Item className="mb-0">
                <div className="flex justify-end">
                  <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                    保存修改
                  </Button>
                </div>
              </Form.Item>
            )}
          </Form>
        </AntCard>
      </div>
    </div>
  );
};

export default Profile;
