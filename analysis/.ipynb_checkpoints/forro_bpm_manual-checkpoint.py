import argparse
import subprocess
from pathlib import Path

import numpy as np
import librosa
from scipy.signal import butter, sosfiltfilt


# ---------------------------
# FFmpeg / áudio
# ---------------------------
def extract_audio_to_wav(video_path: str, wav_path: str, sr: int = 22050):
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-y", "-i", video_path, "-vn",
        "-ac", "1", "-ar", str(sr),
        "-c:a", "pcm_s16le", wav_path
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
# Filtros / Onset forró-friendly
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
# Encontrar primeiro compasso / tempo forte (downbeat)
# ---------------------------
def score_beats(onset_env, beat_frames, weights=None):
    beat_frames = np.array(beat_frames, dtype=int)
    beat_frames = beat_frames[(beat_frames >= 0) & (beat_frames < len(onset_env))]
    if len(beat_frames) == 0:
        return -1e9

    vals = onset_env[beat_frames]
    if weights is None or len(weights) != len(vals):
        return float(np.mean(vals))
    return float(np.sum(vals * weights) / (np.sum(weights) + 1e-9))


def find_best_downbeat_offset(onset_env, sr, bpm, beats_per_bar=4, hop_length=512, search_seconds=25):
    frame_rate = sr / hop_length
    period_sec = 60.0 / float(bpm)
    period_frames = period_sec * frame_rate

    max_frames = len(onset_env)
    search_frames = int(min(max_frames, search_seconds * frame_rate))

    step = max(1, int(round(period_frames / 24)))  # ~ 1/24 de beat
    best = None

    for offset in range(0, int(period_frames), step):
        beats = []
        t = offset
        while t < search_frames:
            beats.append(int(round(t)))
            t += period_frames

        if len(beats) < beats_per_bar * 3:
            continue

        downbeats = beats[::beats_per_bar]
        s = score_beats(onset_env, downbeats, weights=np.ones(len(downbeats), dtype=float))
        mid = score_beats(onset_env, beats)
        final = s + 0.35 * mid

        if (best is None) or (final > best["final"]):
            best = {"offset_frames": offset, "final": final}

    if best is None:
        raise RuntimeError("Não consegui achar um downbeat consistente. Tente aumentar search_seconds ou ajustar bpm.")

    offset_frames = best["offset_frames"]
    downbeat_time = float(offset_frames / frame_rate)

    total_sec = (len(onset_env) / frame_rate)
    beat_times = np.arange(downbeat_time, total_sec, period_sec, dtype=float)

    return downbeat_time, beat_times


# ---------------------------
# ASS subtitles (sem piscar e sem sobreposição)
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


def write_ass_bottom_cs(ass_path: str, events_cs, play_res=(1920, 1080), font="Arial", fontsize=44):
    """
    events_cs: list of (start_cs, end_cs, text)
    """
    w, h = play_res
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
; Alignment=2 => centralizado embaixo (posição fixa)
Style: Hud,{font},{fontsize},&H00FFFFFF,&H000000FF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,3,1,2,40,40,28,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [header]

    for st_cs, et_cs, txt in events_cs:
        if et_cs <= st_cs:
            et_cs = st_cs + 1
        lines.append(
            f"Dialogue: 0,{_ass_time_from_cs(st_cs)},{_ass_time_from_cs(et_cs)},Hud,,0,0,0,,{txt}"
        )

    Path(ass_path).write_text("\n".join(lines), encoding="utf-8")


# ---------------------------
# Render: cortar e queimar contador
# ---------------------------
def ffmpeg_trim(video_in, video_out, start_time):
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-y",
        "-ss", f"{start_time:.3f}",
        "-i", video_in,
        "-c", "copy",
        video_out
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True, help="Caminho do mp4")
    ap.add_argument("--bpm", required=True, type=float, help="BPM que você quer testar (manual)")
    ap.add_argument("--search-seconds", type=int, default=25, help="Janela inicial para achar o primeiro tempo forte")
    ap.add_argument("--trim-from-downbeat", action="store_true", help="Corta o vídeo a partir do primeiro compasso encontrado")
    ap.add_argument("--out", default="output_hud.mp4", help="Arquivo de saída")
    ap.add_argument("--font", default="Arial", help="Fonte do overlay")
    ap.add_argument("--fontsize", type=int, default=44, help="Tamanho da fonte do overlay")
    args = ap.parse_args()

    video_file = args.video
    if not Path(video_file).exists():
        raise FileNotFoundError(video_file)

    tmp_wav = "audio_tmp.wav"
    tmp_ass = "hud.ass"
    tmp_trim = "trimmed.mp4"

    # Fixo para seu caso: 1-2-3-4 = um compasso (1 e 3 são tempos)
    beats_per_bar = 4

    # 1) extrai áudio e onset
    extract_audio_to_wav(video_file, tmp_wav, sr=22050)
    y, sr = librosa.load(tmp_wav, sr=22050)

    hop_length = 512
    onset_env = compute_onset_env_forro(y, sr, hop_length=hop_length)

    # 2) downbeat + beat grid (BPM fixo)
    downbeat_time, beat_times = find_best_downbeat_offset(
        onset_env, sr, bpm=args.bpm,
        beats_per_bar=beats_per_bar,
        hop_length=hop_length,
        search_seconds=args.search_seconds
    )

    video_dur = get_video_duration_sec(video_file)
    dur_cs = int(np.floor(video_dur * 100.0))

    print(f"[OK] BPM fixado: {args.bpm:.2f}")
    print(f"[OK] Primeiro compasso (tempo forte) em: {downbeat_time:.3f}s")
    print(f"[OK] Batidas geradas: {len(beat_times)} | beats_per_bar={beats_per_bar}")

    # 3) Constrói timeline em centésimos SEM overlap:
    #    end_cs[i] = start_cs[i+1]
    start_cs = (np.floor(beat_times * 100.0)).astype(int)
    start_cs = start_cs[start_cs < dur_cs]  # só dentro do vídeo

    # remove duplicatas (pode acontecer por arredondamento)
    start_cs = np.unique(start_cs)

    events_cs = []
    for i, st in enumerate(start_cs):
        et = start_cs[i + 1] if (i + 1 < len(start_cs)) else dur_cs

        compasso = (i // beats_per_bar) + 1
        beat = (i % beats_per_bar) + 1
        txt = f"Compasso: {compasso} | Beat: {beat}"

        events_cs.append((int(st), int(et), txt))

    # 4) Trim opcional (rebase de tempo)
    if args.trim_from_downbeat:
        ffmpeg_trim(video_file, tmp_trim, downbeat_time)

        # rebase em cs
        shift = int(np.floor(downbeat_time * 100.0))
        events_rel = []
        for st, et, txt in events_cs:
            if et <= shift:
                continue
            st2 = max(0, st - shift)
            et2 = max(0, et - shift)
            events_rel.append((st2, et2, txt))

        write_ass_bottom_cs(tmp_ass, events_rel, font=args.font, fontsize=args.fontsize)
        ffmpeg_burn_subs(tmp_trim, tmp_ass, args.out)
    else:
        write_ass_bottom_cs(tmp_ass, events_cs, font=args.font, fontsize=args.fontsize)
        ffmpeg_burn_subs(video_file, tmp_ass, args.out)

    print("[DONE] Gerado:", args.out)


if __name__ == "__main__":
    main()
