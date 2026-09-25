import { useState, useEffect, useRef } from 'react';
import { List, Input, Button, Avatar, Empty, Badge, Card, message } from 'antd';
import { SendOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { messageApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import dayjs from 'dayjs';

const { Search } = Input;

const MessageCenter = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [_loading, _setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      const response = await messageApi.getConversations();
      setConversations(response.data);
    } catch (error) {
      message.error('获取会话列表失败');
    }
  };

  const fetchMessages = async (userId: string) => {
    try {
      const response = await messageApi.getConversation(userId);
      setMessages(response.data.messages);
    } catch (error) {
      message.error('获取消息失败');
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    const stateUserId = (location.state as any)?.userId;
    if (stateUserId) {
      const conversation = conversations.find((c) => c.other_user_id === stateUserId);
      if (conversation) {
        handleSelectUser(conversation);
      }
    }
  }, [location.state, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectUser = (conversation: any) => {
    setSelectedUser(conversation);
    fetchMessages(conversation.other_user_id);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !selectedUser) return;

    try {
      await messageApi.send({
        receiver_id: selectedUser.other_user_id,
        content: inputValue.trim(),
      });

      setInputValue('');
      fetchMessages(selectedUser.other_user_id);
      fetchConversations();
    } catch (error) {
      message.error('发送失败');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">消息中心</h1>

      <div className="flex h-[calc(100vh-200px)]">
        <Card className="w-80 mr-4 flex-shrink-0" styles={{ body: { padding: 0 } }}>
          <div className="p-4 border-b">
            <Search placeholder="搜索联系人" />
          </div>
          <List
            dataSource={conversations}
            renderItem={(item) => (
              <List.Item
                className={`cursor-pointer hover:bg-gray-50 ${selectedUser?.other_user_id === item.other_user_id ? 'bg-orange-50' : ''}`}
                onClick={() => handleSelectUser(item)}
              >
                <List.Item.Meta
                  avatar={
                    <Badge count={item.unread_count} size="small">
                      <Avatar icon={<UserOutlined />} />
                    </Badge>
                  }
                  title={
                    <div className="flex justify-between">
                      <span>{item.other_user_name}</span>
                      <span className="text-xs text-gray-400">
                        {dayjs(item.created_at).format('MM-DD HH:mm')}
                      </span>
                    </div>
                  }
                  description={
                    <span className="truncate block w-48">
                      {item.content}
                    </span>
                  }
                />
              </List.Item>
            )}
            locale={{ emptyText: <Empty description="暂无会话" /> }}
          />
        </Card>

        <Card className="flex-1 flex flex-col" styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%' } }}>
          {selectedUser ? (
            <>
              <div className="flex items-center pb-4 border-b mb-4">
                <Avatar icon={<UserOutlined />} className="mr-3" />
                <div>
                  <div className="font-medium">{selectedUser.other_user_name}</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                {messages.map((msg: any, index: number) => (
                  <div
                    key={index}
                    className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender_id !== user?.id && (
                      <Avatar icon={<UserOutlined />} className="mr-2 flex-shrink-0" size="small" />
                    )}
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-lg ${
                        msg.sender_id === user?.id
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.sender_id === user?.id ? 'text-orange-100' : 'text-gray-400'
                        }`}
                      >
                        {dayjs(msg.created_at).format('HH:mm')}
                      </p>
                    </div>
                    {msg.sender_id === user?.id && (
                      <Avatar icon={<UserOutlined />} className="ml-2 flex-shrink-0" size="small" />
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex items-center space-x-2">
                <Input.TextArea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入消息..."
                  rows={1}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  style={{ resize: 'none' }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                >
                  发送
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Empty description="请选择一个会话开始聊天" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default MessageCenter;
