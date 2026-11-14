import React from "react";
import { Clock, RefreshCw, Sparkles } from "lucide-react";
import type { StorefrontData } from "../types/sagebot";

interface SkinRarityInfo {
  name: string;
  color: string;
  glow: string;
  icon: string;
}

interface ShopTabProps {
  isStoreLoading: boolean;
  storefront: StorefrontData | null;
  selectedBundleIdx: number;
  setSelectedBundleIdx: (idx: number) => void;
  formatDuration: (seconds: number) => string;
  getSkinRarity: (costVp: number, skinName?: string) => SkinRarityInfo;
  onRetryStorefront: () => void;
}

export const ShopTab: React.FC<ShopTabProps> = ({
  isStoreLoading,
  storefront,
  selectedBundleIdx,
  setSelectedBundleIdx,
  formatDuration,
  getSkinRarity,
  onRetryStorefront,
}) => (
  <div className="tab-pane shop-tab-pane">
    {isStoreLoading && !storefront ? (
      <div className="shop-loading-card">
        <RefreshCw size={24} className="spin" style={{ color: "#a855f7" }} />
        <span>Taking a look at the shop...</span>
      </div>
    ) : storefront ? (
      <div className="shop-container">
        {/* 1. FEATURED BUNDLE */}
        {storefront.featured_bundles.length > 0 && (() => {
          const currentBundle = storefront.featured_bundles[selectedBundleIdx] || storefront.featured_bundles[0];
          return (
            <div className="shop-featured-wrapper">
              {storefront.featured_bundles.length > 1 && (
                <div className="featured-bundle-tabs-bar">
                  <span className="featured-tabs-heading">FEATURED COLLECTIONS</span>
                  <div className="featured-bundle-tabs-outside">
                    {storefront.featured_bundles.map((b, idx) => (
                      <button
                        key={b.bundle_id || idx}
                        className={`bundle-tab-btn-outside ${idx === selectedBundleIdx ? "active" : ""}`}
                        onClick={() => setSelectedBundleIdx(idx)}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="shop-featured-card">
                <div className="featured-banner-wrap">
                  {storefront.featured_bundles.map((b, idx) => (
                    <img
                      key={b.bundle_id || idx}
                      src={b.display_icon}
                      className={`featured-banner-img ${idx === selectedBundleIdx ? "active" : ""}`}
                      alt={b.name}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ))}

                  <div className="featured-banner-overlay" />

                  <div className="featured-content-top-left">
                    <div className="featured-timer-badge">
                      <Clock size={12} />
                      <span>FEATURED | {formatDuration(currentBundle.seconds_remaining)}</span>
                    </div>
                    <h1 className="featured-title">{currentBundle.name}</h1>
                    <div className="featured-collection-tag">COLLECTION</div>
                  </div>

                  <div
                    className="featured-price-badge featured-price-bottom-right"
                    data-tooltip={`Bundle Price: ${currentBundle.total_cost_vp.toLocaleString()} VP`}
                  >
                    <img
                      src="https://media.valorant-api.com/currencies/85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741/displayicon.png"
                      className="currency-logo-sm"
                      alt="VP"
                    />
                    <span>{currentBundle.total_cost_vp.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 2. DAILY 4-GUN ROTATING OFFERS */}
        <div className="shop-section">
          <div className="shop-section-header">
            <div className="section-title-line" />
            <div className="section-title-center">
              <span className="section-title-text">DAILY OFFERS</span>
              <span className="section-timer-badge">
                <Clock size={12} />
                <span>{formatDuration(storefront.daily_seconds_remaining)}</span>
              </span>
            </div>
            <div className="section-title-line" />
          </div>

          <div className="daily-offers-grid">
            {storefront.daily_offers.map((offer) => {
              const rarity = getSkinRarity(offer.cost_vp, offer.skin_name);
              return (
                <div
                  key={offer.offer_id}
                  className="daily-offer-card"
                  style={{
                    borderColor: `${rarity.color}66`,
                    boxShadow: `0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px ${rarity.glow}`,
                  }}
                  data-tooltip={`${offer.skin_name} • ${rarity.name}`}
                >
                  <div
                    className="daily-offer-ambient-aura"
                    style={{
                      background: `radial-gradient(circle at 50% 120%, ${rarity.glow} 0%, transparent 72%)`,
                    }}
                  />
                  <div className="daily-offer-img-wrap">
                    {offer.icon_url ? (
                      <img
                        src={offer.icon_url}
                        className="daily-offer-img"
                        alt={offer.skin_name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="skin-placeholder">Weapon Skin</div>
                    )}
                  </div>
                  <div className="daily-offer-footer">
                    <div className="daily-offer-name-wrap">
                      <img
                        src={rarity.icon}
                        className="daily-offer-tier-icon"
                        alt={rarity.name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <span
                        className="daily-offer-name"
                        data-tooltip={offer.skin_name}
                      >
                        {offer.skin_name}
                      </span>
                    </div>
                    <div className="daily-offer-price" data-tooltip={`${offer.cost_vp.toLocaleString()} VP`}>
                      <img
                        src="https://media.valorant-api.com/currencies/85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741/displayicon.png"
                        className="currency-logo-xs"
                        alt="VP"
                      />
                      <span>{offer.cost_vp.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. NIGHT.MARKET (BONUS STORE) */}
        <div className="shop-section">
          <div className="shop-section-header">
            <div className="section-title-line" />
            <div className="section-title-center">
              <span className="section-title-text">NIGHT.MARKET</span>
              {storefront.night_market_active && (
                <span className="section-timer-badge">
                  <Clock size={12} />
                  <span>{formatDuration(storefront.night_market_seconds_remaining)}</span>
                </span>
              )}
            </div>
            <div className="section-title-line" />
          </div>

          {storefront.night_market_active && storefront.night_market_offers.length > 0 ? (
            <div className="night-market-grid">
              {storefront.night_market_offers.map((nm) => (
                <div key={nm.offer_id} className="night-market-card" data-tooltip={nm.skin_name}>
                  <div className="nm-discount-tag">-{nm.discount_percent}%</div>
                  <div className="nm-img-wrap">
                    <img src={nm.icon_url} className="nm-img" alt={nm.skin_name} />
                  </div>
                  <div className="nm-info">
                    <span className="nm-skin-name">{nm.skin_name}</span>
                    <div className="nm-prices">
                      <span className="nm-orig-price">{nm.original_cost_vp.toLocaleString()}</span>
                      <div className="nm-disc-price">
                        <img
                          src="https://media.valorant-api.com/currencies/85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741/displayicon.png"
                          className="currency-logo-xs"
                          alt="VP"
                        />
                        <span>{nm.discounted_cost_vp.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="shop-night-market-closed">
              <Sparkles size={20} className="nm-sparkle-icon" />
              <div className="nm-closed-content">
                <span className="nm-closed-title">Night.Market is Closed</span>
                <span className="nm-closed-sub">The Night.Market will return towards the conclusion of the Act.</span>
              </div>
            </div>
          )}
        </div>

        {/* 4. ACCESSORY STORE */}
        {storefront.accessory_offers.length > 0 && (
          <div className="shop-section">
            <div className="shop-section-header">
              <div className="section-title-line" />
              <div className="section-title-center">
                <span className="section-title-text">ACCESSORY STORE</span>
                <span className="section-timer-badge">
                  <Clock size={12} />
                  <span>{formatDuration(storefront.accessory_seconds_remaining)}</span>
                </span>
              </div>
              <div className="section-title-line" />
            </div>

            <div className="accessory-offers-grid">
              {storefront.accessory_offers.map((acc, idx) => (
                <div key={acc.offer_id || idx} className="accessory-offer-card" data-tooltip={`${acc.name} • ${acc.item_type}`}>
                  <div className="accessory-img-wrap">
                    {acc.icon_url ? (
                      <img
                        src={acc.icon_url}
                        className={`accessory-img ${acc.item_type === "Player Card" ? "is-card" : acc.item_type === "Spray" ? "is-spray" : ""}`}
                        alt={acc.name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="accessory-title-preview">
                        <div className="accessory-title-accent" />
                        <span className="accessory-title-text">"{acc.name}"</span>
                        <span className="accessory-title-tag">PLAYER TITLE</span>
                      </div>
                    )}
                  </div>
                  <div className="accessory-footer">
                    <span className="accessory-name-label" data-tooltip={acc.name}>{acc.name}</span>
                    <div className="accessory-price" data-tooltip={`${acc.cost_kc.toLocaleString()} KC`}>
                      <img
                        src="https://media.valorant-api.com/currencies/85ca954a-41f2-ce94-9b45-8ca3dd39a00d/displayicon.png"
                        className="currency-logo-xs"
                        alt="KC"
                      />
                      <span>{acc.cost_kc.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    ) : (
      <div className="shop-empty-card">
        <span>VALORANT Client is offline. Launch VALORANT to view your live store.</span>
        <button className="shop-retry-btn" onClick={onRetryStorefront}>
          <RefreshCw size={13} />
          <span>Retry</span>
        </button>
      </div>
    )}
  </div>
);
