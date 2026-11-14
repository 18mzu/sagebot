import React from "react";
import { Play } from "lucide-react";

interface MediaTabProps {
  musicDuration: number;
  musicCurrentTime: number;
  isPlayingMusic: boolean;
  musicVolume: number;
  isDraggingMusicRef: React.MutableRefObject<boolean>;
  onSeekInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSeekCommit: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  onTogglePlayMusic: () => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  formatTime: (secs: number) => string;
}

export const MediaTab: React.FC<MediaTabProps> = ({
  musicDuration,
  musicCurrentTime,
  isPlayingMusic,
  musicVolume,
  isDraggingMusicRef,
  onSeekInput,
  onSeekCommit,
  onTogglePlayMusic,
  onVolumeChange,
  formatTime,
}) => (
  <div className="tab-pane">
    <div className="card music-card">
      <div className="music-title">
        Mario Paint x Hey There Delilah x Closing Time x Cake by the Ocean x Patient Zero x Fitnessgram x Five Nights at Freddy&apos;s 1
      </div>

      <input
        type="range"
        className="music-slider"
        min="0"
        max={musicDuration > 0 ? musicDuration : 100}
        step="0.1"
        value={musicCurrentTime}
        onMouseDown={() => {
          isDraggingMusicRef.current = true;
        }}
        onTouchStart={() => {
          isDraggingMusicRef.current = true;
        }}
        onChange={onSeekInput}
        onMouseUp={onSeekCommit}
        onTouchEnd={onSeekCommit}
      />

      <div className="music-timestamp">
        {formatTime(musicCurrentTime)} / {formatTime(musicDuration)}
      </div>

      <div className="music-play-btn-wrapper">
        <button className="music-play-btn" onClick={onTogglePlayMusic}>
          {isPlayingMusic ? (
            <div className="pause-bars">
              <span></span>
              <span></span>
            </div>
          ) : (
            <Play size={20} fill="#8b5cf6" color="#8b5cf6" />
          )}
        </button>
      </div>

      <div className="volume-control-row">
        <span className="volume-label">
          Volume: {musicVolume}%
        </span>
        <input
          type="range"
          className="vol-slider"
          min="0"
          max="100"
          value={musicVolume}
          onChange={onVolumeChange}
        />
      </div>
    </div>
  </div>
);
