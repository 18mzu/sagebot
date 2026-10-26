use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use base64::Engine;
use crate::valorant::{LockfileData, discover_client_version, discover_glz_host};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct StoreDailyOffer {
    pub offer_id: String,
    pub skin_name: String,
    pub weapon_name: String,
    pub icon_url: String,
    pub cost_vp: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct StoreBundleItem {
    pub item_id: String,
    pub name: String,
    pub icon_url: String,
    pub base_price: u32,
    pub discounted_price: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct StoreFeaturedBundle {
    pub bundle_id: String,
    pub name: String,
    pub display_icon: String,
    pub total_cost_vp: u32,
    pub seconds_remaining: u64,
    pub items: Vec<StoreBundleItem>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct StoreNightMarketOffer {
    pub offer_id: String,
    pub skin_name: String,
    pub icon_url: String,
    pub discount_percent: u32,
    pub original_cost_vp: u32,
    pub discounted_cost_vp: u32,
    pub is_purchased: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct StoreAccessoryOffer {
    pub offer_id: String,
    pub item_id: String,
    pub name: String,
    pub item_type: String,
    pub icon_url: String,
    pub cost_kc: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct StorefrontData {
    pub daily_offers: Vec<StoreDailyOffer>,
    pub daily_seconds_remaining: u64,
    pub featured_bundles: Vec<StoreFeaturedBundle>,
    pub night_market_active: bool,
    pub night_market_offers: Vec<StoreNightMarketOffer>,
    pub night_market_seconds_remaining: u64,
    pub accessory_offers: Vec<StoreAccessoryOffer>,
    pub accessory_seconds_remaining: u64,
}

// In-memory cache for API items: (skin_name, icon_url)
static ITEM_META_CACHE: std::sync::OnceLock<Arc<RwLock<HashMap<String, (String, String)>>>> = std::sync::OnceLock::new();

fn get_item_meta_cache() -> &'static Arc<RwLock<HashMap<String, (String, String)>>> {
    ITEM_META_CACHE.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
}

// In-memory cache for Bundles: (name, icon_url)
static BUNDLE_META_CACHE: std::sync::OnceLock<Arc<RwLock<HashMap<String, (String, String)>>>> = std::sync::OnceLock::new();

fn get_bundle_meta_cache() -> &'static Arc<RwLock<HashMap<String, (String, String)>>> {
    BUNDLE_META_CACHE.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
}

// In-memory store data cache (TTL 60s)
static STORE_CACHE: std::sync::OnceLock<Arc<RwLock<Option<(std::time::Instant, StorefrontData)>>>> = std::sync::OnceLock::new();

fn get_store_cache() -> &'static Arc<RwLock<Option<(std::time::Instant, StorefrontData)>>> {
    STORE_CACHE.get_or_init(|| Arc::new(RwLock::new(None)))
}

async fn resolve_skin_level_meta(client: &reqwest::Client, uuid: &str) -> (String, String) {
    {
        let r = get_item_meta_cache().read().await;
        if let Some(meta) = r.get(uuid) {
            return meta.clone();
        }
    }

    let url = format!("https://valorant-api.com/v1/weapons/skinlevels/{}", uuid);
    if let Ok(resp) = client.get(&url).send().await {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let Some(data) = json.get("data") {
                let name = data.get("displayName").and_then(|v| v.as_str()).unwrap_or("Weapon Skin").to_string();
                let icon = data.get("displayIcon").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let meta = (name, icon);
                let mut w = get_item_meta_cache().write().await;
                w.insert(uuid.to_string(), meta.clone());
                return meta;
            }
        }
    }
    ("Weapon Skin".to_string(), format!("https://media.valorant-api.com/weaponskinlevels/{}/displayicon.png", uuid))
}

async fn resolve_bundle_meta(client: &reqwest::Client, uuid: &str) -> (String, String) {
    {
        let r = get_bundle_meta_cache().read().await;
        if let Some(meta) = r.get(uuid) {
            return meta.clone();
        }
    }

    let url = format!("https://valorant-api.com/v1/bundles/{}", uuid);
    if let Ok(resp) = client.get(&url).send().await {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let Some(data) = json.get("data") {
                let name = data.get("displayName").and_then(|v| v.as_str()).unwrap_or("Featured Collection").to_string();
                let icon = data.get("displayIcon").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let meta = (name, icon);
                let mut w = get_bundle_meta_cache().write().await;
                w.insert(uuid.to_string(), meta.clone());
                return meta;
            }
        }
    }
    ("Featured Collection".to_string(), format!("https://media.valorant-api.com/bundles/{}/displayicon.png", uuid))
}

