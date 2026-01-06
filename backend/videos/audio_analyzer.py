"""
Audio analysis utilities for beat detection and BPM estimation.

This module extracts audio from video files and analyzes it to detect
beats and estimate BPM using librosa.
"""
import os
import tempfile
import subprocess
import numpy as np
import librosa
import librosa.display
from scipy.signal import butter, sosfiltfilt


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


def detect_beats_and_bpm(audio_path, video_duration=None):
    """
    Detect beats and estimate BPM from audio file.
    
    Uses librosa's beat tracking algorithm which analyzes the onset strength
    envelope to find rhythmic patterns.
    
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
        
        print(f"Audio loaded: duration={len(y)/sr:.2f}s, sample_rate={sr}")
        
        # Detect tempo and beats
        # onset_envelope: measure of note onsets (sudden increases in energy)
        # aggregate: use median for more robust tempo estimation
        print("Detecting tempo and beats...")
        tempo, beat_frames = librosa.beat.beat_track(
            y=y,
            sr=sr,
            units='frames',
            start_bpm=120.0,  # Initial guess
            tightness=100  # How closely to follow the tempo (higher = stricter)
        )
        
        # Convert beat frames to timestamps
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        
        print(f"Detected tempo: {tempo:.2f} BPM")
        print(f"Detected {len(beat_times)} beats")
        
        # Calculate confidence based on beat consistency
        confidence = calculate_beat_confidence(beat_times, tempo)
        
        # Filter beats if video_duration is provided
        if video_duration:
            beat_times = [t for t in beat_times if t <= video_duration]
        
        return {
            'bpm': float(tempo),
            'beat_timestamps': beat_times.tolist(),
            'confidence': confidence,
            'total_beats': len(beat_times)
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


def analyze_video_with_downbeat(video_path, bpm=None, beats_per_bar=4, search_seconds=25):
    """
    Complete audio analysis with downbeat detection.
    
    This function:
    1. Extracts audio from video
    2. Detects BPM if not provided
    3. Finds the first downbeat (strong beat)
    4. Returns timing information for counter overlay
    
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
    """
    audio_path = None
    
    try:
        # Extract audio
        print(f"Extracting audio from {video_path}...")
        audio_path = extract_audio_from_video(video_path)
        
        # Load audio
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        hop_length = 512
        
        # Auto-detect BPM if not provided
        if bpm is None:
            print("Auto-detecting BPM...")
            tempo, _ = librosa.beat.beat_track(
                y=y, sr=sr, units='frames', start_bpm=120.0, tightness=100
            )
            bpm = float(tempo)
            print(f"Detected BPM: {bpm:.2f}")
        
        # Compute onset envelope optimized for forró/brazilian music
        print("Computing onset envelope...")
        onset_env = compute_onset_env_forro(y, sr, hop_length=hop_length)
        
        # Find best downbeat offset
        print("Finding first downbeat...")
        downbeat_time, beat_times = find_best_downbeat_offset(
            onset_env, sr, bpm,
            beats_per_bar=beats_per_bar,
            hop_length=hop_length,
            search_seconds=search_seconds
        )
        
        print(f"First downbeat at: {downbeat_time:.3f}s")
        print(f"Total beats: {len(beat_times)}")
        
        return {
            'bpm': float(bpm),
            'offset_start': float(downbeat_time),
            'beat_timestamps': beat_times.tolist(),
            'beats_per_bar': beats_per_bar,
            'time_signature_numerator': beats_per_bar,
            'time_signature_denominator': 4
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
