import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import { updateConfig, getConfig } from './api/config';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const app = express();
const port = process.env.PORT || 3001;

// 中间件配置
app.use(cors({
  origin: true,  // 允许所有来源访问
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// API路由
const router = express.Router();

// DeepSeek API代理
const handleDeepSeekProxy: RequestHandler = async (req, res) => {
  try {
    // 验证请求体
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: '无效的请求数据' });
      return;
    }

    const { model, messages } = req.body;

    // 验证必要字段
    if (!model || !Array.isArray(messages)) {
      res.status(400).json({ error: '缺少必要的请求参数' });
      return;
    }

    // 优先使用请求头中的Authorization，去掉Bearer前缀
    const authHeader = req.headers['authorization'];
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      console.warn('API请求未提供密钥');
      res.status(401).json({ error: '未提供API密钥' });
      return;
    }

    console.log('=== DeepSeek API 请求开始 ===');
    console.log('请求URL:', 'https://ark.cn-beijing.volces.com/api/v3/chat/completions');
    console.log('请求方法: POST');
    console.log('请求头:', {
      'Authorization': `Bearer ${apiKey.substring(0, 8)}...`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Origin': 'https://ark.cn-beijing.volces.com',
      'Referer': 'https://ark.cn-beijing.volces.com'
    });
    console.log('请求参数:', {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content_length: m.content ? m.content.length : 0
      }))
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;

    try {
      console.log('正在发送请求...');
      const startTime = Date.now();
      response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://ark.cn-beijing.volces.com',
          'Referer': 'https://ark.cn-beijing.volces.com'
        },
        body: JSON.stringify({ model, messages }),
        signal: controller.signal
      });
      const endTime = Date.now();
      console.log(`请求耗时: ${endTime - startTime}ms`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error('DeepSeek API响应错误:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        url: response.url,
        headers: Object.fromEntries(response.headers)
      });
      
      // 根据不同的错误状态码返回相应的错误信息
      if (response.status === 401) {
        throw new Error('API密钥无效或未授权');
      } else if (response.status === 429) {
        throw new Error('请求次数超限，请稍后重试');
      } else if (response.status >= 500) {
        throw new Error('DeepSeek API服务器错误，请稍后重试');
      }
      
      throw new Error(`DeepSeek API请求失败: ${response.status} ${response.statusText}\n${errorData}`);
    }

    const data = await response.json();
    
    // 验证API响应数据结构
    const responseData = data as { choices?: unknown[] };
    if (!responseData || !Array.isArray(responseData.choices)) {
      console.error('DeepSeek API返回的数据结构无效:', data);
      throw new Error('API返回的数据结构无效');
    }

    console.log('DeepSeek API请求成功');
    res.json(data);
  } catch (error) {
    console.error('DeepSeek API代理错误:', {
      name: error instanceof Error ? error.name : 'Unknown Error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    // 根据错误类型返回适当的状态码和错误信息
    if (error instanceof TypeError) {
      res.status(400).json({ error: '请求参数类型错误' });
    } else if (error instanceof Error && error.message.includes('API返回的数据结构无效')) {
      res.status(502).json({ error: 'API返回的响应无效' });
    } else {
      res.status(500).json({
        error: error instanceof Error ? error.message : '调用DeepSeek API失败',
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : undefined : undefined
      });
    }
  }
};

router.post('/deepseek', handleDeepSeekProxy);
router.get('/config/get', getConfig);
router.post('/config/update', updateConfig);

// 配置路由
app.use('/api', router);

// 启动服务器
const server = app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}).on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${port} 已被占用，请先关闭占用该端口的进程或使用其他端口`);
    process.exit(1);
  } else {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
});

// 优雅关闭服务器
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