// In-memory cache for Accessories: (name, item_type, icon_url)
static ACCESSORY_META_CACHE: std::sync::OnceLock<Arc<RwLock<HashMap<String, (String, String, String)>>>> = std::sync::OnceLock::new();

fn get_accessory_meta_cache() -> &'static Arc<RwLock<HashMap<String, (String, String, String)>>> {
    ACCESSORY_META_CACHE.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
}

async fn resolve_accessory_meta(client: &reqwest::Client, type_id: &str, item_id: &str) -> (String, String, String) {
    {
        let r = get_accessory_meta_cache().read().await;
        if let Some(meta) = r.get(item_id) {
            return meta.clone();
        }
    }

    let (item_type, url) = match type_id {
        "3f296c07-64c3-494c-923b-fe692a4fa1bd" => ("Player Card", format!("https://valorant-api.com/v1/playercards/{}", item_id)),
        "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475" => ("Spray", format!("https://valorant-api.com/v1/sprays/{}", item_id)),
        "dd3bf334-87f3-40bd-b043-682a57a8dc3a" => ("Gun Buddy", format!("https://valorant-api.com/v1/buddies/levels/{}", item_id)),
        "de7caa6b-adf7-4588-bbd1-143831e786c6" | "de7da39b-4523-42e8-a00e-c2ddf708686f" => ("Player Title", format!("https://valorant-api.com/v1/playertitles/{}", item_id)),
        _ => ("Accessory", String::new()),
    };

    if !url.is_empty() {
        if let Ok(resp) = client.get(&url).send().await {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(data) = json.get("data") {
                    let name = if item_type == "Player Title" {
                        data.get("titleText")
                            .or_else(|| data.get("displayName"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("Title")
                            .to_string()
                    } else {
                        data.get("displayName")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Accessory")
                            .to_string()
                    };

                    let icon = if item_type == "Spray" {
                        // Prioritize fullTransparentIcon so sprays aren't cropped square thumbnails
                        data.get("fullTransparentIcon")
                            .or_else(|| data.get("displayIcon"))
                            .or_else(|| data.get("fullIcon"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string()
                    } else if item_type == "Player Card" {
                        data.get("largeArt")
                            .or_else(|| data.get("displayIcon"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string()
                    } else {
                        data.get("displayIcon")
                            .or_else(|| data.get("largeArt"))
                            .or_else(|| data.get("fullTransparentIcon"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string()
                    };

                    let meta = (name, item_type.to_string(), icon);
                    let mut w = get_accessory_meta_cache().write().await;
                    w.insert(item_id.to_string(), meta.clone());
                    return meta;
                }
            }
        }
    }

    (format!("{} Item", item_type), item_type.to_string(), String::new())
}

pub async fn fetch_storefront_internal() -> Result<StorefrontData, String> {
    // 1. Check Store Cache
    {
        let r = get_store_cache().read().await;
        if let Some((instant, ref data)) = *r {
            if instant.elapsed() < std::time::Duration::from_secs(45) {
                return Ok(data.clone());
            }
        }
    }

    let lockfile = LockfileData::read_from_disk().map_err(|e| e.to_string())?;
    let client = reqwest::Client::builder().danger_accept_invalid_certs(true).build().map_err(|e| e.to_string())?;
    let auth = base64::engine::general_purpose::STANDARD.encode(format!("riot:{}", lockfile.password));
    let token_resp = client.get(format!("https://127.0.0.1:{}/entitlements/v1/token", lockfile.port))
        .header("Authorization", format!("Basic {}", auth))
        .send().await.map_err(|e| e.to_string())?;
    let token_json = token_resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())?;
    let puuid = token_json.get("subject").and_then(|s| s.as_str()).ok_or("No PUUID in token")?;
    let access_token = token_json.get("accessToken").and_then(|s| s.as_str()).ok_or("No accessToken")?;
    let jwt = token_json.get("token").and_then(|s| s.as_str()).ok_or("No JWT")?;

    let client_version = discover_client_version();
    let glz_host = discover_glz_host();
    let parts: Vec<&str> = glz_host.split('.').collect();
    let shard = if parts.len() >= 2 { parts[1] } else { "ap" };
    let pd_host = format!("pd.{}.a.pvp.net", shard);

    let store_url = format!("https://{}/store/v3/storefront/{}", pd_host, puuid);
    let store_req = client.post(&store_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .header("Content-Type", "application/json")
        .body("{}")
        .send().await.map_err(|e| e.to_string())?;

    let store_json = store_req.json::<serde_json::Value>().await.map_err(|e| e.to_string())?;

    // 1. Parse Daily Offers
    let mut daily_offers = Vec::new();
    let mut daily_seconds_remaining = 0;
    if let Some(panel) = store_json.get("SkinsPanelLayout") {
        daily_seconds_remaining = panel.get("SingleItemOffersRemainingDurationInSeconds").and_then(|v| v.as_u64()).unwrap_or(0);
        
        let mut prices_map: HashMap<String, u32> = HashMap::new();
        if let Some(offers_arr) = panel.get("SingleItemStoreOffers").and_then(|v| v.as_array()) {
            for o in offers_arr {
                if let Some(offer_id) = o.get("OfferID").and_then(|v| v.as_str()) {
                    let cost = o.get("Cost").and_then(|c| c.get("85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741")).and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                    prices_map.insert(offer_id.to_string(), cost);
                }
            }
        }

        if let Some(items) = panel.get("SingleItemOffers").and_then(|v| v.as_array()) {
            for item in items {
                if let Some(uuid) = item.as_str() {
                    let (name, icon) = resolve_skin_level_meta(&client, uuid).await;
                    let cost = prices_map.get(uuid).copied().unwrap_or(1775);
                    
                    let parts: Vec<&str> = name.split_whitespace().collect();
                    let weapon = parts.last().copied().unwrap_or("Weapon").to_string();

                    daily_offers.push(StoreDailyOffer {
                        offer_id: uuid.to_string(),
                        skin_name: name,
                        weapon_name: weapon,
                        icon_url: icon,
                        cost_vp: cost,
                    });
                }
            }
        }
    }

    // 2. Parse Featured Bundles
    let mut featured_bundles = Vec::new();
    if let Some(feat) = store_json.get("FeaturedBundle") {
        let bundle_duration_fallback = feat.get("BundleRemainingDurationInSeconds").and_then(|v| v.as_u64()).unwrap_or(0);
        
        // Check for multiple Bundles array, or single Bundle object
        let bundles_list: Vec<&serde_json::Value> = if let Some(arr) = feat.get("Bundles").and_then(|v| v.as_array()) {
            arr.iter().collect()
        } else if let Some(b) = feat.get("Bundle") {
            vec![b]
        } else {
            Vec::new()
        };

        for b in bundles_list {
            let bundle_id = b.get("ID").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let data_asset_id = b.get("DataAssetID").and_then(|v| v.as_str()).unwrap_or(&bundle_id);
            let (b_name, b_icon) = resolve_bundle_meta(&client, data_asset_id).await;

            let bundle_duration = b.get("DurationRemainingInSeconds")
                .and_then(|v| v.as_u64())
                .unwrap_or(bundle_duration_fallback);

            let mut items_list = Vec::new();
            let mut total_cost = 0;

            if let Some(items) = b.get("Items").and_then(|v| v.as_array()) {
                for it in items {
                    let base_price = it.get("BasePrice").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                    let disc_price = it.get("DiscountedPrice").and_then(|v| v.as_u64()).unwrap_or(base_price as u64) as u32;
                    total_cost += disc_price;

                    if let Some(it_obj) = it.get("Item") {
                        if let Some(item_id) = it_obj.get("ItemID").and_then(|v| v.as_str()) {
                            let (it_name, it_icon) = resolve_skin_level_meta(&client, item_id).await;
                            items_list.push(StoreBundleItem {
                                item_id: item_id.to_string(),
                                name: it_name,
                                icon_url: it_icon,
                                base_price,
                                discounted_price: disc_price,
                            });
                        }
                    }
                }
            }

            let total_cost = b.get("TotalDiscountedCost")
                .and_then(|v| v.as_u64())
                .map(|v| v as u32)
                .unwrap_or(total_cost);

            featured_bundles.push(StoreFeaturedBundle {
                bundle_id,
                name: b_name,
                display_icon: b_icon,
                total_cost_vp: total_cost,
                seconds_remaining: bundle_duration,
                items: items_list,
            });
        }
    }

    // 3. Parse Night Market (BonusStore)
    let mut night_market_active = false;
    let mut night_market_offers = Vec::new();
    let mut night_market_seconds_remaining = 0;
    if let Some(bonus) = store_json.get("BonusStore") {
        night_market_active = true;
        night_market_seconds_remaining = bonus.get("BonusStoreRemainingDurationInSeconds").and_then(|v| v.as_u64()).unwrap_or(0);
        if let Some(offers) = bonus.get("BonusStoreOffers").and_then(|v| v.as_array()) {
            for o in offers {
                let disc_pct = o.get("DiscountPercent").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                let orig_cost = o.get("Offer").and_then(|of| of.get("Cost")).and_then(|c| c.get("85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741")).and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                let disc_cost = o.get("DiscountCosts").and_then(|c| c.get("85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741")).and_then(|v| v.as_u64()).unwrap_or(orig_cost as u64) as u32;
                let is_purchased = o.get("IsPurchased").and_then(|v| v.as_bool()).unwrap_or(false);
                let offer_id = o.get("BonusOfferID").and_then(|v| v.as_str()).unwrap_or("").to_string();

                let mut skin_name = "Night Market Offer".to_string();
                let mut icon_url = "".to_string();
                if let Some(rewards) = o.get("Offer").and_then(|of| of.get("Rewards")).and_then(|r| r.as_array()) {
                    if let Some(first_r) = rewards.first() {
                        if let Some(item_id) = first_r.get("ItemID").and_then(|v| v.as_str()) {
                            let (name, icon) = resolve_skin_level_meta(&client, item_id).await;
                            skin_name = name;
                            icon_url = icon;
                        }
                    }
                }

                night_market_offers.push(StoreNightMarketOffer {
                    offer_id,
                    skin_name,
                    icon_url,
                    discount_percent: disc_pct,
                    original_cost_vp: orig_cost,
                    discounted_cost_vp: disc_cost,
                    is_purchased,
                });
            }
        }
    }

    // 4. Parse Accessory Store
    let mut accessory_offers = Vec::new();
    let mut accessory_seconds_remaining = 0;
    if let Some(acc) = store_json.get("AccessoryStore") {
        accessory_seconds_remaining = acc.get("AccessoryStoreRemainingDurationInSeconds").and_then(|v| v.as_u64()).unwrap_or(0);
        if let Some(offers) = acc.get("AccessoryStoreOffers").and_then(|v| v.as_array()) {
            for o in offers {
                let contract_id = o.get("ContractID").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let cost_kc = o.get("Offer").and_then(|of| of.get("Cost")).and_then(|c| c.get("85ca954a-41f2-ce94-9b45-8ca3dd39a00d")).and_then(|v| v.as_u64()).unwrap_or(4000) as u32;
                
                let mut item_id = "".to_string();
                let mut type_id = "".to_string();
                if let Some(rewards) = o.get("Offer").and_then(|of| of.get("Rewards")).and_then(|r| r.as_array()) {
                    if let Some(first_r) = rewards.first() {
                        item_id = first_r.get("ItemID").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        type_id = first_r.get("ItemTypeID").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    }
                }

                let (name, item_type, icon_url) = resolve_accessory_meta(&client, &type_id, &item_id).await;

                accessory_offers.push(StoreAccessoryOffer {
                    offer_id: contract_id,
                    item_id,
                    name,
                    item_type,
                    icon_url,
                    cost_kc,
                });
            }
        }
    }

    let result = StorefrontData {
        daily_offers,
        daily_seconds_remaining,
        featured_bundles,
        night_market_active,
        night_market_offers,
        night_market_seconds_remaining,
        accessory_offers,
        accessory_seconds_remaining,
    };

    let mut w = get_store_cache().write().await;
    *w = Some((std::time::Instant::now(), result.clone()));

    Ok(result)
}

#[tauri::command]
pub async fn get_storefront() -> Result<StorefrontData, String> {
    fetch_storefront_internal().await
}
