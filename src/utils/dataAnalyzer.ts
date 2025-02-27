import axios from 'axios';
import config from '../config/deepseek'
interface HospitalData {
  hospitalName: string;
  date: string;
  医疗收入: number;
  门急诊收入: number;
  住院收入: number;
  手术人数: number;
  门急诊人次: number;
  入院人次: number;
  实际在院总床日数: number;
  出院人次: number;
  [key: string]: string | number;
}

interface AnomalyResult {
  type: string;
  hospital: string;
  date: string;
  indicator?: string;
  value?: number;
  rule?: string;
  message?: string;
  values?: Record<string, number>;
}

// 定义目标指标列表 - 将在数据处理时动态获取
export let TARGET_INDICATORS: string[] = [];

// 设置目标指标列表
export function setTargetIndicators(indicators: string[]) {
  TARGET_INDICATORS = indicators;
}

// 从数据中动态获取指标名称
function getIndicatorsFromData(data: HospitalData[]): string[] {
  if (!data || data.length === 0) return [];
  
  // 获取第一条记录的所有键
  const allKeys = Object.keys(data[0]);
  
  // 过滤掉非指标字段（如医院名称、日期等）
  const excludeFields = ['hospitalName', 'date'];
  return allKeys.filter(key => !excludeFields.includes(key));
}

// 获取当前数据集的指标列表
export function getCurrentIndicators(data: HospitalData[]): string[] {
  return getIndicatorsFromData(data);
}

interface AnalysisRule {
  name: string;
  description: string;
  validate: (value: number, context?: any) => boolean;
  enabled?: boolean;
}

interface CrossValidationRule {
  indicator1: string;
  indicator2: string;
  validate: (value1: number, value2: number) => boolean;
  message: string;
  enabled?: boolean;
}

export const ANALYSIS_RULES: AnalysisRule[] = [
  {
    name: '波动率校验',
    description: '检查指标波动是否超过阈值',
    validate: (curr, { prev }) => {
      if (prev === 0) return true;
      return Math.abs(curr - prev) / prev < 0.3;
    },
    enabled: true
  }
];

export const CROSS_VALIDATION_RULES: CrossValidationRule[] = [
  {
    indicator1: '出院人次',
    indicator2: '住院收入',
    validate: (dischargeCount, hospitalizedIncome) => 
      !(dischargeCount > 0 && hospitalizedIncome <= 0),
    message: '出院人次大于0但住院收入为0或负数',
    enabled: true
  },
  {
    indicator1: '手术人数',
    indicator2: '医疗收入',
    validate: (surgeryCount, medicalIncome) =>
      !(surgeryCount > 0 && medicalIncome < 10000),
    message: '有手术记录但医疗收入异常偏低',
    enabled: true
  }
];

interface DeepSeekConfig {
  apiKey: string;
  anomalyThreshold: number;
  timeseriesAnalysis: boolean;
  systemPrompt: string;
}

export const DEEPSEEK_CONFIG: DeepSeekConfig = config;

export async function analyzeData(data: HospitalData[]) {
  const anomalies: AnomalyResult[] = [];
  
  // 基础规则检验
  // 获取当前数据集的所有指标
  const indicators = getIndicatorsFromData(data);

  // 分别执行基础规则和交叉规则验证
  // 基础规则验证
  for (const record of data) {
    for (const indicator of indicators) {
      const value = record[indicator] as number;
      
      for (const rule of ANALYSIS_RULES) {
        if (rule.enabled && !rule.validate(value, { prev: getPreviousValue(data, record, indicator) })) {
          anomalies.push({
            type: '单指标异常',
            hospital: record.hospitalName,
            date: record.date,
            indicator,
            value,
            rule: rule.name
          });
        }
      }
    }
  }

  // 交叉验证规则（独立于基础规则）
  for (const record of data) {
    for (const rule of CROSS_VALIDATION_RULES) {
      if (!rule.enabled) continue;
      
      const value1 = record[rule.indicator1] as number;
      const value2 = record[rule.indicator2] as number;
      
      if (!rule.validate(value1, value2)) {
        anomalies.push({
          type: '关联性异常',
          hospital: record.hospitalName,
          date: record.date,
          message: rule.message,
          values: { [rule.indicator1]: value1, [rule.indicator2]: value2 }
        });
      }
    }
  }
  
  // DeepSeek API分析
  if (DEEPSEEK_CONFIG.apiKey) {
    try {
      const deepseekAnomalies = await callDeepSeekAPI(data);
      anomalies.push(...deepseekAnomalies);
    } catch (error) {
      console.error('DeepSeek API调用失败:', error);
    }
  }
  
  return anomalies;
}

