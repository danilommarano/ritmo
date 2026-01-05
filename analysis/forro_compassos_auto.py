import argparse
import subprocess
from pathlib import Path

import numpy as np
import librosa
from scipy.signal import butter, sosfiltfilt


# ---------------------------
# FFmpeg helpers
# ---------------------------
def extract_audio_to_wav(video_path: str, wav_path: str, sr: int = 22050):
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-y", "-i", video_path, "-vn",
        "-ac", "1", "-ar", str(sr),
        "-c:a", "pcm_s16le", wav_path
    ]
    subprocess.run(cmd, check=True)


def ffmpeg_burn_subs(video_in, ass_file, video_out):
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-y",
        "-i", video_in,
        "-vf", f"subtitles={ass_file}",
        "-c:a", "copy",
        video_out
    ]
    subprocess.run(cmd, check=True)


def get_video_duration_sec(video_path: str) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path
    ]
    out = subprocess.check_output(cmd).decode("utf-8").strip()
    return float(out)


# ---------------------------
# Forró-friendly onset
# ---------------------------
def bandpass(y, sr, low=30, high=250, order=4):
    nyq = 0.5 * sr
    low /= nyq
    high /= nyq
    sos = butter(order, [low, high], btype="bandpass", output="sos")
    return sosfiltfilt(sos, y)


def compute_onset_env_forro(y, sr, hop_length=512):
    y = y - np.mean(y)
    y = librosa.util.normalize(y)

    _, y_perc = librosa.effects.hpss(y)
    y_low = bandpass(y_perc, sr, low=30, high=250)

    onset_low = librosa.onset.onset_strength(
        y=y_low, sr=sr, hop_length=hop_length,
        n_fft=1024, n_mels=32
    )
    onset_all = librosa.onset.onset_strength(
        y=y_perc, sr=sr, hop_length=hop_length,
        n_fft=1024, n_mels=64
    )

    onset_env = librosa.util.normalize(onset_low) + 0.6 * librosa.util.normalize(onset_all)
    onset_env = librosa.util.normalize(onset_env)
    return onset_env


# ---------------------------
# Beats (PLP)
# ---------------------------
def detect_beats_plp(onset_env, sr, hop_length=512):
    pulse = librosa.beat.plp(onset_envelope=onset_env, sr=sr, hop_length=hop_length)

    peaks = librosa.util.peak_pick(
        pulse,
        pre_max=3, post_max=3,
        pre_avg=3, post_avg=3,
        delta=0.02,
        wait=3
    )

    beat_times = librosa.frames_to_time(peaks, sr=sr, hop_length=hop_length)

    # remove duplicatas e beats muito próximos
    if len(beat_times) >= 2:
        ibi = np.diff(beat_times)
        med = np.median(ibi)
        keep = [True]
        for d in ibi:
            keep.append(d > max(0.18, 0.35 * med))
        beat_times = beat_times[np.array(keep, dtype=bool)]

    return beat_times


# ---------------------------
# Downbeat offset heurístico
# ---------------------------
def estimate_downbeat_offset(beat_times, onset_env, sr, hop_length, beats_per_bar=4, analyze_first_seconds=35):
    if len(beat_times) < beats_per_bar * 6:
        return 0

    bt = beat_times[beat_times <= analyze_first_seconds]
    if len(bt) < beats_per_bar * 6:
        bt = beat_times[: beats_per_bar * 10]

    beat_frames = librosa.time_to_frames(bt, sr=sr, hop_length=hop_length)
    beat_frames = beat_frames[(beat_frames >= 0) & (beat_frames < len(onset_env))]
    if len(beat_frames) < beats_per_bar * 4:
        return 0

    strengths = onset_env[beat_frames]

    best_offset = 0
    best_score = -1e9
    for off in range(beats_per_bar):
        idx = np.arange(off, len(strengths), beats_per_bar)
        if len(idx) == 0:
            continue
        score = float(np.mean(strengths[idx]))
        if score > best_score:
            best_score = score
            best_offset = off

    return int(best_offset)


