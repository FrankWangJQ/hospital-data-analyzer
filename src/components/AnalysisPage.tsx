import React, { useState, useEffect } from 'react';
import { Card, Table, DatePicker, Select, Alert } from 'antd';
import dayjs from 'dayjs';
export interface AnomalyResult {
  hospital: string;
  date: string;
  type: string;
  indicator?: string;
  value?: number;
  rule?: string;
  message?: string;
  values?: Record<string, any>;
}

const { RangePicker } = DatePicker;

interface AnalysisPageProps {
  data: AnomalyResult[];
  selectedType?: string;
}

const AnalysisPage: React.FC<AnalysisPageProps> = ({ data, selectedType: initialSelectedType }) => {
  const [filteredData, setFilteredData] = useState<AnomalyResult[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(initialSelectedType || null);

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
          return `${record.indicator || ''}: ${record.value !== null && record.value !== undefined ? record.value.toLocaleString() : '-'} (${record.rule || ''})`;
        }
        if (record.type === '关联性异常' && record.values) {
          const values = Object.entries(record.values)
            .map(([key, value]) => `${key}: ${value !== null && value !== undefined ? value.toLocaleString() : '-'}`)
            .join(', ');
          return `${record.message || ''} (${values})`;
        }
        return record.message || '';
      },
    },
  ];

  useEffect(() => {
    let filtered = [...data];

    if (dateRange && dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(
        (item) => {
          const itemDate = new Date(item.date);
          return itemDate >= dateRange[0].toDate() && itemDate <= dateRange[1].toDate();
        }
      );
    }

    if (selectedType) {
      filtered = filtered.filter((item) => item.type === selectedType);
    }

    setFilteredData(filtered);
  }, [data, dateRange, selectedType]);

  const typeOptions = [
    { label: '全部类型', value: '' },
    { label: '单指标异常', value: '单指标异常' },
    { label: '关联性异常', value: '关联性异常' },
    { label: '深度学习检测', value: '深度学习检测' },
  ];

  return (
    <Card title="异常分析">
      <div style={{ marginBottom: 16 }}>
        <RangePicker
          style={{ marginRight: 16 }}
          onChange={(dates: any) => {
            if (dates) {
              setDateRange([dayjs(dates[0]), dayjs(dates[1])]);
            } else {
              setDateRange(null);
            }
          }}
        />
        <Select
          style={{ width: 200 }}
          placeholder="选择异常类型"
          options={typeOptions}
          onChange={(value) => setSelectedType(value || null)}
          allowClear
        />
      </div>

      {filteredData.length > 0 ? (
        <>
          <Alert
            message={`共检测到 ${filteredData.length} 个异常`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey={(record) => `${record.hospital}-${record.date}-${record.type}`}
          />
        </>
      ) : (
        <Alert message="暂无异常数据" type="info" showIcon />
      )}
    </Card>
  );
};

export default AnalysisPage;