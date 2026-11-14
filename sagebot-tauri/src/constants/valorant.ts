import tauriConf from "../../src-tauri/tauri.conf.json";
import type { AgentInfo } from "../types/sagebot";

// Single source of truth for the displayed version (bump tauri.conf.json + Cargo.toml only)
export const APP_VERSION = String(tauriConf.version).replace(/\.0$/, "");

export const COMMS_CATEGORIES = [
  {
    id: 1,
    name: "Combat",
    options: [
      { id: 1, text: "Need Support" },
      { id: 2, text: "Caution here!" },
      { id: 3, text: "Need Healing!" },
      { id: 4, text: "On My Way" },
      { id: 5, text: "Ultimate Status" },
    ],
  },
  {
    id: 2,
    name: "Tactics",
    options: [
      { id: 1, text: "I'll Take Point" },
      { id: 2, text: "Let's rush them!" },
      { id: 3, text: "Be Quiet" },
      { id: 4, text: "Fall Back!" },
      { id: 5, text: "Play For Picks" },
    ],
  },
  {
    id: 3,
    name: "Social",
    options: [
      { id: 1, text: "Thanks" },
      { id: 2, text: "Commend" },
      { id: 3, text: "Yes" },
      { id: 4, text: "No" },
      { id: 5, text: "Sorry" },
      { id: 6, text: "Hello" },
    ],
  },
  {
    id: 4,
    name: "Strategy",
    options: [
      { id: 1, text: "Going A" },
      { id: 2, text: "Going B" },
      { id: 3, text: "Going C" },
      { id: 4, text: "Going Mid" },
    ],
  },
];

export const GAMEMODE_NAMES: Record<string, string> = {
  competitive: "Competitive",
  unrated: "Unrated",
  swiftplay: "Swiftplay",
  spikerush: "Spike Rush",
  hurm: "Team Deathmatch",
  deathmatch: "Deathmatch",
  ggteam: "Escalation",
  onefa: "Replication",
  snowball: "Snowball Fight",
};

export const WEAPON_SKIN_GROUPS = [
  {
    category: "Sidearms",
    weapons: [
      { id: "classic", label: "Classic" },
      { id: "shorty", label: "Shorty" },
      { id: "frenzy", label: "Frenzy" },
      { id: "ghost", label: "Ghost" },
      { id: "bandit", label: "Bandit" },
      { id: "sheriff", label: "Sheriff" },
    ],
  },
  {
    category: "SMGs & Shotguns",
    weapons: [
      { id: "stinger", label: "Stinger" },
      { id: "spectre", label: "Spectre" },
      { id: "bucky", label: "Bucky" },
      { id: "judge", label: "Judge" },
    ],
  },
  {
    category: "Snipers & Heavy",
    weapons: [
      { id: "marshal", label: "Marshal" },
      { id: "outlaw", label: "Outlaw" },
      { id: "operator", label: "Operator" },
      { id: "ares", label: "Ares" },
      { id: "odin", label: "Odin" },
    ],
  },
  {
    category: "Rifles",
    weapons: [
      { id: "bulldog", label: "Bulldog" },
      { id: "guardian", label: "Guardian" },
      { id: "warden", label: "Warden" },
      { id: "phantom", label: "Phantom" },
      { id: "vandal", label: "Vandal" },
    ],
  },
  {
    category: "Melee",
    weapons: [
      { id: "melee", label: "Melee" },
    ],
  },
];

export const MAP_SPLASHES: Record<string, string> = {
  ascent: "https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png",
  bind: "https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png",
  breeze: "https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png",
  fracture: "https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/splash.png",
  haven: "https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/splash.png",
  icebox: "https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/splash.png",
  lotus: "https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/splash.png",
  pearl: "https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/splash.png",
  split: "https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png",
  sunset: "https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/splash.png",
  abyss: "https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/splash.png",
  summit: "https://media.valorant-api.com/maps/756da597-416b-c0f2-f47b-afbdf28670bc/splash.png",
  corrode: "https://media.valorant-api.com/maps/1c18ab1f-420d-0d8b-71d0-77ad3c439115/splash.png",
  district: "https://media.valorant-api.com/maps/690b3ed2-4dff-945b-8223-6da834e30d24/splash.png",
  kasbah: "https://media.valorant-api.com/maps/12452a9d-48c3-0b02-e7eb-0381c3520404/splash.png",
  drift: "https://media.valorant-api.com/maps/2c09d728-42d5-30d8-43dc-96a05cc7ee9d/splash.png",
  glitch: "https://media.valorant-api.com/maps/d6336a5a-428f-c591-98db-c8a291159134/splash.png",
  piazza: "https://media.valorant-api.com/maps/de28aa9b-4cbe-1003-320e-6cb3ec309557/splash.png",
  gauntlet: "https://media.valorant-api.com/maps/dd3a1cd9-41b1-50ea-3bd6-a7bb3c5978bd/splash.png",
};

