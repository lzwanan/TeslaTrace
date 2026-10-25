import { useEffect, useMemo, useRef, useState } from "react";
import { Gauge, Moon, RefreshCw, Route, Sun, TrendingUp } from "lucide-react";

import { StatePill, humanAge } from "./components/StatePill";
import { Card, Skeleton } from "./components/ui";
import { apiGet, ApiError, authToken } from "./lib/api";
import { ageSeconds } from "./lib/format";
import { useI18n } from "./lib/i18n";
import { useNow, useSummaryStream } from "./lib/live";
import { applyTheme, readTheme, saveTheme } from "./lib/theme";
import type { Car } from "./lib/types";
import { Drives } from "./pages/Drives";
import { Insights } from "./pages/insights";
import { Overview } from "./pages/Overview";

type Route = "overview" | "drives" | "insights";
const ROUTES: Route[] = ["overview", "drives", "insights"];

const ROUTE_ICON = { overview: Gauge, drives: Route, insights: TrendingUp } as const;

export function App() {
  const { t, lang, setLang } = useI18n();
  const now = useNow();

  const [route, setRoute] = useState<Route>(readRoute);
  const [theme, setTheme] = useState(readTheme);
  const [cars, setCars] = useState<Car[] | null>(null);
  const [carId, setCarId] = useState<number | undefined>();
  const [failure, setFailure] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** Bumped by the refresh button so views refetch instead of waiting for a reload. */
  const [nonce, setNonce] = useState(0);

  const viewsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  // Each tab remembers its own scroll position only by accident otherwise: leaving
  // a long list and coming back lands you in the middle of it.
  useEffect(() => {
    viewsRef.current?.scrollTo({ top: 0 });
  }, [route, carId]);

  useEffect(() => {
    let alive = true;
    apiGet<Car[]>("/cars")
      .then((list) => {
        if (!alive) return;
        setCars(list);
        setFailure(null);
        setCarId((current) => current ?? list[0]?.id);
      })
      .catch((error) => {
        if (alive) setFailure(error instanceof ApiError ? error.status : 0);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const { summary, status } = useSummaryStream(carId, nonce);

  const updated = useMemo(() => {
    if (!summary?.live.updated_at) return t("ui.offline");
    const age = ageSeconds(summary.live.updated_at, now);
    return age === null ? t("ui.offline") : t("ui.updated", { time: humanAge(age, t) });
  }, [summary?.live.updated_at, now, t]);

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

  // A token prompt and a broken API both leave the shell usable: the theme and
  // language switches are exactly what someone reaches for when a page looks wrong.
  if (failure === 401) return <TokenGate chrome={chrome} onSubmit={() => setAttempt((v) => v + 1)} />;

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
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div className="title">
              <h1>{t(`nav.${route}`)}</h1>
              <p>
                {summary?.car.label ?? "TeslaTrace"} · {updated}
              </p>
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
            ) : summary ? (
              route === "overview" ? (
                <Overview summary={summary} />
              ) : route === "drives" ? (
                <Drives summary={summary} nonce={nonce} />
              ) : (
                <Insights summary={summary} nonce={nonce} />
              )
            ) : (
              <LoadingGrid />
            )}
          </div>

          <nav className="tabbar">
            {ROUTES.map((item) => {
              const Icon = ROUTE_ICON[item];
              return (
                <a key={item} className="tab" href={`#/${item}`} aria-current={route === item ? "page" : undefined}>
                  <Icon size={21} />
                  <span>{t(`nav.${item}`)}</span>
                </a>
              );
            })}
          </nav>
        </main>
      </div>
    </div>
  );
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

function TokenGate({ chrome, onSubmit }: { chrome: React.ReactNode; onSubmit: () => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");

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
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    authToken.set(value.trim());
                    onSubmit();
                  }}
                >
                  <input
                    className="field"
                    type="password"
                    autoFocus
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="AUTH_TOKEN"
                  />
                  <button className="btn primary" type="submit" disabled={!value.trim()}>
                    {t("ui.authSave")}
                  </button>
                </form>
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
  const value = window.location.hash.replace(/^#\/?/, "");
  return (ROUTES as string[]).includes(value) ? (value as Route) : "overview";
}
