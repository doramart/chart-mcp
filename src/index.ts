import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const NWS_API_BASE = "https://api.chart.gov";
const USER_AGENT = "chart-app/1.0";

// Helper function for making NWS API requests
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

// Format alert data
function formatAlert(feature: AlertFeature): string {
  const props = feature.properties;
  return [
    `Event: ${props.event || "Unknown"}`,
    `Area: ${props.areaDesc || "Unknown"}`,
    `Severity: ${props.severity || "Unknown"}`,
    `Status: ${props.status || "Unknown"}`,
    `Headline: ${props.headline || "No headline"}`,
    "---",
  ].join("\n");
}

interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
}

interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponse {
  properties: {
    forecast?: string;
  };
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}

// Create server instance
const server = new McpServer({
  name: "chart",
  version: "1.0.0",
});

// // Register chart tools
// server.tool(
//   "get-alerts",
//   "Get chart alerts for a state",
//   {
//     state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
//   },
//   async ({ state }) => {
//     const stateCode = state.toUpperCase();
//     const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
//     const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

//     if (!alertsData) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: "Failed to retrieve alerts data",
//           },
//         ],
//       };
//     }

//     const features = alertsData.features || [];
//     if (features.length === 0) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: `No active alerts for ${stateCode}`,
//           },
//         ],
//       };
//     }

//     const formattedAlerts = features.map(formatAlert);
//     const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join(
//       "\n"
//     )}`;

//     return {
//       content: [
//         {
//           type: "text",
//           text: alertsText,
//         },
//       ],
//     };
//   }
// );

// server.tool(
//   "get-forecast",
//   "Get chart forecast for a location",
//   {
//     latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
//     longitude: z
//       .number()
//       .min(-180)
//       .max(180)
//       .describe("Longitude of the location"),
//   },
//   async ({ latitude, longitude }) => {
//     // Get grid point data
//     const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(
//       4
//     )},${longitude.toFixed(4)}`;
//     const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

//     if (!pointsData) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
//           },
//         ],
//       };
//     }

//     const forecastUrl = pointsData.properties?.forecast;
//     if (!forecastUrl) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: "Failed to get forecast URL from grid point data",
//           },
//         ],
//       };
//     }

//     // Get forecast data
//     const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
//     if (!forecastData) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: "Failed to retrieve forecast data",
//           },
//         ],
//       };
//     }

//     const periods = forecastData.properties?.periods || [];
//     if (periods.length === 0) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: "No forecast periods available",
//           },
//         ],
//       };
//     }

//     // Format forecast periods
//     const formattedForecast = periods.map((period: ForecastPeriod) =>
//       [
//         `${period.name || "Unknown"}:`,
//         `Temperature: ${period.temperature || "Unknown"}°${
//           period.temperatureUnit || "F"
//         }`,
//         `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
//         `${period.shortForecast || "No forecast available"}`,
//         "---",
//       ].join("\n")
//     );

//     const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join(
//       "\n"
//     )}`;

//     return {
//       content: [
//         {
//           type: "text",
//           text: forecastText,
//         },
//       ],
//     };
//   }
// );
// Add an addition tool
server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [{ type: "text", text: String(a + b) }],
}));

// Multiplication tool
server.tool("multiply", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [{ type: "text", text: String(a * b) }],
}));

// Division tool
server.tool("divide", { a: z.number(), b: z.number() }, async ({ a, b }) => {
  if (b === 0) {
    return {
      content: [{ type: "text", text: "Error: Cannot divide by zero" }],
    };
  }
  return {
    content: [{ type: "text", text: String(a / b) }],
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Chart MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
