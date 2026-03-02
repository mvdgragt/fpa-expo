import AsyncStorage from "@react-native-async-storage/async-storage";

export type ClubSession = {
  type: "club";
  clubCode: string;
  clubId: string;
  clubName: string;
  clubLogoPath?: string;
  loginTime: string;
};

export type AdminSession = {
  type: "admin";
  loginTime: string;
};

const CLUB_SESSION_KEY = "clubSession";

export const getClubSession = async (): Promise<ClubSession | null> => {
  const raw = await AsyncStorage.getItem(CLUB_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as any;
    if (parsed && typeof parsed === "object") {
      if (!parsed.clubLogoPath && typeof parsed.clubLogoUrl === "string") {
        parsed.clubLogoPath = parsed.clubLogoUrl;
      }
    }
    return parsed as ClubSession;
  } catch {
    return null;
  }
};

export const setClubSession = async (session: ClubSession) => {
  await AsyncStorage.setItem(CLUB_SESSION_KEY, JSON.stringify(session));
};

export const clearClubSession = async () => {
  await AsyncStorage.removeItem(CLUB_SESSION_KEY);
};

export type AthleteSession = {
  type: "athlete";
  clubId: string;
  clubName: string;
  userId: string;
  userName: string;
  loginTime: string;
};

const ATHLETE_SESSION_KEY = "athleteSession";

export const getAthleteSession = async (): Promise<AthleteSession | null> => {
  const raw = await AsyncStorage.getItem(ATHLETE_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AthleteSession;
  } catch {
    return null;
  }
};

export const setAthleteSession = async (session: AthleteSession) => {
  await AsyncStorage.setItem(ATHLETE_SESSION_KEY, JSON.stringify(session));
};

export const clearAthleteSession = async () => {
  await AsyncStorage.removeItem(ATHLETE_SESSION_KEY);
};
