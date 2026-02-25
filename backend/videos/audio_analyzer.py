"""Audio analysis utilities for beat detection and BPM estimation.

This module extracts audio from video files and analyzes it to detect
beats and estimate BPM using advanced multi-technique algorithms
optimized for low-quality audio from dance videos.

Key techniques:
- Multi-band onset detection (bass, mid, treble)
- Tempogram with autocorrelation for robust BPM estimation
- PLP (Predominant Local Pulse) for beat tracking
- Multi-candidate BPM validation
- Harmonic-Percussive Source Separation (HPSS)
"""
import os
import tempfile
import subprocess
import numpy as np
import librosa
import librosa.display
from scipy.signal import butter, sosfiltfilt, medfilt
from scipy.ndimage import uniform_filter1d


def extract_audio_from_video(video_path, output_path=None):
    """
    Extract audio from video file using FFmpeg.
    
    Args:
        video_path: Path to the video file
        output_path: Optional path for output audio file. If None, creates temp file.
        
    Returns:
        Path to the extracted audio file (WAV format)
    """
    if output_path is None:
        # Create temporary file for audio
        fd, output_path = tempfile.mkstemp(suffix='.wav')
        os.close(fd)
    
    try:
        # Extract audio using FFmpeg
        # Convert to mono, 22050 Hz sample rate (standard for librosa)
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-vn',  # No video
            '-acodec', 'pcm_s16le',  # PCM 16-bit
            '-ar', '22050',  # Sample rate
            '-ac', '1',  # Mono
            '-y',  # Overwrite output file
            output_path
        ]
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True
        )
        
        return output_path
        
    except subprocess.CalledProcessError as e:
        raise Exception(f'Failed to extract audio: {e.stderr.decode()}')


# =============================================================================
# ROBUST BPM DETECTION - Multi-technique approach for low-quality audio
# =============================================================================

def preprocess_audio(y, sr):
    """
    Preprocess audio for better beat detection in low-quality recordings.
    
    Applies:
    - DC offset removal
    - Normalization
    - Dynamic range compression (soft limiting)
    - High-pass filter to remove rumble
    """
    # Remove DC offset
    y = y - np.mean(y)
    
    # Normalize
    y = librosa.util.normalize(y)
    
    # Soft dynamic range compression to bring up quiet parts
    # This helps with recordings where the beat might be buried
    threshold = 0.3
    ratio = 0.5
    above_threshold = np.abs(y) > threshold
    y_compressed = y.copy()
    y_compressed[above_threshold] = np.sign(y[above_threshold]) * (
        threshold + (np.abs(y[above_threshold]) - threshold) * ratio
    )
    y = librosa.util.normalize(y_compressed)
    
    # High-pass filter to remove low rumble (below 20Hz)
    nyq = sr / 2
    low_cutoff = 20 / nyq
    if low_cutoff < 1:
        sos = butter(2, low_cutoff, btype='high', output='sos')
        y = sosfiltfilt(sos, y)
    
    return y


