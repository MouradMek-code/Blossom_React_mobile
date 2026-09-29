import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator, Image, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { BASE_URL } from "../api/config";
import { getToken } from "../api/storage";
import { peekCache, writeCache } from "../api/cache";
import { IMG } from "../api/images";
import {
  actionChips,
  breakdownLabel,
  clockTime,
  compact,
  delta,
  durationLabel,
  localDay,
  longDate,
  niceMax,
  placeLabel,
  shiftDay,
  shortDate,
  tzOffsetMinutes,
} from "../api/dashboardLabels";
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
  // "period": the overview over 7/30/90 days; "day": one day in detail.
  const [mode, setMode] = useState("period");
  const [dayRefresh, setDayRefresh] = useState(0);

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
    setMode("period");
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
            if (mode === "day") setDayRefresh((n) => n + 1);
            else load();
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
            style={[styles.period, mode === "period" && days === p && styles.periodActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === "period" && days === p }}
          >
            <Text style={[styles.periodText, mode === "period" && days === p && styles.periodTextActive]}>
              {t("dashboard.periodDays", { count: p })}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setMode("day")}
          style={[styles.period, mode === "day" && styles.periodActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === "day" }}
        >
          <Text style={[styles.periodText, mode === "day" && styles.periodTextActive]}>{t("dashboard.dayTab")}</Text>
        </Pressable>
      </View>

      {mode === "day" ? (
        <DayView t={t} lang={lang} refreshKey={dayRefresh} onLoaded={() => setRefreshing(false)} />
      ) : !data ? (
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

// ---- One day in detail -------------------------------------------------------

const FILTERS = ["all", "members", "visitors"];

// Everyone who came on one day: who, when, how long, the screens/pages they
// saw, and what members did (counts only). GET /analytics/day.
function DayView({ t, lang, refreshKey, onLoaded }) {
  const today = localDay();
  const [day, setDay] = useState(today);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getToken();
        const resp = await fetch(`${BASE_URL}/analytics/day?day=${day}&tz_offset=${tzOffsetMinutes()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error(`day ${resp.status}`);
        const json = await resp.json();
        if (alive) {
          setData(json);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) onLoaded();
      }
    })();
    return () => {
      alive = false;
    };
    // onLoaded only stops the pull-to-refresh spinner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, refreshKey]);

  function goTo(next) {
    if (next > today) return;
    setData((cur) => (cur && cur.date === next ? cur : null));
    setDay(next);
  }

  const people = data?.people || [];
  const counts = {
    all: people.length,
    members: people.filter((p) => p.member).length,
    visitors: people.filter((p) => !p.member).length,
  };
  const shown = people.filter((p) => filter === "all" || (filter === "members" ? p.member : !p.member));
  const totals = data?.totals;

  return (
    <>
      <View style={styles.dayNav}>
        <Pressable
          onPress={() => goTo(shiftDay(day, -1))}
          style={styles.dayArrow}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("dashboard.dayPrev")}
        >
          <Text style={styles.dayArrowText}>‹</Text>
        </Pressable>
        <View style={styles.dayCenter}>
          <Text style={styles.dayTitle} numberOfLines={1}>{longDate(day, lang)}</Text>
          {day !== today ? (
            <Pressable onPress={() => goTo(today)} hitSlop={6}>
              <Text style={styles.dayTodayLink}>{t("dashboard.dayToday")}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => goTo(shiftDay(day, 1))}
          disabled={day >= today}
          style={[styles.dayArrow, day >= today && styles.dayArrowOff]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("dashboard.dayNext")}
        >
          <Text style={styles.dayArrowText}>›</Text>
        </Pressable>
      </View>

      {!data ? (
        error ? (
          <View style={styles.card}>
            <Text style={styles.muted}>{t("dashboard.loadError")}</Text>
          </View>
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        )
      ) : (
        <>
          {error && <Text style={styles.offline}>{t("dashboard.loadError")}</Text>}
          <View style={styles.tiles}>
            <DayTile label={t("dashboard.dayPeople")} value={totals.people}
              line={t("dashboard.dayPeopleLine", { members: totals.members, visitors: totals.visitors })} />
            <DayTile label={t("dashboard.dayVisits")} value={totals.visits}
              line={t("dashboard.dayVisitsLine", { app: totals.app, web: totals.web })} />
            <DayTile label={t("dashboard.dayTime")} value={durationLabel(totals.seconds, t)}
              line={t("dashboard.dayTimeLine", { pages: totals.pages })} />
            <DayTile label={t("dashboard.dayNew")} value={totals.new_profiles}
              line={t("dashboard.dayNewLine", { accounts: totals.new_accounts })} />
          </View>

          <ColumnChart
            title={t("dashboard.dayHours")}
            hint={t("dashboard.hoursHint")}
            values={data.hours}
            labels={data.hours.map((_, h) => `${String(h).padStart(2, "0")}h`)}
            labelEvery={6}
            describe={(h) => `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59 · ${t("dashboard.visitsCount", { count: data.hours[h] })}`}
            color={SERIES.all}
            t={t}
          />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("dashboard.dayWho")}</Text>
            <View style={styles.filters}>
              {FILTERS.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setFilter(key)}
                  style={[styles.period, filter === key && styles.periodActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === key }}
                >
                  <Text style={[styles.periodText, filter === key && styles.periodTextActive]}>
                    {t(`dashboard.filter${key[0].toUpperCase()}${key.slice(1)}`)} · {counts[key]}
                  </Text>
                </Pressable>
              ))}
            </View>
            {shown.length === 0 ? (
              <Text style={styles.empty}>{t("dashboard.dayEmpty")}</Text>
            ) : (
              shown.map((person) => <PersonCard key={person.key} person={person} t={t} lang={lang} />)
            )}
            {data.truncated ? <Text style={styles.hint}>{t("dashboard.dayTruncated")}</Text> : null}
          </View>

          <Text style={styles.footnote}>{t("dashboard.dayPrivacy")}</Text>
        </>
      )}
    </>
  );
}

function DayTile({ label, value, line }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.hint}>{line}</Text>
    </View>
  );
}

// One person on that day: who, when, how long, what they did, each visit's path.
function PersonCard({ person, t, lang }) {
  const navigation = useNavigation();
  const member = person.member;
  const chips = actionChips(person.actions, t);
  const from = clockTime(person.first_at, lang);
  const to = clockTime(person.last_at, lang);
  return (
    <View style={styles.person}>
      <Pressable
        style={styles.personHead}
        onPress={member ? () => navigation.navigate("ProfileDetails", { id: member.id }) : undefined}
        disabled={!member}
      >
        {member?.photo ? (
          <Image source={{ uri: IMG.thumb(member.photo) }} style={styles.personAvatar} />
        ) : (
          <View style={[styles.personAvatar, styles.personAvatarEmpty]}>
            <Text>{member ? "🌸" : "👤"}</Text>
          </View>
        )}
        <View style={styles.personWho}>
          <Text style={styles.personName} numberOfLines={1}>
            {member ? member.first_name : t("dashboard.visitor", { id: person.device || "—" })}
          </Text>
          <Text style={styles.personMeta} numberOfLines={1}>
            {member
              ? [member.age, member.city].filter(Boolean).join(" · ")
              : person.returning
                ? t("dashboard.dayReturning")
                : t("dashboard.dayFirstTime")}
          </Text>
        </View>
        {person.first_at ? (
          <View style={styles.personWhen}>
            <Text style={styles.personTime}>{from !== to ? `${from}–${to}` : from}</Text>
            <Text style={styles.personMeta}>
              {durationLabel(person.seconds, t)} · {person.platforms.map((p) => t(`dashboard.${p}`)).join(" + ")}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <Text key={chip} style={styles.chip}>{chip}</Text>
          ))}
        </View>
      ) : null}
      {person.visits.length === 0 ? (
        <Text style={styles.hint}>{t("dashboard.noVisit")}</Text>
      ) : (
        person.visits.map((visit) => <VisitPath key={visit.start} visit={visit} t={t} lang={lang} />)
      )}
    </View>
  );
}

// "📱 14:05  Home → Browse → A profile → A chat" - long paths folded in the middle.
function VisitPath({ visit, t, lang }) {
  const [open, setOpen] = useState(false);
  const names = visit.pages.map((page) => placeLabel(page.path));
  const long = names.length > 10;
  const text = long && !open
    ? [...names.slice(0, 4), `… +${names.length - 8} …`, ...names.slice(-4)].join("  →  ")
    : names.join("  →  ");
  return (
    <View style={styles.visitRow}>
      <Text style={styles.visitWhen}>
        {visit.platform === "app" ? "📱" : "💻"} {clockTime(visit.start, lang)}
      </Text>
      <View style={styles.visitPath}>
        <Text style={styles.pathText}>{text}</Text>
        {long ? (
          <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6}>
            <Text style={styles.pathToggle}>
              {open ? t("dashboard.showLess") : t("dashboard.showAllPages", { count: names.length })}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
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
  // One day in detail
  dayNav: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  dayArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dayArrowOff: { opacity: 0.35 },
  dayArrowText: { fontSize: 22, color: colors.text, marginTop: -2 },
  dayCenter: { flex: 1, alignItems: "center" },
  dayTitle: { fontSize: 16, fontWeight: "700", color: colors.text, textTransform: "capitalize" },
  dayTodayLink: { fontSize: 12.5, fontWeight: "700", color: colors.primary, marginTop: 2 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.sm },
  person: { borderWidth: 1, borderColor: GRID, borderRadius: radius.md, padding: 12, marginTop: 10 },
  personHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  personAvatar: { width: 40, height: 40, borderRadius: 20 },
  personAvatarEmpty: { backgroundColor: TRACK, alignItems: "center", justifyContent: "center" },
  personWho: { flex: 1, minWidth: 0 },
  personName: { fontSize: 15, fontWeight: "700", color: colors.text },
  personMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  personWhen: { alignItems: "flex-end", maxWidth: "45%" },
  personTime: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primaryDeep,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: "hidden",
  },
  visitRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  visitWhen: { fontSize: 12.5, fontWeight: "600", color: colors.textSoft, minWidth: 64 },
  visitPath: { flex: 1 },
  pathText: { fontSize: 12.5, color: colors.text, lineHeight: 18 },
  pathToggle: { fontSize: 12, fontWeight: "700", color: colors.primary, marginTop: 3 },
});
