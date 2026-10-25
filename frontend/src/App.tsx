import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Gauge,
  LogOut,
  Moon,
  RefreshCw,
  Route,
  ShieldAlert,
  ShieldPlus,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  WifiOff,
  X,
} from "lucide-react";

import { StatePill, humanAge } from "./components/StatePill";
import { Card, Skeleton } from "./components/ui";
import { apiGet, ApiError, session, type Session } from "./lib/api";
import { ageSeconds } from "./lib/format";
import { useI18n } from "./lib/i18n";
import { clearSnapshot, useNow, useSummaryStream } from "./lib/live";
import { forgetCachedData, markFromNetwork, useAppUpdate, useOffline } from "./lib/pwa";
import { applyTheme, readTheme, saveTheme } from "./lib/theme";
import type { Car } from "./lib/types";
import { Drives } from "./pages/Drives";
import { Insights, SECTION_IDS, type InsightsSection } from "./pages/insights";
import { Overview } from "./pages/Overview";
import { Settings } from "./pages/Settings";

type Route = "overview" | "drives" | "insights" | "settings";
const ROUTES: Route[] = ["overview", "drives", "insights", "settings"];

const ROUTE_ICON = {
  overview: Gauge,
  drives: Route,
  insights: TrendingUp,
  settings: SlidersHorizontal,
} as const;

/** Dismissed banners, one key each so hiding one does not hide the other. */
const NOTICE = {
  open: "teslatrace.notice.open",
  defaultPassword: "teslatrace.notice.default-password",
} as const;

