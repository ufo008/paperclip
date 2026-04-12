import { useEffect, useMemo, useRef, useState } from "react";

export type DatePreset = "mtd" | "7d" | "30d" | "ytd" | "all" | "custom";

export const PRESET_LABELS: Record<DatePreset, string> = {
  mtd: "Month to Date",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  ytd: "Year to Date",
  all: "All Time",
  custom: "Custom",
};

export const PRESET_KEYS: DatePreset[] = ["mtd", "7d", "30d", "ytd", "all", "custom"];

// 注意：computeRange 在 useMemo 内部调用，每分钟重新评估一次
//（由 minuteTick 驱动）。这意味着滑动窗口（7d、30d）的上限
// 最多每分钟推进一次 — 对于成本仪表板来说是可以接受的。
function computeRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  switch (preset) {
    case "mtd": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: d.toISOString(), to };
    }
    case "7d": {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
      return { from: d.toISOString(), to };
    }
    case "30d": {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
      return { from: d.toISOString(), to };
    }
    case "ytd": {
      const d = new Date(now.getFullYear(), 0, 1);
      return { from: d.toISOString(), to };
    }
    case "all":
    case "custom":
      return { from: "", to: "" };
  }
}

// 将 Date 向下取整到最接近的分钟，以便查询键在
// 30 秒重新获取 tick 之间保持稳定（防止每个轮询周期创建新的缓存条目）
function floorToMinute(d: Date): string {
  const floored = new Date(d);
  floored.setSeconds(0, 0);
  return floored.toISOString();
}

export interface UseDateRangeResult {
  preset: DatePreset;
  setPreset: (p: DatePreset) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
  /** 已解析的 ISO 字符串，准备传递给 API 调用；空字符串表示无限制 */
  from: string;
  to: string;
  /** 当 preset=custom 但两个日期都尚未选择时为 false */
  customReady: boolean;
}

export function useDateRange(): UseDateRangeResult {
  const [preset, setPreset] = useState<DatePreset>("mtd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // 在下一个日历分钟边界 tick，然后每 60 秒 tick 一次，这样滑动预设
  //（7d、30d）可以与挂钟分钟同步推进其上限，而不是
  // 随着月份偏移而漂移。
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [minuteTick, setMinuteTick] = useState(() => floorToMinute(new Date()));
  useEffect(() => {
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    const timeout = setTimeout(() => {
      setMinuteTick(floorToMinute(new Date()));
      intervalRef.current = setInterval(
        () => setMinuteTick(floorToMinute(new Date())),
        60_000,
      );
    }, msToNextMinute);
    return () => {
      clearTimeout(timeout);
      if (intervalRef.current != null) clearInterval(intervalRef.current);
    };
  }, []);

  const { from, to } = useMemo(() => {
    if (preset !== "custom") return computeRange(preset);
    // 将自定义日期字符串作为本地日期边界处理，以包含完整的一天
    // 而不管用户的时区如何。"from" 从本地午夜开始，"to" 到 23:59:59.999。
    const fromDate = customFrom ? new Date(customFrom + "T00:00:00") : null;
    const toDate = customTo ? new Date(customTo + "T23:59:59.999") : null;
    return {
      from: fromDate ? fromDate.toISOString() : "",
      to: toDate ? toDate.toISOString() : "",
    };
  // minuteTick 每分钟驱动滑动预设的重新计算。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customFrom, customTo, minuteTick]);

  const customReady = preset !== "custom" || (!!customFrom && !!customTo);

  return {
    preset,
    setPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    from,
    to,
    customReady,
  };
}
