import argparse
import subprocess
from pathlib import Path

import numpy as np
import librosa
from scipy.signal import butter, sosfiltfilt, medfilt


# ---------------------------
# FFmpeg
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


# ---------------------------
# Audio helpers
# ---------------------------
def bandpass(y, sr, low=30, high=250, order=4):
    nyq = 0.5 * sr
    low /= nyq
    high /= nyq
    sos = butter(order, [low, high], btype="bandpass", output="sos")
    return sosfiltfilt(sos, y)


def compute_onset_env_forro(y, sr, hop_length=512):
    """
    Onset robusto para forró em gravação de baile:
    - HPSS para pegar percussão
    - bandpass no grave (zabumba)
    - combina onset grave + onset percussão geral (triângulo/ataques)
    """
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
# Beats que seguem variação de BPM (PLP + peak picking)
# ---------------------------
def detect_beats_variable_tempo(onset_env, sr, hop_length=512):
    """
    Usa PLP (predominant local pulse) para obter uma curva de pulso contínua,
    depois extrai picos -> beat_times. Isso acompanha variações de tempo melhor
    do que um BPM fixo.
    """
    # PLP: curva suave de pulso
    pulse = librosa.beat.plp(onset_envelope=onset_env, sr=sr, hop_length=hop_length)

    # peak picking nos picos do pulso
    # Parâmetros funcionam bem na prática; se precisar, ajustamos.
    peaks = librosa.util.peak_pick(
        pulse,
        pre_max=3, post_max=3,
        pre_avg=3, post_avg=3,
        delta=0.02,
        wait=3
    )

    beat_times = librosa.frames_to_time(peaks, sr=sr, hop_length=hop_length)

    # remove beats muito próximos (ruído/picos duplicados)
    if len(beat_times) >= 2:
        ibi = np.diff(beat_times)
        median_ibi = np.median(ibi)
        # filtra intervalos absurdamente curtos
        keep = [True]
        for d in ibi:
            keep.append(d > max(0.18, 0.35 * median_ibi))  # limite prático
        beat_times = beat_times[np.array(keep, dtype=bool)]

    return beat_times, pulse


# ---------------------------
# BPM local (curva) a partir dos beats
# ---------------------------
def bpm_curve_from_beats(beat_times, window_beats=9):
    """
    BPM local por janela deslizante centrada em cada beat.
    window_beats ímpar recomendado (ex: 7, 9, 11).
    """
    if len(beat_times) < window_beats:
        return np.array([]), np.array([])

    half = window_beats // 2
    t_out = []
    bpm_out = []

    for i in range(half, len(beat_times) - half):
        w = beat_times[i - half:i + half + 1]
        ibi = np.diff(w)
        if np.any(ibi <= 0):
            continue
        bpm = 60.0 / np.median(ibi)
        t_center = beat_times[i]
        t_out.append(t_center)
        bpm_out.append(bpm)

    t_out = np.array(t_out)
    bpm_out = np.array(bpm_out)

    # suaviza (mediana) pra reduzir “serrilhado”
    if len(bpm_out) >= 7:
        bpm_out = medfilt(bpm_out, kernel_size=7)

    return t_out, bpm_out


# ---------------------------
# Descobrir tempo forte (offset do "1")
# ---------------------------
def estimate_downbeat_offset(beat_times, onset_env, sr, hop_length, beats_per_bar=2, analyze_first_seconds=30):
    """
    Para forró: beats_per_bar geralmente 2 (1-2).
    Heurística:
    - pega beats no começo
    - mede força do onset nos beats
    - testa offsets 0..beats_per_bar-1 e escolhe o que maximiza força nos downbeats
    """
    if len(beat_times) < beats_per_bar * 4:
        return 0

    # limita ao começo
    bt = beat_times[beat_times <= analyze_first_seconds]
    if len(bt) < beats_per_bar * 4:
        bt = beat_times[:beats_per_bar * 8]

    beat_frames = librosa.time_to_frames(bt, sr=sr, hop_length=hop_length)
    beat_frames = beat_frames[(beat_frames >= 0) & (beat_frames < len(onset_env))]
    strengths = onset_env[beat_frames]

    best_offset = 0
    best_score = -1e9
    for off in range(beats_per_bar):
        down_idx = np.arange(off, len(strengths), beats_per_bar)
        score = float(np.mean(strengths[down_idx])) if len(down_idx) else -1e9
        if score > best_score:
            best_score = score
            best_offset = off

    return int(best_offset)


