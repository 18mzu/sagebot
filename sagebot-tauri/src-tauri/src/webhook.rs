use crate::valorant::shared_public_http_client;
use serde::Serialize;

#[derive(Serialize)]
struct DiscordWebhookPayload {
    username: String,
    avatar_url: Option<String>,
    content: Option<String>,
}

/// Send notification through Discord Webhook URL
pub async fn send_unified_discord_notification(
    webhook_url: &str,
    _bot_token: &str,
    user_id: &str,
    message: &str,
) -> Result<(), String> {
    if !webhook_url.trim().is_empty() {
        let text = if !user_id.trim().is_empty() {
            format!("<@{}> {}", user_id.trim(), message)
        } else {
            message.to_string()
        };

        let payload = DiscordWebhookPayload {
            username: "SageBot".to_string(),
            avatar_url: Some("https://raw.githubusercontent.com/hexeth/sagebot/main/assets/sage.ico".to_string()),
            content: Some(text),
        };

        let _ = shared_public_http_client()
            .post(webhook_url)
            .json(&payload)
            .send()
            .await;
    }

    Ok(())
}