# ---------------------------
# ASS utils (eventos curtos)
# ---------------------------
def _ass_time_from_cs(cs: int) -> str:
    if cs < 0:
        cs = 0
    total_sec = cs / 100.0
    h = int(total_sec // 3600)
    m = int((total_sec % 3600) // 60)
    s = total_sec % 60
    c = int(round((s - int(s)) * 100))
    return f"{h}:{m:02d}:{int(s):02d}.{c:02d}"


def write_ass_marker(ass_path: str, marker_events_cs, play_res=(1920, 1080), font="Arial", fontsize=80):
    """
    marker_events_cs: list of (start_cs, end_cs) para mostrar o marcador.
    Posição fixa embaixo, central.
    """
    w, h = play_res
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
; Alignment=2 => centralizado embaixo
Style: Marker,{font},{fontsize},&H00FFFFFF,&H000000FF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,4,1,2,40,40,35,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [header]

    # marcador simples e bem visível
    # pode trocar por "●" ou "▼" se preferir
    marker_text = "●"

    for st_cs, et_cs in marker_events_cs:
        if et_cs <= st_cs:
            et_cs = st_cs + 1
        lines.append(
            f"Dialogue: 0,{_ass_time_from_cs(st_cs)},{_ass_time_from_cs(et_cs)},Marker,,0,0,0,,{marker_text}"
        )

    Path(ass_path).write_text("\n".join(lines), encoding="utf-8")


# ---------------------------
# Main
# ---------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--out", default="out_mark_compasso.mp4")
    ap.add_argument("--beats-per-bar", type=int, default=4, help="Assuma 4 subdivisões por compasso (ajuste se quiser testar)")
    ap.add_argument("--flash-ms", type=int, default=160, help="Duração do marcador (ms)")
    ap.add_argument("--font", default="Arial")
    ap.add_argument("--fontsize", type=int, default=80)
    ap.add_argument("--search-seconds", type=int, default=35)
    args = ap.parse_args()

    video_file = args.video
    if not Path(video_file).exists():
        raise FileNotFoundError(video_file)

    tmp_wav = "audio_tmp.wav"
    tmp_ass = "marker.ass"

    # 1) áudio + onset
    extract_audio_to_wav(video_file, tmp_wav, sr=22050)
    y, sr = librosa.load(tmp_wav, sr=22050)
    hop_length = 512
    onset_env = compute_onset_env_forro(y, sr, hop_length=hop_length)

    # 2) beats automáticos
    beat_times = detect_beats_plp(onset_env, sr, hop_length=hop_length)
    if len(beat_times) < args.beats_per_bar * 6:
        raise RuntimeError("Poucas batidas detectadas. Tente um trecho com mais música e menos conversa/ruído.")

    # 3) downbeats (início do compasso) por offset
    offset = estimate_downbeat_offset(
        beat_times, onset_env, sr, hop_length,
        beats_per_bar=args.beats_per_bar,
        analyze_first_seconds=args.search_seconds
    )
    downbeat_times = beat_times[offset::args.beats_per_bar]
    if len(downbeat_times) < 3:
        raise RuntimeError("Downbeats insuficientes. Tente mudar beats-per-bar ou aumentar search-seconds.")

    print(f"[OK] beats detectados: {len(beat_times)}")
    print(f"[OK] offset downbeat: {offset} (0..{args.beats_per_bar-1})")
    print(f"[OK] inícios de compasso (marcadores): {len(downbeat_times)}")

    # 4) eventos curtos (flash)
    dur = get_video_duration_sec(video_file)
    dur_cs = int(np.floor(dur * 100.0))
    flash_cs = max(5, int(round(args.flash_ms / 10.0)))  # 10ms = 1cs

    starts_cs = (np.floor(downbeat_times * 100.0)).astype(int)
    starts_cs = starts_cs[(starts_cs >= 0) & (starts_cs < dur_cs)]
    starts_cs = np.unique(starts_cs)

    marker_events = []
    for st in starts_cs:
        et = min(dur_cs, st + flash_cs)
        marker_events.append((int(st), int(et)))

    write_ass_marker(tmp_ass, marker_events, font=args.font, fontsize=args.fontsize)
    ffmpeg_burn_subs(video_file, tmp_ass, args.out)

    print("[DONE] Gerado:", args.out)


if __name__ == "__main__":
    main()
