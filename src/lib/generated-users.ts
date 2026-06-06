export type GeneratedUserAccount = {
  username: string;
  email: string;
  fullName: string;
  role: "analyst" | "supervisor" | "admin";
};

export const GENERATED_USER_ACCOUNTS: GeneratedUserAccount[] = [
  // Supervisors / Admins (3)
  { username: "admin01",    email: "admin01@lab.local",    fullName: "Supervisor Admin 01", role: "admin" },
  { username: "admin02",    email: "admin02@lab.local",    fullName: "Supervisor Admin 02", role: "admin" },
  { username: "admin03",    email: "admin03@lab.local",    fullName: "Supervisor Admin 03", role: "admin" },
  // Analysts (15)
  { username: "analyst01",  email: "analyst01@lab.local",  fullName: "Analyst User 01",     role: "analyst" },
  { username: "analyst02",  email: "analyst02@lab.local",  fullName: "Analyst User 02",     role: "analyst" },
  { username: "analyst03",  email: "analyst03@lab.local",  fullName: "Analyst User 03",     role: "analyst" },
  { username: "analyst04",  email: "analyst04@lab.local",  fullName: "Analyst User 04",     role: "analyst" },
  { username: "analyst05",  email: "analyst05@lab.local",  fullName: "Analyst User 05",     role: "analyst" },
  { username: "analyst06",  email: "analyst06@lab.local",  fullName: "Analyst User 06",     role: "analyst" },
  { username: "analyst07",  email: "analyst07@lab.local",  fullName: "Analyst User 07",     role: "analyst" },
  { username: "analyst08",  email: "analyst08@lab.local",  fullName: "Analyst User 08",     role: "analyst" },
  { username: "analyst09",  email: "analyst09@lab.local",  fullName: "Analyst User 09",     role: "analyst" },
  { username: "analyst10",  email: "analyst10@lab.local",  fullName: "Analyst User 10",     role: "analyst" },
  { username: "analyst11",  email: "analyst11@lab.local",  fullName: "Analyst User 11",     role: "analyst" },
  { username: "analyst12",  email: "analyst12@lab.local",  fullName: "Analyst User 12",     role: "analyst" },
  { username: "analyst13",  email: "analyst13@lab.local",  fullName: "Analyst User 13",     role: "analyst" },
  { username: "analyst14",  email: "analyst14@lab.local",  fullName: "Analyst User 14",     role: "analyst" },
  { username: "analyst15",  email: "analyst15@lab.local",  fullName: "Analyst User 15",     role: "analyst" },
];