// Historical/secondary UUIDs mapped in legacy match logs alongside backend get_agents IDs
const VALORANT_AGENT_MAP: Record<string, string> = {
  "41fb69c1-4189-7b37-f117-bcaf1e96f1bf": "Astra",
  "b9f36430-4074-b290-eb81-0440ac023b4f": "Astra",
  "95b78d77-474e-9714-2971-15c32582b04a": "Astra",
  "5f8d3a7f-467b-97f3-062c-13acf203c006": "Breach",
  "9f0d8ba9-4140-b941-57d3-a7ad57c6b417": "Brimstone",
  "22697a3d-45bf-8dd7-4fec-84a9e28c69d7": "Chamber",
  "1dbf2edd-4729-0984-3115-daa5eed44993": "Clove",
  "1dbf2edd-4729-0984-3115-ffb5dde52523": "Clove",
  "117ed9e3-49f3-6512-3ccf-0cada7e3823b": "Cypher",
  "a3bfb854-4376-2d48-8377-93a26e38fb6f": "Cypher",
  "cc8b64c8-4b25-4ff9-6e7f-37b4da43d235": "Deadlock",
  "dade69b4-4f5a-8528-247b-219e5a1facd6": "Fade",
  "e370fa57-4757-3604-3648-499e1f642d3f": "Gekko",
  "95b78ed7-4637-86d9-7e41-71ba8c293152": "Harbor",
  "ddd5a15c-4fbe-42fa-3789-11a55ca5ee04": "Hush",
  "0e38b510-41a8-5780-5e8f-568b2a4f2d6c": "Iso",
  "add6443a-41bd-e414-f6ad-e58d267f4e95": "Jett",
  "601dbbe7-43ce-be57-2a40-4abd24953621": "KAY/O",
  "1e58de9c-4950-5125-93e9-a0aee9f98746": "Killjoy",
  "7c8a4701-4de6-9355-b254-e09bc2a34b72": "Miks",
  "bb2a4828-46eb-8cd1-e765-15848195d751": "Neon",
  "bb2a483e-4654-9406-1218-a616235b0d62": "Neon",
  "8e253930-4c05-31dd-1b6c-968525494517": "Omen",
  "8e253930-4c05-31dd-16ee-adacb8744f8b": "Omen",
  "eb93336a-449b-9c1b-0a54-a891f7921d69": "Phoenix",
  "eb9333ab-4054-7ac4-14d0-76ac36ab0ce6": "Phoenix",
  "f94c3b30-42be-e959-889c-5aa313dba261": "Raze",
  "a3bfb853-43b2-7238-a4f1-ad90e9e46bcc": "Reyna",
  "569fdd95-4d10-43ab-ca70-79becc718b46": "Sage",
  "6f2a04ca-43e0-be17-7f36-b3908627744d": "Skye",
  "320b2a48-4d9b-a075-30f1-1f93a9b638fa": "Sova",
  "ded3520f-4264-bfed-162d-b080e2abccf9": "Sova",
  "b444168c-4e35-8076-db47-ef9bf368f384": "Tejo",
  "b57f0980-4963-c36b-d8b4-028d7121287e": "Tejo",
  "92eeef5d-43b5-1d4a-8d03-b3927a09034b": "Veto",
  "707eab51-4836-f488-046a-cda6bf494859": "Viper",
  "efba5359-4016-a1e5-7626-b1ae76895940": "Vyse",
  "df222b40-4f51-4043-9831-27909339e6a0": "Vyse",
  "df1cb487-4902-002e-5c17-d28e83e78588": "Waylay",
  "7f94d92c-4234-0a36-9646-3a87eb8b5c89": "Yoru",
};

export function resolveAgentName(agentId?: string, fallback?: string, dynamicAgents?: AgentInfo[]): string {
  if (fallback && fallback !== "Agent" && fallback.trim().length > 0) {
    return fallback;
  }
  if (agentId) {
    const lower = agentId.toLowerCase();
    if (dynamicAgents && dynamicAgents.length > 0) {
      const hit = dynamicAgents.find((a) => a.id.toLowerCase() === lower);
      if (hit) return hit.name;
    }
    const mapped = VALORANT_AGENT_MAP[lower];
    if (mapped) return mapped;
  }
  return fallback || "Agent";
}