def compute_multiband_onset(y, sr, hop_length=512):
    """
    Compute onset envelope from multiple frequency bands.
    
    Splits audio into bass, mid, and treble bands and computes
    onset strength for each. Combines them with weights that
    emphasize rhythmic content.
    
    Returns:
        tuple: (combined_onset, onset_bass, onset_mid, onset_treble)
    """
    # Separate harmonic and percussive components
    y_harm, y_perc = librosa.effects.hpss(y)
    
    # Use percussive component for better beat detection
    y_use = y_perc
    
    # Band 1: Bass (30-200 Hz) - kick drum, bass
    y_bass = bandpass_filter(y_use, sr, low=30, high=200, order=4)
    onset_bass = librosa.onset.onset_strength(
        y=y_bass, sr=sr, hop_length=hop_length,
        n_fft=2048, n_mels=32, fmin=30, fmax=200
    )
    
    # Band 2: Mid (200-2000 Hz) - snare, claps, most instruments
    y_mid = bandpass_filter(y_use, sr, low=200, high=2000, order=4)
    onset_mid = librosa.onset.onset_strength(
        y=y_mid, sr=sr, hop_length=hop_length,
        n_fft=2048, n_mels=64, fmin=200, fmax=2000
    )
    
    # Band 3: Treble (2000-8000 Hz) - hi-hats, cymbals, triangle
    y_treble = bandpass_filter(y_use, sr, low=2000, high=min(8000, sr//2 - 100), order=4)
    onset_treble = librosa.onset.onset_strength(
        y=y_treble, sr=sr, hop_length=hop_length,
        n_fft=2048, n_mels=32, fmin=2000, fmax=8000
    )
    
    # Also compute onset from full percussive signal
    onset_full = librosa.onset.onset_strength(
        y=y_perc, sr=sr, hop_length=hop_length,
        n_fft=2048, n_mels=128
    )
    
    # Normalize each band
    onset_bass = librosa.util.normalize(onset_bass)
    onset_mid = librosa.util.normalize(onset_mid)
    onset_treble = librosa.util.normalize(onset_treble)
    onset_full = librosa.util.normalize(onset_full)
    
    # Combine with weights emphasizing bass (most reliable for beat)
    # Bass typically has the kick drum which marks the beat
    combined = (
        1.0 * onset_bass +      # Bass - primary beat source
        0.6 * onset_mid +       # Mid - snare/claps
        0.3 * onset_treble +    # Treble - hi-hats (subdivisions)
        0.5 * onset_full        # Full - overall energy
    )
    combined = librosa.util.normalize(combined)
    
    return combined, onset_bass, onset_mid, onset_treble


def estimate_bpm_robust(y, sr, hop_length=512, onset_env=None):
    """
    Estimate BPM using multiple techniques and vote on the best.
    
    Techniques used:
    1. Tempogram with autocorrelation
    2. Librosa beat_track with different parameters
    3. Peak analysis of onset envelope
    
    Returns:
        tuple: (best_bpm, confidence, all_candidates)
    """
    if onset_env is None:
        onset_env, _, _, _ = compute_multiband_onset(y, sr, hop_length)
    
    candidates = []
    
    # Technique 1: Tempogram-based estimation
    # More robust to noise than simple beat tracking
    try:
        tempogram = librosa.feature.tempogram(
            onset_envelope=onset_env, sr=sr, hop_length=hop_length,
            win_length=400  # About 9 seconds window for stability
        )
        
        # Get tempo from tempogram using autocorrelation
        tempo_ac = librosa.feature.tempo(
            onset_envelope=onset_env, sr=sr, hop_length=hop_length,
            aggregate=None  # Get tempo for each frame
        )
        
        # Use median of tempo estimates (robust to outliers)
        if len(tempo_ac) > 0:
            median_tempo = float(np.median(tempo_ac))
            # Calculate stability as inverse of variance
            tempo_std = np.std(tempo_ac)
            stability = 1.0 / (1.0 + tempo_std / 10)
            candidates.append((median_tempo, stability * 0.9, 'tempogram_median'))
            
            # Also try mode (most common tempo)
            tempo_rounded = np.round(tempo_ac / 2) * 2  # Round to nearest 2 BPM
            unique, counts = np.unique(tempo_rounded, return_counts=True)
            mode_tempo = unique[np.argmax(counts)]
            mode_confidence = np.max(counts) / len(tempo_ac)
            candidates.append((float(mode_tempo), mode_confidence * 0.85, 'tempogram_mode'))
    except Exception:
        pass
    
    # Technique 2: Standard beat tracking with multiple start_bpm
    for start_bpm in [90, 120, 140]:
        try:
            tempo, _ = librosa.beat.beat_track(
                onset_envelope=onset_env, sr=sr, hop_length=hop_length,
                start_bpm=start_bpm, tightness=100
            )
            # Score based on how well tempo aligns with onset peaks
            score = score_tempo_alignment(onset_env, sr, tempo, hop_length)
            candidates.append((float(tempo), score * 0.8, f'beat_track_{start_bpm}'))
        except Exception:
            pass
    
    # Technique 3: Autocorrelation of onset envelope
    try:
        # Compute autocorrelation
        onset_ac = np.correlate(onset_env, onset_env, mode='full')
        onset_ac = onset_ac[len(onset_ac)//2:]  # Take positive lags only
        
        # Find peaks in autocorrelation
        # These correspond to periodic patterns in the audio
        frame_rate = sr / hop_length
        
        # Search for BPM in range 60-200
        min_lag = int(frame_rate * 60 / 200)  # Max 200 BPM
        max_lag = int(frame_rate * 60 / 60)   # Min 60 BPM
        
        if max_lag < len(onset_ac) and min_lag < max_lag:
            ac_search = onset_ac[min_lag:max_lag]
            if len(ac_search) > 0:
                peak_lag = np.argmax(ac_search) + min_lag
                ac_bpm = frame_rate * 60 / peak_lag
                # Confidence based on peak prominence
                peak_val = onset_ac[peak_lag]
                baseline = np.median(onset_ac[min_lag:max_lag])
                prominence = (peak_val - baseline) / (peak_val + 1e-6)
                candidates.append((float(ac_bpm), prominence * 0.7, 'autocorrelation'))
    except Exception:
        pass
    
    if not candidates:
        # Fallback to basic beat tracking
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        return float(tempo), 0.5, [(float(tempo), 0.5, 'fallback')]
    
    # Vote on best BPM
    # Group candidates that are similar (within 5%)
    best_bpm, confidence = vote_best_bpm(candidates)
    
    return best_bpm, confidence, candidates


def score_tempo_alignment(onset_env, sr, bpm, hop_length):
    """
    Score how well a tempo aligns with onset envelope peaks.
    
    Places a beat grid at the given BPM and measures how much
    onset energy falls on the beat positions.
    """
    frame_rate = sr / hop_length
    period_frames = frame_rate * 60 / bpm
    
    total_frames = len(onset_env)
    
    # Try multiple phase offsets and take best
    best_score = 0
    n_offsets = int(period_frames)
    
    for offset in range(0, n_offsets, max(1, n_offsets // 20)):
        beat_frames = []
        t = offset
        while t < total_frames:
            beat_frames.append(int(round(t)))
            t += period_frames
        
        if len(beat_frames) > 4:
            # Score: average onset strength at beat positions
            beat_frames = np.array(beat_frames)
            beat_frames = beat_frames[beat_frames < len(onset_env)]
            score = np.mean(onset_env[beat_frames])
            best_score = max(best_score, score)
    
    return best_score


def vote_best_bpm(candidates):
    """
    Vote on the best BPM from multiple candidates.
    
    Groups similar BPMs and chooses the group with highest
    cumulative confidence.
    """
    if not candidates:
        return 120.0, 0.0
    
    # Sort by confidence
    candidates = sorted(candidates, key=lambda x: x[1], reverse=True)
    
    # Group similar BPMs (within 3%)
    groups = []
    for bpm, conf, method in candidates:
        found_group = False
        for group in groups:
            group_bpm = group[0][0]
            # Check if within 3% or is a 2x/0.5x multiple
            if abs(bpm - group_bpm) / group_bpm < 0.03:
                group.append((bpm, conf, method))
                found_group = True
                break
            # Check for octave errors (2x or 0.5x tempo)
            elif abs(bpm * 2 - group_bpm) / group_bpm < 0.03:
                # This candidate is half the tempo - add adjusted
                group.append((bpm * 2, conf * 0.8, method + '_2x'))
                found_group = True
                break
            elif abs(bpm / 2 - group_bpm) / group_bpm < 0.03:
                # This candidate is double the tempo - add adjusted
                group.append((bpm / 2, conf * 0.8, method + '_half'))
                found_group = True
                break
        
        if not found_group:
            groups.append([(bpm, conf, method)])
    
    # Find group with highest cumulative confidence
    best_group = max(groups, key=lambda g: sum(c[1] for c in g))
    
    # Use weighted average of BPMs in best group
    total_weight = sum(c[1] for c in best_group)
    if total_weight > 0:
        best_bpm = sum(c[0] * c[1] for c in best_group) / total_weight
        confidence = min(1.0, total_weight / len(candidates))
    else:
        best_bpm = best_group[0][0]
        confidence = 0.5
    
    return best_bpm, confidence


def detect_beats_plp(onset_env, sr, hop_length=512, bpm_hint=None):
    """
    Detect beats using PLP (Predominant Local Pulse).
    
    PLP is more robust than simple beat tracking because it
    follows the local pulse and can handle tempo variations.
    
    Args:
        onset_env: Onset envelope
        sr: Sample rate
        hop_length: Hop length
        bpm_hint: Optional BPM hint to guide detection
        
    Returns:
        numpy array of beat times in seconds
    """
    # Compute PLP (predominant local pulse)
    pulse = librosa.beat.plp(
        onset_envelope=onset_env, sr=sr, hop_length=hop_length
    )
    
    # Peak picking to find beats
    # Adjust parameters based on expected BPM
    if bpm_hint:
        # Expected interval between beats in frames
        expected_interval = (sr / hop_length) * 60 / bpm_hint
        wait = max(3, int(expected_interval * 0.4))  # Min 40% of beat interval
    else:
        wait = 4
    
    peaks = librosa.util.peak_pick(
        pulse,
        pre_max=3, post_max=3,
        pre_avg=4, post_avg=4,
        delta=0.02,
        wait=wait
    )
    
    beat_times = librosa.frames_to_time(peaks, sr=sr, hop_length=hop_length)
    
    # Remove beats that are too close together (likely noise)
    if len(beat_times) >= 2:
        ibi = np.diff(beat_times)
        if len(ibi) > 0:
            median_ibi = np.median(ibi)
            # Keep beats that are at least 35% of median interval apart
            keep = [True]
            for d in ibi:
                # Min 180ms between beats (max ~333 BPM) or 35% of median
                keep.append(d > max(0.18, 0.35 * median_ibi))
            beat_times = beat_times[np.array(keep, dtype=bool)]
    
    return beat_times


def refine_beat_times(beat_times, onset_env, sr, hop_length, bpm):
    """
    Refine beat times by snapping them to nearby onset peaks.
    
    This helps align beats more precisely with the actual
    musical events.
    """
    if len(beat_times) < 2:
        return beat_times
    
    frame_rate = sr / hop_length
    refined = []
    
    # Search window: +/- 10% of beat interval
    period_sec = 60.0 / bpm
    window_sec = period_sec * 0.1
    window_frames = int(window_sec * frame_rate)
    
    for t in beat_times:
        frame = int(t * frame_rate)
        
        # Search window around expected beat
        start = max(0, frame - window_frames)
        end = min(len(onset_env) - 1, frame + window_frames)
        
        if start < end:
            # Find peak in window
            window = onset_env[start:end+1]
            peak_offset = np.argmax(window)
            refined_frame = start + peak_offset
            refined_time = refined_frame / frame_rate
            refined.append(refined_time)
        else:
            refined.append(t)
    
    return np.array(refined)


def detect_beats_and_bpm(audio_path, video_duration=None):
    """
    Detect beats and estimate BPM from audio file.
    
    Uses a robust multi-technique approach optimized for
    low-quality audio from dance videos:
    
    1. Audio preprocessing (normalization, compression)
    2. Multi-band onset detection
    3. BPM estimation via tempogram + voting
    4. Beat detection via PLP
    5. Beat refinement by snapping to onsets
    
    Args:
        audio_path: Path to the audio file
        video_duration: Optional video duration to validate beat timestamps
        
    Returns:
        dict with:
            - bpm: Estimated BPM (float)
            - beat_timestamps: List of beat timestamps in seconds (list of floats)
            - confidence: Confidence score of the detection (float, 0-1)
    """
    try:
        # Load audio file
        print(f"Loading audio from {audio_path}...")
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        hop_length = 512
        
        print(f"Audio loaded: duration={len(y)/sr:.2f}s, sample_rate={sr}")
        
        # Step 1: Preprocess audio for better detection
        print("Preprocessing audio...")
        y = preprocess_audio(y, sr)
        
        # Step 2: Compute multi-band onset envelope
        print("Computing multi-band onset envelope...")
        onset_env, onset_bass, onset_mid, onset_treble = compute_multiband_onset(
            y, sr, hop_length
        )
        
        # Step 3: Estimate BPM using multiple techniques
        print("Estimating BPM with robust multi-technique approach...")
        bpm, bpm_confidence, candidates = estimate_bpm_robust(
            y, sr, hop_length, onset_env
        )
        print(f"BPM candidates: {[(round(c[0], 1), c[2]) for c in candidates[:5]]}")
        print(f"Selected BPM: {bpm:.2f} (confidence: {bpm_confidence:.2f})")
        
        # Step 4: Detect beats using PLP
        print("Detecting beats with PLP...")
        beat_times = detect_beats_plp(onset_env, sr, hop_length, bpm_hint=bpm)
        
        # Step 5: Refine beat times
        print("Refining beat positions...")
        beat_times = refine_beat_times(beat_times, onset_env, sr, hop_length, bpm)
        
        print(f"Detected {len(beat_times)} beats")
        
        # Calculate overall confidence
        beat_confidence = calculate_beat_confidence(beat_times, bpm)
        overall_confidence = (bpm_confidence + beat_confidence) / 2
        
        # Filter beats if video_duration is provided
        if video_duration:
            beat_times = beat_times[beat_times <= video_duration]
        
        return {
            'bpm': float(bpm),
            'beat_timestamps': beat_times.tolist(),
            'confidence': overall_confidence,
            'total_beats': len(beat_times),
            'bpm_confidence': bpm_confidence,
            'beat_confidence': beat_confidence
        }
        
    except Exception as e:
        raise Exception(f'Failed to detect beats: {str(e)}')


def calculate_beat_confidence(beat_times, tempo):
    """
    Calculate confidence score based on beat consistency.
    
    A good beat detection should have relatively consistent intervals
    between beats. This function calculates the coefficient of variation
    (std/mean) of beat intervals and converts it to a confidence score.
    
    Args:
        beat_times: Array of beat timestamps
        tempo: Detected tempo in BPM
        
    Returns:
        Confidence score between 0 and 1
    """
    if len(beat_times) < 2:
        return 0.0
    
    # Calculate intervals between consecutive beats
    intervals = np.diff(beat_times)
    
    if len(intervals) == 0:
        return 0.0
    
    # Calculate coefficient of variation (lower is better)
    mean_interval = np.mean(intervals)
    std_interval = np.std(intervals)
    
    if mean_interval == 0:
        return 0.0
    
    cv = std_interval / mean_interval
    
    # Convert to confidence score (0-1)
    # cv of 0 = perfect (confidence 1.0)
    # cv of 0.5 or higher = poor (confidence approaches 0)
    confidence = max(0.0, min(1.0, 1.0 - (cv * 2)))
    
    return confidence


def analyze_video_audio(video_path):
    """
    Complete audio analysis pipeline for a video file.
    
    This is the main entry point that:
    1. Extracts audio from video
    2. Detects beats and estimates BPM
    3. Cleans up temporary files
    
    Args:
        video_path: Path to the video file
        
    Returns:
        dict with analysis results (bpm, beat_timestamps, confidence)
    """
    audio_path = None
    
    try:
        # Extract audio
        print(f"Extracting audio from {video_path}...")
        audio_path = extract_audio_from_video(video_path)
        
        # Analyze audio
        print("Analyzing audio for beats and BPM...")
        results = detect_beats_and_bpm(audio_path)
        
        print(f"Analysis complete: BPM={results['bpm']:.2f}, "
              f"Beats={results['total_beats']}, "
              f"Confidence={results['confidence']:.2f}")
        
        return results
        
    finally:
        # Clean up temporary audio file
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
                print(f"Cleaned up temporary audio file: {audio_path}")
            except Exception as e:
                print(f"Warning: Could not remove temporary file {audio_path}: {e}")


def refine_beat_detection(audio_path, initial_bpm, beat_timestamps):
    """
    Refine beat detection using the initial BPM estimate.
    
    This can be used to improve beat detection by using the estimated BPM
    as a prior for a second pass of beat tracking.
    
    Args:
        audio_path: Path to the audio file
        initial_bpm: Initial BPM estimate
        beat_timestamps: Initial beat timestamps
        
    Returns:
        dict with refined results
    """
    try:
        # Load audio
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        
        # Second pass with tighter constraints
        tempo, beat_frames = librosa.beat.beat_track(
            y=y,
            sr=sr,
            units='frames',
            start_bpm=initial_bpm,
            tightness=200  # Stricter adherence to tempo
        )
        
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        confidence = calculate_beat_confidence(beat_times, tempo)
        
        return {
            'bpm': float(tempo),
            'beat_timestamps': beat_times.tolist(),
            'confidence': confidence,
            'total_beats': len(beat_times)
        }
        
    except Exception as e:
        raise Exception(f'Failed to refine beat detection: {str(e)}')


# ---------------------------
# Forró-style beat detection (from forro_bpm_manual.py)
# ---------------------------

def bandpass_filter(y, sr, low=30, high=250, order=4):
    """Apply bandpass filter to isolate bass frequencies."""
    nyq = 0.5 * sr
    low_norm = low / nyq
    high_norm = high / nyq
    sos = butter(order, [low_norm, high_norm], btype="bandpass", output="sos")
    return sosfiltfilt(sos, y)


def compute_onset_env_forro(y, sr, hop_length=512):
    """
    Compute onset envelope optimized for forró/brazilian music.
    Emphasizes bass frequencies where the zabumba hits.
    """
    y = y - np.mean(y)
    y = librosa.util.normalize(y)

    # Separate harmonic and percussive components
    _, y_perc = librosa.effects.hpss(y)
    
    # Filter to bass frequencies (zabumba range)
    y_low = bandpass_filter(y_perc, sr, low=30, high=250)

    # Onset strength from bass
    onset_low = librosa.onset.onset_strength(
        y=y_low, sr=sr, hop_length=hop_length,
        n_fft=1024, n_mels=32
    )
    
    # Onset strength from all percussive
    onset_all = librosa.onset.onset_strength(
        y=y_perc, sr=sr, hop_length=hop_length,
        n_fft=1024, n_mels=64
    )

    # Combine with emphasis on bass
    onset_env = librosa.util.normalize(onset_low) + 0.6 * librosa.util.normalize(onset_all)
    onset_env = librosa.util.normalize(onset_env)
    return onset_env


def score_beats(onset_env, beat_frames, weights=None):
    """Score a set of beat frames based on onset envelope values."""
    beat_frames = np.array(beat_frames, dtype=int)
    beat_frames = beat_frames[(beat_frames >= 0) & (beat_frames < len(onset_env))]
    if len(beat_frames) == 0:
        return -1e9

    vals = onset_env[beat_frames]
    if weights is None or len(weights) != len(vals):
        return float(np.mean(vals))
    return float(np.sum(vals * weights) / (np.sum(weights) + 1e-9))


def find_best_downbeat_offset(onset_env, sr, bpm, beats_per_bar=4, hop_length=512, search_seconds=25):
    """
    Find the best downbeat (first beat of measure) offset.
    
    Args:
        onset_env: Onset envelope array
        sr: Sample rate
        bpm: Beats per minute
        beats_per_bar: Number of beats per bar (e.g., 4 for 4/4 time)
        hop_length: Hop length used for onset envelope
        search_seconds: How many seconds to search for the best offset
        
    Returns:
        tuple: (downbeat_time, beat_times_array)
    """
    frame_rate = sr / hop_length
    period_sec = 60.0 / float(bpm)
    period_frames = period_sec * frame_rate

    max_frames = len(onset_env)
    search_frames = int(min(max_frames, search_seconds * frame_rate))

    step = max(1, int(round(period_frames / 24)))  # ~1/24 of a beat
    best = None

    for offset in range(0, int(period_frames), step):
        beats = []
        t = offset
        while t < search_frames:
            beats.append(int(round(t)))
            t += period_frames

        if len(beats) < beats_per_bar * 3:
            continue

        # Score downbeats (first beat of each bar)
        downbeats = beats[::beats_per_bar]
        s = score_beats(onset_env, downbeats, weights=np.ones(len(downbeats), dtype=float))
        mid = score_beats(onset_env, beats)
        final = s + 0.35 * mid

        if (best is None) or (final > best["final"]):
            best = {"offset_frames": offset, "final": final}

    if best is None:
        # Fallback: start at 0
        return 0.0, np.arange(0, len(onset_env) / frame_rate, period_sec)

    offset_frames = best["offset_frames"]
    downbeat_time = float(offset_frames / frame_rate)

    total_sec = len(onset_env) / frame_rate
    beat_times = np.arange(downbeat_time, total_sec, period_sec, dtype=float)

    return downbeat_time, beat_times


def estimate_downbeat_offset(beat_times, onset_env, sr, hop_length, beats_per_bar=4, analyze_first_seconds=30):
    """
    Estimate which beat in the sequence is the downbeat (beat 1).
    
    Analyzes onset strength patterns to find where measures start.
    In most music, downbeats (beat 1) tend to be stronger/more emphasized.
    
    Args:
        beat_times: Array of beat timestamps
        onset_env: Onset envelope
        sr: Sample rate
        hop_length: Hop length
        beats_per_bar: Beats per measure
        analyze_first_seconds: How many seconds to analyze
        
    Returns:
        int: Offset index (0 to beats_per_bar-1) indicating which beat is "1"
    """
    if len(beat_times) < beats_per_bar * 6:
        return 0
    
    frame_rate = sr / hop_length
    
    # Only analyze first N seconds for efficiency
    cutoff_time = analyze_first_seconds
    analysis_beats = beat_times[beat_times < cutoff_time]
    
    if len(analysis_beats) < beats_per_bar * 4:
        analysis_beats = beat_times[:beats_per_bar * 8]
    
    best_offset = 0
    best_score = -np.inf
    
    for offset in range(beats_per_bar):
        # Get downbeats for this offset
        downbeat_indices = list(range(offset, len(analysis_beats), beats_per_bar))
        if len(downbeat_indices) < 3:
            continue
        
        downbeat_times = analysis_beats[downbeat_indices]
        
        # Convert to frames and get onset values
        downbeat_frames = (downbeat_times * frame_rate).astype(int)
        downbeat_frames = downbeat_frames[
            (downbeat_frames >= 0) & (downbeat_frames < len(onset_env))
        ]
        
        if len(downbeat_frames) == 0:
            continue
        
        # Score: average onset strength at downbeat positions
        # Weight earlier downbeats more (music usually starts clearer)
        weights = np.exp(-np.arange(len(downbeat_frames)) * 0.1)
        onset_vals = onset_env[downbeat_frames]
        score = np.sum(onset_vals * weights) / np.sum(weights)
        
        if score > best_score:
            best_score = score
            best_offset = offset
    
    return best_offset


def analyze_video_with_downbeat(video_path, bpm=None, beats_per_bar=4, search_seconds=25):
    """
    Complete audio analysis with downbeat detection.
    
    This function uses robust multi-technique beat detection:
    1. Extracts and preprocesses audio
    2. Computes multi-band onset envelope
    3. Detects BPM via tempogram + voting (if not provided)
    4. Detects beats via PLP
    5. Finds the first downbeat (strong beat)
    6. Returns timing information for counter overlay
    
    Args:
        video_path: Path to the video file
        bpm: Optional BPM (if None, will be auto-detected)
        beats_per_bar: Number of beats per bar (default 4)
        search_seconds: How many seconds to search for downbeat
        
    Returns:
        dict with:
            - bpm: BPM value
            - offset_start: Time of first downbeat in seconds
            - beat_timestamps: List of all beat times
            - beats_per_bar: Beats per bar used
            - confidence: Detection confidence
    """
    audio_path = None
    
    try:
        # Extract audio
        print(f"Extracting audio from {video_path}...")
        audio_path = extract_audio_from_video(video_path)
        
        # Load audio
        print("Loading and preprocessing audio...")
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        hop_length = 512
        
        # Preprocess for better detection
        y = preprocess_audio(y, sr)
        
        # Compute multi-band onset envelope
        print("Computing multi-band onset envelope...")
        onset_env, onset_bass, _, _ = compute_multiband_onset(y, sr, hop_length)
        
        # Also compute forró-optimized onset (emphasizes zabumba)
        onset_forro = compute_onset_env_forro(y, sr, hop_length)
        
        # Combine both for best results
        onset_combined = librosa.util.normalize(
            0.6 * onset_env + 0.4 * onset_forro
        )
        
        # Auto-detect BPM if not provided
        bpm_confidence = 1.0
        if bpm is None:
            print("Auto-detecting BPM with robust multi-technique approach...")
            bpm, bpm_confidence, candidates = estimate_bpm_robust(
                y, sr, hop_length, onset_combined
            )
            print(f"Detected BPM: {bpm:.2f} (confidence: {bpm_confidence:.2f})")
            if candidates:
                print(f"Top candidates: {[(round(c[0], 1), c[2]) for c in candidates[:3]]}")
        
        # Detect beats using PLP
        print("Detecting beats with PLP...")
        beat_times = detect_beats_plp(onset_combined, sr, hop_length, bpm_hint=bpm)
        
        # Refine beat times
        beat_times = refine_beat_times(beat_times, onset_combined, sr, hop_length, bpm)
        
        if len(beat_times) < beats_per_bar * 3:
            # Fallback: generate beats from BPM
            print("Few beats detected, using BPM-based grid...")
            duration = len(y) / sr
            period = 60.0 / bpm
            beat_times = np.arange(0, duration, period)
        
        # Find downbeat offset
        print("Finding first downbeat...")
        offset_idx = estimate_downbeat_offset(
            beat_times, onset_combined, sr, hop_length,
            beats_per_bar=beats_per_bar,
            analyze_first_seconds=search_seconds
        )
        
        # Get first downbeat time
        if offset_idx < len(beat_times):
            downbeat_time = float(beat_times[offset_idx])
        else:
            downbeat_time = float(beat_times[0]) if len(beat_times) > 0 else 0.0
        
        # Recompute beat grid starting from downbeat
        # This ensures beats are properly aligned
        duration = len(y) / sr
        period = 60.0 / bpm
        
        # Generate aligned beat times
        aligned_beats = []
        t = downbeat_time
        while t < duration:
            aligned_beats.append(t)
            t += period
        
        # Also go backwards if downbeat isn't at start
        t = downbeat_time - period
        while t >= 0:
            aligned_beats.insert(0, t)
            t -= period
        
        beat_times = np.array(aligned_beats)
        beat_times = beat_times[beat_times >= 0]
        
        # Calculate beat confidence
        beat_confidence = calculate_beat_confidence(beat_times, bpm)
        overall_confidence = (bpm_confidence + beat_confidence) / 2
        
        print(f"First downbeat at: {downbeat_time:.3f}s")
        print(f"Total beats: {len(beat_times)}")
        print(f"Overall confidence: {overall_confidence:.2f}")
        
        return {
            'bpm': float(bpm),
            'offset_start': float(downbeat_time),
            'beat_timestamps': beat_times.tolist(),
            'beats_per_bar': beats_per_bar,
            'time_signature_numerator': beats_per_bar,
            'time_signature_denominator': 4,
            'confidence': overall_confidence,
            'bpm_confidence': bpm_confidence,
            'beat_confidence': beat_confidence
        }
        
    finally:
        # Clean up temporary audio file
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except Exception as e:
                print(f"Warning: Could not remove temporary file {audio_path}: {e}")


def generate_waveform_data(video_path, num_samples=1000):
    """
    Generate waveform visualization data from video audio.
    Returns both positive and negative amplitude values for proper waveform display.
    
    Args:
        video_path: Path to the video file
        num_samples: Number of samples to return for visualization (default 1000 for smooth waveform)
        
    Returns:
        list of amplitude values (-1 to 1) representing the waveform
    """
    audio_path = None
    
    try:
        # Extract audio
        audio_path = extract_audio_from_video(video_path)
        
        # Load audio
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        
        # Downsample to num_samples points
        samples_per_point = len(y) // num_samples
        if samples_per_point < 1:
            samples_per_point = 1
            
        waveform = []
        for i in range(num_samples):
            start = i * samples_per_point
            end = min(start + samples_per_point, len(y))
            if start < len(y):
                # Use RMS (root mean square) for each segment to get amplitude
                segment = y[start:end]
                rms = np.sqrt(np.mean(segment ** 2))
                waveform.append(float(rms))
            else:
                waveform.append(0.0)
        
        # Normalize to -1 to 1 range
        max_val = max(waveform) if waveform else 1.0
        if max_val > 0:
            waveform = [v / max_val for v in waveform]
        
        # Create mirrored waveform (positive and negative) for proper visualization
        # This creates the classic waveform look with top and bottom
        mirrored_waveform = []
        for amp in waveform:
            mirrored_waveform.append(amp)      # Top half
            mirrored_waveform.append(-amp)     # Bottom half (mirrored)
            
        return mirrored_waveform
        
    finally:
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except Exception:
                pass
