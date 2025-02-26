import React, { useState } from 'react';
import { Card, Table, Switch, InputNumber, Form, Space, Divider, Input, Button, message } from 'antd';
import { ANALYSIS_RULES, CROSS_VALIDATION_RULES, DEEPSEEK_CONFIG } from '../utils/dataAnalyzer';

interface DeepSeekFormValues {
  apiKey: string;
  anomalyThreshold: number;
  timeseriesAnalysis: boolean;
  systemPrompt: string;
}

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm<DeepSeekFormValues>();
  const [apiKey, setApiKey] = useState(DEEPSEEK_CONFIG.apiKey);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | ''>('');

  React.useEffect(() => {
    // 组件加载时从服务器获取最新配置
    fetch('http://localhost:3001/api/config/get')
      .then(response => response.json())
      .then(config => {
        // 更新前端配置对象
        Object.assign(DEEPSEEK_CONFIG, config);
        // 更新表单字段
        form.setFieldsValue({
          apiKey: config.apiKey,
          anomalyThreshold: config.anomalyThreshold,
          timeseriesAnalysis: config.timeseriesAnalysis,
          systemPrompt: config.systemPrompt
        });
        setApiKey(config.apiKey);

        // 更新规则状态
        if (Array.isArray(config.analysisRules)) {
          const updatedBasicRules = ANALYSIS_RULES.map((rule, index) => {
            const configRule = config.analysisRules[index];
            return {
              ...rule,
              enabled: configRule ? configRule.enabled : false,
              key: index
            };
          });
          setBasicRules(updatedBasicRules);
          // 同步更新ANALYSIS_RULES的状态
          ANALYSIS_RULES.forEach((rule, index) => {
            const configRule = config.analysisRules[index];
            rule.enabled = configRule ? configRule.enabled : false;
          });
        }

        if (Array.isArray(config.crossValidationRules)) {
          const updatedCrossRules = CROSS_VALIDATION_RULES.map((rule, index) => {
            const configRule = config.crossValidationRules[index];
            return {
              ...rule,
              enabled: configRule ? configRule.enabled : false,
              key: index
            };
          });
          setCrossRules(updatedCrossRules);
          // 同步更新CROSS_VALIDATION_RULES的状态
          CROSS_VALIDATION_RULES.forEach((rule, index) => {
            const configRule = config.crossValidationRules[index];
            rule.enabled = configRule ? configRule.enabled : false;
          });
        }
      })
      .catch(error => {
        console.error('获取配置失败:', error);
        message.error('获取配置失败，将使用默认配置');
      });
  }, [form]);

  const handleSaveConfig = async (values: DeepSeekFormValues) => {
    try {
      // 更新配置文件，确保所有规则都是启用状态
      const updatedConfig = {
        ...DEEPSEEK_CONFIG,
        apiKey: values.apiKey,
        anomalyThreshold: values.anomalyThreshold,
        timeseriesAnalysis: values.timeseriesAnalysis,
        systemPrompt: values.systemPrompt,
        analysisRules: ANALYSIS_RULES.map(rule => ({
          ...rule,
          enabled: true
        })),
        crossValidationRules: CROSS_VALIDATION_RULES.map(rule => ({
          ...rule,
          enabled: true
        }))
      };

      // 发送请求更新配置文件
      const response = await fetch('http://localhost:3001/api/config/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedConfig),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存配置失败');
      }

      // 更新前端配置对象
      Object.assign(DEEPSEEK_CONFIG, updatedConfig);
      // 更新规则状态
      ANALYSIS_RULES.forEach((rule, index) => {
        rule.enabled = updatedConfig.analysisRules[index].enabled;
      });
      CROSS_VALIDATION_RULES.forEach((rule, index) => {
        rule.enabled = updatedConfig.crossValidationRules[index].enabled;
      });

      setSaveStatus('success');
      message.success('配置已保存');
      setApiKey(values.apiKey);
    } catch (error) {
      setSaveStatus('error');
      message.error(error instanceof Error ? error.message : '保存配置失败，请检查服务器连接');
      console.error('保存配置失败:', error);
    }
  };

  const [basicRules, setBasicRules] = useState(() => {
    // 从ANALYSIS_RULES中读取规则，并设置为启用状态
    return ANALYSIS_RULES.map((rule, index) => ({
      ...rule,
      enabled: true,
      key: index
    }));
  });

  const [crossRules, setCrossRules] = useState(() => {
    // 从CROSS_VALIDATION_RULES中读取规则，并设置为启用状态
    return CROSS_VALIDATION_RULES.map((rule, index) => ({
      ...rule,
      enabled: true,
      key: index
    }));
  });

  const basicColumns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '规则描述',
      dataIndex: 'description',
      key: 'description',
    },
  ];

  const crossColumns = [
    {
      title: '指标1',
      dataIndex: 'indicator1',
      key: 'indicator1',
    },
    {
      title: '指标2',
      dataIndex: 'indicator2',
      key: 'indicator2',
    },
    {
      title: '规则描述',
      dataIndex: 'message',
      key: 'message',
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSaveConfig}
        style={{ width: '100%' }}
      >
        <Card title="深度学习配置">
          <Form.Item
            label="API密钥"
            name="apiKey"
            rules={[{ required: true, message: '请输入API密钥' }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="系统提示词"
            name="systemPrompt"
            tooltip="设置与AI模型交互时的系统提示词"
          >
            <Input.TextArea rows={4} placeholder="请输入系统提示词" />
          </Form.Item>

          <Form.Item
            label="异常检测阈值"
            name="anomalyThreshold"
            tooltip="设置深度学习模型判定异常的阈值（0-1之间）"
          >
            <InputNumber
              min={0}
              max={1}
              step={0.01}
              style={{ width: 200 }}
            />
          </Form.Item>

          <Form.Item
            label="时间序列分析"
            name="timeseriesAnalysis"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Card>

        <Card title="基础规则配置">
          <Table
            columns={basicColumns}
            dataSource={basicRules}
            pagination={false}
          />
        </Card>

        <Card title="交叉验证规则配置">
          <Table
            columns={crossColumns}
            dataSource={crossRules}
            pagination={false}
          />
        </Card>

        <Form.Item style={{ marginTop: 24, textAlign: 'center' }}>
          <Button type="primary" htmlType="submit" size="large">
            保存所有配置
          </Button>
        </Form.Item>
      </Form>
    </Space>
  );
};

export default SettingsPage;