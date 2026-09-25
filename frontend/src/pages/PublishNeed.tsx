import { useState, useEffect } from 'react';
import { Card, Form, Input, Select, DatePicker, InputNumber, Button, message, Row, Col } from 'antd';
import { elderlyApi, careNeedsApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const careTypes = [
  { value: 'health_check', label: '健康检查' },
  { value: 'accompany', label: '陪同就医' },
  { value: 'daily_care', label: '日常照料' },
  { value: 'shopping', label: '代购代办' },
  { value: 'companionship', label: '聊天陪伴' },
  { value: 'other', label: '其他' },
];

const PublishNeed = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [elderlyList, setElderlyList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchElderly = async () => {
      try {
        const response = await elderlyApi.getList();
        setElderlyList(response.data);
      } catch (error) {
        message.error('获取老人列表失败');
      }
    };
    fetchElderly();
  }, []);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const [start_time, end_time] = values.time_range;
      const duration_hours = end_time.diff(start_time, 'hour', true);

      await careNeedsApi.create({
        ...values,
        start_time: start_time.toISOString(),
        end_time: end_time.toISOString(),
        duration_hours: duration_hours.toFixed(2),
      });

      message.success('发布成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || '发布失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">发布照护需求</h1>

      <Card className="max-w-3xl mx-auto">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            price: 80,
            duration_hours: 1,
          }}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="elderly_id"
                label="选择老人"
                rules={[{ required: true, message: '请选择服务对象' }]}
              >
                <Select placeholder="请选择要服务的老人">
                  {elderlyList.map((elderly) => (
                    <Option key={elderly.id} value={elderly.id}>
                      {elderly.name} ({elderly.gender}，{elderly.age}岁)
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="title"
                label="需求标题"
                rules={[{ required: true, message: '请输入需求标题' }]}
              >
                <Input placeholder="例如：上门量血压、陪同就医等" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="care_type"
                label="服务类型"
                rules={[{ required: true, message: '请选择服务类型' }]}
              >
                <Select placeholder="请选择服务类型">
                  {careTypes.map((type) => (
                    <Option key={type.value} value={type.value}>
                      {type.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="服务描述"
            rules={[{ required: true, message: '请输入服务描述' }]}
          >
            <TextArea
              rows={4}
              placeholder="请详细描述您的需求，包括服务内容、注意事项等"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="time_range"
                label="服务时间"
                rules={[{ required: true, message: '请选择服务时间' }]}
              >
                <RangePicker
                  showTime
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD HH:mm"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="price"
                label="服务价格(元)"
                rules={[{ required: true, message: '请输入服务价格' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={10}
                  placeholder="请输入价格"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="address"
            label="服务地址"
            rules={[{ required: true, message: '请输入服务地址' }]}
          >
            <Input placeholder="请输入详细的服务地址" />
          </Form.Item>

          <Form.Item className="mb-0">
            <div className="flex justify-end space-x-3">
              <Button onClick={() => navigate('/')}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                发布需求
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default PublishNeed;
