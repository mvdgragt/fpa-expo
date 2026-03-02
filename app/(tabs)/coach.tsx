import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getClubSession } from "../../lib/session";
import { supabase } from "../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "Elite" | "Strong" | "Moderate" | "Needs Development";

const CAT_COLOR: Record<Category, string> = {
  Elite: "#10b981",
  Strong: "#3b82f6",
  Moderate: "#f59e0b",
  "Needs Development": "#ef4444",
};

type RawRow = {
  userId: string;
  userName: string;
  stationId: string;
  stationName: string;
  stationShortName: string;
  timeSeconds: number;
  timestamp: string;
  foot?: "left" | "right";
};

type AthleteStationData = {
  stationId: string;
  stationName: string;
  stationShortName: string;
  bestTime: number;
  leftBest: number | null;
  rightBest: number | null;
  asymmetryPct: number | null;
  slowerSide: "left" | "right" | null;
  category: Category | null;
  overallScore: number | null;
  advice: string;
};

type AthleteSummary = {
  userId: string;
  name: string;
  stations: AthleteStationData[];
};

type StationAthleteRow = {
  userId: string;
  name: string;
  bestTime: number;
  leftBest: number | null;
  rightBest: number | null;
  asymmetryPct: number | null;
  category: Category | null;
  overallScore: number | null;
};

type StationSummary = {
  stationId: string;
  stationName: string;
  stationShortName: string;
  is505: boolean;
  athletes: StationAthleteRow[];
  insight: string;
};

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function compute505(leftBest: number | null, rightBest: number | null): {
  category: Category;
  overallScore: number;
  asymmetryPct: number | null;
  slowerSide: "left" | "right" | null;
} {
  const best =
    leftBest !== null && rightBest !== null
      ? Math.min(leftBest, rightBest)
      : leftBest ?? rightBest;

  if (best === null) {
    return { category: "Needs Development", overallScore: 0, asymmetryPct: null, slowerSide: null };
  }

  const PI_ELITE = 2.0, PI_POOR = 2.7;
  const performanceIndex = clamp(((PI_POOR - best) / (PI_POOR - PI_ELITE)) * 100, 0, 100);

  let balanceScore = 100;
  let asymmetryPct: number | null = null;
  let slowerSide: "left" | "right" | null = null;

  if (leftBest !== null && rightBest !== null) {
    const fast = Math.min(leftBest, rightBest);
    const slow = Math.max(leftBest, rightBest);
    asymmetryPct = fast > 0 ? ((slow - fast) / fast) * 100 : null;
    slowerSide = leftBest > rightBest ? "left" : "right";
    if (asymmetryPct !== null) balanceScore = clamp(100 - asymmetryPct * 5, 0, 100);
  }

  const overallScore = performanceIndex * 0.7 + balanceScore * 0.3;

  let category: Category;
  if (overallScore >= 80) category = "Elite";
  else if (overallScore >= 60) category = "Strong";
  else if (overallScore >= 40) category = "Moderate";
  else category = "Needs Development";

  return { category, overallScore, asymmetryPct, slowerSide };
}

function getAdvice(
  category: Category,
  asymmetryPct: number | null,
  slowerSide: "left" | "right" | null,
): string {
  const asymStr =
    asymmetryPct !== null && asymmetryPct > 10 && slowerSide
      ? ` High asymmetry — prioritise unilateral work for the ${slowerSide} foot.`
      : asymmetryPct !== null && asymmetryPct > 5 && slowerSide
        ? ` Mild asymmetry on ${slowerSide} side — include unilateral drills.`
        : "";

  switch (category) {
    case "Elite":
      return "Excellent COD performance. Maintain with plyometrics and speed work." + asymStr;
    case "Strong":
      return "Good COD ability. Focus on consistency and explosiveness under fatigue." + asymStr;
    case "Moderate":
      return "Improve deceleration mechanics and change-of-direction technique." + asymStr;
    case "Needs Development":
      return "Focus on fundamentals: braking, foot planting, and re-acceleration." + asymStr;
  }
}

