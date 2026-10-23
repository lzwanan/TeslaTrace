import { useEffect, useMemo, useState } from "react";
import { Gauge, Moon, Route, Sun, TrendingUp } from "lucide-react";

import { StatePill, humanAge } from "./components/StatePill";
import { Skeleton } from "./components/ui";
import { apiGet, ApiError, authToken } from "./lib/api";
import { ageSeconds } from "./lib/format";
import { useI18n } from "./lib/i18n";
import { useNow, useSummaryStream } from "./lib/live";
import type { Car } from "./lib/types";
import { Drives } from "./pages/Drives";
import { Insights } from "./pages/Insights";
import { Overview } from "./pages/Overview";

type Route = "overview" | "drives" | "insights";
const ROUTES: Route[] = ["overview", "drives", "insights"];

const ROUTE_ICON = { overview: Gauge, drives: Route, insights: TrendingUp } as const;

export function App() {
  const { t, lang, setLang } = useI18n();
  const now = useNow();

  const [route, setRoute] = useState<Route>(readRoute);
  const [theme, setTheme] = useState<"dark" | "light">(readTheme);
  const [cars, setCars] = useState<Car[] | null>(null);
  const [carId, setCarId] = useState<number | undefined>();
  const [failure, setFailure] = useState<number | null>(null);
  const [tokenVersion, setTokenVersion] = useState(0);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("teslatrace.theme", theme);
  }, [theme]);

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
  }, [tokenVersion]);

  const { summary, status } = useSummaryStream(carId);

  const updated = useMemo(() => {
    if (!summary?.live.updated_at) return t("ui.offline");
    const age = ageSeconds(summary.live.updated_at, now);
    return age === null ? t("ui.offline") : t("ui.updated", { time: humanAge(age, t) });
  }, [summary?.live.updated_at, now, t]);

  if (failure === 401) {
    return <TokenGate onSubmit={() => setTokenVersion((v) => v + 1)} />;
  }

  if (failure !== null) {
    return (
      <div className="centered">
        <div className="panel">
          <h2>{t("ui.error")}</h2>
          <p>{failure === 0 ? t("ui.error") : `HTTP ${failure}`}</p>
          <button className="btn primary" type="button" onClick={() => setTokenVersion((v) => v + 1)}>
            {t("ui.retry")}
          </button>
        </div>
      </div>
    );
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

          {ROUTES.map((item) => (
            <a
              key={item}
              className="nav-item"
              href={`#/${item}`}
              aria-current={route === item ? "page" : undefined}
            >
              {(() => {
                const Icon = ROUTE_ICON[item];
                return <Icon size={18} />;
              })()}
              {t(`nav.${item}`)}
            </a>
          ))}

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

            <div className="top-actions">
              {cars && cars.length > 1 ? (
                <CarCycle cars={cars} current={carId} onPick={setCarId} />
              ) : null}

              {summary?.live ? <StatePill live={summary.live} now={now} /> : null}

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
          </header>

          <div className="views">
            {summary ? (
              route === "overview" ? (
                <Overview summary={summary} />
              ) : route === "drives" ? (
                <Drives summary={summary} />
              ) : (
                <Insights summary={summary} />
              )
            ) : (
              <LoadingGrid />
            )}
          </div>

          <nav className="tabbar">
            {ROUTES.map((item) => (
              <a
                key={item}
                className="tab"
                href={`#/${item}`}
                aria-current={route === item ? "page" : undefined}
                style={{ textDecoration: "none" }}
              >
                {(() => {
                  const Icon = ROUTE_ICON[item];
                  return <Icon size={21} />;
                })()}
                <span>{t(`nav.${item}`)}</span>
              </a>
            ))}
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

function TokenGate({ onSubmit }: { onSubmit: () => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");

  return (
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

function readTheme(): "dark" | "light" {
  const saved = localStorage.getItem("teslatrace.theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
