import * as fs from "fs/promises";
import * as path from "path";
import ExcelJS from "exceljs";
import { parse } from "csv-parse";

// 支持的文件类型枚举
export enum FileType {
  CSV = ".csv",
  JSON = ".json",
  XLSX = ".xlsx",
  XLS = ".xls",
}

// 定义返回数据接口
export interface LoadedData {
  headers: string[];
  rows: any[];
  sourceFile: string;
}

export class DataLoader {
  private uploadDir: string;
  private readonly maxFileSize: number =
    parseInt(process.env.MAX_FILE_SIZE || "10") * 1024 * 1024; // 10MB
  private readonly supportedTypes: string[] = Object.values(FileType);

  constructor(uploadDir?: string) {
    this.uploadDir = uploadDir || path.join(process.cwd(), "uploads");
  }

  /**
   * 验证文件是否合法
   */
  private async validateFile(filePath: string): Promise<void> {
    // 检查文件是否存在
    try {
      const stats = await fs.stat(filePath);

      // 验证文件大小
      if (stats.size > this.maxFileSize) {
        throw new Error(
          `File size exceeds maximum limit of ${
            this.maxFileSize / (1024 * 1024)
          }MB`
        );
      }

      // 验证文件类型
      const ext = path.extname(filePath).toLowerCase();
      if (!this.supportedTypes.includes(ext)) {
        throw new Error(
          `Unsupported file type: ${ext}. Supported types are: ${this.supportedTypes.join(
            ", "
          )}`
        );
      }

      // 验证文件权限
      await fs.access(filePath, fs.constants.R_OK);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * 加载文件数据
   */
  async loadFile(filePath: string): Promise<LoadedData> {
    await this.validateFile(filePath);

    const ext = path.extname(filePath).toLowerCase();
    let data: any;

    try {
      switch (ext as FileType) {
        case FileType.CSV:
          data = await this.loadCSV(filePath);
          break;
        case FileType.JSON:
          data = await this.loadJSON(filePath);
          break;
        case FileType.XLSX:
        case FileType.XLS:
          data = await this.loadExcel(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${ext}`);
      }

      return {
        headers:
          Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [],
        rows: data,
        sourceFile: path.basename(filePath),
      };
    } catch (error: any) {
      throw new Error(`Error loading file ${filePath}: ${error.message}`);
    }
  }

  private async loadCSV(filePath: string): Promise<any[]> {
    const content = await fs.readFile(filePath, "utf-8");
    return new Promise((resolve, reject) => {
      parse(
        content,
        {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          cast: true, // 自动转换数据类型
        },
        (err, data) => {
          if (err) reject(new Error(`CSV parsing error: ${err.message}`));
          else resolve(data);
        }
      );
    });
  }

  private async loadJSON(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      // 确保数据是数组格式
      if (!Array.isArray(data)) {
        throw new Error("JSON file must contain an array of objects");
      }

      return data;
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON format: ${error.message}`);
      }
      throw error;
    }
  }

  private async loadExcel(filePath: string): Promise<any[]> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        throw new Error("Excel file contains no worksheets");
      }

      // 获取表头
      const headers = worksheet.getRow(1).values as string[];
      if (!headers || headers.length < 2) {
        throw new Error("Excel file must contain headers in the first row");
      }

      const data: any[] = [];

      // 从第二行开始读取数据
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // 跳过表头

        const rowData: string[] = [];
        row.eachCell((cell) => {
          rowData.push(String(cell.value || "")); // Convert all values to strings
        });
        data.push(rowData);
      });

      return data;
    } catch (error: any) {
      throw new Error(`Excel parsing error: ${error.message}`);
    }
  }
}
