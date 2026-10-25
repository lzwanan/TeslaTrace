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
  "nav.insights": "Insights",
  "nav.settings": "Settings",

  "insight.month": "Monthly",
  "insight.year": "Yearly",
  "insight.charging": "Charging",
  "insight.habits": "Habits",
  "insight.places": "Places",
  "insight.nav": "Insights sections",

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
  "card.monthDrives": "Trips this month",
  "card.battery": "Battery",
  "card.vehicle": "Vehicle",
  "card.charging": "Charging",
  "card.recent": "Recent drives",
  "card.attention": "Needs attention",
  "card.annual": "Year by year",
  "card.chargingHabits": "Charging habits",
  "card.drivingHabits": "Driving habits",
  "card.places": "Frequent places",

  "stats.year": "Year",
  "stats.ytd": "to date",
  "stats.avgTrip": "Average trip",
  "stats.avgSpeed": "Average speed",
  "stats.shortTrips": "Under 5 km",
  "stats.night": "At night",
  "stats.daysUsed": "Days driven",
  "stats.busiestDay": "Longest day",
  "stats.longestTrip": "Longest trip",
  "stats.avgPower": "Average power",
  "stats.avgDuration": "Average session",
  "stats.maxKwh": "Largest session",
  "stats.level.full": "to 100%",
  "stats.level.to90": "to 90%",
  "stats.level.to80": "to 80%",
  "stats.level.below80": "under 80%",
  "stats.hour.night": "00–08",
  "stats.hour.day": "08–18",
  "stats.hour.evening": "18–24",
  "stats.visits": "departures",
  "stats.chargedTo": "Charged to",
  "stats.startedAt": "Started at",
  "stats.shortNote": "Short trips spend a larger share on climate and pack warm-up, which is why consumption runs high.",
  "kpi.minutes": "min",
  "stats.lfpNote": "Topping up to 100% is right for LFP packs; a nickel-based pack would prefer 80%.",

  "card.monthlyKm": "Distance by month",
  "card.monthlyCost": "Cost by month",
  "card.totals": "Last {n} months",
  "card.capacity": "Battery capacity",
  "card.climate": "Climate today",
  "card.climateHint": "Camp mode and preconditioning run on parked energy",

  "pos.open": "Open in maps",
  "pos.unknown": "Unknown place",
  "pos.coords": "{lat}, {lng}",

  "kpi.battery": "Battery",
  "kpi.elevation": "Altitude",
  "kpi.speed": "Speed",
  "kpi.climate": "Climate on",
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
  "stats.perKm": "per km",
  "stats.kwh": "Charged",
  "stats.cost": "Cost",
  "stats.sessions": "{n} sessions",
  "stats.samples": "from {n} large charges",
  "stats.ratedRange": "Range at 100%",
  "stats.noCost": "No tariff configured",
  "stats.current": "This month",
  "stats.includesParked": "Includes parked use: climate, camp mode and standby drain",

  "alert.lowBattery": "Battery below 20%",
  "alert.unlocked": "Car is unlocked",
  "alert.sentry": "Sentry mode is on",

  "recent.empty": "No drives yet",
  "recent.all": "All drives",
  "drives.count": "{n} drives",
  "drives.more": "Load more",
  "drives.all": "All",
  "drives.filter": "Filter by month",
  "drives.shown": "Showing {n}",
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
  "ui.refresh": "Refresh",
  "ui.retry": "Retry",
  "ui.loading": "Loading",
  "ui.error": "Could not reach the API",
  "ui.authTitle": "Sign in",
  "ui.authHint": "This dashboard is protected. Use the username and password you set in Settings.",
  "ui.authSave": "Sign in",
  "ui.authChecking": "Checking…",
  "ui.authWrong": "Wrong username or password.",
  "ui.authThrottled": "Too many attempts. Wait a minute.",
  "ui.logout": "Sign out",
  "ui.dismiss": "Got it",
  "ui.setUp": "Open settings",
  "ui.openTitle": "No login set up",
  "ui.openBody": "Anyone on this network can see where this car is.",
  "ui.defaultPasswordTitle": "Still using admin / admin",
  "ui.defaultPasswordBody": "The default password is public. Change it before anyone else finds this page.",

  "settings.access": "Access",
  "settings.on": "protected",
  "settings.off": "open",
  "settings.require": "Require a username and password",
  "settings.requireHint": "The dashboard asks once per browser and remembers you for 30 days.",
  "settings.openHint": "No login. Anyone who can reach this address sees the car, including where it is parked.",
  "settings.username": "Username",
  "settings.password": "Password",
  "settings.newPassword": "New password",
  "settings.confirmPassword": "Repeat the new password",
  "settings.currentPassword": "Current password",
  "settings.keepPassword": "Leave empty to keep the current one",
  "settings.defaultPassword": "Leave empty for admin",
  "settings.session": "This browser",
  "settings.sessionHint": "Signed in. Signing out only affects this browser.",
  "settings.noSession": "No login is set up, so there is nothing to sign out of.",
  "settings.save": "Save",
  "settings.saving": "Saving…",
  "settings.saved": "Saved.",
  "settings.mismatch": "The two passwords do not match.",
  "settings.tooShort": "Use at least 4 characters.",
  "settings.wrongCurrent": "That is not your current password.",
  "settings.rejected": "That value was rejected.",
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
  "nav.insights": "统计",
  "nav.settings": "设置",

  "insight.month": "月度",
  "insight.year": "年度",
  "insight.charging": "充电",
  "insight.habits": "习惯",
  "insight.places": "地点",
  "insight.nav": "统计分区",

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
  "card.monthDrives": "本月趟数",
  "card.battery": "电池",
  "card.vehicle": "车辆",
  "card.charging": "充电",
  "card.recent": "最近行程",
  "card.attention": "需要留意",
  "card.annual": "年度对比",
  "card.chargingHabits": "充电习惯",
  "card.drivingHabits": "驾驶习惯",
  "card.places": "常去地点",

  "stats.year": "年份",
  "stats.ytd": "至今",
  "stats.avgTrip": "平均单趟",
  "stats.avgSpeed": "平均时速",
  "stats.shortTrips": "短途占比",
  "stats.night": "夜间行程",
  "stats.daysUsed": "有用车天数",
  "stats.busiestDay": "单日最远",
  "stats.longestTrip": "最长单趟",
  "stats.avgPower": "平均功率",
  "stats.avgDuration": "平均时长",
  "stats.maxKwh": "单次最大",
  "stats.level.full": "充满 100%",
  "stats.level.to90": "到 90%",
  "stats.level.to80": "到 80%",
  "stats.level.below80": "不足 80%",
  "stats.hour.night": "00–08",
  "stats.hour.day": "08–18",
  "stats.hour.evening": "18–24",
  "stats.visits": "次出发",
  "stats.chargedTo": "充到",
  "stats.startedAt": "开始时刻",
  "stats.shortNote": "短途占比高时，空调与电池预热摊到的比例更大，这也是能耗偏高的原因之一。",
  "kpi.minutes": "分钟",
  "stats.lfpNote": "充到 100% 对 LFP 电池是正确做法；三元锂车型则应停在 80%。",

  "card.monthlyKm": "月度里程",
  "card.monthlyCost": "月度电费",
  "card.totals": "近 {n} 个月",
  "card.capacity": "电池容量",
  "card.climate": "今日空调",
  "card.climateHint": "露营模式与提前开空调都算驻车用电",

  "pos.open": "在地图中打开",
  "pos.unknown": "未知位置",
  "pos.coords": "{lat}, {lng}",

  "kpi.battery": "当前电量",
  "kpi.elevation": "海拔",
  "kpi.speed": "速度",
  "kpi.climate": "空调开启",
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
  "stats.perKm": "每公里",
  "stats.kwh": "充电量",
  "stats.cost": "电费",
  "stats.sessions": "{n} 次充电",
  "stats.samples": "取自 {n} 次大额充电",
  "stats.ratedRange": "满电续航",
  "stats.noCost": "未配置电价",
  "stats.current": "本月",
  "stats.includesParked": "含驻车用电：空调、露营模式与静置耗电",

  "alert.lowBattery": "电量低于 20%",
  "alert.unlocked": "车辆未上锁",
  "alert.sentry": "哨兵模式已开启",

  "recent.empty": "还没有行程",
  "recent.all": "全部行程",
  "drives.count": "共 {n} 趟",
  "drives.more": "加载更多",
  "drives.all": "全部",
  "drives.filter": "按月份筛选",
  "drives.shown": "已显示 {n} 趟",
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
  "ui.refresh": "刷新",
  "ui.retry": "重试",
  "ui.loading": "加载中",
  "ui.error": "无法连接后端接口",
  "ui.authTitle": "登录",
  "ui.authHint": "这个看板已开启登录保护，用你在设置里定的用户名和密码进入。",
  "ui.authSave": "登录",
  "ui.authChecking": "验证中…",
  "ui.authWrong": "用户名或密码不对。",
  "ui.authThrottled": "尝试次数过多，请等一分钟。",
  "ui.logout": "退出登录",
  "ui.dismiss": "知道了",
  "ui.setUp": "去设置",
  "ui.openTitle": "未开启登录保护",
  "ui.openBody": "同一网络内任何人都能看到这台车的位置。",
  "ui.defaultPasswordTitle": "还在用 admin / admin",
  "ui.defaultPasswordBody": "默认密码是公开的，趁别人还没发现这个页面，先改掉。",

  "settings.access": "访问保护",
  "settings.on": "已开启",
  "settings.off": "未开启",
  "settings.require": "需要用户名和密码才能查看",
  "settings.requireHint": "每个浏览器问一次，之后 30 天内免登录。",
  "settings.openHint": "不设登录。任何能打开这个地址的人都能看到车况，包括现在停在哪。",
  "settings.username": "用户名",
  "settings.password": "密码",
  "settings.newPassword": "新密码",
  "settings.confirmPassword": "再输一次新密码",
  "settings.currentPassword": "当前密码",
  "settings.keepPassword": "留空则不修改",
  "settings.defaultPassword": "留空则使用 admin",
  "settings.session": "当前浏览器",
  "settings.sessionHint": "已登录。退出只影响这个浏览器。",
  "settings.noSession": "尚未设置登录，没有可退出的会话。",
  "settings.save": "保存",
  "settings.saving": "保存中…",
  "settings.saved": "已保存。",
  "settings.mismatch": "两次输入的密码不一致。",
  "settings.tooShort": "至少 4 位字符。",
  "settings.wrongCurrent": "当前密码不对。",
  "settings.rejected": "这个值不被接受。",
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
