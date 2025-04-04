import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DataLoader, LoadedData } from "./data/loader.js";
import { ChartGenerator } from "./data/chart.js";
import * as dotenv from "dotenv";
import * as fs from "fs/promises";
import * as path from "path";
import { Base64 } from "js-base64";
// 加载环境变量
dotenv.config();

// 验证必要的环境变量
const requiredEnvVars = ["UPLOAD_DIR", "API_KEY", "BASE_URL", "AI_MODEL"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);
if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

class ChartMCPServer {
  private server: McpServer;
  private dataLoader: DataLoader;
  private chartGenerator: ChartGenerator;
  private readonly uploadDir: string;

  constructor() {
    // 验证并规范化上传目录路径
    this.uploadDir = path.resolve(process.env.UPLOAD_DIR!);

    this.server = new McpServer({
      name: "Chart MCP Server",
      version: "1.0.0",
    });

    this.dataLoader = new DataLoader(this.uploadDir);
    this.chartGenerator = new ChartGenerator();

    this.registerResources();
    this.registerTools();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch (error) {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  private registerResources() {
    // 注册文件资源
    this.server.resource(
      "data-file",
      new ResourceTemplate("data://{filename}", { list: undefined }),
      async (uri, { filename }) => {
        try {
          // 验证文件名
          const actualFilename = Array.isArray(filename)
            ? filename[0]
            : filename;
          if (!actualFilename || actualFilename.includes("..")) {
            throw new Error("Invalid filename");
          }

          const filePath = path.join(this.uploadDir, actualFilename);

          // 确保文件存在且可读
          const fileStat = await fs.stat(filePath);
          if (!fileStat.isFile()) {
            throw new Error("Not a valid file");
          }

          // 加载并验证数据
          const data: LoadedData = await this.dataLoader.loadFile(filePath);

          return {
            contents: [
              {
                uri: uri.href,
                text: JSON.stringify(data),
              },
            ],
          };
        } catch (error: any) {
          throw new Error(`Failed to load file: ${error.message}`);
        }
      }
    );
  }

  private registerTools() {
    // Remove test tool if exists
    // Only keep the generate_chart tool

    // 图表生成工具
    this.server.tool(
      "generate_chart",
      {
        dataResource: z
          .string()
          .url("Invalid data resource URL")
          .refine((val) => val.startsWith("data://"), {
            message: "Data resource must start with 'data://'",
          })
          .describe("数据资源的URI，格式为 data://{filename}"),
        prompt: z
          .string()
          .min(1, "Prompt cannot be empty")
          .max(1000, "Prompt is too long")
          .describe(
            "用户的需求描述，用于指导图表生成，例如：'展示销售额随月份的变化趋势'"
          ),
      },
      async ({ dataResource, prompt }) => {
        try {
          // 解析和验证数据资源 URL
          const resourceUrl = new URL(dataResource);
          if (resourceUrl.protocol !== "data:") {
            throw new Error("Invalid data resource protocol");
          }

          const fileName = resourceUrl.hostname; // 获取文件名
          if (!fileName || fileName.includes("..")) {
            throw new Error("Invalid filename in data resource");
          }

          const filePath = path.join(this.uploadDir, fileName);

          // 验证文件存在性和权限
          await fs.access(filePath, fs.constants.R_OK);
          const fileStat = await fs.stat(filePath);
          if (!fileStat.isFile()) {
            throw new Error("Resource is not a valid file");
          }

          // 加载数据并生成图表
          const data = await this.dataLoader.loadFile(filePath);
          const chartOption = await this.chartGenerator.generateChart(
            data,
            prompt
          );

          return {
            content: [
              {
                type: "text",
                text: `https://chart.micoai.cn/v1/page?options=${Base64.encode(
                  JSON.stringify(chartOption)
                )}`,
              },
            ],
          };
        } catch (error: any) {
          console.error("Chart generation error:", error);
          return {
            content: [
              {
                type: "text",
                text: `Error generating chart: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  async start() {
    try {
      // 确保上传目录存在
      await this.ensureUploadDir();

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      console.log("Chart MCP Server started successfully");
    } catch (error: any) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  }
}

// 启动服务器
const server = new ChartMCPServer();
server.start().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
