export const testStations = [
  {
    id: "flying-20",
    name: "Flying Twenty",
    shortName: "Flying 20m",
    distanceMeters: 20,
    category: "speed",
    unit: "seconds",
    description: "Measures top-end sprint speed after a running start.",
  },
  {
    id: "five-ten-five",
    name: "Five-Ten-Five Agility Test",
    shortName: "5-10-5",
    distanceMeters: 20,
    category: "agility",
    unit: "seconds",
    description: "Measures change-of-direction speed over short distances.",
  },
  {
    id: "ten-meter-sprint",
    name: "10 Meter Sprint",
    shortName: "10m Sprint",
    distanceMeters: 10,
    category: "acceleration",
    unit: "seconds",
    description: "Measures short-distance acceleration from a static start.",
  },
  {
    id: "twenty-meter-sprint",
    name: "20 Meter Sprint",
    shortName: "20m Sprint",
    distanceMeters: 20,
    category: "acceleration",
    unit: "seconds",
    description: "Measures short-distance acceleration from a static start.",
  },
  {
    id: "run-home",
    name: "Run Home",
    shortName: "Run Home",
    distanceMeters: 100,
    category: "speed",
    unit: "seconds",
    description: "Measures short-distance acceleration from a static start.",
  },
];

export type TestStation = (typeof testStations)[0];
