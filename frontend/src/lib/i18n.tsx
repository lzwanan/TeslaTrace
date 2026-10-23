/**
 * Two languages, ~60 strings, no i18n library. Chinese is the default; the header
 * toggle switches to English in one click and the choice is persisted.
 *
 * An open-source dashboard that only speaks Chinese loses half its audience, and a
 * full i18n stack for 60 strings is not worth the dependency. Keys are typed against
 * the English dictionary, so a missing translation is a compile error.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const en = {
  "nav.overview": "Overview",
  "nav.drives": "Drives",

  "state.charging": "Charging",
  "state.driving": "Driving",
  "state.online": "Online",
  "state.asleep": "Asleep",
  "state.offline": "Offline",
  "state.updating": "Updating",
  "state.error": "Error",
  "state.unknown": "Unknown",

  "hero.target": "target {n}%",
  "hero.limit": "limit",
  "hero.range": "range",
  "hero.parked": "at {place}",
  "hero.nowhere": "location unknown",
  "hero.moving": "{speed} km/h",

  "card.position": "Location",
  "card.today": "Today",
  "card.month": "This month",
  "card.battery": "Battery",
  "card.vehicle": "Vehicle",
  "card.charging": "Charging",
  "card.recent": "Recent drives",
  "card.attention": "Needs attention",

  "pos.open": "Open in maps",
  "pos.unknown": "Unknown place",
  "pos.coords": "{lat}, {lng}",

  "kpi.battery": "Battery",
  "kpi.elevation": "Altitude",
  "kpi.speed": "Speed",
  "kpi.km": "km",
  "kpi.drives": "drives",
  "kpi.odometer": "Odometer",
  "kpi.version": "Software",
  "kpi.locked": "Locked",
  "kpi.unlocked": "Unlocked",
  "kpi.sentry": "Sentry",
  "kpi.tempIn": "Inside",
  "kpi.tempOut": "Outside",
  "kpi.connected": "Connected",
  "kpi.disconnected": "Unplugged",

  "chg.power": "Power",
  "chg.added": "Added",
  "chg.eta": "To {n}%",
  "chg.target": "Target",
  "chg.plugged": "Plugged in",
  "chg.notPlugged": "Not plugged in",
  "chg.complete": "Charge complete",
  "chg.toFull": "To full",

  "alert.lowBattery": "Battery below 20%",
  "alert.unlocked": "Car is unlocked",
  "alert.sentry": "Sentry mode is on",

  "recent.empty": "No drives yet",
  "recent.all": "All drives",
  "drives.count": "{n} drives",
  "drives.more": "Load more",
  "drives.empty": "Nothing here yet",
  "drives.emptyHint": "Trips appear once TeslaMate records a drive.",

  "time.now": "just now",
  "time.sec": "{n}s ago",
  "time.min": "{n}m ago",
  "time.hour": "{n}h ago",
  "time.day": "{n}d ago",
  "time.minShort": "{n}m",
  "time.hourShort": "{n}h",

  "ui.live": "Live",
  "ui.reconnecting": "Reconnecting",
  "ui.updated": "Updated {time}",
  "ui.retry": "Retry",
  "ui.loading": "Loading",
  "ui.error": "Could not reach the API",
  "ui.authTitle": "Access token required",
  "ui.authHint": "This dashboard was started with AUTH_TOKEN set. Paste it to continue.",
  "ui.authSave": "Unlock",
  "ui.car": "Car",
  "ui.theme": "Theme",
  "ui.language": "Language",
  "ui.offline": "Waiting for the car",
} as const;

type Dict = typeof en;
export type TKey = keyof Dict;

const zh: Record<TKey, string> = {
  "nav.overview": "概览",
  "nav.drives": "行程",

  "state.charging": "充电中",
  "state.driving": "行驶中",
  "state.online": "在线",
  "state.asleep": "已休眠",
  "state.offline": "离线",
  "state.updating": "升级中",
  "state.error": "异常",
  "state.unknown": "未知",

  "hero.target": "目标 {n}%",
  "hero.limit": "上限",
  "hero.range": "续航",
  "hero.parked": "停在 {place}",
  "hero.nowhere": "位置未知",
  "hero.moving": "{speed} km/h",

  "card.position": "位置",
  "card.today": "今日",
  "card.month": "本月",
  "card.battery": "电池",
  "card.vehicle": "车辆",
  "card.charging": "充电",
  "card.recent": "最近行程",
  "card.attention": "需要留意",

  "pos.open": "在地图中打开",
  "pos.unknown": "未知位置",
  "pos.coords": "{lat}, {lng}",

  "kpi.battery": "当前电量",
  "kpi.elevation": "海拔",
  "kpi.speed": "速度",
  "kpi.km": "公里",
  "kpi.drives": "趟",
  "kpi.odometer": "总里程",
  "kpi.version": "软件版本",
  "kpi.locked": "已锁车",
  "kpi.unlocked": "未锁车",
  "kpi.sentry": "哨兵",
  "kpi.tempIn": "车内",
  "kpi.tempOut": "车外",
  "kpi.connected": "已插枪",
  "kpi.disconnected": "未插枪",

  "chg.power": "功率",
  "chg.added": "已充",
  "chg.eta": "充满至 {n}%",
  "chg.target": "目标",
  "chg.plugged": "已插枪",
  "chg.notPlugged": "未插枪",
  "chg.complete": "已充满",
  "chg.toFull": "距充满",

  "alert.lowBattery": "电量低于 20%",
  "alert.unlocked": "车辆未上锁",
  "alert.sentry": "哨兵模式已开启",

  "recent.empty": "还没有行程",
  "recent.all": "全部行程",
  "drives.count": "共 {n} 趟",
  "drives.more": "加载更多",
  "drives.empty": "这里还是空的",
  "drives.emptyHint": "TeslaMate 记录到行程后会出现在这里。",

  "time.now": "刚刚",
  "time.sec": "{n} 秒前",
  "time.min": "{n} 分钟前",
  "time.hour": "{n} 小时前",
  "time.day": "{n} 天前",
  "time.minShort": "{n} 分钟",
  "time.hourShort": "{n} 小时",

  "ui.live": "实时",
  "ui.reconnecting": "重连中",
  "ui.updated": "{time}更新",
  "ui.retry": "重试",
  "ui.loading": "加载中",
  "ui.error": "无法连接后端接口",
  "ui.authTitle": "需要访问令牌",
  "ui.authHint": "这个看板启动时设置了 AUTH_TOKEN，填入后继续。",
  "ui.authSave": "解锁",
  "ui.car": "车辆",
  "ui.theme": "主题",
  "ui.language": "语言",
  "ui.offline": "等待车辆上报",
};

const dictionaries = { en, zh } as const;
export type Lang = keyof typeof dictionaries;

const STORAGE_KEY = "teslatrace.lang";

/**
 * Chinese first, deliberately: the project starts in the community it was built for.
 * An explicit choice is remembered; the browser language is never consulted, because
 * "my browser is English" is not a request for an English dashboard.
 */
function detect(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "en" ? "en" : "zh";
}

export type Translate = (key: TKey, vars?: Record<string, string | number>) => string;

type Context = { lang: Lang; locale: string; t: Translate; setLang: (lang: Lang) => void };

const LangContext = createContext<Context | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  const value = useMemo<Context>(() => {
    const dict = dictionaries[lang] as Record<TKey, string>;
    const t: Translate = (key, vars) => {
      const template = dict[key] ?? en[key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
    };
    return { lang, locale: lang === "zh" ? "zh-CN" : "en-US", t, setLang };
  }, [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n(): Context {
  const context = useContext(LangContext);
  if (!context) throw new Error("useI18n must be used inside LangProvider");
  return context;
}