function buildStationInsight(station: StationSummary): string {
  const n = station.athletes.length;
  if (!station.is505) return `${n} athlete${n !== 1 ? "s" : ""} tested`;

  const needsDev = station.athletes.filter(
    (a) => a.category === "Needs Development" || a.category === "Moderate",
  ).length;
  const elite = station.athletes.filter((a) => a.category === "Elite").length;
  const highAsym = station.athletes.filter(
    (a) => a.asymmetryPct !== null && a.asymmetryPct > 10,
  ).length;

  const parts: string[] = [];
  if (elite > 0) parts.push(`${elite} Elite`);
  if (needsDev > 0) parts.push(`${needsDev} need focus`);
  if (highAsym > 0) parts.push(`${highAsym} high asymmetry`);
  return parts.length > 0 ? parts.join(" · ") : `${n} athletes tested`;
}

// ─── Data processing ──────────────────────────────────────────────────────────

function processRows(rows: RawRow[]): {
  stations: StationSummary[];
  athletes: AthleteSummary[];
} {
  // Group by athlete × station
  const byAthleteStation = new Map<string, RawRow[]>();
  for (const r of rows) {
    const key = `${r.userId}::${r.stationId}`;
    const arr = byAthleteStation.get(key) ?? [];
    arr.push(r);
    byAthleteStation.set(key, arr);
  }

  // Per-athlete, per-station aggregation
  const athleteMap = new Map<string, { name: string; stations: AthleteStationData[] }>();
  const stationMeta = new Map<string, { name: string; shortName: string; is505: boolean }>();

  for (const [key, raws] of byAthleteStation.entries()) {
    const [userId] = key.split("::");
    const first = raws[0];
    const is505 = first.stationId === "5-0-5-test";

    stationMeta.set(first.stationId, {
      name: first.stationName,
      shortName: first.stationShortName,
      is505,
    });

    const allTimes = raws.map((r) => r.timeSeconds).filter(Number.isFinite);
    const leftTimes = raws.filter((r) => r.foot === "left").map((r) => r.timeSeconds).filter(Number.isFinite);
    const rightTimes = raws.filter((r) => r.foot === "right").map((r) => r.timeSeconds).filter(Number.isFinite);

    const bestTime = allTimes.length > 0 ? Math.min(...allTimes) : Infinity;
    const leftBest = leftTimes.length > 0 ? Math.min(...leftTimes) : null;
    const rightBest = rightTimes.length > 0 ? Math.min(...rightTimes) : null;

    let cat: Category | null = null;
    let overallScore: number | null = null;
    let asymmetryPct: number | null = null;
    let slowerSide: "left" | "right" | null = null;
    let advice = "";

    if (is505) {
      const scores = compute505(leftBest, rightBest);
      cat = scores.category;
      overallScore = scores.overallScore;
      asymmetryPct = scores.asymmetryPct;
      slowerSide = scores.slowerSide;
      advice = getAdvice(scores.category, scores.asymmetryPct, scores.slowerSide);
    }

    const stationData: AthleteStationData = {
      stationId: first.stationId,
      stationName: first.stationName,
      stationShortName: first.stationShortName,
      bestTime: Number.isFinite(bestTime) ? bestTime : 0,
      leftBest,
      rightBest,
      asymmetryPct,
      slowerSide,
      category: cat,
      overallScore,
      advice,
    };

    const ath = athleteMap.get(userId) ?? { name: first.userName, stations: [] };
    ath.stations.push(stationData);
    athleteMap.set(userId, ath);
  }

  // Build station summaries
  const stationRowsMap = new Map<string, StationAthleteRow[]>();
  for (const [userId, ath] of athleteMap.entries()) {
    for (const s of ath.stations) {
      const arr = stationRowsMap.get(s.stationId) ?? [];
      arr.push({
        userId,
        name: ath.name,
        bestTime: s.bestTime,
        leftBest: s.leftBest,
        rightBest: s.rightBest,
        asymmetryPct: s.asymmetryPct,
        category: s.category,
        overallScore: s.overallScore,
      });
      stationRowsMap.set(s.stationId, arr);
    }
  }

  const stations: StationSummary[] = [];
  for (const [stationId, athleteRows] of stationRowsMap.entries()) {
    const meta = stationMeta.get(stationId)!;
    const sorted = [...athleteRows].sort((a, b) => a.bestTime - b.bestTime);
    const s: StationSummary = {
      stationId,
      stationName: meta.name,
      stationShortName: meta.shortName,
      is505: meta.is505,
      athletes: sorted,
      insight: "",
    };
    s.insight = buildStationInsight(s);
    stations.push(s);
  }
  stations.sort((a, b) => a.stationShortName.localeCompare(b.stationShortName));

  const athletes: AthleteSummary[] = Array.from(athleteMap.entries()).map(
    ([userId, v]) => ({
      userId,
      name: v.name,
      stations: v.stations.sort((a, b) => a.stationShortName.localeCompare(b.stationShortName)),
    }),
  );
  athletes.sort((a, b) => a.name.localeCompare(b.name));

  return { stations, athletes };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: Category }) {
  return (
    <View style={[styles.badge, { backgroundColor: CAT_COLOR[category] + "22", borderColor: CAT_COLOR[category] }]}>
      <Text style={[styles.badgeText, { color: CAT_COLOR[category] }]}>{category}</Text>
    </View>
  );
}

