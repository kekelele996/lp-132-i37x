import { useState, useEffect } from 'react';
import { Card, List, Avatar, Tag, Statistic, Row, Col, Select, message } from 'antd';
import { TrophyOutlined, UserOutlined, RiseOutlined, DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { userApi, scheduleApi } from '../services/api';
import { useAuthStore } from '../store/auth';

const { Option } = Select;

const IncomeRanking = () => {
  const { user } = useAuthStore();
  const [ranking, setRanking] = useState<any[]>([]);
  const [myRank, setMyRank] = useState(0);
  const [incomeData, setIncomeData] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'));

  const fetchRanking = async () => {
    try {
      const response = await userApi.getIncomeRanking();
      setRanking(response.data.ranking);
      setMyRank(response.data.myRank);
    } catch (error) {
      message.error('获取排行榜失败');
    }
  };

  const fetchIncome = async (month?: string) => {
    try {
      const params = month ? { month } : {};
      const response = await scheduleApi.getIncome(params);
      setIncomeData(response.data);
    } catch (error) {
      message.error('获取收入数据失败');
    }
  };

  useEffect(() => {
    fetchRanking();
    fetchIncome();
  }, []);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    fetchIncome(month);
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <TrophyOutlined className="text-yellow-500 text-xl" />;
    if (index === 1) return <TrophyOutlined className="text-gray-400 text-xl" />;
    if (index === 2) return <TrophyOutlined className="text-orange-600 text-xl" />;
    return <span className="text-lg font-bold text-gray-500">{index + 1}</span>;
  };

  const months = [];
  for (let i = 0; i < 12; i++) {
    const date = dayjs().subtract(i, 'month');
    months.push({
      value: date.format('YYYY-MM'),
      label: date.format('YYYY年MM月'),
    });
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">收入统计与排行</h1>
        <Select
          value={selectedMonth}
          onChange={handleMonthChange}
          style={{ width: 150 }}
        >
          {months.map((m) => (
            <Option key={m.value}>{m.label}</Option>
          ))}
        </Select>
      </div>

      <Row gutter={16} className="mb-6">
        <Col span={8}>
          <Card>
            <Statistic
              title="本月收入"
              value={incomeData?.summary?.total_income || 0}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="本月完成订单"
              value={incomeData?.summary?.total_orders || 0}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="我的排名"
              value={myRank || '-'}
              suffix={myRank ? `/${ranking.length}` : ''}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <div className="grid grid-cols-2 gap-6">
        <Card title="收入明细">
          {incomeData?.daily_income?.length > 0 ? (
            <List
              dataSource={incomeData.daily_income}
              renderItem={(item: any) => (
                <List.Item>
                  <List.Item.Meta
                    title={dayjs(item.date).format('YYYY-MM-DD')}
                    description={`完成 ${item.order_count} 单`}
                  />
                  <div className="text-right">
                    <span className="text-green-600 font-bold">+¥{item.daily_income}</span>
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <div className="text-center py-8 text-gray-400">暂无收入数据</div>
          )}
        </Card>

        <Card title="收入排行榜">
          <List
            dataSource={ranking}
            renderItem={(item, index) => (
              <List.Item
                className={item.id === user?.id ? 'bg-orange-50 rounded-lg' : ''}
              >
                <div className="flex items-center w-full">
                  <div className="w-10 flex justify-center">
                    {getRankIcon(index)}
                  </div>
                  <Avatar icon={<UserOutlined />} className="mx-4" src={item.avatar} />
                  <div className="flex-1">
                    <div className="font-medium">
                      {item.real_name}
                      {item.id === user?.id && (
                        <Tag color="orange" className="ml-2">我</Tag>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      完成 {item.order_count} 单
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                    ¥{item.total_income || 0}
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </Card>
      </div>
    </div>
  );
};

export default IncomeRanking;
