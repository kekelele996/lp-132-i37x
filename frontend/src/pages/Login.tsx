import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Select, message, Tabs } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/auth';

const { Title, Text } = Typography;
const { Option } = Select;

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { setToken, setUser } = useAuthStore();

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      const response = await authApi.login(values);
      setToken(response.data.token);
      setUser(response.data.user);
      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    setLoading(true);
    try {
      const response = await authApi.register(values);
      setToken(response.data.token);
      setUser(response.data.user);
      message.success('注册成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const loginItems = [
    {
      label: '登录',
      key: 'login',
      children: (
        <Form
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      label: '注册',
      key: 'register',
      children: (
        <Form
          name="register"
          onFinish={handleRegister}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item
            name="real_name"
            rules={[{ required: true, message: '请输入真实姓名' }]}
          >
            <Input placeholder="真实姓名" />
          </Form.Item>

          <Form.Item
            name="phone"
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input placeholder="手机号" />
          </Form.Item>

          <Form.Item
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="选择角色">
              <Option value="child">子女家属</Option>
              <Option value="worker">专业护工</Option>
              <Option value="volunteer">志愿者</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <Title level={2} className="!text-orange-600 !mb-2">
            社区老人关怀服务平台
          </Title>
          <Text type="secondary">让关爱更简单，让老人更幸福</Text>
        </div>

        <Card className="shadow-lg">
          <Tabs items={loginItems} centered />
        </Card>

        <div className="text-center mt-6">
          <Text type="secondary" className="text-sm">
            测试账号：child1 / 密码：123456（子女）
            <br />
            worker1 / 123456（护工）
          </Text>
        </div>
      </div>
    </div>
  );
};

export default Login;
