import React, { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Typography, Space, Alert, Divider, Row, Col, message, Select, Tag } from 'antd'
import { KeyOutlined, SaveOutlined, ApiOutlined, InfoCircleOutlined, RobotOutlined } from '@ant-design/icons'
import { settingsApi } from '../services/api'
import { isDesktopMode } from '../utils/desktopMode'
import { trackApiKeyConfigured } from '../analytics/events'
import '../pages/SettingsPage.css'

const { Title, Text, Paragraph } = Typography

/**
 * AI 模型配置（DeepSeek）
 *
 * 从 SettingsPage 抽出来的独立模块，现在只在管理者后台 /admin 里用——
 * DeepSeek API Key 是全局共享的，不该让普通用户改，所以搬进后台。
 * 逻辑（读取/保存/测试）与原来完全一致，只是换了个挂载位置。
 */
const AiModelConfig: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [currentProvider, setCurrentProvider] = useState<any>({})
  const [selectedProvider, setSelectedProvider] = useState('deepseek')

  // 提供商配置 —— 本项目只用 DeepSeek
  const providerConfig = {
    deepseek: {
      name: 'DeepSeek',
      icon: <RobotOutlined />,
      color: '#4d6bfe',
      description: 'DeepSeek 大模型服务（OpenAI 兼容）',
      apiKeyField: 'deepseek_api_key',
      placeholder: '请输入 DeepSeek API 密钥'
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const isDesktop = await isDesktopMode()

      if (isDesktop) {
        const [settings, models, provider] = await Promise.allSettled([
          settingsApi.getSettings(),
          settingsApi.getAvailableModels(),
          settingsApi.getCurrentProvider()
        ])

        const failedRequests = [settings, models, provider].filter(result => result.status === 'rejected')
        if (failedRequests.length > 0) {
          console.warn('部分API请求失败:', failedRequests.map(r => (r as PromiseRejectedResult).reason))
        }

        const settingsData = settings.status === 'fulfilled' ? settings.value : {}
        const providerData = provider.status === 'fulfilled'
          ? provider.value
          : { available: false, provider: 'deepseek', display_name: 'DeepSeek', model: 'deepseek-chat' }
        const providerName = providerData.provider || 'deepseek'
        setCurrentProvider(providerData)

        const flatSettings = {
          llm_provider: providerName,
          deepseek_api_key: settingsData.api?.api_keys?.deepseek || '',
          model_name: settingsData.api?.api_model || 'deepseek-chat',
          chunk_size: settingsData.processing?.processing_chunk_size || 5000,
          min_score_threshold: settingsData.processing?.processing_min_score || 0.7,
          max_clips_per_collection: settingsData.processing?.processing_max_clips || 5
        }

        setSelectedProvider(providerName)
        form.setFieldsValue(flatSettings)
      } else {
        const flatSettings = {
          llm_provider: 'deepseek',
          deepseek_api_key: '',
          model_name: 'deepseek-chat',
          chunk_size: 5000,
          min_score_threshold: 0.7,
          max_clips_per_collection: 5
        }
        setSelectedProvider('deepseek')
        form.setFieldsValue(flatSettings)
        setCurrentProvider({
          available: false,
          provider: 'deepseek',
          display_name: 'DeepSeek',
          model: 'deepseek-chat'
        })
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  const handleSave = async (values: any) => {
    try {
      setLoading(true)
      const isDesktop = await isDesktopMode()

      if (!isDesktop) {
        message.info('Web模式下配置无法保存，请在桌面应用中使用完整功能')
        setLoading(false)
        return
      }

      let existingSettings = null
      try {
        existingSettings = await settingsApi.getSettings()
      } catch (error) {
        console.warn('获取现有配置失败，将使用默认配置:', error)
      }

      const existingApiKeys = existingSettings?.api?.api_keys || {}

      const backendSettings = {
        basic: {
          app_name: "AutoClip Desktop",
          app_version: "1.0.0",
          debug_mode: false,
          auto_start: true
        },
        service: {
          host: "127.0.0.1",
          port: 8000,
          max_memory_usage: 2048
        },
        api: {
          provider: values.llm_provider || "deepseek",
          api_keys: {
            deepseek: values.deepseek_api_key || existingApiKeys.deepseek || ""
          },
          api_model: values.model_name || "deepseek-chat",
          api_max_tokens: 4096,
          api_timeout: 30
        },
        processing: {
          processing_chunk_size: values.chunk_size || 5000,
          processing_min_score: values.min_score_threshold || 0.7,
          processing_max_clips: values.max_clips_per_collection || 5,
          processing_max_retries: 3
        },
        logs: {
          log_level: "INFO",
          log_retention_days: 7
        },
        paths: {
          data_directory: "/Users/zhoukk/Library/Application Support/AutoClip",
          cache_directory: "/Users/zhoukk/Library/Application Support/AutoClip/cache",
          temp_directory: "/Users/zhoukk/Library/Application Support/AutoClip/temp"
        }
      }

      await settingsApi.updateSettings(backendSettings)
      message.success('配置保存成功！')

      const apiKeyField = providerConfig[selectedProvider as keyof typeof providerConfig]?.apiKeyField
      if (apiKeyField) {
        trackApiKeyConfigured({
          provider: selectedProvider,
          hasKey: !!values[apiKeyField],
        })
      }

      await loadData()
    } catch (error: any) {
      message.error('保存失败: ' + (error.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const handleTestApiKey = async () => {
    const apiKey = form.getFieldValue(providerConfig[selectedProvider as keyof typeof providerConfig].apiKeyField)

    if (!apiKey || apiKey.trim() === '') {
      message.error('请先输入API密钥')
      return
    }

    try {
      setLoading(true)
      const result = await settingsApi.testApiKey(selectedProvider, apiKey)
      if (result.success) {
        message.success('API密钥测试成功！')
      } else {
        message.error('API密钥测试失败: ' + (result.error || '未知错误'))
      }
    } catch (error: any) {
      message.error('测试失败: ' + (error.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider)
    form.setFieldsValue({ llm_provider: provider })
  }

  return (
    <>
      <Card title="AI 模型配置" className="settings-card">
        <Alert
          message="使用 DeepSeek 模型"
          description="本项目使用 DeepSeek 大模型（OpenAI 兼容），在下方填入 DeepSeek API Key 并选择模型即可。"
          type="info"
          showIcon
          className="settings-alert"
        />

        <Form
          form={form}
          layout="vertical"
          className="settings-form"
          onFinish={handleSave}
          initialValues={{
            llm_provider: 'deepseek',
            model_name: 'deepseek-chat',
            chunk_size: 5000,
            min_score_threshold: 0.7,
            max_clips_per_collection: 5
          }}
        >
          {currentProvider.available && (
            <Alert
              message={`当前使用: ${currentProvider.display_name} - ${currentProvider.model}`}
              type="success"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <Form.Item
            label="选择AI模型提供商"
            name="llm_provider"
            className="form-item"
            rules={[{ required: true, message: '请选择AI模型提供商' }]}
          >
            <Select
              value={selectedProvider}
              onChange={handleProviderChange}
              className="settings-input"
              placeholder="请选择AI模型提供商"
            >
              {Object.entries(providerConfig).map(([key, config]) => (
                <Select.Option key={key} value={key}>
                  <Space>
                    <span style={{ color: config.color }}>{config.icon}</span>
                    <span>{config.name}</span>
                    <Tag color={config.color}>{config.description}</Tag>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={`${providerConfig[selectedProvider as keyof typeof providerConfig].name} API Key`}
            name={providerConfig[selectedProvider as keyof typeof providerConfig].apiKeyField}
            className="form-item"
            rules={[
              { required: true, message: '请输入API密钥' },
              { min: 10, message: 'API密钥长度不能少于10位' }
            ]}
          >
            <Input.Password
              placeholder={providerConfig[selectedProvider as keyof typeof providerConfig].placeholder}
              prefix={<KeyOutlined />}
              className="settings-input"
            />
          </Form.Item>

          <Form.Item
            label="选择模型"
            name="model_name"
            className="form-item"
            rules={[{ required: true, message: '请输入或选择模型名称' }]}
            extra="支持手动输入模型名称或从常用模型中选择"
          >
            <Select
              className="settings-input"
              placeholder="请选择或输入模型名称"
              showSearch
              allowClear
            >
              <Select.OptGroup label="DeepSeek">
                <Select.Option value="deepseek-chat">deepseek-chat (DeepSeek V3)</Select.Option>
                <Select.Option value="deepseek-reasoner">deepseek-reasoner (DeepSeek R1)</Select.Option>
              </Select.OptGroup>
            </Select>
          </Form.Item>

          <Form.Item className="form-item">
            <Space>
              <Button
                type="default"
                icon={<ApiOutlined />}
                className="test-button"
                onClick={handleTestApiKey}
                loading={loading}
              >
                测试连接
              </Button>
            </Space>
          </Form.Item>

          <Divider className="settings-divider" />

          <Title level={4} className="section-title">模型配置</Title>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="文本分块大小" name="chunk_size" className="form-item">
                <Input type="number" placeholder="5000" addonAfter="字符" className="settings-input" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="最低评分阈值" name="min_score_threshold" className="form-item">
                <Input type="number" step="0.1" min="0" max="1" placeholder="0.7" className="settings-input" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="每个合集最大切片数" name="max_clips_per_collection" className="form-item">
                <Input type="number" placeholder="5" addonAfter="个" className="settings-input" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item className="form-item">
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              size="large"
              className="save-button"
              loading={loading}
            >
              保存配置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="使用说明" className="settings-card">
        <Space direction="vertical" size="large" className="instructions-space">
          <div className="instruction-item">
            <Title level={5} className="instruction-title">
              <InfoCircleOutlined /> 1. 配置 DeepSeek
            </Title>
            <Paragraph className="instruction-text">
              本项目使用 <Text strong>DeepSeek</Text> 大模型：
              <br />• 访问 platform.deepseek.com 创建并获取 API 密钥
              <br />• 模型可选 <Text strong>deepseek-chat</Text>（V3，通用）或 <Text strong>deepseek-reasoner</Text>（R1，推理）
            </Paragraph>
          </div>

          <div className="instruction-item">
            <Title level={5} className="instruction-title">
              <InfoCircleOutlined /> 2. 配置参数说明
            </Title>
            <Paragraph className="instruction-text">
              • <Text strong>文本分块大小</Text>：影响处理速度和精度，建议5000字符<br />
              • <Text strong>评分阈值</Text>：只有高于此分数的片段才会被保留<br />
              • <Text strong>合集切片数</Text>：控制每个主题合集包含的片段数量
            </Paragraph>
          </div>

          <div className="instruction-item">
            <Title level={5} className="instruction-title">
              <InfoCircleOutlined /> 3. 测试连接
            </Title>
            <Paragraph className="instruction-text">
              保存前建议先测试API密钥是否有效，确保服务正常运行
            </Paragraph>
          </div>
        </Space>
      </Card>
    </>
  )
}

export default AiModelConfig
