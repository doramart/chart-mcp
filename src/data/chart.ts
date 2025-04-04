import OpenAI from "openai";

interface ChartData {
  [key: string]: any[];
}

interface ChartOption {
  title?: {
    text: string;
  };
  xAxis?: {
    type: string;
    data?: any[];
  };
  yAxis?: {
    type: string;
  };
  series?: Array<{
    type: string;
    data: any[];
    [key: string]: any;
  }>;
  [key: string]: any;
}

export class ChartGenerator {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: `${process.env.API_KEY}`,
      baseURL: `${process.env.BASE_URL}`,
    });
  }

  async generateChart(dataSource: any, prompt: string): Promise<ChartOption> {
    try {
      // 构建系统提示词
      const systemPrompt = `你是一个专业的图表生成助手。请依据用户提供的数据和需求，生成符合 ECharts 规范的配置。配置中必须包含必要的 title、xAxis、yAxis 和 series 等配置项，且要保证该配置能直接被 ECharts 使用，以 JSON 格式返回。\n
数据的首行为表头，涵盖了各类指标与维度。请仔细分析需求，从表头里精准定位出和需求相关的指标与维度。之后，从数据中提取这些相关指标与维度的具体值，将其填充到 ECharts 配置里对应的字段，像 xAxis、yAxis 或者 series 的 data 字段。\n
例如，若需求是分析不同地区的销售额，你就得从表头里找出 “地区” 和 “销售额” 这两列，提取 “地区” 列下的具体的名称填充到 yAxis 或 xAxis 的 data 字段，“销售额” 列的数据填充到 series 的 data 字段，请注意 data 字段中不要出现运算符，一定是数据聚合完成的结果\n
请严格按照数据内容来填充配置，不要使用占位符，确保返回的配置能准确呈现数据里的信息。直接返回 JSON 格式的配置，不要包含任何markdown标签。`;

      // 构建用户提示词
      const userPrompt = `数据：${JSON.stringify(dataSource)}
      需求：${prompt}
      请生成合适的 ECharts 配置。`;

      // 调用 DeepSeek API
      const completion = await this.openai.chat.completions.create({
        model: `${process.env.AI_MODEL}`,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      let responseStr = completion.choices[0].message.content || "";
      const cleanString = responseStr.replace(/```json\n|```/g, "");

      const result = JSON.parse(cleanString || "{}");

      // 验证返回的配置是否有效
      if (!this.isValidChartOption(result)) {
        throw new Error("Invalid chart option received from DeepSeek");
      }

      return result as ChartOption;
    } catch (error) {
      console.error("Error generating chart:", error);
      throw error;
    }
  }

  private isValidChartOption(option: any): boolean {
    // 验证图表配置的基本结构
    return (
      option &&
      typeof option === "object" &&
      Array.isArray(option.series) &&
      option.series.length > 0 &&
      option.series[0].type &&
      Array.isArray(option.series[0].data)
    );
  }
}
