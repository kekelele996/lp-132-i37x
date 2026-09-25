import { useState, useEffect } from 'react';
import { Card, List, Button, Rate, Tag, message, Empty, Avatar } from 'antd';
import { UserOutlined, MessageOutlined, DeleteOutlined } from '@ant-design/icons';
import { favoriteApi } from '../services/api';
import { useNavigate } from 'react-router-dom';

const Favorites = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const response = await favoriteApi.getList();
      setFavorites(response.data);
    } catch (error) {
      message.error('获取收藏列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleRemove = async (workerId: string) => {
    try {
      await favoriteApi.remove(workerId);
      message.success('已取消收藏');
      fetchFavorites();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleChat = (workerId: string) => {
    navigate('/messages', { state: { userId: workerId } });
  };

  const handleBook = (_workerId: string) => {
    navigate('/publish');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">收藏的护工</h1>

      {favorites.length === 0 ? (
        <Card>
          <Empty description="暂无收藏的护工" />
        </Card>
      ) : (
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
          dataSource={favorites}
          loading={loading}
          renderItem={(item) => (
            <List.Item>
              <Card hoverable>
                <div className="text-center">
                  <Avatar size={80} icon={<UserOutlined />} src={item.avatar} />
                  <h3 className="text-lg font-bold mt-4">{item.real_name}</h3>
                  <div className="flex justify-center items-center mt-2">
                    <Rate disabled value={item.rating} className="text-sm" />
                    <span className="ml-2 text-gray-500 text-sm">{item.rating}</span>
                  </div>
                  <div className="mt-2">
                    <Tag color="blue">已完成 {item.order_count} 单</Tag>
                  </div>
                  {item.skills && (
                    <div className="mt-3 text-sm text-gray-600">
                      技能：{item.skills}
                    </div>
                  )}
                  {item.introduction && (
                    <div className="mt-2 text-sm text-gray-500 line-clamp-2">
                      {item.introduction}
                    </div>
                  )}
                  <div className="mt-4 flex justify-center space-x-2">
                    <Button
                      size="small"
                      icon={<MessageOutlined />}
                      onClick={() => handleChat(item.worker_id)}
                    >
                      联系
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => handleBook(item.worker_id)}
                    >
                      预约
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemove(item.worker_id)}
                    >
                      取消收藏
                    </Button>
                  </div>
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  );
};

export default Favorites;
