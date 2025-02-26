import express from 'express';
import cors from 'cors';
import { updateConfig } from './api/config';
import fs from 'fs';
import path from 'path';

const app = express();
const port = process.env.PORT || 3001;

// 中间件配置
app.use(cors());
app.use(express.json());

// API路由
app.get('/api/config/get', async (req, res) => {
  try {
    // 每次请求时重新读取配置文件
    const configPath = path.resolve(__dirname, './config/deepseek.ts');
    const configContent = await fs.promises.readFile(configPath, 'utf-8');
    
    // 使用正则表达式提取配置对象
    const configMatch = configContent.match(/const DEEPSEEK_CONFIG = ({[\s\S]*?});/);
    if (!configMatch) {
      throw new Error('无法解析配置文件');
    }
    
    // 将配置字符串转换为对象
    const config = eval('(' + configMatch[1] + ')');
    res.json(config);
  } catch (error) {
    console.error('获取配置失败:', error);
    res.status(500).json({ error: '获取配置失败' });
  }
});

app.post('/api/config/update', updateConfig);

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});