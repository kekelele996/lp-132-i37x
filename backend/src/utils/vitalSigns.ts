/**
 * 血压异常判定：
 * - 收缩压 >= 140 mmHg 或 舒张压 >= 90 mmHg 判定为异常
 */
export const SYSTOLIC_THRESHOLD = 140;
export const DIASTOLIC_THRESHOLD = 90;

export const isBloodPressureAbnormal = (systolic: number, diastolic: number): boolean =>
  systolic >= SYSTOLIC_THRESHOLD || diastolic >= DIASTOLIC_THRESHOLD;

export const buildAbnormalReason = (systolic: number, diastolic: number): string | null => {
  if (!isBloodPressureAbnormal(systolic, diastolic)) {
    return null;
  }

  const reasons: string[] = [];
  if (systolic >= SYSTOLIC_THRESHOLD) {
    reasons.push(`收缩压${systolic}mmHg ≥ ${SYSTOLIC_THRESHOLD}mmHg`);
  }
  if (diastolic >= DIASTOLIC_THRESHOLD) {
    reasons.push(`舒张压${diastolic}mmHg ≥ ${DIASTOLIC_THRESHOLD}mmHg`);
  }
  return '血压偏高：' + reasons.join('，');
};
