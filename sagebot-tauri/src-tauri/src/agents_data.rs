use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct AgentInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub role: &'static str,
    pub color: &'static str,
    pub is_starter: bool,
}

static ALL_AGENTS: &[AgentInfo] = &[
    AgentInfo {
        id: "41fb69c1-4189-7b37-f117-bcaf1e96f1bf",
        name: "Astra",
        role: "Controller",
        color: "#9B59B6",
        is_starter: false,
    },
    AgentInfo {
        id: "5f8d3a7f-467b-97f3-062c-13acf203c006",
        name: "Breach",
        role: "Initiator",
        color: "#EB3B5A",
        is_starter: false,
    },
    AgentInfo {
        id: "9f0d8ba9-4140-b941-57d3-a7ad57c6b417",
        name: "Brimstone",
        role: "Controller",
        color: "#DE6433",
        is_starter: true,
    },
    AgentInfo {
        id: "22697a3d-45bf-8dd7-4fec-84a9e28c69d7",
        name: "Chamber",
        role: "Sentinel",
        color: "#F7B731",
        is_starter: false,
    },
    AgentInfo {
        id: "1dbf2edd-4729-0984-3115-daa5eed44993",
        name: "Clove",
        role: "Controller",
        color: "#FF9EBB",
        is_starter: false,
    },
    AgentInfo {
        id: "117ed9e3-49f3-6512-3ccf-0cada7e3823b",
        name: "Cypher",
        role: "Sentinel",
        color: "#D1D8E0",
        is_starter: false,
    },
    AgentInfo {
        id: "cc8b64c8-4b25-4ff9-6e7f-37b4da43d235",
        name: "Deadlock",
        role: "Sentinel",
        color: "#8854D0",
        is_starter: false,
    },
    AgentInfo {
        id: "dade69b4-4f5a-8528-247b-219e5a1facd6",
        name: "Fade",
        role: "Initiator",
        color: "#778CA3",
        is_starter: false,
    },
    AgentInfo {
        id: "e370fa57-4757-3604-3648-499e1f642d3f",
        name: "Gekko",
        role: "Initiator",
        color: "#A3CB38",
        is_starter: false,
    },
    AgentInfo {
        id: "95b78ed7-4637-86d9-7e41-71ba8c293152",
        name: "Harbor",
        role: "Controller",
        color: "#0FB9B1",
        is_starter: false,
    },
    AgentInfo {
        id: "ddd5a15c-4fbe-42fa-3789-11a55ca5ee04",
        name: "Hush",
        role: "Duelist",
        color: "#E056FD",
        is_starter: false,
    },
    AgentInfo {
        id: "0e38b510-41a8-5780-5e8f-568b2a4f2d6c",
        name: "Iso",
        role: "Duelist",
        color: "#5758BB",
        is_starter: false,
    },
    AgentInfo {
        id: "add6443a-41bd-e414-f6ad-e58d267f4e95",
        name: "Jett",
        role: "Duelist",
        color: "#FFFFFF",
        is_starter: true,
    },
    AgentInfo {
        id: "601dbbe7-43ce-be57-2a40-4abd24953621",
        name: "KAY/O",
        role: "Initiator",
        color: "#45AAF2",
        is_starter: false,
    },
    AgentInfo {
        id: "1e58de9c-4950-5125-93e9-a0aee9f98746",
        name: "Killjoy",
        role: "Sentinel",
        color: "#FED330",
        is_starter: false,
    },
    AgentInfo {
        id: "7c8a4701-4de6-9355-b254-e09bc2a34b72",
        name: "Miks",
        role: "Controller",
        color: "#3498DB",
        is_starter: false,
    },
    AgentInfo {
        id: "bb2a4828-46eb-8cd1-e765-15848195d751",
        name: "Neon",
        role: "Duelist",
        color: "#2BCBBA",
        is_starter: false,
    },
    AgentInfo {
        id: "8e253930-4c05-31dd-1b6c-968525494517",
        name: "Omen",
        role: "Controller",
        color: "#4B6584",
        is_starter: false,
    },
    AgentInfo {
        id: "eb93336a-449b-9c1b-0a54-a891f7921d69",
        name: "Phoenix",
        role: "Duelist",
        color: "#F67243",
        is_starter: true,
    },
    AgentInfo {
        id: "f94c3b30-42be-e959-889c-5aa313dba261",
        name: "Raze",
        role: "Duelist",
        color: "#FA8231",
        is_starter: false,
    },
    AgentInfo {
        id: "a3bfb853-43b2-7238-a4f1-ad90e9e46bcc",
        name: "Reyna",
        role: "Duelist",
        color: "#A55EEA",
        is_starter: false,
    },
    AgentInfo {
        id: "569fdd95-4d10-43ab-ca70-79becc718b46",
        name: "Sage",
        role: "Sentinel",
        color: "#56E0D2",
        is_starter: true,
    },
    AgentInfo {
        id: "6f2a04ca-43e0-be17-7f36-b3908627744d",
        name: "Skye",
        role: "Initiator",
        color: "#26DE81",
        is_starter: false,
    },
    AgentInfo {
        id: "320b2a48-4d9b-a075-30f1-1f93a9b638fa",
        name: "Sova",
        role: "Initiator",
        color: "#2C6DE8",
        is_starter: true,
    },
    AgentInfo {
        id: "b444168c-4e35-8076-db47-ef9bf368f384",
        name: "Tejo",
        role: "Initiator",
        color: "#E58E26",
        is_starter: false,
    },
    AgentInfo {
        id: "92eeef5d-43b5-1d4a-8d03-b3927a09034b",
        name: "Veto",
        role: "Sentinel",
        color: "#6C5CE7",
        is_starter: false,
    },
    AgentInfo {
        id: "707eab51-4836-f488-046a-cda6bf494859",
        name: "Viper",
        role: "Controller",
        color: "#20BF6B",
        is_starter: false,
    },
    AgentInfo {
        id: "efba5359-4016-a1e5-7626-b1ae76895940",
        name: "Vyse",
        role: "Sentinel",
        color: "#9980FA",
        is_starter: false,
    },
    AgentInfo {
        id: "df1cb487-4902-002e-5c17-d28e83e78588",
        name: "Waylay",
        role: "Duelist",
        color: "#E74C3C",
        is_starter: false,
    },
    AgentInfo {
        id: "7f94d92c-4234-0a36-9646-3a87eb8b5c89",
        name: "Yoru",
        role: "Duelist",
        color: "#3867D6",
        is_starter: false,
    },
];

