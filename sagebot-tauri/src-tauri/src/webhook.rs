use serde::Serialize;

#[derive(Serialize)]
struct DiscordWebhookPayload {
    username: String,
    avatar_url: Option<String>,
    content: Option<String>,
    embeds: Vec<DiscordEmbed>,
}

#[derive(Serialize)]
struct DiscordEmbed {
    title: String,
    description: String,
    color: u32,
    fields: Vec<DiscordEmbedField>,
    footer: Option<DiscordFooter>,
}

#[derive(Serialize)]
struct DiscordEmbedField {
    name: String,
    value: String,
    inline: bool,
}

#[derive(Serialize)]
struct DiscordFooter {
    text: String,
}

pub async fn send_discord_test(webhook_url: &str, user_id: &str) -> Result<String, String> {
    if webhook_url.trim().is_empty() {
        return Err("Webhook URL is empty".to_string());
    }

    let mention = if !user_id.trim().is_empty() {
        Some(format!("<@{}>", user_id.trim()))
    } else {
        None
    };

    let payload = DiscordWebhookPayload {
        username: "SageBot".to_string(),
        avatar_url: Some("https://raw.githubusercontent.com/hexeth/sagebot/main/assets/sage.ico".to_string()),
        content: mention,
        embeds: vec![DiscordEmbed {
            title: "🟢 SageBot Webhook Connected".to_string(),
            description: "SageBot is successfully linked and listening for Valorant match events!".to_string(),
            color: 0x10B981, // Emerald green
            fields: vec![
                DiscordEmbedField {
                    name: "Version".to_string(),
                    value: "v3.0 (Tauri + Rust)".to_string(),
                    inline: true,
                },
                DiscordEmbedField {
                    name: "Status".to_string(),
                    value: "Online & Ready".to_string(),
                    inline: true,
                },
            ],
            footer: Some(DiscordFooter {
                text: "SageBot • Automated Valorant Companion".to_string(),
            }),
        }],
    };

    let client = reqwest::Client::new();
    let resp = client.post(webhook_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send webhook: {}", e))?;

    if resp.status().is_success() {
        Ok("Webhook test successful!".to_string())
    } else {
        Err(format!("Discord returned status {}", resp.status()))
    }
}

pub async fn send_match_notification(
    webhook_url: &str,
    user_id: &str,
    title: &str,
    description: &str,
    color: u32,
) -> Result<(), String> {
    if webhook_url.trim().is_empty() {
        return Ok(());
    }

    let mention = if !user_id.trim().is_empty() {
        Some(format!("<@{}>", user_id.trim()))
    } else {
        None
    };

    let payload = DiscordWebhookPayload {
        username: "SageBot".to_string(),
        avatar_url: Some("https://raw.githubusercontent.com/hexeth/sagebot/main/assets/sage.ico".to_string()),
        content: mention,
        embeds: vec![DiscordEmbed {
            title: title.to_string(),
            description: description.to_string(),
            color,
            fields: vec![],
            footer: Some(DiscordFooter {
                text: "SageBot • Match Tracker".to_string(),
            }),
        }],
    };

    let client = reqwest::Client::new();
    let _ = client.post(webhook_url).json(&payload).send().await;
    Ok(())
}
