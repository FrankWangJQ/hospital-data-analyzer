浏览器插件项目：
针对连续数据进行异常检测分析，可以分析出数据超过设置边界波动阈值的数据，另外接入deepseek，通过修改apikey和提示词来支持不同行业特性的数据进行检测分析。
医疗数据简单分析提示词案例：你是一个专业的医疗数据分析助手，负责分析医院数据中的异常情况。请以JSON数组格式返回异常数据，每个异常包含type、hospital、date、indicator、value、message等字段。

- 项目结构已经完整，包含了所有必要的源代码文件和配置文件
- 主要功能文件包括：
  - App.tsx：主应用程序组件
  - AnalysisPage.tsx：数据分析页面组件
  - SettingsPage.tsx：设置页面组件
  - dataAnalyzer.ts：数据分析工具
- 配置文件齐全：
  - package.json：项目依赖和脚本配置
  - manifest.json：Chrome插件配置
  - vite.config.ts：构建工具配置
- 资源文件已就位：
  - public/icons/：插件图标文件
  - index.html：主页面模板
项目已经可以正常运行，支持数据上传、异常分析和规则配置等核心功能。