pub fn get_all_agents() -> &'static [AgentInfo] {
    ALL_AGENTS
}

pub fn resolve_agent_name_by_id(id: &str) -> String {
    for a in ALL_AGENTS {
        if a.id.eq_ignore_ascii_case(id) {
            return a.name.to_string();
        }
    }
    // Alternate/legacy Riot UUIDs observed in older match payloads
    match id.to_ascii_lowercase().as_str() {
        "ded3520f-4264-bfed-162d-b080e2abccf9" => "Sova",
        "a3bfb854-4376-2d48-8377-93a26e38fb6f" => "Cypher",
        "eb9333ab-4054-7ac4-14d0-76ac36ab0ce6" => "Phoenix",
        "8e253930-4c05-31dd-16ee-adacb8744f8b" => "Omen",
        "b9f36430-4074-b290-eb81-0440ac023b4f" | "95b78d77-474e-9714-2971-15c32582b04a" => "Astra",
        "bb2a483e-4654-9406-1218-a616235b0d62" => "Neon",
        "1dbf2edd-4729-0984-3115-ffb5dde52523" => "Clove",
        "df222b40-4f51-4043-9831-27909339e6a0" => "Vyse",
        "b57f0980-4963-c36b-d8b4-028d7121287e" => "Tejo",
        _ => "Agent",
    }
    .to_string()
}
