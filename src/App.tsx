import React, { useState } from 'react';
import { Layout, Menu, Upload, Button, Table, Card, Alert, Spin, message, Space } from 'antd';
import type { MenuProps } from 'antd';
const { Header, Sider, Content } = Layout;
import { UploadOutlined, BarChartOutlined, SettingOutlined, PlayCircleOutlined } from '@ant-design/icons';
import AnalysisPage from './components/AnalysisPage';
import SettingsPage from './components/SettingsPage';
import type { UploadFile } from 'antd/es/upload/interface';
import * as XLSX from 'xlsx';
import { analyzeData, TARGET_INDICATORS, setTargetIndicators } from './utils/dataAnalyzer';

interface HospitalData {
  date: string;
  hospitalName: string;
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

const App: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadedData, setUploadedData] = useState<Map<string, HospitalData[]>>(new Map());
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [currentPage, setCurrentPage] = useState<string>('upload');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (!e.target?.result) {
          message.error('文件读取失败');
          return;
        }
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        // 从文件名中提取医院名称（去除扩展名）
        const hospitalName = file.name.replace(/.[^/.]+$/, '');
        
        // 验证工作表是否存在
        if (!workbook.SheetNames.length) {
          message.error('Excel文件不包含任何工作表');
          return;
        }
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(firstSheet, { 
          header: 1,
          raw: true,
          blankrows: false,
          dateNF: 'yyyy-MM-dd',
          defval: null
        }) as any[][];
        
        // 验证数据格式
        if (!Array.isArray(rawData) || rawData.length < 3) {
          message.error('Excel文件格式无效，请确保包含表头和数据行');
          return;
        }
        
        // 获取表头并验证
        const headers = rawData[0];
        if (!Array.isArray(headers) || headers.length < 2) {
          message.error('表头格式无效，请检查Excel文件');
          return;
        }
        
        const indicators = headers.slice(1).filter((header: string) => header);
        setTargetIndicators(indicators);
        
        // 处理数据并添加医院名称
        const jsonData = rawData.slice(2).map(row => {
          const record: any = { hospitalName };
          
          // 格式化日期
          const rawDate = row[0];
          if (rawDate instanceof Date) {
            record.date = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'number') {
            const excelDate = new Date((rawDate - 25569) * 86400 * 1000);
            record.date = excelDate.toISOString().split('T')[0];
          } else {
            record.date = String(rawDate || '');
          }
          
          // 根据表头映射其他字段
          headers.forEach((header: string, index: number) => {
            if (index > 0 && header) {
              let value = row[index];
              if (value === undefined || value === null || value === '') {
                record[header] = 0;
              } else {
                if (typeof value === 'number') {
                  record[header] = value;
                } else if (typeof value === 'string') {
                  const normalizedValue = value.trim()
                    .replace(/,/g, '')
                    .replace(/[^-\d.eE]/g, '');
                  
                  if (normalizedValue === '') {
                    record[header] = 0;
                  } else {
                    const parsedValue = Number(normalizedValue);
                    record[header] = !isNaN(parsedValue) ? parsedValue : 0;
                  }
                } else {
                  record[header] = 0;
                }
              }
            }
          });
          
          return record as HospitalData;
        });

        // 验证处理后的数据
        if (!jsonData.length) {
          message.error('未能从Excel文件中提取有效数据');
          return;
        }

        // 先更新文件列表状态
        const newFile = {
          uid: file.name,
          name: file.name,
          status: 'done',
          size: file.size,
          type: file.type
        };

        setFileList(prev => {
          const existingFileIndex = prev.findIndex(f => f.name === file.name);
          if (existingFileIndex >= 0) {
            const newList = [...prev];
            newList[existingFileIndex] = { ...newFile };
            return newList;
          }
          return [...prev, newFile];
        });

        // 然后更新uploadedData
        setUploadedData(prevData => {
          const newData = new Map(prevData);
          newData.set(hospitalName, jsonData);
          return newData;
        });
        
        message.success(`${hospitalName}数据上传成功`);
      };
      reader.readAsArrayBuffer(file);
      return false;
    } catch (error) {
      console.error('文件处理错误:', error);
      message.error(`文件处理失败: ${error.message}`);
      return false;
    }
  };

  const handleAnalyze = async () => {
    // 检查是否有上传的数据文件
    if (uploadedData.size === 0 || !fileList.length) {
      message.warning('请先上传数据文件');
      return;
    }

    // 验证所有上传的数据是否有效
    const hasValidData = Array.from(uploadedData.values()).every(data => 
      Array.isArray(data) && data.length > 0
    );

    if (!hasValidData) {
      message.error('上传的数据格式无效，请检查Excel文件内容');
      return;
    }

    setLoading(true);
    setAnomalies([]);

    try {
      // 并发分析所有上传的数据
      const analysisPromises = Array.from(uploadedData.values()).map(data => analyzeData(data));
      const results = await Promise.all(analysisPromises);
      
      // 合并所有分析结果
      const combinedAnomalies = results.flat();
      setAnomalies(combinedAnomalies);
      
      message.success(`分析完成，共发现 ${combinedAnomalies.length} 个异常`);
    } catch (error) {
      console.error('数据分析错误:', error);
      message.error('数据分析失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '医院名称',
      dataIndex: 'hospital',
      key: 'hospital',
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: '异常类型',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: '异常描述',
      key: 'description',
      render: (record: AnomalyResult) => {
        if (record.type === '单指标异常') {
          return `${record.indicator || ''}: ${record.value?.toLocaleString() || '0'} (${record.rule || ''})`;
        }
        if (record.type === '关联性异常' && record.values) {
          const values = Object.entries(record.values)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          return `${record.message || ''} (${values})`;
        }
        return record.message || '';
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 16px' }}>
        <h1>医院数据异常检测分析工具</h1>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            style={{ height: '100%' }}
            onClick={({ key }) => setCurrentPage(key)}
          >
            <Menu.Item key="upload" icon={<UploadOutlined />}>
              数据上传
            </Menu.Item>
            <Menu.Item key="analysis" icon={<BarChartOutlined />}>
              异常分析
            </Menu.Item>
            <Menu.Item key="settings" icon={<SettingOutlined />}>
              规则配置
            </Menu.Item>
          </Menu>
        </Sider>
        <Content style={{ padding: '24px', minHeight: 280 }}>
          {currentPage === 'upload' && (
            <>
              <Card title="数据上传">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Upload
                    fileList={fileList}
                    beforeUpload={(file) => {
                      handleUpload(file);
                      return false;
                    }}
                    onChange={({ file, fileList }) => {
                      // 只更新当前处理的文件状态
                      if (file.status === 'removed') {
                        setFileList(fileList);
                        // 从uploadedData中移除对应的数据
                        setUploadedData(prevData => {
                          const newData = new Map(prevData);
                          const hospitalName = file.name.replace(/\.[^/.]+$/, '');
                          newData.delete(hospitalName);
                          return newData;
                        });
                      }
                    }}
                    multiple
                  >
                    <Button icon={<UploadOutlined />}>选择Excel文件</Button>
                  </Upload>
                  
                  <Button 
                    type="primary" 
                    icon={<PlayCircleOutlined />} 
                    onClick={handleAnalyze}
                    loading={loading}
                    style={{ marginTop: '16px' }}
                  >
                    开始分析
                  </Button>
                </Space>
              </Card>
              
              {loading && <Spin size="large" style={{ margin: '20px 0' }} />}
              
              {anomalies.length > 0 && (
                <Card title="异常检测结果" style={{ marginTop: '20px' }}>
                  <Alert
                    message={`检测到 ${anomalies.length} 个异常`}
                    type="warning"
                    showIcon
                    style={{ marginBottom: '16px' }}
                  />
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {Object.entries(
                      anomalies.reduce((acc, anomaly) => {
                        acc[anomaly.type] = (acc[anomaly.type] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([type, count]) => (
                      <Card key={type} size="small" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{type}</span>
                          <Space>
                            <span>异常数量: {count}</span>
                            <Button 
                              type="link" 
                              onClick={() => {
                                setCurrentPage('analysis');
                                // 设置分析页面的类型筛选
                                setSelectedType(type);
                              }}
                            >
                              查看详情
                            </Button>
                          </Space>
                        </div>
                      </Card>
                    ))}
                  </Space>
                </Card>
              )}
            </>
          )}
          {currentPage === 'analysis' && <AnalysisPage data={anomalies} selectedType={selectedType} />}
          {currentPage === 'settings' && <SettingsPage />}
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;