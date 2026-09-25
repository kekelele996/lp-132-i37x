import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge } from 'antd';
import {
  HomeOutlined,
  UserOutlined,
  HeartOutlined,
  MessageOutlined,
  CalendarOutlined,
  TeamOutlined,
  SettingOutlined,
  LogoutOutlined,
  FileTextOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { messageApi } from '../services/api';

const { Header, Sider, Content } = Layout;

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [collapsed, _setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const response = await messageApi.getUnreadCount();
        setUnreadCount(response.data.unread_count);
      } catch (error) {
        console.error('获取未读消息失败', error);
      }
    };
    fetchUnread();
  }, []);

  const childMenuItems = [
    { key: '/', icon: <HomeOutlined />, label: '需求广场' },
    { key: '/elderly', icon: <UserOutlined />, label: '老人档案' },
    { key: '/publish', icon: <FileTextOutlined />, label: '发布需求' },
    { key: '/my-orders', icon: <HeartOutlined />, label: '我的订单' },
    { key: '/favorites', icon: <StarOutlined />, label: '收藏护工' },
    { key: '/messages', icon: <Badge count={unreadCount} size="small"><MessageOutlined /></Badge>, label: '消息中心' },
    { key: '/profile', icon: <SettingOutlined />, label: '个人中心' },
  ];

  const workerMenuItems = [
    { key: '/', icon: <HomeOutlined />, label: '需求广场' },
    { key: '/my-orders', icon: <HeartOutlined />, label: '我的接单' },
    { key: '/schedule', icon: <CalendarOutlined />, label: '排班日历' },
    { key: '/income', icon: <TeamOutlined />, label: '收入排行' },
    { key: '/messages', icon: <Badge count={unreadCount} size="small"><MessageOutlined /></Badge>, label: '消息中心' },
    { key: '/profile', icon: <SettingOutlined />, label: '个人中心' },
  ];

  const menuItems = user?.role === 'child' ? childMenuItems : workerMenuItems;

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenu = [
    {
      key: 'profile',
      icon: <SettingOutlined />,
      label: '个人中心',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout className="min-h-screen">
      <Sider trigger={null} collapsible collapsed={collapsed} theme="light">
        <div className="h-16 flex items-center justify-center bg-gradient-to-r from-orange-500 to-amber-500">
          <span className="text-white font-bold text-lg">
            {collapsed ? '关怀' : '老人关怀平台'}
          </span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header className="bg-white px-6 flex items-center justify-between shadow-sm">
          <span className="text-lg font-medium text-gray-700">
            欢迎回来，{user?.real_name}
          </span>
          <Dropdown menu={{ items: userMenu }} placement="bottomRight">
            <div className="flex items-center cursor-pointer hover:bg-gray-50 px-3 py-2 rounded-lg">
              <Avatar icon={<UserOutlined />} className="mr-2" />
              <span className="text-gray-700">{user?.real_name}</span>
            </div>
          </Dropdown>
        </Header>
        <Content className="m-6">{children}</Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