function HorizontalBar({
  time,
  fastestTime,
  color,
}: {
  time: number;
  fastestTime: number;
  color: string;
}) {
  const pct = fastestTime > 0 ? clamp((fastestTime / time) * 100, 5, 100) : 50;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      <Text style={styles.barTime}>{time.toFixed(2)}s</Text>
    </View>
  );
}

function TeamStationCard({ station }: { station: StationSummary }) {
  const fastestTime = station.athletes[0]?.bestTime ?? 1;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name="fitness" size={20} color="#ff7e21" />
          <Text style={styles.cardTitle}>{station.stationShortName}</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{station.athletes.length}</Text>
          </View>
        </View>
        <Text style={styles.insightText}>{station.insight}</Text>
      </View>

      {station.athletes.map((a, i) => {
        const barColor = a.category ? CAT_COLOR[a.category] : "#ff7e21";
        return (
          <View key={a.userId} style={styles.athleteRow}>
            <Text style={styles.rankNum}>#{i + 1}</Text>
            <View style={styles.athleteNameWrap}>
              <Text style={styles.athleteName} numberOfLines={1}>{a.name}</Text>
            </View>
            <View style={styles.barWrapper}>
              <HorizontalBar time={a.bestTime} fastestTime={fastestTime} color={barColor} />
            </View>
            {station.is505 && a.category && (
              <CategoryBadge category={a.category} />
            )}
          </View>
        );
      })}
    </View>
  );
}

