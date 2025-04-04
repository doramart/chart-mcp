# Chart MCP Server

基于 MCP 协议的图表生成服务器，支持从各种数据源读取数据并生成图表配置。

## 功能特点

- 支持多种数据源：
  - 文件格式：CSV、XLSX、XLS、JSON
  - 数据库：MySQL、SQLite、MariaDB
- 智能图表生成：
  - 基于用户提示词生成合适的图表
  - 支持多种图表类型（柱状图、折线图、饼图等）
  - 自动进行数据分析和处理

## 发布到 mcp.so

1. 确保已安装 Node.js (v18+)
2. 安装依赖：

```bash
npm install
```

3. 构建项目：

```bash
npm run build
```

4. 按照 mcp.so 的发布向导上传项目

## API 说明

服务器提供以下 MCP 工具：

1. `generate_chart`
   - 参数：
     - `dataResource`: 数据资源 URI (格式: data://{filename})
     - `prompt`: 图表生成提示词
   - 功能：根据数据和提示词生成图表配置

## 环境变量配置

发布到 mcp.so 时，需要在平台配置以下环境变量：

- `UPLOAD_DIR`: 文件上传目录
- (其他数据库相关变量根据需要配置)

## 许可证

MIT