export function App() {
  const { t, lang, setLang } = useI18n();
  const now = useNow();

  const [route, setRoute] = useState<Route>(readRoute);
  const [section, setSection] = useState<InsightsSection>(readSection);
  const [theme, setTheme] = useState(readTheme);
  const [auth, setAuth] = useState<Session | null>(null);
  const [cars, setCars] = useState<Car[] | null>(null);
  const [carId, setCarId] = useState<number | undefined>();
  const [failure, setFailure] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** Bumped by the refresh button so views refetch instead of waiting for a reload. */
  const [nonce, setNonce] = useState(0);
  const [hidden, setHidden] = useState<string[]>(readNotices);

  const viewsRef = useRef<HTMLDivElement>(null);
  const offline = useOffline();
  const update = useAppUpdate();

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      setSection(readSection());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  // Coming back from offline should not require pulling to refresh: the data
  // on screen was, by definition, out of date when the network left.
  useEffect(() => {
    const onOnline = () => {
      setAttempt((value) => value + 1);
      setNonce((value) => value + 1);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // Each tab would otherwise keep the previous tab's scroll offset: leaving a long
  // list and coming back lands you in the middle of it.
  useEffect(() => {
    viewsRef.current?.scrollTo({ top: 0 });
  }, [route, carId, section]);

  // One request decides whether a login is needed at all, before asking for data.
  useEffect(() => {
    let alive = true;
    setAuth(null);
    session
      .get()
      .then(async (state) => {
        if (!alive) return;
        setAuth(state);
        if (state.required && !state.authenticated) return;
        const list = await apiGet<Car[]>("/cars");
        if (!alive) return;
        setCars(list);
        setFailure(null);
        setCarId((current) => current ?? list[0]?.id);
      })
      .catch((error) => {
        if (!alive) return;
        // A cookie that expired mid-session is a login prompt, not an error page.
        if (error instanceof ApiError && error.status === 401) {
          setAuth({ required: true, authenticated: false, username: null, default_password: false });
          return;
        }
        setFailure(error instanceof ApiError ? error.status : 0);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const { summary, status } = useSummaryStream(carId, nonce);

  // A live stream is proof that what is on screen is current, and it is the only
  // thing that recovers by itself when the server comes back: nothing else asks
  // the API again without someone pressing something.
  useEffect(() => {
    if (status === "live") markFromNetwork();
  }, [status]);

  const updated = useMemo(() => {
    if (!summary?.live.updated_at) return t("ui.offline");
    const age = ageSeconds(summary.live.updated_at, now);
    return age === null ? t("ui.offline") : t("ui.updated", { time: humanAge(age, t) });
  }, [summary?.live.updated_at, now, t]);

  const signOut = async () => {
    try {
      await session.close();
      forgetCachedData();
      clearSnapshot();
    } finally {
      setCars(null);
      setCarId(undefined);
      setFailure(null);
      setAuth({ required: true, authenticated: false, username: null, default_password: false });
    }
  };

  const dismiss = (key: string) => {
    localStorage.setItem(key, "1");
    setHidden((current) => [...current, key]);
  };

  const chrome = (
    <div className="top-actions">
      {cars && cars.length > 1 && carId ? (
        <CarCycle cars={cars} current={carId} onPick={setCarId} />
      ) : null}

      {summary?.live ? <StatePill live={summary.live} now={now} /> : null}

      <button
        className="icon-btn"
        type="button"
        title={t("ui.refresh")}
        aria-label={t("ui.refresh")}
        onClick={() => setNonce((value) => value + 1)}
      >
        <RefreshCw size={15} className={status === "live" ? undefined : "turning"} />
      </button>

      <button
        className="icon-btn lang-btn"
        type="button"
        title={t("ui.language")}
        aria-label={t("ui.language")}
        onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      >
        {lang === "zh" ? "EN" : "中"}
      </button>

      <button
        className="icon-btn theme-btn"
        type="button"
        title={t("ui.theme")}
        aria-label={t("ui.theme")}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
    </div>
  );

  if (auth !== null && auth.required && !auth.authenticated) {
    return <LoginGate chrome={chrome} onSubmit={() => setAttempt((value) => value + 1)} />;
  }

  return (
    <div className="shell">
      <div className="app">
        <aside className="side">
          <div className="brand">
            <span className="brand-mark">
              <Gauge size={16} strokeWidth={2} />
            </span>
            <div>
              <div className="brand-name">TeslaTrace</div>
              <div className="brand-sub">{summary?.car.label ?? "TeslaMate"}</div>
            </div>
          </div>

          {ROUTES.map((item) => {
            const Icon = ROUTE_ICON[item];
            return (
              <a
                key={item}
                className="nav-item"
                href={`#/${item}`}
                aria-current={route === item ? "page" : undefined}
              >
                <Icon size={18} />
                {t(`nav.${item}`)}
              </a>
            );
          })}

          <div className="side-foot">
            {status === "live" ? t("ui.live") : t("ui.reconnecting")}
            <br />
            {updated}
            {auth?.required ? (
              <>
                <br />
                <button className="linkish" type="button" onClick={() => void signOut()}>
                  <LogOut size={12} /> {t("ui.logout")}
                </button>
              </>
            ) : null}
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div className="title">
              <h1>{t(`nav.${route}`)}</h1>
              {/* The car name is in the switcher right next to this; repeating it here
                  was costing the only width this line has on a phone. */}
              <p>{updated}</p>
            </div>
            {chrome}
          </header>

          <div className="views" ref={viewsRef}>
            {failure !== null ? (
              <div className="cards">
                <Card span="full" cols={12}>
                  <div className="empty">
                    <div>{failure === 0 ? t("ui.error") : `${t("ui.error")} · HTTP ${failure}`}</div>
                    <button className="btn" type="button" onClick={() => setAttempt((v) => v + 1)}>
                      {t("ui.retry")}
                    </button>
                  </div>
                </Card>
              </div>
            ) : (
              <>
                {offline ? (
                  <div className="offline-bar" role="status">
                    <WifiOff size={14} strokeWidth={1.9} />
                    <span>{t("ui.offlineBar")}</span>
                  </div>
                ) : null}

                {auth && !auth.required && route !== "settings" && !hidden.includes(NOTICE.open) ? (
                  <Notice
                    icon={ShieldPlus}
                    title={t("ui.openTitle")}
                    body={t("ui.openBody")}
                    action={t("ui.setUp")}
                    onAction={() => goTo("settings")}
                    onDismiss={() => dismiss(NOTICE.open)}
                    dismissLabel={t("ui.dismiss")}
                  />
                ) : null}

                {auth?.default_password &&
                route !== "settings" &&
                !hidden.includes(NOTICE.defaultPassword) ? (
                  <Notice
                    icon={ShieldAlert}
                    title={t("ui.defaultPasswordTitle")}
                    body={t("ui.defaultPasswordBody")}
                    action={t("ui.setUp")}
                    onAction={() => goTo("settings")}
                    onDismiss={() => dismiss(NOTICE.defaultPassword)}
                    dismissLabel={t("ui.dismiss")}
                  />
                ) : null}

                {route === "settings" ? (
                  auth ? (
                    <Settings auth={auth} onChange={setAuth} />
                  ) : (
                    <LoadingGrid />
                  )
                ) : summary ? (
                  route === "overview" ? (
                    <Overview summary={summary} />
                  ) : route === "drives" ? (
                    <Drives summary={summary} nonce={nonce} />
                  ) : (
                    <Insights
                      summary={summary}
                      nonce={nonce}
                      section={section}
                      onSection={(id) => goTo("insights", id)}
                    />
                  )
                ) : (
                  <LoadingGrid />
                )}
              </>
            )}
          </div>

          <nav className="tabbar">
            {ROUTES.map((item) => {
              const Icon = ROUTE_ICON[item];
              return (
                <a
                  key={item}
                  className="tab"
                  href={`#/${item}`}
                  aria-current={route === item ? "page" : undefined}
                >
                  <Icon size={21} />
                  <span>{t(`nav.${item}`)}</span>
                </a>
              );
            })}
          </nav>
        </main>

        {update.ready ? <UpdateToast onApply={update.apply} /> : null}
      </div>
    </div>
  );
}

/**
 * Shown when a new build is installed and waiting. It never reloads on its own:
 * the page is being read, possibly mid-scroll, on a phone.
 */
function UpdateToast({ onApply }: { onApply: () => void }) {
  const { t } = useI18n();
  return (
    <div className="update-toast" role="status">
      <ArrowDownToLine size={15} strokeWidth={1.9} />
      <span>{t("ui.updateReady")}</span>
      <button className="btn primary" type="button" onClick={onApply}>
        {t("ui.updateApply")}
      </button>
    </div>
  );
}

/** Hash navigation from a button: the router reads the hash, so this is the whole API. */
function goTo(route: Route, section?: string) {
  window.location.hash = section ? `#/${route}/${section}` : `#/${route}`;
}

/** One tap cycles to the next car: cheaper than a dropdown on a phone. */
function CarCycle({
  cars,
  current,
  onPick,
}: {
  cars: Car[];
  current: number | undefined;
  onPick: (id: number) => void;
}) {
  const index = Math.max(0, cars.findIndex((car) => car.id === current));
  const next = cars[(index + 1) % cars.length];
  const label = cars[index]?.label ?? "";

  return (
    <button
      className="icon-btn car-btn"
      type="button"
      title={`${label} → ${next.label}`}
      onClick={() => onPick(next.id)}
    >
      <span>{label}</span>
    </button>
  );
}

/**
 * The two states worth interrupting for: nobody can be locked out, or everybody
 * can walk in with the password that is printed in the README.
 */
function Notice({
  icon: Icon,
  title,
  body,
  action,
  onAction,
  onDismiss,
  dismissLabel,
}: {
  icon: typeof ShieldPlus;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  onDismiss: () => void;
  dismissLabel: string;
}) {
  return (
    <div className="notice" role="status">
      <Icon size={16} strokeWidth={1.8} />
      <div>
        <b>{title}</b>
        <span>{body}</span>
        <button className="notice-action" type="button" onClick={onAction}>
          {action} ›
        </button>
      </div>
      <button className="notice-x" type="button" aria-label={dismissLabel} onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  );
}

function LoginGate({ chrome, onSubmit }: { chrome: React.ReactNode; onSubmit: () => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await session.open(username.trim(), password);
      onSubmit();
    } catch (failure) {
      const status = failure instanceof ApiError ? failure.status : 0;
      setError(status === 429 ? t("ui.authThrottled") : t("ui.authWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell">
      <div className="app">
        <main className="main">
          <header className="topbar">
            <div className="title">
              <h1>TeslaTrace</h1>
              <p>{t("ui.authTitle")}</p>
            </div>
            {chrome}
          </header>
          <div className="views">
            <div className="centered">
              <div className="panel">
                <h2>{t("ui.authTitle")}</h2>
                <p>{t("ui.authHint")}</p>
                <form onSubmit={submit}>
                  <input
                    className="field"
                    value={username}
                    autoComplete="username"
                    aria-label={t("settings.username")}
                    placeholder={t("settings.username")}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                  <input
                    className="field"
                    type="password"
                    autoFocus
                    autoComplete="current-password"
                    value={password}
                    aria-label={t("settings.password")}
                    placeholder={t("settings.password")}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button className="btn primary" type="submit" disabled={!password || busy}>
                    {busy ? t("ui.authChecking") : t("ui.authSave")}
                  </button>
                </form>
                {error ? <div className="form-error">{error}</div> : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/** Skeletons shaped like the real cards, so the first paint does not jump. */
function LoadingGrid() {
  return (
    <div className="cards">
      <div className="card c-full" style={{ height: 250 }}>
        <Skeleton height={122} width="122px" />
      </div>
      <div className="card c-half" style={{ height: 200 }}>
        <Skeleton height={18} width="40%" />
      </div>
      {[0, 1, 2, 3].map((item) => (
        <div className="card c-kpi" key={item} style={{ height: 104 }}>
          <Skeleton height={12} width="50%" />
          <div style={{ height: 12 }} />
          <Skeleton height={22} width="70%" />
        </div>
      ))}
    </div>
  );
}

function readRoute(): Route {
  const [value] = window.location.hash.replace(/^#\/?/, "").split("/");
  return (ROUTES as string[]).includes(value) ? (value as Route) : "overview";
}

/** `#/insights/charging` — the topic is part of the address, so a reload keeps it. */
function readSection(): InsightsSection {
  const value = window.location.hash.replace(/^#\/?/, "").split("/")[1];
  return (SECTION_IDS as readonly string[]).includes(value) ? (value as InsightsSection) : "month";
}

function readNotices(): string[] {
  return Object.values(NOTICE).filter((key) => localStorage.getItem(key) === "1");
}
