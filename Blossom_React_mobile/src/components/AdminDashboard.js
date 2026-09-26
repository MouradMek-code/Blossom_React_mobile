import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { BASE_URL } from "../api/config";
import { getToken } from "../api/storage";
import { peekCache, writeCache } from "../api/cache";
import { breakdownLabel, compact, delta, niceMax, shortDate, tzOffsetMinutes } from "../api/dashboardLabels";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import { colors, radius, spacing, shadow } from "../theme";

const PERIODS = [7, 30, 90];

// Series colours (validated for colour-blind separation): members = rose,
// visitors without a profile = blue; one-series charts use deep plum. Text
// never takes a series colour.
const SERIES = { members: "#C1466B", anon: "#2A78D6", all: "#7E2A44" };
const UP = "#1F7A4D";
const DOWN = "#B3261E";
const GRID = "#EFE7E1";
const TRACK = "#F5EEEA";

// Admins only: who visits Blossom (admins never counted; a member once per
// period, anyone without a profile at every visit) and how many finish a
// profile. Numbers from GET /analytics/dashboard.
export default function AdminDashboard({ bottomInset = 0 }) {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(() => peekCache("dashboard30"));
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (period = days) => {
      try {
        const token = await getToken();
        const resp = await fetch(`${BASE_URL}/analytics/dashboard?days=${period}&tz_offset=${tzOffsetMinutes()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error(`dashboard ${resp.status}`);
        const json = await resp.json();
        setData(json);
        writeCache(`dashboard${period}`, json);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setRefreshing(false);
      }
    },
    [days],
  );

  useAutoRefresh(load, { minIntervalMs: 60000 });

  function pickPeriod(period) {
    if (period === days) return;
    setDays(period);
    setData(peekCache(`dashboard${period}`) ?? null);
    load(period);
  }

  const k = data?.kpis;
  const lang = i18n.language;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.xl }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.periods}>
        {PERIODS.map((p) => (
          <Pressable
            key={p}
            onPress={() => pickPeriod(p)}
            style={[styles.period, days === p && styles.periodActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: days === p }}
          >
            <Text style={[styles.periodText, days === p && styles.periodTextActive]}>
              {t("dashboard.periodDays", { count: p })}
            </Text>
          </Pressable>
        ))}
      </View>

      {!data ? (
        error ? (
          <View style={styles.card}>
            <Text style={styles.muted}>{t("dashboard.loadError")}</Text>
            <Pressable onPress={() => load()} style={styles.retryBtn}>
              <Text style={styles.retryText}>{t("dashboard.retry")}</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        )
      ) : (
        <>
          {error && <Text style={styles.offline}>{t("dashboard.loadError")}</Text>}

          {/* Hero: the one number to read first */}
          <View style={styles.card}>
            <Text style={styles.label}>
              {t("dashboard.visitors")} · {t("dashboard.periodDays", { count: days })}
            </Text>
            <Text style={styles.hero}>{compact(k.visitors.value)}</Text>
            <Delta d={delta(k.visitors.value, k.visitors.previous, { t })} days={days} t={t} />
            <Text style={styles.explain}>
              {t("dashboard.visitorsExplain", { members: k.members.value, visits: k.anonymous.value })}
            </Text>
            <View style={styles.todayRow}>
              <Text style={styles.todayLabel}>{t("dashboard.today")}</Text>
              <Text style={styles.todayValue}>{data.today.visitors}</Text>
              <Text style={styles.todayLine}>
                {t("dashboard.todayLine", {
                  members: data.today.members,
                  visits: data.today.anonymous,
                  newProfiles: data.today.new_profiles,
                })}
              </Text>
            </View>
          </View>

          <View style={styles.tiles}>
            <Tile label={t("dashboard.members")} hint={t("dashboard.membersHint")} value={compact(k.members.value)}
              d={delta(k.members.value, k.members.previous, { t })} days={days} t={t} />
            <Tile label={t("dashboard.anonymous")} hint={t("dashboard.anonymousHint")} value={compact(k.anonymous.value)}
              d={delta(k.anonymous.value, k.anonymous.previous, { t })} days={days} t={t} />
            <Tile label={t("dashboard.newProfiles")} hint={t("dashboard.newProfilesHint")} value={compact(k.new_profiles.value)}
              d={delta(k.new_profiles.value, k.new_profiles.previous, { t })} days={days} t={t} />
            <Tile label={t("dashboard.signupRate")} hint={t("dashboard.signupRateHint")}
              value={k.signup_rate.value == null ? "—" : `${k.signup_rate.value}%`}
              d={delta(k.signup_rate.value, k.signup_rate.previous, { points: true, t })} days={days} t={t} />
          </View>

          <DailyChart daily={data.daily} t={t} lang={lang} />

          <ColumnChart
            title={t("dashboard.dailyNew")}
            hint={t("dashboard.newProfilesHint")}
            values={data.daily.map((d) => d.new_profiles)}
            labels={data.daily.map((d) => shortDate(d.date, lang))}
            labelEvery={Math.ceil(data.daily.length / 4)}
            describe={(i) => `${shortDate(data.daily[i].date, lang)} · ${t("dashboard.newProfilesCount", { count: data.daily[i].new_profiles })}`}
            color={SERIES.members}
            t={t}
          />

          <ColumnChart
            title={t("dashboard.hours")}
            hint={t("dashboard.hoursHint")}
            values={data.hours}
            labels={data.hours.map((_, h) => `${String(h).padStart(2, "0")}h`)}
            labelEvery={6}
            describe={(h) => `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59 · ${t("dashboard.visitsCount", { count: data.hours[h] })}`}
            color={SERIES.all}
            t={t}
          />

          <Funnel steps={data.funnel} t={t} />
          <Community c={data.community} t={t} />

          <Breakdown title={t("dashboard.platforms")} kind="platforms" items={data.platforms} t={t} />
          <Breakdown title={t("dashboard.languages")} kind="languages" items={data.languages} t={t} />
          <Breakdown title={t("dashboard.regions")} kind="timezones" items={data.timezones} t={t} />
          <Breakdown title={t("dashboard.entries")} kind="entries" items={data.entries} t={t} />

          <Text style={styles.footnote}>{t("dashboard.footnote")}</Text>
        </>
      )}
    </ScrollView>
  );
}

function Delta({ d, days, t }) {
  if (!d) return null;
  const color = d.direction === "up" ? UP : d.direction === "down" ? DOWN : colors.textMuted;
  const arrow = d.direction === "up" ? "▲" : d.direction === "down" ? "▼" : "•";
  return (
    <Text style={[styles.delta, { color }]}>
      {arrow} {d.text} <Text style={styles.deltaVs}>{t("dashboard.vsPrevious", { count: days })}</Text>
    </Text>
  );
}

function Tile({ label, hint, value, d, days, t }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Delta d={d} days={days} t={t} />
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

function YAxis({ max, height }) {
  return (
    <View style={[styles.yAxis, { height }]}>
      <Text style={styles.axisText}>{compact(max)}</Text>
      <Text style={styles.axisText}>0</Text>
    </View>
  );
}

// Members (rose) + visits without a profile (blue), stacked per day. Tap a
// day for its numbers.
function DailyChart({ daily, t, lang }) {
  const [active, setActive] = useState(null);
  const height = 170;
  const max = niceMax(Math.max(0, ...daily.map((d) => d.members + d.anonymous)));
  const empty = daily.every((d) => d.members + d.anonymous === 0);
  const labelEvery = Math.ceil(daily.length / 4);
  const current = active != null ? daily[active] : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("dashboard.daily")}</Text>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: SERIES.members }]} />
          <Text style={styles.legendText}>{t("dashboard.legendMembers")}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: SERIES.anon }]} />
          <Text style={styles.legendText}>{t("dashboard.legendAnonymous")}</Text>
        </View>
      </View>

      {empty ? (
        <Text style={styles.empty}>{t("dashboard.noData")}</Text>
      ) : (
        <>
          <View style={styles.chartRow}>
            <YAxis max={max} height={height} />
            <View style={styles.plot}>
              <View style={[styles.gridLine, { top: 0 }]} />
              <View style={[styles.gridLine, { top: height / 2 }]} />
              <View style={[styles.columns, { height }]}>
                {daily.map((d, i) => {
                  const total = d.members + d.anonymous;
                  return (
                    <Pressable
                      key={d.date}
                      style={[styles.colSlot, active === i && styles.colActive]}
                      onPress={() => setActive(active === i ? null : i)}
                      hitSlop={{ top: 8, bottom: 8 }}
                      accessibilityLabel={`${shortDate(d.date, lang)}: ${d.members} ${t("dashboard.legendMembers")}, ${d.anonymous} ${t("dashboard.legendAnonymous")}`}
                    >
                      {total > 0 && (
                        <View style={[styles.stack, { height: (total / max) * height }]}>
                          {d.anonymous > 0 && (
                            <View style={[styles.seg, styles.segTop, { flex: d.anonymous, backgroundColor: SERIES.anon }]} />
                          )}
                          {d.members > 0 && (
                            <View
                              style={[
                                styles.seg,
                                d.anonymous === 0 && styles.segTop,
                                { flex: d.members, backgroundColor: SERIES.members },
                              ]}
                            />
                          )}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <XAxis labels={daily.map((d) => shortDate(d.date, lang))} every={labelEvery} />
            </View>
          </View>
          <Text style={styles.detail}>
            {current
              ? `${shortDate(current.date, lang)} · ${current.members} ${t("dashboard.legendMembers")} · ${current.anonymous} ${t("dashboard.legendAnonymous")} · ${t("dashboard.newProfilesCount", { count: current.new_profiles })}`
              : t("dashboard.tapHint")}
          </Text>
        </>
      )}
    </View>
  );
}

function XAxis({ labels, every }) {
  return (
    <View style={styles.xAxis}>
      {labels.map((label, i) =>
        i % every === 0 ? (
          <Text
            key={i}
            style={[styles.axisText, styles.xLabel, { left: `${(i / labels.length) * 100}%` }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        ) : null,
      )}
    </View>
  );
}

// One series: the title names it, so no legend.
function ColumnChart({ title, hint, values, labels, labelEvery, describe, color, t }) {
  const [active, setActive] = useState(null);
  const height = 110;
  const max = niceMax(Math.max(0, ...values));
  const empty = values.every((v) => v === 0);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {hint ? <Text style={[styles.hint, { marginBottom: spacing.sm }]}>{hint}</Text> : null}
      {empty ? (
        <Text style={styles.empty}>{t("dashboard.noData")}</Text>
      ) : (
        <>
          <View style={styles.chartRow}>
            <YAxis max={max} height={height} />
            <View style={styles.plot}>
              <View style={[styles.gridLine, { top: 0 }]} />
              <View style={[styles.columns, { height }]}>
                {values.map((v, i) => (
                  <Pressable
                    key={i}
                    style={[styles.colSlot, active === i && styles.colActive]}
                    onPress={() => setActive(active === i ? null : i)}
                    hitSlop={{ top: 8, bottom: 8 }}
                    accessibilityLabel={describe(i)}
                  >
                    {v > 0 && (
                      <View style={[styles.stack, { height: (v / max) * height }]}>
                        <View style={[styles.seg, styles.segTop, { flex: 1, backgroundColor: color }]} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
              <XAxis labels={labels} every={labelEvery} />
            </View>
          </View>
          <Text style={styles.detail}>{active != null ? describe(active) : t("dashboard.tapHint")}</Text>
        </>
      )}
    </View>
  );
}

function Breakdown({ title, kind, items, t }) {
  const total = items.reduce((sum, x) => sum + x.value, 0);
  const max = Math.max(1, ...items.map((x) => x.value));
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {total === 0 ? (
        <Text style={styles.empty}>{t("dashboard.noData")}</Text>
      ) : (
        items.map((x) => (
          <View key={x.key} style={styles.barRow}>
            <View style={styles.barTop}>
              <Text style={styles.barLabel} numberOfLines={1}>
                {breakdownLabel(kind, x.key, t)}
              </Text>
              <Text style={styles.barValue}>
                {x.value} <Text style={styles.barPct}>{Math.round((x.value / total) * 100)}%</Text>
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${(x.value / max) * 100}%`, backgroundColor: SERIES.all }]} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function Funnel({ steps, t }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("dashboard.funnel")}</Text>
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const rate = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <View key={s.key} style={styles.barRow}>
            <View style={styles.barTop}>
              <Text style={styles.barLabel}>{t(`dashboard.funnel_${s.key}`)}</Text>
              <Text style={styles.barValue}>
                {s.value}
                {rate != null ? <Text style={styles.barPct}> · {rate}%</Text> : null}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${(s.value / max) * 100}%`, backgroundColor: SERIES.members }]} />
            </View>
          </View>
        );
      })}
      <Text style={[styles.hint, { marginTop: spacing.sm }]}>{t("dashboard.funnelHint")}</Text>
    </View>
  );
}

function Community({ c, t }) {
  const items = [
    [t("dashboard.membersTotal"), c.members_total],
    [t("dashboard.finishedTotal"), c.finished_total],
    [t("dashboard.activeWeek"), c.active_week],
    [t("dashboard.returning"), c.returning],
    [t("dashboard.visitsPerMember"), c.visits_per_member],
  ];
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("dashboard.community")}</Text>
      <View style={styles.communityGrid}>
        {items.map(([label, value]) => (
          <View key={label} style={styles.communityItem}>
            <Text style={styles.hint}>{label}</Text>
            <Text style={styles.communityValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  periods: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 3,
    marginBottom: spacing.md,
  },
  period: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.pill },
  periodActive: { backgroundColor: colors.text },
  periodText: { fontSize: 13, fontWeight: "600", color: colors.textSoft },
  periodTextActive: { color: "#fff" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  label: { fontSize: 13, fontWeight: "600", color: colors.textSoft },
  hero: { fontSize: 52, fontWeight: "700", color: colors.text, marginTop: 4, letterSpacing: -1 },
  explain: { fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 18 },
  todayRow: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: GRID },
  todayLabel: { fontSize: 13, fontWeight: "600", color: colors.textSoft },
  todayValue: { fontSize: 28, fontWeight: "700", color: colors.text, marginTop: 2 },
  todayLine: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  delta: { fontSize: 13, fontWeight: "700", marginTop: 4 },
  deltaVs: { fontWeight: "500", color: colors.textMuted },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  tile: {
    width: "48.5%",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  tileValue: { fontSize: 26, fontWeight: "700", color: colors.text, marginTop: 6 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 6 },
  legend: { flexDirection: "row", gap: 14, marginBottom: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { fontSize: 12.5, color: colors.textSoft },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  chartRow: { flexDirection: "row", gap: 6 },
  yAxis: { justifyContent: "space-between", minWidth: 24, alignItems: "flex-end" },
  axisText: { fontSize: 10.5, color: colors.textMuted },
  plot: { flex: 1 },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: GRID },
  columns: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  colSlot: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center", borderRadius: 4 },
  colActive: { backgroundColor: "rgba(42,36,32,0.06)" },
  stack: { width: "100%", maxWidth: 24, gap: 2 },
  seg: { minHeight: 2 },
  segTop: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  xAxis: { height: 18, marginTop: 4 },
  xLabel: { position: "absolute", top: 0 },
  detail: { fontSize: 12.5, color: colors.textSoft, marginTop: spacing.sm, textAlign: "center" },
  empty: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingVertical: 24 },
  barRow: { marginTop: 10 },
  barTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 5 },
  barLabel: { flex: 1, fontSize: 13, color: colors.textSoft },
  barValue: { fontSize: 13, fontWeight: "700", color: colors.text },
  barPct: { fontSize: 12, fontWeight: "500", color: colors.textMuted },
  track: { height: 9, borderRadius: 999, backgroundColor: TRACK, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  communityGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 4 },
  communityItem: {
    width: "48.5%",
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: spacing.sm,
  },
  communityValue: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 2 },
  footnote: { fontSize: 11.5, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
  muted: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
  retryBtn: { alignSelf: "center", marginTop: spacing.sm },
  retryText: { color: colors.primary, fontWeight: "700" },
  offline: { color: colors.danger, fontSize: 13, textAlign: "center", marginBottom: spacing.sm },
});