function getPreviousValue(data: HospitalData[], currentRecord: HospitalData, indicator: keyof HospitalData): number {
  const currentIndex = data.findIndex(record => 
    record.hospitalName === currentRecord.hospitalName && 
    record.date === currentRecord.date
  );
  
  if (currentIndex > 0) {
    const prevRecord = data[currentIndex - 1];
    const prevValue = prevRecord[indicator];
    return typeof prevValue === 'number' ? prevValue : 0;
  }
  
  return 0;
}

interface DeepSeekResponse {
  choices: Array<{
    message?: {
      content: string;
    };
  }>;
}

interface DeepSeekAnomaly {
  hospitalName?: string;
  hospital?: string;
  date?: string;
  indicator?: string;
  field?: string;
  value?: number;
  description?: string;
  message?: string;
}

async function callDeepSeekAPI(data: HospitalData[]): Promise<AnomalyResult[]> {
  if (!DEEPSEEK_CONFIG.apiKey) {
    console.log('未配置DeepSeek API密钥，跳过深度学习分析');
    return [];
  }

  const maxRetries = 3;
  const timeout = 100000; // 10秒超时

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log('正在发送请求到后端服务器...');
      const requestData = {
        model: 'deepseek-r1-250120',
        messages: [
          {role: 'system', content: DEEPSEEK_CONFIG.systemPrompt},
          {role: 'user', content: `请分析以下医疗数据中的异常情况：${JSON.stringify(data)}`}
        ]
      };
      
      const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      console.log('请求配置:', {
        url: apiUrl,
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey.substring(0, 8)}...`,
          'Content-Type': 'application/json'
        },
        timeout
      });

      const response = await axios.post<DeepSeekResponse>(apiUrl, requestData, {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new Error('API响应格式无效');
      }

      // 尝试从响应中提取异常数据
      let anomalies: DeepSeekAnomaly[] = [];
      if (response.data.choices && Array.isArray(response.data.choices) && response.data.choices.length > 0) {
        const content = response.data.choices[0].message?.content;
        if (content) {
          try {
            // 提取content中的JSON数组部分
            const jsonMatch = content.match(/\[([\s\S]*?)\]/); // 匹配最外层的方括号及其内容
            if (jsonMatch) {
              const jsonStr = jsonMatch[0];
              const parsedContent = JSON.parse(jsonStr);
              if (Array.isArray(parsedContent)) {
                anomalies = parsedContent;
              }
            } else {
              console.warn('未在响应内容中找到JSON数组');
            }
          } catch (parseError) {
            console.warn('无法解析AI返回的内容:', parseError);
          }
        }
      }

      return anomalies.map((anomaly) => ({
        type: '深度学习检测',
        hospital: anomaly.hospitalName || anomaly.hospital || '未知医院',
        date: anomaly.date || '未知日期',
        indicator: anomaly.indicator || anomaly.field,
        value: typeof anomaly.value === 'number' ? anomaly.value : undefined,
        message: anomaly.description || anomaly.message || '检测到异常'
      }));

    } catch (error) {
      console.error(`DeepSeek API调用失败 (尝试 ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) {
        console.warn('DeepSeek API调用重试次数已达上限，将仅使用基础规则进行分析');
        return [];
      }
      // 在重试之前等待一段时间
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  return [];
}