function PlayerStationCard({ s }: { s: AthleteStationData }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name="fitness" size={20} color="#ff7e21" />
          <Text style={styles.cardTitle}>{s.stationShortName}</Text>
        </View>
        {s.category ? (
          <CategoryBadge category={s.category} />
        ) : (
          <Text style={styles.bestTimeDisplay}>{s.bestTime.toFixed(2)}s</Text>
        )}
      </View>

      {s.stationId === "5-0-5-test" ? (
        <>
          <View style={styles.footRow}>
            <View style={styles.footCell}>
              <Text style={styles.footLabel}>Left foot</Text>
              <Text style={styles.footTime}>
                {s.leftBest !== null ? `${s.leftBest.toFixed(2)}s` : "—"}
              </Text>
            </View>
            <View style={styles.footDivider} />
            <View style={styles.footCell}>
              <Text style={styles.footLabel}>Right foot</Text>
              <Text style={styles.footTime}>
                {s.rightBest !== null ? `${s.rightBest.toFixed(2)}s` : "—"}
              </Text>
            </View>
            <View style={styles.footDivider} />
            <View style={styles.footCell}>
              <Text style={styles.footLabel}>Asymmetry</Text>
              <Text
                style={[
                  styles.footTime,
                  s.asymmetryPct !== null && s.asymmetryPct > 10
                    ? { color: "#ef4444" }
                    : s.asymmetryPct !== null && s.asymmetryPct > 5
                      ? { color: "#f59e0b" }
                      : { color: "#10b981" },
                ]}
              >
                {s.asymmetryPct !== null ? `${s.asymmetryPct.toFixed(1)}%` : "—"}
              </Text>
            </View>
          </View>

          {s.overallScore !== null && (
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>COD Score</Text>
              <View style={styles.scoreBarTrack}>
                <View
                  style={[
                    styles.scoreBarFill,
                    {
                      width: `${s.overallScore}%` as any,
                      backgroundColor: s.category ? CAT_COLOR[s.category] : "#ff7e21",
                    },
                  ]}
                />
              </View>
              <Text style={[styles.scoreValue, { color: s.category ? CAT_COLOR[s.category] : "#ff7e21" }]}>
                {Math.round(s.overallScore)}
              </Text>
            </View>
          )}

          {s.advice !== "" && (
            <View style={styles.adviceBox}>
              <Ionicons name="bulb-outline" size={14} color="#ff7e21" style={{ marginTop: 1 }} />
              <Text style={styles.adviceText}>{s.advice}</Text>
            </View>
          )}
        </>
      ) : (
        <Text style={styles.generalTime}>Best: {s.bestTime.toFixed(2)}s</Text>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CoachScreen() {
  const [mode, setMode] = useState<"team" | "player">("team");
  const [rows, setRows] = useState<RawRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const load = async () => {
    setIsLoading(true);
    try {
      const saved = await AsyncStorage.getItem("testResults");
      const local: RawRow[] = saved
        ? (JSON.parse(saved) as any[]).map((r) => ({
            userId: String(r.userId || ""),
            userName: String(r.userName || r.userId || ""),
            stationId: String(r.stationId || ""),
            stationName: String(r.stationName || ""),
            stationShortName: String(r.stationShortName || ""),
            timeSeconds: Number(r.time),
            timestamp: String(r.timestamp || ""),
            foot:
              r.foot === "left" || r.foot === "right" ? r.foot : undefined,
          }))
        : [];

      let remote: RawRow[] = [];
      try {
        const session = await getClubSession();
        if (session?.clubId) {
          const { data, error } = await supabase
            .from("test_results")
            .select(
              "user_id, station_id, station_name, station_short_name, time_seconds, tested_at, foot, club_users:club_users(first_name, last_name)",
            )
            .eq("club_id", session.clubId)
            .order("tested_at", { ascending: false })
            .limit(5000);

          if (!error && data) {
            remote = (data as any[]).map((row) => ({
              userId: String(row.user_id || ""),
              userName:
                `${row.club_users?.first_name || ""} ${row.club_users?.last_name || ""}`.trim() ||
                row.user_id,
              stationId: String(row.station_id || ""),
              stationName: String(row.station_name || ""),
              stationShortName: String(row.station_short_name || ""),
              timeSeconds: Number(row.time_seconds),
              timestamp: String(row.tested_at || ""),
              foot:
                row.foot === "left" || row.foot === "right"
                  ? row.foot
                  : undefined,
            }));
          }
        }
      } catch {
        // offline fallback
      }

      const seen = new Set<string>();
      const merged: RawRow[] = [];
      for (const r of remote) {
        const k = `${r.userId}:${r.stationId}:${r.timestamp}`;
        if (!seen.has(k)) { seen.add(k); merged.push(r); }
      }
      for (const r of local) {
        const k = `${r.userId}:${r.stationId}:${r.timestamp}`;
        if (!seen.has(k)) { seen.add(k); merged.push(r); }
      }

      setRows(merged);
    } catch (e) {
      console.error("CoachScreen load error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const { stations, athletes } = useMemo(() => processRows(rows), [rows]);

  const selectedAthlete = useMemo(
    () => athletes.find((a) => a.userId === selectedAthleteId) ?? athletes[0] ?? null,
    [athletes, selectedAthleteId],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Coach Analytics</Text>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === "team" && styles.toggleBtnActive]}
            onPress={() => setMode("team")}
          >
            <Ionicons
              name={mode === "team" ? "people" : "people-outline"}
              size={15}
              color={mode === "team" ? "#fff" : "#666"}
            />
            <Text style={[styles.toggleLabel, mode === "team" && styles.toggleLabelActive]}>
              Team
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === "player" && styles.toggleBtnActive]}
            onPress={() => setMode("player")}
          >
            <Ionicons
              name={mode === "player" ? "person" : "person-outline"}
              size={15}
              color={mode === "player" ? "#fff" : "#666"}
            />
            <Text style={[styles.toggleLabel, mode === "player" && styles.toggleLabelActive]}>
              Player
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#ff7e21" />
          <Text style={styles.loadingText}>Loading data…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="analytics-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySubtitle}>Complete some tests to see analytics here</Text>
        </View>
      ) : mode === "team" ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {stations.map((s) => (
            <TeamStationCard key={s.stationId} station={s} />
          ))}
        </ScrollView>
      ) : (
        <>
          {/* Athlete chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipContent}
          >
            {athletes.map((a) => {
              const active = (selectedAthleteId ?? athletes[0]?.userId) === a.userId;
              return (
                <TouchableOpacity
                  key={a.userId}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedAthleteId(a.userId)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {a.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Player detail */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedAthlete ? (
              selectedAthlete.stations.map((s) => (
                <PlayerStationCard key={s.stationId} s={s} />
              ))
            ) : (
              <Text style={styles.emptySubtitle}>No athlete selected</Text>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8f9fa" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e8e8",
  },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#1a1a1a" },
  toggle: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: "#ff7e21" },
  toggleLabel: { fontSize: 13, fontWeight: "600", color: "#666" },
  toggleLabelActive: { color: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  loadingText: { color: "#666", fontSize: 15 },
  emptyTitle: { fontSize: 20, fontWeight: "600", color: "#555", marginTop: 8 },
  emptySubtitle: { fontSize: 14, color: "#999", textAlign: "center", paddingHorizontal: 40 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  // Chips
  chipScroll: { maxHeight: 52, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e8e8e8" },
  chipContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  chipActive: { backgroundColor: "#ff7e21", borderColor: "#ff7e21" },
  chipText: { fontSize: 13, fontWeight: "500", color: "#444" },
  chipTextActive: { color: "#fff" },
  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    flexWrap: "wrap",
    gap: 6,
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: "bold", color: "#1a1a1a" },
  countPill: {
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  countPillText: { fontSize: 12, color: "#666", fontWeight: "600" },
  insightText: { fontSize: 12, color: "#888", fontStyle: "italic" },
  // Athlete bar rows
  athleteRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  rankNum: { fontSize: 12, color: "#aaa", width: 24, textAlign: "right" },
  athleteNameWrap: { width: 90 },
  athleteName: { fontSize: 13, color: "#333", fontWeight: "500" },
  barWrapper: { flex: 1 },
  barTrack: {
    height: 22,
    backgroundColor: "#f0f0f0",
    borderRadius: 11,
    overflow: "hidden",
    justifyContent: "center",
  },
  barFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 11, opacity: 0.85 },
  barTime: { fontSize: 11, color: "#333", fontWeight: "600", paddingLeft: 8, zIndex: 1 },
  // Badge
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  // Player cards
  bestTimeDisplay: { fontSize: 20, fontWeight: "bold", color: "#ff7e21" },
  generalTime: { fontSize: 15, color: "#555", marginTop: 4 },
  footRow: {
    flexDirection: "row",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    borderRadius: 10,
    overflow: "hidden",
  },
  footCell: { flex: 1, alignItems: "center", paddingVertical: 10 },
  footLabel: { fontSize: 11, color: "#999", marginBottom: 4 },
  footTime: { fontSize: 18, fontWeight: "bold", color: "#1a1a1a" },
  footDivider: { width: 1, backgroundColor: "#f0f0f0" },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  scoreLabel: { fontSize: 12, color: "#888", width: 72 },
  scoreBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  scoreBarFill: { height: 8, borderRadius: 4 },
  scoreValue: { fontSize: 13, fontWeight: "700", width: 28, textAlign: "right" },
  adviceBox: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#fff8f3",
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#ff7e21",
  },
  adviceText: { flex: 1, fontSize: 13, color: "#555", lineHeight: 18 },
});
