use serde::Serialize;

#[derive(Serialize)]
struct DiscordWebhookPayload {
    username: String,
    avatar_url: Option<String>,
    content: Option<String>,
}

/// Send a Direct Message to a user via Discord Bot Token
pub async fn send_bot_dm(bot_token: &str, user_id: &str, message: &str) -> Result<String, String> {
    let token = bot_token.trim();
    let uid = user_id.trim();
    if token.is_empty() || uid.is_empty() {
        return Err("Bot Token or User ID is empty".to_string());
    }

    let client = reqwest::Client::new();
    let auth_header = format!("Bot {}", token);

    // 1. Create or get existing DM channel with user_id
    let dm_resp = client.post("https://discord.com/api/v10/users/@me/channels")
        .header("Authorization", &auth_header)
        .json(&serde_json::json!({
            "recipient_id": uid
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to open DM channel: {}", e))?;

    if !dm_resp.status().is_success() {
        let err_text = dm_resp.text().await.unwrap_or_default();
        return Err(format!("Discord DM channel error: {}", err_text));
    }

    let dm_json: serde_json::Value = dm_resp.json().await
        .map_err(|e| format!("Failed to parse DM response: {}", e))?;

    let channel_id = dm_json.get("id").and_then(|i| i.as_str())
        .ok_or_else(|| "Missing DM channel ID".to_string())?;

    // 2. Send message into the DM channel
    let msg_url = format!("https://discord.com/api/v10/channels/{}/messages", channel_id);
    let send_resp = client.post(&msg_url)
        .header("Authorization", &auth_header)
        .json(&serde_json::json!({
            "content": message
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to send DM: {}", e))?;

    if send_resp.status().is_success() {
        Ok("DM delivered successfully!".to_string())
    } else {
        let err_text = send_resp.text().await.unwrap_or_default();
        Err(format!("Discord message send error: {}", err_text))
    }
}

/// Test Discord Connection (tests Bot DM if bot_token is provided, and/or Webhook if webhook_url is provided)
pub async fn send_discord_test(
    webhook_url: &str,
    bot_token: &str,
    user_id: &str,
) -> Result<String, String> {
    let mut successes = Vec::new();
    let mut errors = Vec::new();

    // 1. Test Bot DM if configured
    if !bot_token.trim().is_empty() && !user_id.trim().is_empty() {
        let dm_msg = "Testing 1 2 3.";
        match send_bot_dm(bot_token, user_id, dm_msg).await {
            Ok(_) => successes.push("Bot DM sent"),
            Err(e) => errors.push(format!("Bot DM failed ({})", e)),
        }
    }

    // 2. Test Webhook if configured
    if !webhook_url.trim().is_empty() {
        let text = if !user_id.trim().is_empty() {
            format!("<@{}> Sagebot says Hello World! Discord Webhook is working!", user_id.trim())
        } else {
            "Sagebot says Hello World! Discord Webhook is working!".to_string()
        };

        let payload = DiscordWebhookPayload {
            username: "SageBot".to_string(),
            avatar_url: Some("https://raw.githubusercontent.com/hexeth/sagebot/main/assets/sage.ico".to_string()),
            content: Some(text),
        };

        let client = reqwest::Client::new();
        match client.post(webhook_url).json(&payload).send().await {
            Ok(resp) if resp.status().is_success() => successes.push("Webhook message sent"),
            Ok(resp) => errors.push(format!("Webhook status {}", resp.status())),
            Err(e) => errors.push(format!("Webhook error ({})", e)),
        }
    }

    if successes.is_empty() && errors.is_empty() {
        return Err("Please configure either a Bot Token + User ID or a Webhook URL first.".to_string());
    }

    if !successes.is_empty() {
        let note = if !errors.is_empty() {
            format!(" (Note: {})", errors.join(", "))
        } else {
            String::new()
        };
        Ok(format!("{}{}", successes.join(" & "), note))
    } else {
        Err(errors.join("; "))
    }
}

/// Send notification through both Bot DM and Webhook (whichever are configured)
pub async fn send_unified_discord_notification(
    webhook_url: &str,
    bot_token: &str,
    user_id: &str,
    message: &str,
) -> Result<(), String> {
    // 1. Send via Bot DM
    if !bot_token.trim().is_empty() && !user_id.trim().is_empty() {
        let _ = send_bot_dm(bot_token, user_id, message).await;
    }

    // 2. Send via Webhook URL
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

        let client = reqwest::Client::new();
        let _ = client.post(webhook_url).json(&payload).send().await;
    }

    Ok(())
}

/// Backward compatibility alias
pub async fn send_match_notification(
    webhook_url: &str,
    user_id: &str,
    message: &str,
) -> Result<(), String> {
    send_unified_discord_notification(webhook_url, "", user_id, message).await
}
