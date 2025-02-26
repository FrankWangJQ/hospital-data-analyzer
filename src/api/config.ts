import { Request, Response, RequestHandler } from 'express';
import fs from 'fs';
import path from 'path';

const configPath = path.resolve(__dirname, '../config/deepseek.ts');

export const updateConfig: RequestHandler = async (req, res) => {
  try {
    const newConfig = req.body;
    
    // 验证必要的配置字段
    if (!newConfig || typeof newConfig !== 'object') {
      res.status(400).json({ error: '无效的配置数据' });
      return;
    }

    // 读取现有配置文件内容
    const currentContent = await fs.promises.readFile(configPath, 'utf-8');
    
    // 生成新的配置文件内容
    const newContent = `// DeepSeek API配置
const DEEPSEEK_CONFIG = {
  apiKey: '${newConfig.apiKey ?? ''}',
  anomalyThreshold: ${newConfig.anomalyThreshold ?? 0.8},
  timeseriesAnalysis: ${newConfig.timeseriesAnalysis ?? true},
  systemPrompt: ${JSON.stringify(newConfig.systemPrompt ?? '')},  // 使用JSON.stringify确保正确转义
  analysisRules: ${JSON.stringify(newConfig.analysisRules ?? [])},
  crossValidationRules: ${JSON.stringify(newConfig.crossValidationRules ?? [])}
};

export default DEEPSEEK_CONFIG;`;

    // 写入新的配置内容
    await fs.promises.writeFile(configPath, newContent, 'utf-8');

    res.json({ success: true, message: '配置更新成功' });
  } catch (error) {
    console.error('更新配置文件失败:', error);
    res.status(500).json({ error: '更新配置文件失败' });
  }
}