/**
 * Settings: one switch, one account.
 *
 * The whole surface is here on purpose. A dashboard that shows where a car is has
 * to make "who can see this" answerable in one screen, not buried in a config file
 * that requires a container restart.
 */

import { useState } from "react";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";

import { Card, Cap } from "../components/ui";
import { ApiError, session, settings, type Session } from "../lib/api";
import { useI18n } from "../lib/i18n";

export function Settings({
  auth,
  onChange,
}: {
  auth: Session;
  onChange: (next: Session) => void;
}) {
  const { t } = useI18n();

  // The name the form starts with, so opening the page is not itself "an edit".
  const initialName = auth.username ?? "admin";

  const [enabled, setEnabled] = useState(auth.required);
  const [username, setUsername] = useState(initialName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const needsCurrent = auth.required;
  const editing = enabled !== auth.required || password !== "" || username !== initialName;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password && password !== confirm) {
      setError(t("settings.mismatch"));
      return;
    }
    if (password && password.length < 4) {
      setError(t("settings.tooShort"));
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await settings.saveAuth({
        enabled,
        username,
        new_password: password || undefined,
        current_password: current || undefined,
      });
      onChange(next);
      setPassword("");
      setConfirm("");
      setCurrent("");
      setSaved(true);
    } catch (failure) {
      const status = failure instanceof ApiError ? failure.status : 0;
      setError(
        status === 403
          ? t("settings.wrongCurrent")
          : status === 400
            ? t("settings.rejected")
            : t("ui.error"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cards">
      <Card span="full" cols={8}>
        <Cap icon={ShieldCheck} title={t("settings.access")} aside={enabled ? t("settings.on") : t("settings.off")} />

        <form className="form" onSubmit={submit}>
          <label className="switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => {
                setEnabled(event.target.checked);
                setSaved(false);
              }}
            />
            <span className="switch-track" aria-hidden="true" />
            <span className="switch-text">{t("settings.require")}</span>
          </label>
          <p className="note">{enabled ? t("settings.requireHint") : t("settings.openHint")}</p>

          {enabled ? (
            <>
              <div className="form-row">
                <label htmlFor="username">{t("settings.username")}</label>
                <input
                  id="username"
                  className="field"
                  value={username}
                  autoComplete="username"
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>

              <div className="form-row">
                <label htmlFor="password">{t("settings.newPassword")}</label>
                <input
                  id="password"
                  className="field"
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  placeholder={auth.required ? t("settings.keepPassword") : t("settings.defaultPassword")}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {password ? (
                <div className="form-row">
                  <label htmlFor="confirm">{t("settings.confirmPassword")}</label>
                  <input
                    id="confirm"
                    className="field"
                    type="password"
                    value={confirm}
                    autoComplete="new-password"
                    onChange={(event) => setConfirm(event.target.value)}
                  />
                </div>
              ) : null}

              {needsCurrent ? (
                <div className="form-row">
                  <label htmlFor="current">{t("settings.currentPassword")}</label>
                  <input
                    id="current"
                    className="field"
                    type="password"
                    value={current}
                    autoComplete="current-password"
                    onChange={(event) => setCurrent(event.target.value)}
                  />
                </div>
              ) : null}
            </>
          ) : needsCurrent ? (
            <div className="form-row">
              <label htmlFor="current-off">{t("settings.currentPassword")}</label>
              <input
                id="current-off"
                className="field"
                type="password"
                value={current}
                autoComplete="current-password"
                onChange={(event) => setCurrent(event.target.value)}
              />
            </div>
          ) : null}

          {error ? <div className="form-error">{error}</div> : null}
          {saved ? <div className="form-ok">{t("settings.saved")}</div> : null}

          <button
            className="btn primary"
            type="submit"
            disabled={busy || (!editing && !needsCurrent) || (needsCurrent && !current)}
          >
            {busy ? t("settings.saving") : t("settings.save")}
          </button>
        </form>
      </Card>

      <Card span="half" cols={4}>
        <Cap icon={KeyRound} title={t("settings.session")} />
        {auth.required && auth.authenticated ? (
          <>
            <div className="kpi-value" style={{ fontSize: 24 }}>
              {auth.username}
            </div>
            <div className="note">{t("settings.sessionHint")}</div>
            <button
              className="btn"
              type="button"
              style={{ marginTop: 14, width: "100%" }}
              onClick={async () => {
                await session.close();
                window.location.reload();
              }}
            >
              <LogOut size={14} /> {t("ui.logout")}
            </button>
          </>
        ) : (
          <div className="note">{t("settings.noSession")}</div>
        )}
      </Card>
    </div>
  );
}
