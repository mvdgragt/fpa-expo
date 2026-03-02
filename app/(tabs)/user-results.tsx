import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelectedUser } from "../../context/SelectedUserContext";
import { getClubSession } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import {
  extractUserPhotoObjectPath,
  getSignedUserPhotoUrl,
} from "../../lib/user-photos";

interface TestResult {
  userId: string;
  userName: string;
  userImage: string;
  stationId: string;
  stationName: string;
  stationShortName: string;
  time: string;
  timestamp: string;
  foot?: "left" | "right";
}

interface GroupedResults {
  [stationId: string]: {
    stationName: string;
    stationShortName: string;
    results: TestResult[];
  };
}

export default function UserResultsScreen() {
  const { user } = useSelectedUser();
  const [groupedResults, setGroupedResults] = useState<GroupedResults>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const defaultAvatarUrl = "https://www.gravatar.com/avatar/?d=mp&f=y";
  const isCompactModal = Dimensions.get("window").height < 780;
  const [fiveOhFiveDetailsOpen, setFiveOhFiveDetailsOpen] = useState(false);
  const [isBackfillSyncing, setIsBackfillSyncing] = useState(false);
  const [fiveOhFiveSelected, setFiveOhFiveSelected] = useState<{
    dayKey: string;
    latestTimestamp: string;
    left?: TestResult;
    right?: TestResult;
  } | null>(null);

  const getDayKey = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  };

  const mergeFiveOhFiveByDay = (results: TestResult[]) => {
    const byDay = new Map<
      string,
      {
        dayKey: string;
        latestTimestamp: string;
        left?: TestResult;
        right?: TestResult;
      }
    >();

    for (const r of results) {
      const dayKey = getDayKey(r.timestamp);
      const current = byDay.get(dayKey) ?? {
        dayKey,
        latestTimestamp: r.timestamp,
      };

      if (
        new Date(r.timestamp).getTime() >
        new Date(current.latestTimestamp).getTime()
      ) {
        current.latestTimestamp = r.timestamp;
      }

      if (r.foot === "left") {
        if (
          !current.left ||
          new Date(r.timestamp).getTime() >
            new Date(current.left.timestamp).getTime()
        ) {
          current.left = r;
        }
      } else if (r.foot === "right") {
        if (
          !current.right ||
          new Date(r.timestamp).getTime() >
            new Date(current.right.timestamp).getTime()
        ) {
          current.right = r;
        }
      } else {
        // No foot info: treat as a single (left) slot so it still shows.
        if (!current.left) current.left = r;
      }

      byDay.set(dayKey, current);
    }

    return Array.from(byDay.values()).sort(
      (a, b) =>
        new Date(b.latestTimestamp).getTime() -
        new Date(a.latestTimestamp).getTime(),
    );
  };

  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

  const computeFiveOhFiveMetrics = (
    leftSeconds?: number,
    rightSeconds?: number,
  ) => {
    const hasLeft =
      typeof leftSeconds === "number" && Number.isFinite(leftSeconds);
    const hasRight =
      typeof rightSeconds === "number" && Number.isFinite(rightSeconds);

    const bestTime =
      hasLeft && hasRight
        ? Math.min(leftSeconds!, rightSeconds!)
        : hasLeft
          ? leftSeconds!
          : hasRight
            ? rightSeconds!
            : null;

    const weakerDirection =
      hasLeft && hasRight
        ? leftSeconds! > rightSeconds!
          ? "Left Turn"
          : "Right Turn"
        : null;

    const directionalDifference =
      hasLeft && hasRight ? Math.abs(leftSeconds! - rightSeconds!) : null;

    const asymmetryIndex =
      hasLeft && hasRight
        ? (Math.abs(leftSeconds! - rightSeconds!) /
            Math.max(leftSeconds!, rightSeconds!)) *
          100
        : null;

    const performanceIndex =
      bestTime !== null
        ? clamp(((2.4 - bestTime) / (2.4 - 2.0)) * 100, 0, 100)
        : null;

    const asymmetryScore = (() => {
      if (asymmetryIndex === null || !Number.isFinite(asymmetryIndex))
        return null;
      const a = Math.max(0, asymmetryIndex);

      if (a <= 5) {
        // 0–5% → 80–100
        return 100 - (a / 5) * 20;
      }
      if (a <= 10) {
        // 5–10% → 70–80
        return 80 - ((a - 5) / 5) * 10;
      }
      if (a <= 15) {
        // 10–15% → 60–70
        return 70 - ((a - 10) / 5) * 10;
      }
      if (a <= 20) {
        // 15–20% → 50–60
        return 60 - ((a - 15) / 5) * 10;
      }
      if (a <= 30) {
        // 20–30% → 30–50
        return 50 - ((a - 20) / 10) * 20;
      }

      // >30% → 0–30
      return Math.max(0, 30 - (a - 30) * 1.5);
    })();

    const combinedScore =
      performanceIndex !== null && asymmetryScore !== null
        ? performanceIndex * 0.7 + asymmetryScore * 0.3
        : null;

    const category =
      combinedScore !== null
        ? combinedScore >= 85
          ? "Elite"
          : combinedScore >= 70
            ? "Strong"
            : combinedScore >= 55
              ? "Moderate"
              : "Needs Development"
        : null;

    return {
      bestTime,
      weakerDirection,
      directionalDifference,
      asymmetryIndex,
      performanceIndex,
      asymmetryScore,
      combinedScore,
      category,
    };
  };

  const fmt2 = (n: number) => n.toFixed(2);
  const fmt1 = (n: number) => n.toFixed(1);
  const fmt0 = (n: number) => String(Math.round(n));

  const parseTimeSeconds = (raw: string | undefined | null) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;

    // Handle mm:ss(.ms)
    if (s.includes(":")) {
      const parts = s.split(":");
      const last = parts.pop();
      const mins = parts.pop();
      const mm = mins ? parseFloat(mins) : 0;
      const ss = last ? parseFloat(last) : NaN;
      const val = mm * 60 + ss;
      return Number.isFinite(val) ? val : null;
    }

    // Handle plain seconds (optionally with trailing unit)
    const match = s.match(/(\d+(?:\.\d+)?)/);
    const val = match ? parseFloat(match[1]) : NaN;
    return Number.isFinite(val) ? val : null;
  };

  const pct = (value: number, max: number) => {
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
    return clamp((value / max) * 100, 0, 100);
  };

  const getScoreColor = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return "#111";
    if (value >= 70) return "#16a34a";
    if (value >= 50) return "#ca8a04";
    return "#dc2626";
  };

  const deleteResultsByTimestamps = useCallback(
    async (timestamps: string[]) => {
      if (!user) return;
      const tsSet = new Set(timestamps.filter(Boolean));
      if (tsSet.size === 0) return;

      // Best-effort remote delete (Supabase)
      try {
        const session = await getClubSession();
        if (session?.clubId) {
          const { error } = await supabase
            .from("test_results")
            .delete()
            .eq("club_id", session.clubId)
            .eq("user_id", user.id)
            .in("tested_at", Array.from(tsSet));
          if (error && __DEV__) {
            console.warn("[Delete] test_results delete failed", error);
          }
        }
      } catch (e) {
        if (__DEV__) console.warn("[Delete] test_results delete failed", e);
      }

      const savedResults = await AsyncStorage.getItem("testResults");
      const allResults: TestResult[] = savedResults
        ? JSON.parse(savedResults)
        : [];

      const next = allResults.filter(
        (r) => !(r.userId === user.id && tsSet.has(r.timestamp)),
      );
      await AsyncStorage.setItem("testResults", JSON.stringify(next));

      const userResults = next
        .filter((result) => result.userId === user.id)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

      const grouped: GroupedResults = {};
      userResults.forEach((result) => {
        if (!grouped[result.stationId]) {
          grouped[result.stationId] = {
            stationName: result.stationName,
            stationShortName: result.stationShortName,
            results: [],
          };
        }
        grouped[result.stationId].results.push(result);
      });
      setGroupedResults(grouped);

      if (fiveOhFiveDetailsOpen) {
        setFiveOhFiveDetailsOpen(false);
        setFiveOhFiveSelected(null);
      }
    },
    [fiveOhFiveDetailsOpen, user],
  );

  const confirmDeleteSingle = useCallback(
    (result: TestResult) => {
      Alert.alert(
        "Delete result?",
        "This will permanently delete this test result.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteResultsByTimestamps([result.timestamp]),
          },
        ],
      );
    },
    [deleteResultsByTimestamps],
  );

  const confirmDeleteFiveOhFiveMerged = useCallback(
    (merged: {
      dayKey: string;
      latestTimestamp: string;
      left?: TestResult;
      right?: TestResult;
    }) => {
      const hasLeft = !!merged.left;
      const hasRight = !!merged.right;

      const buttons: {
        text: string;
        style?: "default" | "cancel" | "destructive";
        onPress?: () => void;
      }[] = [{ text: "Cancel", style: "cancel" }];

      if (hasLeft) {
        buttons.unshift({
          text: "Delete Left",
          style: "destructive",
          onPress: () => deleteResultsByTimestamps([merged.left!.timestamp]),
        });
      }
      if (hasRight) {
        buttons.unshift({
          text: "Delete Right",
          style: "destructive",
          onPress: () => deleteResultsByTimestamps([merged.right!.timestamp]),
        });
      }
      if (hasLeft && hasRight) {
        buttons.unshift({
          text: "Delete Both",
          style: "destructive",
          onPress: () =>
            deleteResultsByTimestamps([
              merged.left!.timestamp,
              merged.right!.timestamp,
            ]),
        });
      }

      Alert.alert(
        "Delete 5-0-5 result?",
        "Choose which direction to delete.",
        buttons,
      );
    },
    [deleteResultsByTimestamps],
  );

  const loadUserResults = useCallback(async () => {
    try {
      const savedResults = await AsyncStorage.getItem("testResults");
      if (savedResults && user) {
        const allResults: TestResult[] = JSON.parse(savedResults);

        try {
          const unique = Array.from(
            new Set(
              allResults.map((r) => String(r.userImage || "")).filter(Boolean),
            ),
          );
          const entries = await Promise.all(
            unique.map(async (raw) => {
              const path = extractUserPhotoObjectPath(raw);
              const url = path ? await getSignedUserPhotoUrl(path) : "";
              return [raw, url] as const;
            }),
          );
          setSignedUrls((prev) => {
            const next = { ...prev };
            for (const [raw, url] of entries) {
              if (url) next[raw] = url;
            }
            return next;
          });
        } catch {
          // ignore
        }

        // Filter results for current user
        const userResults = allResults
          .filter((result) => result.userId === user.id)
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          );

        // Group by station
        const grouped: GroupedResults = {};
        userResults.forEach((result) => {
          if (!grouped[result.stationId]) {
            grouped[result.stationId] = {
              stationName: result.stationName,
              stationShortName: result.stationShortName,
              results: [],
            };
          }
          grouped[result.stationId].results.push(result);
        });

        setGroupedResults(grouped);
      } else {
        setGroupedResults({});
      }
    } catch (error) {
      console.error("Error loading user results:", error);
    }
  }, [user]);

  useEffect(() => {
    loadUserResults();
  }, [loadUserResults]);

  useFocusEffect(
    useCallback(() => {
      loadUserResults();
    }, [loadUserResults]),
  );

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) {
      return `Today, ${timeStr}`;
    }

    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    return `${dateStr}, ${timeStr}`;
  };

  const handleViewLeaderboard = () => {
    router.push("/(tabs)/leaderboard");
  };

  const handleNewTest = () => {
    router.push("/");
  };

  const syncAllLocalResultsToSupabase = useCallback(async () => {
    if (isBackfillSyncing) return;

    try {
      setIsBackfillSyncing(true);

      const session = await getClubSession();
      if (!session?.clubId) {
        Alert.alert("Not logged in", "Missing club session.");
        return;
      }

      const savedResults = await AsyncStorage.getItem("testResults");
      const allResults: TestResult[] = savedResults
        ? JSON.parse(savedResults)
        : [];

      if (!Array.isArray(allResults) || allResults.length === 0) {
        Alert.alert("Nothing to sync", "No local results found.");
        return;
      }

      const payload = allResults
        .map((r) => {
          const testedAt = String((r as any).timestamp || "");
          if (!testedAt) return null;

          const timeSeconds = Number((r as any).time);
          if (!Number.isFinite(timeSeconds)) return null;

          const stationId = String((r as any).stationId || "");
          const is505 = stationId === "5-0-5-test";
          const foot = is505 ? (r.foot ? String(r.foot) : null) : null;

          return {
            club_id: session.clubId,
            user_id: String((r as any).userId || ""),
            station_id: stationId,
            station_name: String((r as any).stationName || ""),
            station_short_name: String((r as any).stationShortName || ""),
            time_seconds: timeSeconds,
            tested_at: testedAt,
            foot,
          };
        })
        .filter((x): x is NonNullable<typeof x> => !!x && !!x.user_id);

      if (payload.length === 0) {
        Alert.alert("Nothing to sync", "No valid local results found.");
        return;
      }

      const chunkSize = 200;
      let inserted = 0;

      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from("test_results").upsert(chunk, {
          onConflict: "club_id,user_id,station_id,tested_at",
          ignoreDuplicates: true,
        });

        if (error) {
          throw error;
        }
        inserted += chunk.length;
      }

      Alert.alert(
        "Sync complete",
        `Uploaded ${inserted} local result${inserted === 1 ? "" : "s"} to Supabase.`,
      );
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Sync failed.";
      Alert.alert("Sync failed", msg);
    } finally {
      setIsBackfillSyncing(false);
    }
  }, [isBackfillSyncing]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{user?.name || "Your Results"}</Text>
      <Text style={styles.subtitle}>Your Latest 5 Results</Text>

      {Object.keys(groupedResults).length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="clipboard-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No results yet</Text>
          <Text style={styles.emptySubtext}>
            Complete a test to see your results here
          </Text>
        </View>
      ) : (
        <>
          {Object.entries(groupedResults).map(([stationId, data]) => (
            <View key={stationId} style={styles.stationSection}>
              <View style={styles.stationHeader}>
                <Ionicons name="fitness" size={24} color="#ff7e21" />
                <View style={styles.stationTitleWrap}>
                  <Text style={styles.stationTitle}>
                    {data.stationShortName}
                  </Text>
                  {stationId === "5-0-5-test" ? (
                    <Text style={styles.stationHint}>
                      Tap a result for advanced details
                    </Text>
                  ) : null}
                </View>
              </View>

              {stationId === "5-0-5-test"
                ? mergeFiveOhFiveByDay(data.results)
                    .slice(0, 5)
                    .map((merged, index) => (
                      <TouchableOpacity
                        key={`${user?.id || "user"}-${stationId}-${merged.dayKey}-${index}`}
                        style={styles.resultCard}
                        activeOpacity={0.8}
                        onPress={() => {
                          setFiveOhFiveSelected(merged);
                          setFiveOhFiveDetailsOpen(true);
                        }}
                        onLongPress={() => {
                          confirmDeleteFiveOhFiveMerged(merged);
                        }}
                      >
                        {(() => {
                          const display = merged.left ?? merged.right;
                          return (
                            <>
                              <Image
                                source={{
                                  uri:
                                    signedUrls[display?.userImage || ""] ||
                                    defaultAvatarUrl,
                                }}
                                style={styles.resultUserImage}
                              />

                              <View style={styles.resultInfo}>
                                <Text style={styles.resultUserName}>
                                  {display?.userName || user?.name}
                                </Text>
                                <Text style={styles.resultDate}>
                                  {formatDate(merged.latestTimestamp)}
                                </Text>
                              </View>
                            </>
                          );
                        })()}

                        <View style={styles.timeContainer}>
                          <View style={styles.multiTimeRow}>
                            {merged.left ? (
                              <View style={styles.footTimeBadge}>
                                <Text style={styles.footTimeText}>
                                  {merged.left.time}s
                                </Text>
                                <Text style={styles.footTimeLabel}>LEFT</Text>
                              </View>
                            ) : null}
                            {merged.right ? (
                              <View style={styles.footTimeBadge}>
                                <Text style={styles.footTimeText}>
                                  {merged.right.time}s
                                </Text>
                                <Text style={styles.footTimeLabel}>RIGHT</Text>
                              </View>
                            ) : null}
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color="#fff"
                            style={styles.rowChevron}
                          />
                        </View>
                      </TouchableOpacity>
                    ))
                : data.results.slice(0, 5).map((result, index) => (
                    <TouchableOpacity
                      key={`${result.userId}-${result.timestamp}-${index}`}
                      style={styles.resultCard}
                      activeOpacity={0.9}
                      onLongPress={() => confirmDeleteSingle(result)}
                    >
                      <Image
                        source={{
                          uri: signedUrls[result.userImage] || defaultAvatarUrl,
                        }}
                        style={styles.resultUserImage}
                      />

                      <View style={styles.resultInfo}>
                        <Text style={styles.resultUserName}>
                          {result.userName}
                        </Text>
                        <Text style={styles.resultDate}>
                          {formatDate(result.timestamp)}
                        </Text>
                      </View>

                      <View style={styles.timeContainer}>
                        <View style={styles.timeRow}>
                          <Text style={styles.resultTime}>{result.time}s</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
            </View>
          ))}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.leaderboardButton]}
              onPress={handleViewLeaderboard}
              activeOpacity={0.8}
            >
              <Ionicons name="trophy" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>View Leaderboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.syncButton]}
              onPress={() => {
                Alert.alert(
                  "Sync local results",
                  "This will upload all locally saved test results to Supabase. Duplicates will be ignored.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: isBackfillSyncing ? "Syncing…" : "Sync now",
                      onPress: () => syncAllLocalResultsToSupabase(),
                    },
                  ],
                );
              }}
              activeOpacity={0.8}
              disabled={isBackfillSyncing}
            >
              <Ionicons name="cloud-upload" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>
                {isBackfillSyncing
                  ? "Syncing…"
                  : "Sync All Local Results to Supabase"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.newTestButton]}
              onPress={handleNewTest}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>New Test</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal
        visible={fiveOhFiveDetailsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setFiveOhFiveDetailsOpen(false);
          setFiveOhFiveSelected(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              isCompactModal && styles.modalCardCompact,
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>5-0-5 Results</Text>
              <TouchableOpacity
                onPress={() => {
                  setFiveOhFiveDetailsOpen(false);
                  setFiveOhFiveSelected(null);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            {(() => {
              const selected = fiveOhFiveSelected;
              const leftTime = parseTimeSeconds(selected?.left?.time);
              const rightTime = parseTimeSeconds(selected?.right?.time);
              const metrics = computeFiveOhFiveMetrics(
                leftTime ?? undefined,
                rightTime ?? undefined,
              );

              const maxTime =
                typeof leftTime === "number" && typeof rightTime === "number"
                  ? Math.max(leftTime, rightTime)
                  : typeof leftTime === "number"
                    ? leftTime
                    : typeof rightTime === "number"
                      ? rightTime
                      : 2.4;

              const leftBar =
                typeof leftTime === "number" ? pct(leftTime, maxTime) : 0;
              const rightBar =
                typeof rightTime === "number" ? pct(rightTime, maxTime) : 0;

              return (
                <View style={styles.modalBody}>
                  <View style={styles.sectionGrid}>
                    <View
                      style={[
                        styles.card,
                        styles.cardHalf,
                        isCompactModal && styles.cardCompact,
                      ]}
                    >
                      <Text style={styles.cardTitle}>LEFT TURN</Text>
                      <Text
                        style={[
                          styles.cardValue,
                          isCompactModal && styles.cardValueCompact,
                        ]}
                      >
                        {typeof leftTime === "number" &&
                        Number.isFinite(leftTime)
                          ? `${fmt2(leftTime)} s`
                          : "--"}
                      </Text>
                      <View
                        style={[
                          styles.barTrack,
                          isCompactModal && styles.barTrackCompact,
                        ]}
                      >
                        <View
                          style={[styles.barFill, { width: `${leftBar}%` }]}
                        />
                      </View>
                    </View>

                    <View
                      style={[
                        styles.card,
                        styles.cardHalf,
                        isCompactModal && styles.cardCompact,
                      ]}
                    >
                      <Text style={styles.cardTitle}>RIGHT TURN</Text>
                      <Text
                        style={[
                          styles.cardValue,
                          isCompactModal && styles.cardValueCompact,
                        ]}
                      >
                        {typeof rightTime === "number" &&
                        Number.isFinite(rightTime)
                          ? `${fmt2(rightTime)} s`
                          : "--"}
                      </Text>
                      <View
                        style={[
                          styles.barTrack,
                          isCompactModal && styles.barTrackCompact,
                        ]}
                      >
                        <View
                          style={[styles.barFill, { width: `${rightBar}%` }]}
                        />
                      </View>
                    </View>
                  </View>

                  <View
                    style={[styles.card, isCompactModal && styles.cardCompact]}
                  >
                    <Text style={styles.cardTitle}>SUMMARY</Text>
                    {metrics.asymmetryIndex !== null &&
                    metrics.asymmetryIndex > 10 ? (
                      <View style={styles.warningBanner}>
                        <Ionicons name="flag" size={14} color="#b42318" />
                        <Text style={styles.warningText}>
                          Imbalance detected
                        </Text>
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.summaryGrid,
                        isCompactModal && styles.summaryGridCompact,
                      ]}
                    >
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Best Time</Text>
                        <Text style={styles.summaryValue}>
                          {metrics.bestTime !== null
                            ? `${fmt2(metrics.bestTime)} s`
                            : "--"}
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Dir. Diff.</Text>
                        <Text style={styles.summaryValue}>
                          {metrics.directionalDifference !== null
                            ? `${fmt2(metrics.directionalDifference)} s`
                            : "--"}
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Asymmetry</Text>
                        <Text style={styles.summaryValue}>
                          {metrics.asymmetryIndex !== null
                            ? `${fmt1(metrics.asymmetryIndex)} %`
                            : "--"}
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Weaker Dir.</Text>
                        <Text style={styles.summaryValue}>
                          {metrics.weakerDirection !== null
                            ? metrics.weakerDirection
                            : "--"}
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Category</Text>
                        <Text style={styles.summaryValue}>
                          {metrics.category !== null
                            ? metrics.category
                            : "-- (need left + right)"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View
                    style={[styles.card, isCompactModal && styles.cardCompact]}
                  >
                    <Text style={styles.cardTitle}>SCORES</Text>

                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreLabel}>
                        COD Performance Index
                      </Text>
                      <Text
                        style={[
                          styles.scoreValue,
                          {
                            color: getScoreColor(metrics.performanceIndex),
                          },
                        ]}
                      >
                        {metrics.performanceIndex !== null
                          ? `${fmt0(metrics.performanceIndex)} / 100`
                          : "--"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.barTrack,
                        isCompactModal && styles.barTrackCompact,
                      ]}
                    >
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${metrics.performanceIndex !== null ? metrics.performanceIndex : 0}%`,
                          },
                        ]}
                      />
                    </View>

                    <View style={[styles.scoreRow, { marginTop: 10 }]}>
                      <Text style={styles.scoreLabel}>Balance Score</Text>
                      <Text
                        style={[
                          styles.scoreValue,
                          {
                            color: getScoreColor(metrics.asymmetryScore),
                          },
                        ]}
                      >
                        {metrics.asymmetryScore !== null
                          ? `${fmt0(metrics.asymmetryScore)} / 100`
                          : "--"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.barTrack,
                        isCompactModal && styles.barTrackCompact,
                      ]}
                    >
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${metrics.asymmetryScore !== null ? metrics.asymmetryScore : 0}%`,
                          },
                        ]}
                      />
                    </View>

                    <View style={[styles.scoreRow, { marginTop: 10 }]}>
                      <Text style={styles.scoreLabel}>Overall COD Score</Text>
                      <Text
                        style={[
                          styles.scoreValue,
                          {
                            color: getScoreColor(metrics.combinedScore),
                          },
                        ]}
                      >
                        {metrics.combinedScore !== null
                          ? `${fmt0(metrics.combinedScore)} / 100`
                          : "--"}
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${metrics.combinedScore !== null ? metrics.combinedScore : 0}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  stationSection: {
    marginBottom: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  stationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#ff7e21",
  },
  stationTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ff7e21",
  },
  stationTitleWrap: {
    flex: 1,
  },
  stationHint: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  resultCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  resultUserImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultUserName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  resultDate: {
    fontSize: 12,
    color: "#999",
  },
  timeContainer: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowChevron: {
    opacity: 0.9,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  multiTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultTime: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  footTimeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 72,
    alignItems: "center",
  },
  footTimeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
  },
  footTimeLabel: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  modalCardCompact: {
    padding: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
  },
  modalBody: {
    paddingTop: 12,
  },
  categoryText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111",
  },
  sectionGrid: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  cardHalf: {
    flex: 1,
  },
  cardCompact: {
    padding: 10,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#111",
    letterSpacing: 0.8,
  },
  cardValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: "900",
    color: "#111",
  },
  cardValueCompact: {
    fontSize: 18,
  },
  barTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#f1f1f1",
    overflow: "hidden",
  },
  barTrackCompact: {
    marginTop: 8,
    height: 6,
  },
  barFill: {
    height: "100%",
    backgroundColor: "#111",
    borderRadius: 999,
    opacity: 0.85,
  },
  summaryGrid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryGridCompact: {
    marginTop: 8,
    gap: 10,
  },
  summaryItem: {
    width: "47%",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#666",
  },
  summaryValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "900",
    color: "#111",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 8,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111",
    flex: 1,
    paddingRight: 10,
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111",
  },
  warningBanner: {
    marginTop: 10,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: "#fda29b",
    backgroundColor: "#fffbfa",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warningText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#b42318",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#999",
  },
  actionButtons: {
    gap: 12,
    paddingBottom: 32,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  leaderboardButton: {
    backgroundColor: "#47464c",
  },
  syncButton: {
    backgroundColor: "#2563eb",
  },
  newTestButton: {
    backgroundColor: "#4CAF50",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