# ---------------------------
# ASS
# ---------------------------
def fmt_ass_time(t: float) -> str:
    if t < 0:
        t = 0.0
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    cs = int(round((s - int(s)) * 100))
    return f"{h}:{m:02d}:{int(s):02d}.{cs:02d}"


def write_ass(ass_path: str, events, play_res=(1920, 1080), font="Arial", fontsize=88):
    w, h = play_res
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Counter,{font},{fontsize},&H00FFFFFF,&H000000FF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,5,1,5,40,40,70,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [header]
    for (st, et, txt) in events:
        lines.append(f"Dialogue: 0,{fmt_ass_time(st)},{fmt_ass_time(et)},Counter,,0,0,0,,{txt}")
    Path(ass_path).write_text("\n".join(lines), encoding="utf-8")


# ---------------------------
# Main
# ---------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--out", default="output_count.mp4")
    ap.add_argument("--beats-per-bar", type=int, default=2, help="Forró: 2 (1-2). Se quiser 1-4, use 4.")
    ap.add_argument("--hold-ms", type=int, default=220)
    ap.add_argument("--export-bpm-csv", default="", help="Opcional: salva curva de BPM local em CSV")
    args = ap.parse_args()

    video_file = args.video
    if not Path(video_file).exists():
        raise FileNotFoundError(video_file)

    tmp_wav = "audio_tmp.wav"
    tmp_ass = "counter.ass"

    # 1) extrai áudio
    extract_audio_to_wav(video_file, tmp_wav, sr=22050)
    y, sr = librosa.load(tmp_wav, sr=22050)

    hop_length = 512

    # 2) onset robusto pra forró
    onset_env = compute_onset_env_forro(y, sr, hop_length=hop_length)

    # 3) beats que seguem variação (PLP)
    beat_times, pulse = detect_beats_variable_tempo(onset_env, sr, hop_length=hop_length)
    if len(beat_times) < 8:
        raise RuntimeError("Poucas batidas detectadas. Tente um trecho com mais música e menos conversa/ruído.")

    # 4) BPM global “estimado” (mediana dos intervalos) — só para referência
    ibi = np.diff(beat_times)
    bpm_global = 60.0 / np.median(ibi)
    print(f"[INFO] BPM global (mediana IBI): {bpm_global:.2f}")
    print(f"[INFO] Beats detectados: {len(beat_times)}")

    # 5) curva de BPM local
    t_bpm, bpm_local = bpm_curve_from_beats(beat_times, window_beats=9)
    if len(bpm_local):
        print(f"[INFO] BPM local: min={bpm_local.min():.1f}  med={np.median(bpm_local):.1f}  max={bpm_local.max():.1f}")

    # 6) estima offset do "1" (tempo forte) e começa contagem nele
    offset = estimate_downbeat_offset(
        beat_times, onset_env, sr, hop_length,
        beats_per_bar=args.beats_per_bar,
        analyze_first_seconds=30
    )
    print(f"[INFO] Offset do tempo forte (1): {offset} (0..{args.beats_per_bar-1})")

    # 7) cria eventos do contador usando BEAT_TIMES (segue variação naturalmente)
    hold = args.hold_ms / 1000.0
    events = []
    for i, t in enumerate(beat_times):
        # aplica offset: o beat que vira "1" muda
        idx = i - offset
        n = (idx % args.beats_per_bar) + 1
        events.append((float(t), float(t + hold), str(n)))

    write_ass(tmp_ass, events)

    # 8) queima no vídeo
    ffmpeg_burn_subs(video_file, tmp_ass, args.out)
    print("[DONE] Gerado:", args.out)

    # 9) export opcional da curva de BPM local
    if args.export_bpm_csv and len(bpm_local):
        out = Path(args.export_bpm_csv)
        lines = ["time_sec,bpm_local"]
        for t, b in zip(t_bpm, bpm_local):
            lines.append(f"{t:.3f},{b:.3f}")
        out.write_text("\n".join(lines), encoding="utf-8")
        print("[DONE] BPM local CSV:", str(out))


if __name__ == "__main__":
    main()
