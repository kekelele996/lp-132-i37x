import { useState, useEffect } from 'react';
import { Card, Calendar, Badge, Button, Modal, Form, Select, Switch, message, List, Tag, Input } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { scheduleApi } from '../services/api';

const { Option } = Select;

const shiftTypeMap: Record<string, { label: string; color: string }> = {
  morning: { label: '早班 (08:00-12:00)', color: 'blue' },
  afternoon: { label: '午班 (12:00-18:00)', color: 'green' },
  evening: { label: '晚班 (18:00-22:00)', color: 'orange' },
  full: { label: '全天 (08:00-18:00)', color: 'purple' },
};

const Schedule = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [form] = Form.useForm();
  const [monthSchedules, setMonthSchedules] = useState<any[]>([]);

  const fetchSchedules = async (date?: Dayjs) => {
    try {
      const params: any = {};
      if (date) {
        params.start_date = date.startOf('month').format('YYYY-MM-DD');
        params.end_date = date.endOf('month').format('YYYY-MM-DD');
      }
      const response = await scheduleApi.getMySchedules(params);
      setSchedules(response.data);
      setMonthSchedules(response.data);
    } catch (error) {
      message.error('获取排班失败');
    }
  };

  useEffect(() => {
    fetchSchedules(dayjs());
  }, []);

  const handleDateSelect = (date: Dayjs) => {
    setSelectedDate(date);
    form.setFieldsValue({
      date: date.format('YYYY-MM-DD'),
      shift_type: 'morning',
      is_available: true,
    });
    setModalOpen(true);
  };

  const handlePanelChange = (date: Dayjs) => {
    fetchSchedules(date);
  };

  const handleSubmit = async (values: any) => {
    try {
      await scheduleApi.create(values);
      message.success('添加成功');
      setModalOpen(false);
      form.resetFields();
      fetchSchedules(dayjs());
    } catch (error: any) {
      message.error(error.response?.data?.message || '添加失败');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个排班吗？',
      onOk: async () => {
        try {
          await scheduleApi.delete(id);
          message.success('删除成功');
          fetchSchedules(dayjs());
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const getDateListData = (value: Dayjs) => {
    const dateStr = value.format('YYYY-MM-DD');
    const daySchedules = monthSchedules.filter(
      (s) => dayjs(s.date).format('YYYY-MM-DD') === dateStr
    );
    return daySchedules.map((s) => ({
      type: s.order_id ? 'success' : s.is_available ? 'warning' : 'default',
      content: shiftTypeMap[s.shift_type]?.label || s.shift_type,
    }));
  };

  const dateCellRender = (value: Dayjs) => {
    const listData = getDateListData(value);
    return (
      <ul className="p-0 m-0">
        {listData.map((item, index) => (
          <li key={index} className="text-xs mb-1">
            <Badge status={item.type as any} text={item.content} />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">排班日历</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleDateSelect(dayjs())}>
          添加排班
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <Calendar
            dateCellRender={dateCellRender}
            onSelect={handleDateSelect}
            onPanelChange={handlePanelChange}
          />
        </Card>

        <Card title="我的排班">
          <List
            dataSource={schedules.filter((s) => dayjs(s.date).isAfter(dayjs().subtract(1, 'day')))}
            renderItem={(item) => (
              <List.Item
                actions={[
                  !item.order_id && (
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(item.id)}
                    >
                      删除
                    </Button>
                  ),
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={dayjs(item.date).format('YYYY-MM-DD')}
                  description={
                    <div>
                      <Tag color={shiftTypeMap[item.shift_type]?.color}>
                        {shiftTypeMap[item.shift_type]?.label}
                      </Tag>
                      <div className="mt-1 text-sm">
                        {item.order_id ? (
                          <Tag color="green">有订单</Tag>
                        ) : item.is_available ? (
                          <Tag color="orange">可接单</Tag>
                        ) : (
                          <Tag color="default">休息</Tag>
                        )}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
            locale={{ emptyText: '暂无排班' }}
          />
        </Card>
      </div>

      <Modal
        title="添加排班"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="date" label="日期" hidden>
            <Input />
          </Form.Item>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-600">排班日期：</span>
            <span className="font-medium ml-2">{selectedDate?.format('YYYY年MM月DD日')}</span>
          </div>

          <Form.Item
            name="shift_type"
            label="班次"
            rules={[{ required: true, message: '请选择班次' }]}
          >
            <Select placeholder="请选择班次">
              <Option value="morning">早班 (08:00-12:00)</Option>
              <Option value="afternoon">午班 (12:00-18:00)</Option>
              <Option value="evening">晚班 (18:00-22:00)</Option>
              <Option value="full">全天 (08:00-18:00)</Option>
            </Select>
          </Form.Item>

          <Form.Item name="is_available" label="是否可接单" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>

          <Form.Item className="mb-0">
            <div className="flex justify-end space-x-3">
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">添加</Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Schedule;
