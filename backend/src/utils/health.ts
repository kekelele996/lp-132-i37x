// 血压异常判定阈值
import { PoolClient } from 'pg';

export const SYSTOLIC_THRESHOLD = 140;
export const DIASTOLIC_THRESHOLD = 90;

export interface MeasurementData {
  systolic_pressure: number;
  diastolic_pressure: number;
  heart_rate: number;
  measured_at: string;
}

// 判定血压是否异常，并生成异常原因说明
export const evaluateBloodPressure = (
  systolic: number,
  diastolic: number
): { isAbnormal: boolean; abnormalReason: string | null } => {
  const reasons: string[] = [];

  if (systolic >= SYSTOLIC_THRESHOLD) {
    reasons.push(`收缩压 ${systolic}mmHg 达到 ${SYSTOLIC_THRESHOLD}mmHg 警戒线`);
  }
  if (diastolic >= DIASTOLIC_THRESHOLD) {
    reasons.push(`舒张压 ${diastolic}mmHg 达到 ${DIASTOLIC_THRESHOLD}mmHg 警戒线`);
  }

  return {
    isAbnormal: reasons.length > 0,
    abnormalReason: reasons.length > 0 ? reasons.join('；') : null,
  };
};

const isValidInt = (value: unknown, min: number, max: number): boolean => {
  const num = Number(value);
  return Number.isInteger(num) && num >= min && num <= max;
};

// 校验并解析测量数据，全部字段填写完整才返回 data
export const parseMeasurement = (
  body: any
): { data?: MeasurementData; error?: string } => {
  const { systolic_pressure, diastolic_pressure, heart_rate, measured_at } = body || {};

  if (
    systolic_pressure === undefined || systolic_pressure === null || systolic_pressure === '' ||
    diastolic_pressure === undefined || diastolic_pressure === null || diastolic_pressure === '' ||
    heart_rate === undefined || heart_rate === null || heart_rate === '' ||
    !measured_at
  ) {
    return { error: '请完整填写收缩压、舒张压、心率和测量时间' };
  }

  if (!isValidInt(systolic_pressure, 40, 300)) {
    return { error: '收缩压需为 40-300 之间的整数' };
  }
  if (!isValidInt(diastolic_pressure, 20, 200)) {
    return { error: '舒张压需为 20-200 之间的整数' };
  }
  if (!isValidInt(heart_rate, 20, 250)) {
    return { error: '心率需为 20-250 之间的整数' };
  }

  const measuredAt = new Date(measured_at);
  if (Number.isNaN(measuredAt.getTime())) {
    return { error: '测量时间格式不正确' };
  }
  // 允许 10 分钟时钟误差，测量时间不能是将来的时间
  if (measuredAt.getTime() > Date.now() + 10 * 60 * 1000) {
    return { error: '测量时间不能是将来的时间' };
  }

  return {
    data: {
      systolic_pressure: Number(systolic_pressure),
      diastolic_pressure: Number(diastolic_pressure),
      heart_rate: Number(heart_rate),
      measured_at: measured_at,
    },
  };
};

// 判断请求体中是否携带了测量数据字段
export const hasMeasurementPayload = (body: any): boolean => {
  if (!body) return false;
  return ['systolic_pressure', 'diastolic_pressure', 'heart_rate', 'measured_at'].some(
    (key) => body[key] !== undefined && body[key] !== null && body[key] !== ''
  );
};

// 保存测量记录：每个订单仅一条，重复提交覆盖更新；异常时生成待跟进提醒（不重复生成）
export const upsertHealthRecord = async (
  client: PoolClient,
  order: { id: string; elderly_id: string; child_id: string },
  workerId: string,
  measurement: MeasurementData
) => {
  const { isAbnormal, abnormalReason } = evaluateBloodPressure(
    measurement.systolic_pressure,
    measurement.diastolic_pressure
  );

  const recordResult = await client.query(
    `INSERT INTO health_records (order_id, elderly_id, worker_id, systolic_pressure, diastolic_pressure, heart_rate, measured_at, is_abnormal, abnormal_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (order_id) DO UPDATE SET
       worker_id = EXCLUDED.worker_id,
       systolic_pressure = EXCLUDED.systolic_pressure,
       diastolic_pressure = EXCLUDED.diastolic_pressure,
       heart_rate = EXCLUDED.heart_rate,
       measured_at = EXCLUDED.measured_at,
       is_abnormal = EXCLUDED.is_abnormal,
       abnormal_reason = EXCLUDED.abnormal_reason,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      order.id,
      order.elderly_id,
      workerId,
      measurement.systolic_pressure,
      measurement.diastolic_pressure,
      measurement.heart_rate,
      measurement.measured_at,
      isAbnormal,
      abnormalReason,
    ]
  );

  const record = recordResult.rows[0];

  if (isAbnormal) {
    await client.query(
      `INSERT INTO health_alerts (record_id, elderly_id, child_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (record_id) DO NOTHING`,
      [record.id, order.elderly_id, order.child_id]
    );
  }

  return record;
};
