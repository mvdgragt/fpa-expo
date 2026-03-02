import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { clearAthleteSession, getAthleteSession } from "../lib/session";
import { supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "Elite" | "Strong" | "Moderate" | "Needs Development";

const CAT_COLOR: Record<Category, string> = {
  Elite: "#10b981",
  Strong: "#3b82f6",
  Moderate: "#f59e0b",
  "Needs Development": "#ef4444",
};

type StationResult = {
  stationId: string;
  stationName: string;
  stationShortName: string;
  // Athlete
  myBest: number;
  myLeft: number | null;
  myRight: number | null;
  myAsymmetry: number | null;
  mySlowerSide: "left" | "right" | null;
  myCategory: Category | null;
  myOverallScore: number | null;
  myPerformanceIndex: number | null;
  myBalanceScore: number | null;
  // Team
  teamBest: number;
  teamWorst: number;
  teamAvg: number;
  teamCount: number;
  myRank: number;
  // Advice
  advice: string[];
  drills: string[];
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function compute505(leftBest: number | null, rightBest: number | null) {
  const best =
    leftBest !== null && rightBest !== null
      ? Math.min(leftBest, rightBest)
      : (leftBest ?? rightBest);

  if (best === null) {
    return {
      category: "Needs Development" as Category,
      overallScore: 0,
      performanceIndex: 0,
      balanceScore: 0,
      asymmetryPct: null,
      slowerSide: null,
    };
  }

  const PI_ELITE = 2.0,
    PI_POOR = 2.7;
  const performanceIndex = clamp(
    ((PI_POOR - best) / (PI_POOR - PI_ELITE)) * 100,
    0,
    100,
  );

  let balanceScore = 100;
  let asymmetryPct: number | null = null;
  let slowerSide: "left" | "right" | null = null;

  if (leftBest !== null && rightBest !== null) {
    const fast = Math.min(leftBest, rightBest);
    const slow = Math.max(leftBest, rightBest);
    asymmetryPct = fast > 0 ? ((slow - fast) / fast) * 100 : null;
    slowerSide = leftBest > rightBest ? "left" : "right";
    if (asymmetryPct !== null)
      balanceScore = clamp(100 - asymmetryPct * 5, 0, 100);
  }

  const overallScore = performanceIndex * 0.7 + balanceScore * 0.3;
  let category: Category;
  if (overallScore >= 80) category = "Elite";
  else if (overallScore >= 60) category = "Strong";
  else if (overallScore >= 40) category = "Moderate";
  else category = "Needs Development";

  return {
    category,
    overallScore,
    performanceIndex,
    balanceScore,
    asymmetryPct,
    slowerSide,
  };
}

function build505Advice(
  category: Category,
  performanceIndex: number,
  balanceScore: number,
  asymmetryPct: number | null,
  slowerSide: "left" | "right" | null,
): { advice: string[]; drills: string[] } {
  const advice: string[] = [];
  const drills: string[] = [];

  // Performance-based feedback
  if (category === "Elite") {
    advice.push(
      "Outstanding change of direction speed — you're in the top tier.",
    );
    advice.push(
      "Focus on maintaining this level under match fatigue and pressure.",
    );
    drills.push("High-intensity COD circuits with full recovery");
    drills.push("Reactive agility: respond to visual cues");
    drills.push("Loaded COD with resistance band or weighted vest");
  } else if (category === "Strong") {
    advice.push(
      "Solid COD performance. Small speed gains will push you to Elite.",
    );
    advice.push(
      "Work on the final push-off phase — that's where top times are made.",
    );
    drills.push("Acceleration bounds from COD entry angle");
    drills.push("Speed ladder: quick-step patterns into sprint");
    drills.push("Plant-and-drive ankle stiffness drills");
  } else if (category === "Moderate") {
    advice.push("Your COD speed has clear room for improvement.");
    advice.push(
      "Focus on your deceleration — slowing down quickly is key to fast turns.",
    );
    drills.push("Penultimate step braking drills (2-step deceleration)");
    drills.push("Lateral shuffle into sprint (3-5 reps)");
    drills.push("Box drops: eccentric loading for knee/hip control");
  } else {
    advice.push("Build your base first — focus on mechanics before speed.");
    advice.push(
      "Your body needs to learn how to decelerate safely and efficiently.",
    );
    drills.push("Walking COD with pause at turn point (body position focus)");
    drills.push("Slow lateral lunges: hip and glute activation");
    drills.push("Single-leg balance and landing mechanics");
  }

  // Asymmetry-specific
  if (asymmetryPct !== null && slowerSide !== null) {
    if (asymmetryPct > 15) {
      advice.push(
        `High imbalance: your ${slowerSide} foot is significantly slower. This increases injury risk.`,
      );
      drills.push(
        `Unilateral plyometrics on ${slowerSide} foot only (3 sets × 8)`,
      );
      drills.push(
        `Single-leg hop and stick: ${slowerSide} foot landing control`,
      );
      drills.push(
        `${slowerSide === "left" ? "Left" : "Right"}-side lateral bounds`,
      );
    } else if (asymmetryPct > 8) {
      advice.push(
        `Mild imbalance detected: ${slowerSide} side is slightly weaker. Address this to unlock better scores.`,
      );
      drills.push(`Include equal reps both feet on all COD drills`);
      drills.push(
        `Single-leg calf raises and mini-band walks (${slowerSide} focus)`,
      );
    } else {
      advice.push(
        "Good balance between feet — keep training both sides equally.",
      );
    }
  }

  // Balance score encouragement
  if (balanceScore >= 90 && asymmetryPct !== null) {
    advice.push(
      "Excellent foot symmetry. Keep bilateral training in your programme.",
    );
  }

  return { advice, drills };
}

function buildGenericAdvice(
  rank: number,
  teamCount: number,
  stationShortName: string,
): { advice: string[]; drills: string[] } {
  const pct = teamCount > 1 ? ((teamCount - rank) / (teamCount - 1)) * 100 : 50;
  const advice: string[] = [];
  const drills: string[] = [];

  if (pct >= 80) {
    advice.push(
      `Top ${Math.round(100 - pct) + 1}% of your team on ${stationShortName}. Excellent result.`,
    );
    advice.push("Keep up the consistency — maintain this in match conditions.");
  } else if (pct >= 50) {
    advice.push(`Above average on ${stationShortName}. A solid result.`);
    advice.push(
      "Small technique improvements could push you into the top group.",
    );
  } else if (pct >= 25) {
    advice.push(`Below average on ${stationShortName} for your team.`);
    advice.push(
      "Targeted practice of this skill will help you catch up quickly.",
    );
  } else {
    advice.push(`This is an area to prioritise on ${stationShortName}.`);
    advice.push(
      "Talk to your coach about adding focused sessions for this skill.",
    );
  }

  drills.push(`Dedicated ${stationShortName} practice: 2–3 sessions/week`);
  drills.push("Review technique with video or coach feedback");
  return { advice, drills };
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadDashboardData(
  userId: string,
  clubId: string,
): Promise<StationResult[]> {
  type Row = {
    user_id: string;
    station_id: string;
    station_name: string;
    station_short_name: string;
    time_seconds: number;
    foot: string | null;
  };

  let data: Row[] | null = null;

  // Try Supabase first
  const { data: remoteData, error } = await supabase
    .from("test_results")
    .select(
      "user_id, station_id, station_name, station_short_name, time_seconds, foot",
    )
    .eq("club_id", clubId)
    .order("time_seconds", { ascending: true });

  if (!error && remoteData && remoteData.length > 0) {
    data = remoteData as Row[];
  } else {
    // Fall back to AsyncStorage (covers RLS blocks + unsynced local results)
    try {
      const raw = await AsyncStorage.getItem("testResults");
      const local: any[] = raw ? JSON.parse(raw) : [];
      data = local
        .filter((r) => r.club_id === clubId)
        .map((r) => ({
          user_id: String(r.user_id ?? ""),
          station_id: String(r.station_id ?? ""),
          station_name: String(r.station_name ?? r.station_id ?? ""),
          station_short_name: String(
            r.station_short_name ?? r.station_id ?? "",
          ),
          time_seconds: Number(r.time_seconds ?? 0),
          foot: r.foot ?? null,
        }));
    } catch {
      data = [];
    }
  }

  if (!data || data.length === 0) return [];

  // Group by station
  const stationMap = new Map<string, typeof data>();
  for (const row of data) {
    const arr = stationMap.get(row.station_id) ?? [];
    arr.push(row);
    stationMap.set(row.station_id, arr);
  }

  const results: StationResult[] = [];

  for (const [stationId, rows] of stationMap.entries()) {
    const first = rows[0];
    const is505 = stationId === "5-0-5-test";

    // All athletes' best times for this station
    const byAthlete = new Map<string, number>();
    for (const r of rows) {
      const t = Number(r.time_seconds);
      if (!Number.isFinite(t) || t <= 0) continue;
      const existing = byAthlete.get(r.user_id);
      if (existing === undefined || t < existing) byAthlete.set(r.user_id, t);
    }

    const teamTimes = Array.from(byAthlete.values()).sort((a, b) => a - b);
    if (teamTimes.length === 0) continue;

    const teamBest = teamTimes[0];
    const teamWorst = teamTimes[teamTimes.length - 1];
    const teamAvg = teamTimes.reduce((s, v) => s + v, 0) / teamTimes.length;
    const teamCount = teamTimes.length;

    // My best time
    const myBestTime = byAthlete.get(userId);
    if (myBestTime === undefined) continue; // athlete not tested on this station

    const myRank = teamTimes.indexOf(myBestTime) + 1;

    // 5-0-5 foot breakdown
    let myLeft: number | null = null;
    let myRight: number | null = null;

    if (is505) {
      const myRows = rows.filter((r) => r.user_id === userId);
      const lefts = myRows
        .filter((r) => r.foot === "left")
        .map((r) => Number(r.time_seconds))
        .filter(Number.isFinite);
      const rights = myRows
        .filter((r) => r.foot === "right")
        .map((r) => Number(r.time_seconds))
        .filter(Number.isFinite);
      myLeft = lefts.length > 0 ? Math.min(...lefts) : null;
      myRight = rights.length > 0 ? Math.min(...rights) : null;
    }

    let myCategory: Category | null = null;
    let myOverallScore: number | null = null;
    let myPerformanceIndex: number | null = null;
    let myBalanceScore: number | null = null;
    let myAsymmetry: number | null = null;
    let mySlowerSide: "left" | "right" | null = null;
    let advice: string[] = [];
    let drills: string[] = [];

    if (is505) {
      const s = compute505(myLeft, myRight);
      myCategory = s.category;
      myOverallScore = s.overallScore;
      myPerformanceIndex = s.performanceIndex;
      myBalanceScore = s.balanceScore;
      myAsymmetry = s.asymmetryPct;
      mySlowerSide = s.slowerSide;
      const adv = build505Advice(
        s.category,
        s.performanceIndex,
        s.balanceScore,
        s.asymmetryPct,
        s.slowerSide,
      );
      advice = adv.advice;
      drills = adv.drills;
    } else {
      const adv = buildGenericAdvice(
        myRank,
        teamCount,
        first.station_short_name,
      );
      advice = adv.advice;
      drills = adv.drills;
    }

    results.push({
      stationId,
      stationName: first.station_name,
      stationShortName: first.station_short_name,
      myBest: myBestTime,
      myLeft,
      myRight,
      myAsymmetry,
      mySlowerSide,
      myCategory,
      myOverallScore,
      myPerformanceIndex,
      myBalanceScore,
      teamBest,
      teamWorst,
      teamAvg,
      teamCount,
      myRank,
      advice,
      drills,
    });
  }

  return results.sort((a, b) =>
    a.stationShortName.localeCompare(b.stationShortName),
  );
}

// ─── Visual components ────────────────────────────────────────────────────────

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const pct = clamp(score, 0, 100);
  return (
    <View style={v.gaugeWrap}>
      <View style={v.gaugeTrack}>
        <View
          style={[
            v.gaugeFill,
            { width: `${pct}%` as any, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[v.gaugeLabel, { color }]}>{Math.round(pct)}</Text>
    </View>
  );
}

function PositionBar({
  myTime,
  teamBest,
  teamWorst,
  teamAvg,
}: {
  myTime: number;
  teamBest: number;
  teamWorst: number;
  teamAvg: number;
}) {
  const range = teamWorst - teamBest;
  const myPct =
    range > 0 ? clamp(((myTime - teamBest) / range) * 100, 0, 100) : 50;
  const avgPct =
    range > 0 ? clamp(((teamAvg - teamBest) / range) * 100, 0, 100) : 50;

  // lower time = left = better
  const isAboveAvg = myTime <= teamAvg;

  return (
    <View style={v.posWrap}>
      <View style={v.posLabelRow}>
        <Text style={v.posEdge}>Best {teamBest.toFixed(2)}s</Text>
        <Text style={v.posMid}>Team avg {teamAvg.toFixed(2)}s</Text>
        <Text style={v.posEdge}>Slowest {teamWorst.toFixed(2)}s</Text>
      </View>
      <View style={v.posTrack}>
        {/* Gradient halves */}
        <View
          style={[v.posHalf, { backgroundColor: "#10b981", opacity: 0.15 }]}
        />
        <View
          style={[v.posHalf, { backgroundColor: "#ef4444", opacity: 0.15 }]}
        />
        {/* Avg marker */}
        <View style={[v.avgMarker, { left: `${avgPct}%` as any }]} />
        {/* My marker */}
        <View
          style={[
            v.myMarker,
            {
              left: `${myPct}%` as any,
              backgroundColor: isAboveAvg ? "#10b981" : "#f59e0b",
            },
          ]}
        />
      </View>
      <Text style={[v.posNote, { color: isAboveAvg ? "#10b981" : "#f59e0b" }]}>
        {isAboveAvg
          ? `${(teamAvg - myTime).toFixed(2)}s faster than team average`
          : `${(myTime - teamAvg).toFixed(2)}s slower than team average`}
      </Text>
    </View>
  );
}

function AsymmetryMeter({
  pct,
  slowerSide,
}: {
  pct: number;
  slowerSide: "left" | "right";
}) {
  const color = pct > 15 ? "#ef4444" : pct > 8 ? "#f59e0b" : "#10b981";
  const label = pct > 15 ? "High" : pct > 8 ? "Moderate" : "Low";
  return (
    <View style={v.asymWrap}>
      <View style={v.asymHeader}>
        <Text style={v.asymTitle}>Asymmetry</Text>
        <View
          style={[
            v.asymBadge,
            { backgroundColor: color + "22", borderColor: color },
          ]}
        >
          <Text style={[v.asymBadgeText, { color }]}>
            {label} · {pct.toFixed(1)}%
          </Text>
        </View>
      </View>
      <View style={v.asymTrack}>
        <View
          style={[
            v.asymFill,
            {
              width: `${clamp(pct * 3, 2, 100)}%` as any,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={v.asymNote}>
        {slowerSide === "left" ? "Left" : "Right"} foot is slower
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AthleteDashboard() {
  const params = useLocalSearchParams<{ userId?: string; clubId?: string }>();
  const [athleteName, setAthleteName] = useState("");
  const [clubName, setClubName] = useState("");
  const [results, setResults] = useState<StationResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    setIsLoading(true);
    try {
      let userId = params.userId ?? "";
      let clubId = params.clubId ?? "";
      let name = "";
      let club = "";

      if (userId && clubId) {
        // Admin preview mode
        setIsPreview(true);
        const { data } = await supabase
          .from("club_users")
          .select("first_name,last_name")
          .eq("id", userId)
          .maybeSingle();
        name = data ? `${data.first_name} ${data.last_name}`.trim() : userId;
        const { data: clubData } = await supabase
          .from("clubs")
          .select("name")
          .eq("id", clubId)
          .maybeSingle();
        club = clubData?.name ?? "";
      } else {
        const session = await getAthleteSession();
        if (!session) {
          router.replace("/login");
          return;
        }
        userId = session.userId;
        clubId = session.clubId;
        name = session.userName;
        club = session.clubName;
      }

      setAthleteName(name);
      setClubName(club);
      const data = await loadDashboardData(userId, clubId);
      setResults(data);
    } catch (e) {
      console.error("AthleteDashboard init error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearAthleteSession();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const totalStations = results.length;
  const best505 = results.find((r) => r.stationId === "5-0-5-test");

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBack}>
          <Ionicons name="arrow-back" size={22} color="#ff7e21" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerName} numberOfLines={1}>
            {athleteName}
          </Text>
          <Text style={s.headerClub}>{clubName}</Text>
        </View>
        {!isPreview && (
          <TouchableOpacity onPress={handleLogout} style={s.headerAction}>
            <Ionicons name="log-out-outline" size={22} color="#888" />
          </TouchableOpacity>
        )}
        {isPreview && <View style={s.headerAction} />}
      </View>

      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#ff7e21" />
          <Text style={s.loadingText}>Loading your results…</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="analytics-outline" size={64} color="#ccc" />
          <Text style={s.emptyTitle}>No results yet</Text>
          <Text style={s.emptySubtitle}>
            Complete some tests to see your personal analytics here
          </Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary strip */}
          <View style={s.summaryStrip}>
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>{totalStations}</Text>
              <Text style={s.summaryLabel}>Stations</Text>
            </View>
            {best505 && (
              <>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <Text style={s.summaryValue}>
                    {best505.myBest.toFixed(2)}s
                  </Text>
                  <Text style={s.summaryLabel}>Best 5-0-5</Text>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <Text
                    style={[
                      s.summaryValue,
                      {
                        color: best505.myCategory
                          ? CAT_COLOR[best505.myCategory]
                          : "#888",
                      },
                    ]}
                  >
                    {best505.myCategory ?? "—"}
                  </Text>
                  <Text style={s.summaryLabel}>COD Level</Text>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <Text style={s.summaryValue}>
                    #{best505.myRank}
                    <Text style={s.summaryOf}>/{best505.teamCount}</Text>
                  </Text>
                  <Text style={s.summaryLabel}>5-0-5 Rank</Text>
                </View>
              </>
            )}
          </View>

          {/* Station cards */}
          {results.map((r) => (
            <View key={r.stationId} style={s.card}>
              {/* Card header */}
              <View style={s.cardHeader}>
                <View style={s.cardHeaderLeft}>
                  <View style={s.stationIcon}>
                    <Ionicons name="fitness" size={18} color="#ff7e21" />
                  </View>
                  <View>
                    <Text style={s.cardTitle}>{r.stationShortName}</Text>
                    <Text style={s.cardRank}>
                      Rank #{r.myRank} of {r.teamCount} athletes
                    </Text>
                  </View>
                </View>
                <View style={s.cardHeaderRight}>
                  <Text style={s.bigTime}>{r.myBest.toFixed(2)}s</Text>
                  {r.myCategory && (
                    <View
                      style={[
                        s.catBadge,
                        {
                          backgroundColor: CAT_COLOR[r.myCategory] + "22",
                          borderColor: CAT_COLOR[r.myCategory],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.catBadgeText,
                          { color: CAT_COLOR[r.myCategory] },
                        ]}
                      >
                        {r.myCategory}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* 5-0-5 specific */}
              {r.stationId === "5-0-5-test" && (
                <>
                  {/* Left / Right / Asymmetry row */}
                  <View style={s.footRow}>
                    <View style={s.footCell}>
                      <Text style={s.footLabel}>Left foot</Text>
                      <Text style={s.footTime}>
                        {r.myLeft !== null ? `${r.myLeft.toFixed(2)}s` : "—"}
                      </Text>
                    </View>
                    <View style={s.footDiv} />
                    <View style={s.footCell}>
                      <Text style={s.footLabel}>Right foot</Text>
                      <Text style={s.footTime}>
                        {r.myRight !== null ? `${r.myRight.toFixed(2)}s` : "—"}
                      </Text>
                    </View>
                  </View>

                  {/* Score gauges */}
                  {r.myOverallScore !== null && (
                    <View style={s.gaugesBlock}>
                      <View style={s.gaugeRow}>
                        <Text style={s.gaugeRowLabel}>COD Score</Text>
                        <ScoreGauge
                          score={r.myOverallScore}
                          color={
                            r.myCategory ? CAT_COLOR[r.myCategory] : "#888"
                          }
                        />
                      </View>
                      {r.myPerformanceIndex !== null && (
                        <View style={s.gaugeRow}>
                          <Text style={s.gaugeRowLabel}>Speed</Text>
                          <ScoreGauge
                            score={r.myPerformanceIndex}
                            color="#3b82f6"
                          />
                        </View>
                      )}
                      {r.myBalanceScore !== null && (
                        <View style={s.gaugeRow}>
                          <Text style={s.gaugeRowLabel}>Balance</Text>
                          <ScoreGauge
                            score={r.myBalanceScore}
                            color="#8b5cf6"
                          />
                        </View>
                      )}
                    </View>
                  )}

                  {/* Asymmetry meter */}
                  {r.myAsymmetry !== null && r.mySlowerSide !== null && (
                    <AsymmetryMeter
                      pct={r.myAsymmetry}
                      slowerSide={r.mySlowerSide}
                    />
                  )}
                </>
              )}

              {/* Team position bar (all stations) */}
              {r.teamCount > 1 && (
                <PositionBar
                  myTime={r.myBest}
                  teamBest={r.teamBest}
                  teamWorst={r.teamWorst}
                  teamAvg={r.teamAvg}
                />
              )}

              {/* Advice */}
              {r.advice.length > 0 && (
                <View style={s.adviceBlock}>
                  <View style={s.adviceHeader}>
                    <Ionicons name="bulb-outline" size={16} color="#ff7e21" />
                    <Text style={s.adviceTitle}>Coach insight</Text>
                  </View>
                  {r.advice.map((a, i) => (
                    <View key={i} style={s.adviceLine}>
                      <View style={s.adviceDot} />
                      <Text style={s.adviceText}>{a}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Drills */}
              {r.drills.length > 0 && (
                <View style={s.drillsBlock}>
                  <View style={s.adviceHeader}>
                    <Ionicons
                      name="barbell-outline"
                      size={16}
                      color="#8b5cf6"
                    />
                    <Text style={[s.adviceTitle, { color: "#8b5cf6" }]}>
                      Recommended drills
                    </Text>
                  </View>
                  {r.drills.map((d, i) => (
                    <View key={i} style={s.drillLine}>
                      <Text style={s.drillNum}>{i + 1}</Text>
                      <Text style={s.drillText}>{d}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Gauge sub-styles ────────────────────────────────────────────────────────

const v = StyleSheet.create({
  gaugeWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  gaugeTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  gaugeFill: { height: 8, borderRadius: 4 },
  gaugeLabel: {
    fontSize: 13,
    fontWeight: "700",
    width: 26,
    textAlign: "right",
  },
  posWrap: { marginTop: 12 },
  posLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  posEdge: { fontSize: 10, color: "#aaa" },
  posMid: { fontSize: 10, color: "#aaa" },
  posTrack: {
    height: 18,
    backgroundColor: "#f5f5f5",
    borderRadius: 9,
    overflow: "visible",
    flexDirection: "row",
    position: "relative",
  },
  posHalf: { flex: 1 },
  avgMarker: {
    position: "absolute",
    top: 2,
    bottom: 2,
    width: 2,
    backgroundColor: "#94a3b8",
    borderRadius: 1,
  },
  myMarker: {
    position: "absolute",
    top: -3,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    marginLeft: -12,
  },
  posNote: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  asymWrap: { marginTop: 12 },
  asymHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  asymTitle: { fontSize: 13, fontWeight: "600", color: "#444" },
  asymBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  asymBadgeText: { fontSize: 11, fontWeight: "700" },
  asymTrack: {
    height: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  asymFill: { height: 8, borderRadius: 4 },
  asymNote: { fontSize: 11, color: "#888", marginTop: 4 },
});

// ─── Main styles ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f9fa" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerBack: { padding: 4 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerName: { fontSize: 17, fontWeight: "bold", color: "#1a1a1a" },
  headerClub: { fontSize: 12, color: "#888", marginTop: 1 },
  headerAction: { width: 36 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 32,
  },
  loadingText: { color: "#888", fontSize: 15 },
  emptyTitle: { fontSize: 20, fontWeight: "600", color: "#555" },
  emptySubtitle: { fontSize: 14, color: "#999", textAlign: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  // Summary strip
  summaryStrip: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryValue: { fontSize: 18, fontWeight: "bold", color: "#1a1a1a" },
  summaryOf: { fontSize: 12, color: "#888" },
  summaryLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: "#eee", marginVertical: 4 },
  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  stationIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff8f3",
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "bold", color: "#1a1a1a" },
  cardRank: { fontSize: 12, color: "#888", marginTop: 2 },
  cardHeaderRight: { alignItems: "flex-end", gap: 4 },
  bigTime: { fontSize: 24, fontWeight: "bold", color: "#1a1a1a" },
  catBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  catBadgeText: { fontSize: 11, fontWeight: "700" },
  // Foot row
  footRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#f0f0f0",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 12,
  },
  footCell: { flex: 1, alignItems: "center", paddingVertical: 10 },
  footLabel: { fontSize: 11, color: "#999", marginBottom: 3 },
  footTime: { fontSize: 20, fontWeight: "bold", color: "#1a1a1a" },
  footDiv: { width: 1, backgroundColor: "#f0f0f0" },
  // Gauges
  gaugesBlock: { gap: 8, marginBottom: 12 },
  gaugeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  gaugeRowLabel: { fontSize: 12, color: "#888", width: 54 },
  // Advice
  adviceBlock: {
    backgroundColor: "#fff8f3",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#ff7e21",
    marginTop: 12,
    gap: 6,
  },
  adviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  adviceTitle: { fontSize: 13, fontWeight: "700", color: "#ff7e21" },
  adviceLine: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  adviceDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#ff7e21",
    marginTop: 6,
  },
  adviceText: { flex: 1, fontSize: 13, color: "#444", lineHeight: 19 },
  // Drills
  drillsBlock: {
    backgroundColor: "#f5f3ff",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#8b5cf6",
    marginTop: 10,
    gap: 6,
  },
  drillLine: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  drillNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#8b5cf6",
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
  },
  drillText: { flex: 1, fontSize: 13, color: "#444", lineHeight: 19 },
});
