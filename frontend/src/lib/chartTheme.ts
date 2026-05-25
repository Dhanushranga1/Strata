/**
 * Chart theming configuration for TicketPilot V2 "Midnight Prism"
 * Compatible with Recharts, Chart.js, and other common chart libraries
 */

// Chart color series using V2 tokens
export const chartColors = {
  // Primary series colors
  series: [
    'rgb(var(--primary))', // #5B7CFF - indigo-400
    'rgb(var(--primary2))', // #8B5CF6 - violet-500
    'rgb(var(--info))', // #38BDF8 - sky-400
    'rgb(var(--success))', // #22C55E - green-500
    'rgb(var(--warning))', // #FBBF24 - amber-400
    'rgb(var(--danger))', // #F87171 - red-400
  ],

  // Grid and axis colors (low alpha)
  grid: 'rgb(var(--border))',
  axes: 'rgb(var(--muted))',

  // Background colors
  background: 'rgb(var(--surface))',
  tooltip: 'rgb(var(--surface2))',
};

// Recharts theme configuration
export const rechartsTheme = {
  colors: chartColors.series,

  // Grid styling
  cartesianGrid: {
    strokeDasharray: '3 3',
    stroke: chartColors.grid,
    opacity: 0.3,
  },

  // Axis styling
  xAxis: {
    axisLine: { stroke: chartColors.axes, strokeWidth: 1 },
    tickLine: { stroke: chartColors.axes, strokeWidth: 1 },
    tick: { fill: chartColors.axes, fontSize: 12 },
  },

  yAxis: {
    axisLine: { stroke: chartColors.axes, strokeWidth: 1 },
    tickLine: { stroke: chartColors.axes, strokeWidth: 1 },
    tick: { fill: chartColors.axes, fontSize: 12 },
  },

  // Tooltip styling
  tooltip: {
    contentStyle: {
      backgroundColor: chartColors.tooltip,
      border: `1px solid ${chartColors.grid}`,
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    },
    labelStyle: { color: 'rgb(var(--text))' },
    itemStyle: { color: 'rgb(var(--text))' },
  },
};

// Chart.js theme configuration
export const chartJsTheme = {
  plugins: {
    legend: {
      labels: {
        color: chartColors.axes,
        font: { size: 12 },
      },
    },
    tooltip: {
      backgroundColor: chartColors.tooltip,
      titleColor: 'rgb(var(--text))',
      bodyColor: 'rgb(var(--text))',
      borderColor: chartColors.grid,
      borderWidth: 1,
      cornerRadius: 8,
    },
  },

  scales: {
    x: {
      grid: {
        color: chartColors.grid,
        borderDash: [3, 3],
      },
      ticks: {
        color: chartColors.axes,
        font: { size: 12 },
      },
      border: {
        color: chartColors.axes,
      },
    },
    y: {
      grid: {
        color: chartColors.grid,
        borderDash: [3, 3],
      },
      ticks: {
        color: chartColors.axes,
        font: { size: 12 },
      },
      border: {
        color: chartColors.axes,
      },
    },
  },
};

// ECharts theme configuration
export const echartsTheme = {
  color: chartColors.series,

  backgroundColor: 'transparent',

  textStyle: {
    color: chartColors.axes,
    fontSize: 12,
  },

  grid: {
    borderColor: chartColors.grid,
    borderWidth: 1,
  },

  categoryAxis: {
    axisLine: { lineStyle: { color: chartColors.axes } },
    axisTick: { lineStyle: { color: chartColors.axes } },
    axisLabel: { color: chartColors.axes },
    splitLine: {
      lineStyle: {
        color: chartColors.grid,
        type: 'dashed',
        opacity: 0.3,
      },
    },
  },

  valueAxis: {
    axisLine: { lineStyle: { color: chartColors.axes } },
    axisTick: { lineStyle: { color: chartColors.axes } },
    axisLabel: { color: chartColors.axes },
    splitLine: {
      lineStyle: {
        color: chartColors.grid,
        type: 'dashed',
        opacity: 0.3,
      },
    },
  },

  tooltip: {
    backgroundColor: chartColors.tooltip,
    borderColor: chartColors.grid,
    borderWidth: 1,
    textStyle: {
      color: 'rgb(var(--text))',
    },
  },
};

// Usage examples and data mappings
export const chartMappings = {
  ticketVolume: {
    type: 'line',
    color: chartColors.series[0], // primary
    description: 'Ticket Volume Trend',
  },

  responseTime: {
    type: 'donut',
    colors: [
      chartColors.series[1],
      chartColors.series[2],
      chartColors.series[3],
    ], // primary2, info, success
    description: 'Response Time Distribution',
  },

  categories: {
    type: 'horizontalBar',
    color: chartColors.series[0], // primary
    description: 'Top Categories',
  },

  repPerformance: {
    type: 'tableWithBars',
    color: chartColors.series[0], // primary
    description: 'Rep Performance with inline bars',
  },
};
